use crate::provider::Provider;
use crate::store::AppState;
use axum::{
    body::{Body, Bytes},
    extract::State,
    http::{
        header::{AUTHORIZATION, CONNECTION, CONTENT_LENGTH, HOST, PROXY_AUTHENTICATE, PROXY_AUTHORIZATION, TE, TRAILER, TRANSFER_ENCODING, UPGRADE},
        HeaderMap, Method, StatusCode, Uri,
    },
    response::{IntoResponse, Response},
    routing::any,
    Json,
    Router,
};
use futures_util::TryStreamExt;
use reqwest::Url;
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::{oneshot, RwLock};

#[derive(Clone)]
struct GatewayServerState {
    app_handle: tauri::AppHandle,
    client: reqwest::Client,
    route_state: Arc<RwLock<RouteState>>,
}

#[derive(Debug, Clone)]
struct RouteState {
    enabled: bool,
    provider_id: String,
    provider_name: String,
    target_base_url: String,
    upstream_auth: UpstreamAuth,
    available_models: Vec<GatewayModel>,
    models: Vec<GatewayModel>,
    model_routes: std::collections::HashMap<String, GatewayModelRoute>,
}

#[derive(Debug, Clone, Default)]
struct UpstreamAuth {
    strategies: Vec<GatewayAuthStrategy>,
}

#[derive(Debug, Clone)]
struct GatewayModel {
    id: String,
    upstream_model: String,
    display_name: String,
}

#[derive(Debug, Clone)]
struct GatewayModelRoute {
    provider_id: String,
    provider_name: String,
    target_base_url: String,
    upstream_model: String,
    upstream_auth: UpstreamAuth,
}

#[derive(Debug, Clone)]
struct GatewayAuthHeader {
    name: String,
    value: String,
}

#[derive(Debug, Clone)]
struct GatewayAuthQueryParam {
    name: String,
    value: String,
}

#[derive(Debug, Clone)]
enum GatewayAuthStrategy {
    Header(GatewayAuthHeader),
    Query(GatewayAuthQueryParam),
}

#[derive(Default)]
pub struct ApiGatewayRuntime {
    server_handle: Option<tauri::async_runtime::JoinHandle<()>>,
    shutdown_tx: Option<oneshot::Sender<()>>,
    route_state: Option<Arc<RwLock<RouteState>>>,
}

#[derive(Debug, Clone)]
struct ProviderRouteConfig {
    provider_id: String,
    provider_name: String,
    target_base_url: String,
    upstream_auth: UpstreamAuth,
    models: Vec<GatewayModel>,
}

pub fn gateway_base_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}")
}

pub fn provider_target_base_url(provider: &Provider) -> Result<String, String> {
    let base_url = provider
        .settings_config
        .get("env")
        .and_then(|env| env.get("ANTHROPIC_BASE_URL"))
        .and_then(|value| value.as_str())
        .unwrap_or("https://api.anthropic.com");

    let normalized = base_url.trim_end_matches('/');
    if normalized.is_empty() {
        return Err("供应商缺少有效的 ANTHROPIC_BASE_URL 配置".to_string());
    }

    Ok(normalized.to_string())
}

fn configured_provider_models(provider: &Provider) -> Vec<GatewayModel> {
    let env = provider
        .settings_config
        .get("env")
        .and_then(|value| value.as_object());

    let configured = [
        ("default", "ANTHROPIC_MODEL", "Default"),
        ("sonnet", "ANTHROPIC_DEFAULT_SONNET_MODEL", "Sonnet"),
        ("opus", "ANTHROPIC_DEFAULT_OPUS_MODEL", "Opus"),
        ("haiku", "ANTHROPIC_DEFAULT_HAIKU_MODEL", "Haiku"),
        ("fast", "ANTHROPIC_SMALL_FAST_MODEL", "Fast"),
    ];

    let mut models = Vec::new();
    let mut seen_upstream = std::collections::HashSet::new();

    for (suffix, key, label) in configured {
        let Some(upstream_model) = env
            .and_then(|values| values.get(key))
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
        else {
            continue;
        };

        if !seen_upstream.insert(upstream_model.to_string()) {
            continue;
        }

        let id = format!("claude-{}:{}", provider.id, suffix);
        let display_name = if label == "Default" {
            provider.name.clone()
        } else {
            format!("{} · {}", provider.name, label)
        };

        models.push(GatewayModel {
            id,
            upstream_model: upstream_model.to_string(),
            display_name,
        });
    }

    if models.is_empty() {
        let fallback = "claude-sonnet-4-6".to_string();
        models.push(GatewayModel {
            id: format!("claude-{}:default", provider.id),
            upstream_model: fallback,
            display_name: provider.name.clone(),
        });
    }

    models
}

fn read_env_value(provider: &Provider, key: &str) -> Option<String> {
    provider
        .settings_config
        .get("env")
        .and_then(|value| value.as_object())
        .and_then(|values| values.get(key))
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn resolve_auth_value(provider: &Provider, entry: &Value) -> Option<String> {
    let value = entry
        .get("value")
        .and_then(|item| item.as_str())
        .map(str::to_string);
    let env_var = entry
        .get("envVar")
        .and_then(|item| item.as_str())
        .map(str::trim);

    match (value, env_var) {
        (Some(value), _) if !value.trim().is_empty() => Some(value),
        (_, Some(env_var)) if !env_var.is_empty() => read_env_value(provider, env_var),
        _ => None,
    }
}

fn configured_upstream_auth(provider: &Provider) -> UpstreamAuth {
    let mut strategies = configured_custom_auth_strategies(provider);
    if !strategies.is_empty() {
        return UpstreamAuth { strategies };
    }

    let target_base_url = provider_target_base_url(provider).unwrap_or_default();
    let is_official_anthropic = target_base_url.contains("api.anthropic.com");
    let is_minimax = target_base_url.contains("api.minimaxi.com");

    if let Some(api_key) = read_env_value(provider, "ANTHROPIC_API_KEY") {
        strategies.push(GatewayAuthStrategy::Header(GatewayAuthHeader {
            name: AUTHORIZATION.as_str().to_string(),
            value: format!("Bearer {api_key}"),
        }));
        if !is_minimax {
            strategies.push(GatewayAuthStrategy::Header(GatewayAuthHeader {
                name: "x-api-key".to_string(),
                value: api_key,
            }));
        }
    } else if let Some(auth_token) = read_env_value(provider, "ANTHROPIC_AUTH_TOKEN") {
        strategies.push(GatewayAuthStrategy::Header(GatewayAuthHeader {
            name: AUTHORIZATION.as_str().to_string(),
            value: format!("Bearer {auth_token}"),
        }));
        if !is_official_anthropic && !is_minimax {
            strategies.push(GatewayAuthStrategy::Header(GatewayAuthHeader {
                name: "x-api-key".to_string(),
                value: auth_token,
            }));
        }
    }

    UpstreamAuth { strategies }
}

fn configured_custom_auth_strategies(provider: &Provider) -> Vec<GatewayAuthStrategy> {
    let api_gateway = provider.settings_config.get("apiGateway");
    let mut strategies = api_gateway
        .and_then(|value| value.get("auth"))
        .and_then(|value| value.as_array())
        .map(|entries| {
            entries
                .iter()
                .filter_map(|entry| {
                    let strategy_type = entry
                        .get("type")
                        .and_then(|item| item.as_str())
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                        .unwrap_or("header");
                    let name = entry.get("name")?.as_str()?.trim();
                    if name.is_empty() {
                        return None;
                    }

                    let value = resolve_auth_value(provider, entry)?;

                    match strategy_type {
                        "header" => Some(GatewayAuthStrategy::Header(GatewayAuthHeader {
                            name: name.to_string(),
                            value,
                        })),
                        "query" => Some(GatewayAuthStrategy::Query(GatewayAuthQueryParam {
                            name: name.to_string(),
                            value,
                        })),
                        _ => None,
                    }
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let legacy_header_strategies = api_gateway
        .and_then(|value| value.get("authHeaders"))
        .and_then(|value| value.as_array())
        .map(|headers| {
            headers
                .iter()
                .filter_map(|entry| {
                    let name = entry.get("name")?.as_str()?.trim();
                    if name.is_empty() {
                        return None;
                    }

                    let value = resolve_auth_value(provider, entry)?;
                    Some(GatewayAuthStrategy::Header(GatewayAuthHeader {
                        name: name.to_string(),
                        value,
                    }))
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    strategies.extend(legacy_header_strategies);
    strategies
}

fn build_provider_route_config(provider: &Provider) -> Result<ProviderRouteConfig, String> {
    Ok(ProviderRouteConfig {
        provider_id: provider.id.clone(),
        provider_name: provider.name.clone(),
        target_base_url: provider_target_base_url(provider)?,
        upstream_auth: configured_upstream_auth(provider),
        models: configured_provider_models(provider),
    })
}

fn build_model_routes(
    providers: &[ProviderRouteConfig],
) -> std::collections::HashMap<String, GatewayModelRoute> {
    providers
        .iter()
        .flat_map(|provider| {
            provider.models.iter().map(|model| {
                (
                    model.id.clone(),
                    GatewayModelRoute {
                        provider_id: provider.provider_id.clone(),
                        provider_name: provider.provider_name.clone(),
                        target_base_url: provider.target_base_url.clone(),
                        upstream_model: model.upstream_model.clone(),
                        upstream_auth: provider.upstream_auth.clone(),
                    },
                )
            })
        })
        .collect()
}

fn collect_route_configs(state: &AppState) -> Result<Vec<ProviderRouteConfig>, String> {
    let config = state
        .config
        .lock()
        .map_err(|e| format!("获取锁失败: {}", e))?;

    config
        .providers
        .values()
        .map(build_provider_route_config)
        .collect()
}

fn build_models_response(state: &RouteState) -> Value {
    json!({
        "data": state.available_models.iter().map(|model| {
            json!({
                "id": model.id,
                "type": "model",
                "display_name": model.display_name,
                "created_at": chrono::Utc::now().to_rfc3339(),
            })
        }).collect::<Vec<_>>()
    })
}

fn rewrite_model_aliases(body: Bytes, model_routes: &std::collections::HashMap<String, GatewayModelRoute>) -> Bytes {
    let Ok(mut json_body) = serde_json::from_slice::<Value>(&body) else {
        return body;
    };

    let Some(model) = json_body.get_mut("model") else {
        return body;
    };

    let Some(model_id) = model.as_str() else {
        return body;
    };

    let Some(route) = model_routes.get(model_id) else {
        return body;
    };

    *model = Value::String(route.upstream_model.clone());

    serde_json::to_vec(&json_body)
        .map(Bytes::from)
        .unwrap_or(body)
}

fn extract_request_model(body: &Bytes) -> Option<String> {
    serde_json::from_slice::<Value>(body)
        .ok()
        .and_then(|json_body| json_body.get("model").and_then(|value| value.as_str()).map(str::to_string))
}

#[cfg(test)]
pub fn build_gateway_provider_config(provider: &Provider, all_providers: &[Provider], port: u16) -> serde_json::Value {
    let mut provider_config = provider.settings_config.clone();
    let models = all_providers
        .iter()
        .flat_map(configured_provider_models)
        .collect::<Vec<_>>();
    let default_model_id = models
        .iter()
        .find(|model| model.id.starts_with(&format!("claude-{}:", provider.id)))
        .or_else(|| models.first())
        .map(|model| model.id.clone())
        .unwrap_or_else(|| format!("claude-{}:default", provider.id));

    let provider_prefix = format!("claude-{}:", provider.id);
    let model_id_for_suffix = |suffix: &str| {
        models
            .iter()
            .find(|model| model.id.starts_with(&provider_prefix) && model.id.ends_with(&format!(":{suffix}")))
            .map(|model| model.id.clone())
            .unwrap_or_else(|| default_model_id.clone())
    };

    let env = provider_config
        .as_object_mut()
        .and_then(|config| config.get_mut("env"))
        .and_then(|env| env.as_object_mut());

    if let Some(env) = env {
        env.insert(
            "ANTHROPIC_BASE_URL".to_string(),
            serde_json::Value::String(gateway_base_url(port)),
        );
        env.insert(
            "ANTHROPIC_MODEL".to_string(),
            serde_json::Value::String(default_model_id.clone()),
        );
        env.insert(
            "ANTHROPIC_DEFAULT_SONNET_MODEL".to_string(),
            serde_json::Value::String(model_id_for_suffix("sonnet")),
        );
        env.insert(
            "ANTHROPIC_DEFAULT_OPUS_MODEL".to_string(),
            serde_json::Value::String(model_id_for_suffix("opus")),
        );
        env.insert(
            "ANTHROPIC_DEFAULT_HAIKU_MODEL".to_string(),
            serde_json::Value::String(model_id_for_suffix("haiku")),
        );
        env.insert(
            "ANTHROPIC_SMALL_FAST_MODEL".to_string(),
            serde_json::Value::String(model_id_for_suffix("fast")),
        );
    }

    provider_config
}

pub fn is_running(state: &AppState) -> Result<bool, String> {
    let runtime = state
        .api_gateway_runtime
        .lock()
        .map_err(|e| format!("获取 API Gateway 运行时锁失败: {}", e))?;
    Ok(runtime.server_handle.is_some())
}

fn emit_log(app_handle: &tauri::AppHandle, level: &str, message: impl Into<String>) {
    let message = message.into();
    let payload = json!({
        "timestamp": chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        "level": level,
        "message": message,
    });

    let _ = app_handle.emit("api-gateway-log", payload);
}

pub async fn start_or_update(state: &AppState, provider: &Provider, port: u16) -> Result<(), String> {
    let route_configs = collect_route_configs(state)?;
    let current_route = route_configs
        .iter()
        .find(|item| item.provider_id == provider.id)
        .cloned()
        .ok_or_else(|| format!("未找到供应商 {} 的 Gateway 路由配置", provider.id))?;
    let available_models = route_configs
        .iter()
        .flat_map(|item| item.models.clone())
        .collect::<Vec<_>>();
    let model_routes = build_model_routes(&route_configs);
    let target_base_url = current_route.target_base_url.clone();
    let upstream_auth = current_route.upstream_auth.clone();
    let models = current_route.models.clone();

    let (route_state, should_spawn) = {
        let mut runtime = state
            .api_gateway_runtime
            .lock()
            .map_err(|e| format!("获取 API Gateway 运行时锁失败: {}", e))?;

        let route_state = runtime.route_state.clone().unwrap_or_else(|| {
            let route_state = Arc::new(RwLock::new(RouteState {
                enabled: true,
                provider_id: provider.id.clone(),
                provider_name: provider.name.clone(),
                target_base_url: target_base_url.clone(),
                upstream_auth: upstream_auth.clone(),
                available_models: available_models.clone(),
                models: models.clone(),
                model_routes: model_routes.clone(),
            }));
            runtime.route_state = Some(route_state.clone());
            route_state
        });

        let should_spawn = runtime.server_handle.is_none();
        if should_spawn {
            let app_handle = state.app_handle()?.clone();
            let client = reqwest::Client::builder()
                .build()
                .map_err(|e| format!("初始化 API Gateway HTTP 客户端失败: {}", e))?;
            let server_state = GatewayServerState {
                app_handle,
                client,
                route_state: route_state.clone(),
            };
            let (shutdown_tx, shutdown_rx) = oneshot::channel();
            let server_handle = tauri::async_runtime::spawn(run_server(port, server_state, shutdown_rx));
            runtime.shutdown_tx = Some(shutdown_tx);
            runtime.server_handle = Some(server_handle);
        }

        Ok::<_, String>((route_state, should_spawn))
    }?;

    {
        let mut route = route_state.write().await;
        route.enabled = true;
        route.provider_id = provider.id.clone();
        route.provider_name = provider.name.clone();
        route.target_base_url = target_base_url.clone();
        route.upstream_auth = upstream_auth;
        route.available_models = available_models;
        route.models = models;
        route.model_routes = model_routes;
    }

    if should_spawn {
        let message = format!(
            "API Gateway 已启动，监听 {}，当前上游 {} -> {}",
            gateway_base_url(port),
            provider.name,
            target_base_url
        );
        log::info!("{}", message);
        emit_log(state.app_handle()?, "info", message);
    } else {
        let message = format!("API Gateway 路由已更新: {} -> {}", provider.name, target_base_url);
        log::info!("{}", message);
        emit_log(state.app_handle()?, "info", message);
    }

    Ok(())
}

pub async fn stop(state: &AppState) -> Result<(), String> {
    let (route_state, shutdown_tx, server_handle) = {
        let mut runtime = state
            .api_gateway_runtime
            .lock()
            .map_err(|e| format!("获取 API Gateway 运行时锁失败: {}", e))?;

        (
            runtime.route_state.take(),
            runtime.shutdown_tx.take(),
            runtime.server_handle.take(),
        )
    };

    if let Some(route_state) = route_state {
        route_state.write().await.enabled = false;
    }

    if let Some(shutdown_tx) = shutdown_tx {
        let _ = shutdown_tx.send(());
    }

    if let Some(server_handle) = server_handle {
        server_handle
            .await
            .map_err(|e| format!("等待 API Gateway 停止失败: {}", e))?;
    }

    log::info!("API Gateway 已停止");
    emit_log(state.app_handle()?, "info", "API Gateway 已停止");
    Ok(())
}

async fn run_server(
    port: u16,
    server_state: GatewayServerState,
    mut shutdown_rx: oneshot::Receiver<()>,
) {
    let app = Router::new()
        .fallback(any(proxy_request))
        .with_state(server_state);

    let listener = match tokio::net::TcpListener::bind(("127.0.0.1", port)).await {
        Ok(listener) => listener,
        Err(error) => {
            log::error!("API Gateway 监听端口 {} 失败: {}", port, error);
            return;
        }
    };

    let server = axum::serve(listener, app);
    tokio::select! {
        result = server => {
            if let Err(error) = result {
                log::error!("API Gateway 服务异常退出: {}", error);
            }
        }
        _ = &mut shutdown_rx => {}
    }
}

async fn proxy_request(
    State(state): State<GatewayServerState>,
    method: Method,
    uri: Uri,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let route_enabled = {
        let route = state.route_state.read().await;
        route.enabled
    };

    if !route_enabled {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "ok": false,
                "error": "api_gateway_disabled",
                "message": "API Gateway 已关闭",
            })),
        )
            .into_response();
    }

    let request_path = uri.path().to_string();
    let request_model = extract_request_model(&body);

    if method == Method::HEAD && (uri.path() == "/" || uri.path() == "/health") {
        return StatusCode::OK.into_response();
    }

    if method == Method::GET && (uri.path() == "/" || uri.path() == "/health") {
        let route = state.route_state.read().await;
        return Json(json!({
            "ok": true,
            "mode": "anthropic-compatible",
            "providerId": route.provider_id,
            "providerName": route.provider_name,
            "targetBaseUrl": route.target_base_url,
        }))
        .into_response();
    }

    if method == Method::GET && uri.path() == "/v1/models" {
        let route = state.route_state.read().await;
        let message = format!(
            "API Gateway 命中模型列表: current_provider={} path={} count={}",
            route.provider_name,
            request_path,
            route.available_models.len()
        );
        log::info!("{}", message);
        emit_log(&state.app_handle, "info", message);
        return Json(build_models_response(&route)).into_response();
    }

    if let Some(model) = request_model.as_deref() {
        let message = format!(
            "API Gateway 收到请求: method={} path={} model={}",
            method,
            request_path,
            model
        );
        log::info!("{}", message);
        emit_log(&state.app_handle, "info", message);
    } else {
        let message = format!(
            "API Gateway 收到请求: method={} path={}",
            method,
            request_path
        );
        log::info!("{}", message);
        emit_log(&state.app_handle, "info", message);
    }

    match forward_request(state.clone(), method, uri, headers, body).await {
        Ok(response) => response,
        Err(error) => {
            log::error!("API Gateway 转发失败: {}", error);
            emit_log(&state.app_handle, "error", format!("API Gateway 转发失败: {}", error));
            (
                StatusCode::BAD_GATEWAY,
                serde_json::json!({
                    "error": "api_gateway_proxy_failed",
                    "message": error,
                })
                .to_string(),
            )
                .into_response()
        }
    }
}

async fn forward_request(
    state: GatewayServerState,
    method: Method,
    uri: Uri,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Response, String> {
    let (default_target_base_url, default_upstream_auth, model_routes) = {
        let route = state.route_state.read().await;
        (
            route.target_base_url.clone(),
            route.upstream_auth.clone(),
            route.model_routes.clone(),
        )
    };

    let selected_route = extract_request_model(&body)
        .as_deref()
        .and_then(|model| model_routes.get(model));

    let target_base_url = selected_route
        .map(|route| route.target_base_url.clone())
        .unwrap_or(default_target_base_url);
    let upstream_auth = selected_route
        .map(|route| route.upstream_auth.clone())
        .unwrap_or(default_upstream_auth);

    let target_url = apply_upstream_auth_query_params(build_target_url(&target_base_url, &uri)?, &upstream_auth);
    let reqwest_method = reqwest::Method::from_bytes(method.as_str().as_bytes())
        .map_err(|e| format!("不支持的 HTTP 方法: {}", e))?;

    let mut request_builder = state.client.request(reqwest_method, target_url.clone());
    for (name, value) in headers.iter() {
        if should_skip_request_header(name) {
            continue;
        }
        request_builder = request_builder.header(name, value);
    }

    request_builder = apply_upstream_auth_headers(request_builder, &upstream_auth);

    let original_model = extract_request_model(&body);
    let rewritten_body = if method == Method::POST && uri.path() == "/v1/messages" {
        rewrite_model_aliases(body, &model_routes)
    } else {
        body
    };
    let rewritten_model = extract_request_model(&rewritten_body);

    if original_model != rewritten_model {
        let message = format!(
            "API Gateway 模型重写: {} -> {}",
            original_model.as_deref().unwrap_or("<none>"),
            rewritten_model.as_deref().unwrap_or("<none>")
        );
        log::info!("{}", message);
        emit_log(&state.app_handle, "info", message);
    }

    if let Some(route) = selected_route {
        let message = format!(
            "API Gateway 选中上游供应商: model={} provider={}({})",
            original_model.as_deref().unwrap_or("<none>"),
            route.provider_name,
            route.provider_id
        );
        log::info!("{}", message);
        emit_log(&state.app_handle, "info", message);
    }

    let forward_message = format!(
        "API Gateway 转发上游: method={} url={} model={}",
        method,
        target_url,
        rewritten_model.as_deref().or(original_model.as_deref()).unwrap_or("<none>")
    );
    log::info!("{}", forward_message);
    emit_log(&state.app_handle, "info", forward_message);

    let upstream_response = request_builder
        .body(rewritten_body)
        .send()
        .await
        .map_err(|e| format!("请求上游失败: {}", e))?;

    let status = upstream_response.status();
    let response_message = format!("API Gateway 上游响应: status={} url={}", status, target_url);
    log::info!("{}", response_message);
    emit_log(&state.app_handle, "info", response_message);
    let response_headers = upstream_response.headers().clone();
    let body_stream = upstream_response
        .bytes_stream()
        .map_err(std::io::Error::other);

    let mut response_builder = Response::builder().status(status);
    for (name, value) in response_headers.iter() {
        response_builder = response_builder.header(name, value);
    }

    response_builder
        .body(Body::from_stream(body_stream))
        .map_err(|e| format!("构造代理响应失败: {}", e))
}

fn apply_upstream_auth_headers(
    mut request_builder: reqwest::RequestBuilder,
    upstream_auth: &UpstreamAuth,
) -> reqwest::RequestBuilder {
    for strategy in &upstream_auth.strategies {
        if let GatewayAuthStrategy::Header(header) = strategy {
            request_builder = request_builder.header(&header.name, &header.value);
        }
    }

    request_builder
}

fn apply_upstream_auth_query_params(mut target_url: Url, upstream_auth: &UpstreamAuth) -> Url {
    for strategy in &upstream_auth.strategies {
        if let GatewayAuthStrategy::Query(param) = strategy {
            target_url
                .query_pairs_mut()
                .append_pair(&param.name, &param.value);
        }
    }

    target_url
}

fn should_skip_request_header(name: &axum::http::HeaderName) -> bool {
    name == HOST
        || name == CONTENT_LENGTH
        || name == AUTHORIZATION
        || name == CONNECTION
        || name == TRANSFER_ENCODING
        || name == TE
        || name == TRAILER
        || name == UPGRADE
        || name == PROXY_AUTHENTICATE
        || name == PROXY_AUTHORIZATION
        || name == axum::http::header::HeaderName::from_static("x-api-key")
}

fn build_target_url(target_base_url: &str, uri: &Uri) -> Result<Url, String> {
    let mut url = Url::parse(target_base_url)
        .map_err(|e| format!("解析目标地址失败({target_base_url}): {}", e))?;

    let incoming_path = uri.path().trim_start_matches('/');
    if !incoming_path.is_empty() {
        let base_path = url.path().trim_end_matches('/');
        let joined_path = if base_path.is_empty() || base_path == "/" {
            format!("/{incoming_path}")
        } else {
            format!("{base_path}/{incoming_path}")
        };
        url.set_path(&joined_path);
    }

    url.set_query(uri.query());
    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn test_provider() -> Provider {
        Provider {
            id: "minimax".to_string(),
            name: "MiniMax".to_string(),
            settings_config: json!({
                "env": {
                    "ANTHROPIC_AUTH_TOKEN": "sk-test",
                    "ANTHROPIC_BASE_URL": "https://api.minimaxi.com/anthropic",
                    "ANTHROPIC_MODEL": "MiniMax-M2.7",
                    "ANTHROPIC_SMALL_FAST_MODEL": "MiniMax-M2.7"
                }
            }),
            website_url: None,
            category: None,
            created_at: None,
        }
    }

    #[test]
    fn gateway_config_rewrites_base_url_and_default_models() {
        let provider = test_provider();
        let config = build_gateway_provider_config(&provider, std::slice::from_ref(&provider), 8787);
        let env = config.get("env").and_then(|value| value.as_object()).unwrap();

        assert_eq!(
            env.get("ANTHROPIC_BASE_URL").and_then(|value| value.as_str()),
            Some("http://127.0.0.1:8787")
        );
        assert_eq!(
            env.get("ANTHROPIC_MODEL").and_then(|value| value.as_str()),
            Some("claude-minimax:default")
        );
    }

    #[test]
    fn configured_models_embed_provider_name_for_picker() {
        let provider = test_provider();
        let models = configured_provider_models(&provider);

        assert_eq!(models.len(), 1);
        assert_eq!(models[0].id, "claude-minimax:default");
        assert_eq!(models[0].display_name, "MiniMax");
        assert_eq!(models[0].upstream_model, "MiniMax-M2.7");
    }

    #[test]
    fn rewrite_model_aliases_swaps_gateway_model_id() {
        let body = Bytes::from(
            serde_json::to_vec(&json!({
                "model": "claude-minimax:default",
                "messages": [{"role": "user", "content": "hello"}]
            }))
            .unwrap(),
        );
        let aliases = std::collections::HashMap::from([(
            "claude-minimax:default".to_string(),
            GatewayModelRoute {
                provider_id: "minimax".to_string(),
                provider_name: "MiniMax".to_string(),
                target_base_url: "https://api.minimaxi.com/anthropic".to_string(),
                upstream_model: "MiniMax-M2.7".to_string(),
                upstream_auth: UpstreamAuth::default(),
            },
        )]);

        let rewritten = rewrite_model_aliases(body, &aliases);
        let json_body: Value = serde_json::from_slice(&rewritten).unwrap();

        assert_eq!(json_body.get("model").and_then(|value| value.as_str()), Some("MiniMax-M2.7"));
    }

    #[test]
    fn should_skip_request_header_filters_content_length_and_hop_by_hop_headers() {
        assert!(should_skip_request_header(&CONTENT_LENGTH));
        assert!(should_skip_request_header(&HOST));
        assert!(should_skip_request_header(&TRANSFER_ENCODING));
        assert!(should_skip_request_header(&axum::http::header::AUTHORIZATION));
        assert!(should_skip_request_header(&axum::http::header::HeaderName::from_static("x-api-key")));
    }

    #[test]
    fn extract_request_model_reads_model_field() {
        let body = Bytes::from(
            serde_json::to_vec(&json!({
                "model": "claude-minimax:default",
                "messages": [{"role": "user", "content": "hello"}]
            }))
            .unwrap(),
        );

        assert_eq!(extract_request_model(&body).as_deref(), Some("claude-minimax:default"));
    }

    #[test]
    fn configured_upstream_auth_reads_provider_credentials() {
        let provider = test_provider();
        let auth = configured_upstream_auth(&provider);

        assert_eq!(auth.strategies.len(), 1);
        match &auth.strategies[0] {
            GatewayAuthStrategy::Header(header) => {
                assert_eq!(header.name, "authorization");
                assert_eq!(header.value, "Bearer sk-test");
            }
            _ => panic!("expected header auth strategy"),
        }
    }

    #[test]
    fn minimax_uses_bearer_auth_without_x_api_key() {
        let client = reqwest::Client::new();
        let request = apply_upstream_auth_headers(
            client.get("https://example.com"),
            &UpstreamAuth {
                strategies: vec![GatewayAuthStrategy::Header(GatewayAuthHeader {
                    name: AUTHORIZATION.as_str().to_string(),
                    value: "Bearer sk-test".to_string(),
                })],
            },
        )
        .build()
        .unwrap();

        assert_eq!(
            request.headers().get(AUTHORIZATION).and_then(|value| value.to_str().ok()),
            Some("Bearer sk-test")
        );
        assert!(request.headers().get("x-api-key").is_none());
    }

    #[test]
    fn should_skip_request_header_filters_auth_headers_for_reinjection() {
        assert!(should_skip_request_header(&AUTHORIZATION));
        assert!(should_skip_request_header(&axum::http::header::HeaderName::from_static("x-api-key")));
    }

    #[test]
    fn custom_auth_headers_can_reference_env_vars() {
        let provider = Provider {
            id: "custom-auth".to_string(),
            name: "Custom Auth".to_string(),
            settings_config: json!({
                "env": {
                    "ANTHROPIC_BASE_URL": "https://example.com/anthropic",
                    "CUSTOM_TOKEN": "abc123"
                },
                "apiGateway": {
                    "authHeaders": [
                        {"name": "x-custom-token", "envVar": "CUSTOM_TOKEN"}
                    ]
                }
            }),
            website_url: None,
            category: None,
            created_at: None,
        };

        let auth = configured_upstream_auth(&provider);
        assert_eq!(auth.strategies.len(), 1);
        match &auth.strategies[0] {
            GatewayAuthStrategy::Header(header) => {
                assert_eq!(header.name, "x-custom-token");
                assert_eq!(header.value, "abc123");
            }
            _ => panic!("expected header auth strategy"),
        }
    }

    #[test]
    fn custom_auth_strategies_support_query_params() {
        let provider = Provider {
            id: "query-auth".to_string(),
            name: "Query Auth".to_string(),
            settings_config: json!({
                "env": {
                    "ANTHROPIC_BASE_URL": "https://example.com/anthropic",
                    "ACCESS_TOKEN": "q-token"
                },
                "apiGateway": {
                    "auth": [
                        {"type": "query", "name": "access_token", "envVar": "ACCESS_TOKEN"}
                    ]
                }
            }),
            website_url: None,
            category: None,
            created_at: None,
        };

        let auth = configured_upstream_auth(&provider);
        assert_eq!(auth.strategies.len(), 1);
        match &auth.strategies[0] {
            GatewayAuthStrategy::Query(param) => {
                assert_eq!(param.name, "access_token");
                assert_eq!(param.value, "q-token");
            }
            _ => panic!("expected query auth strategy"),
        }

        let url = apply_upstream_auth_query_params(Url::parse("https://example.com/v1/messages").unwrap(), &auth);
        assert_eq!(url.as_str(), "https://example.com/v1/messages?access_token=q-token");
    }

    #[test]
    fn gateway_config_scopes_suffix_models_to_current_provider() {
        let provider_a = Provider {
            id: "alpha".to_string(),
            name: "Alpha".to_string(),
            settings_config: json!({
                "env": {
                    "ANTHROPIC_AUTH_TOKEN": "sk-a",
                    "ANTHROPIC_BASE_URL": "https://alpha.example.com",
                    "ANTHROPIC_MODEL": "alpha-default",
                    "ANTHROPIC_DEFAULT_SONNET_MODEL": "alpha-sonnet",
                }
            }),
            website_url: None,
            category: None,
            created_at: None,
        };
        let provider_b = Provider {
            id: "beta".to_string(),
            name: "Beta".to_string(),
            settings_config: json!({
                "env": {
                    "ANTHROPIC_AUTH_TOKEN": "sk-b",
                    "ANTHROPIC_BASE_URL": "https://beta.example.com",
                    "ANTHROPIC_MODEL": "beta-default",
                    "ANTHROPIC_DEFAULT_SONNET_MODEL": "beta-sonnet",
                }
            }),
            website_url: None,
            category: None,
            created_at: None,
        };

        let config = build_gateway_provider_config(&provider_a, &[provider_a.clone(), provider_b.clone()], 3456);
        let env = config.get("env").and_then(|v| v.as_object()).unwrap();

        assert_eq!(
            env.get("ANTHROPIC_MODEL").and_then(|v| v.as_str()),
            Some("claude-alpha:default")
        );
        assert_eq!(
            env.get("ANTHROPIC_DEFAULT_SONNET_MODEL").and_then(|v| v.as_str()),
            Some("claude-alpha:sonnet")
        );
    }
}