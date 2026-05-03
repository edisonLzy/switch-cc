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
use tokio::sync::{oneshot, RwLock};

#[derive(Clone)]
struct GatewayServerState {
    client: reqwest::Client,
    route_state: Arc<RwLock<RouteState>>,
}

#[derive(Debug, Clone)]
struct RouteState {
    provider_id: String,
    provider_name: String,
    target_base_url: String,
    upstream_auth: UpstreamAuth,
    models: Vec<GatewayModel>,
    model_aliases: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Default)]
struct UpstreamAuth {
    api_key: Option<String>,
    auth_token: Option<String>,
}

#[derive(Debug, Clone)]
struct GatewayModel {
    id: String,
    upstream_model: String,
    display_name: String,
}

#[derive(Default)]
pub struct ApiGatewayRuntime {
    server_handle: Option<tauri::async_runtime::JoinHandle<()>>,
    shutdown_tx: Option<oneshot::Sender<()>>,
    route_state: Option<Arc<RwLock<RouteState>>>,
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

        let id = format!("switch-cc/{}:{}", provider.id, suffix);
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
            id: format!("switch-cc/{}:default", provider.id),
            upstream_model: fallback,
            display_name: provider.name.clone(),
        });
    }

    models
}

fn build_model_aliases(models: &[GatewayModel]) -> std::collections::HashMap<String, String> {
    models
        .iter()
        .map(|model| (model.id.clone(), model.upstream_model.clone()))
        .collect()
}

fn configured_upstream_auth(provider: &Provider) -> UpstreamAuth {
    let env = provider
        .settings_config
        .get("env")
        .and_then(|value| value.as_object());

    let read = |key: &str| {
        env.and_then(|values| values.get(key))
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
    };

    UpstreamAuth {
        api_key: read("ANTHROPIC_API_KEY"),
        auth_token: read("ANTHROPIC_AUTH_TOKEN"),
    }
}

fn build_models_response(state: &RouteState) -> Value {
    json!({
        "data": state.models.iter().map(|model| {
            json!({
                "id": model.id,
                "type": "model",
                "display_name": model.display_name,
                "created_at": chrono::Utc::now().to_rfc3339(),
            })
        }).collect::<Vec<_>>()
    })
}

fn rewrite_model_aliases(body: Bytes, aliases: &std::collections::HashMap<String, String>) -> Bytes {
    let Ok(mut json_body) = serde_json::from_slice::<Value>(&body) else {
        return body;
    };

    let Some(model) = json_body.get_mut("model") else {
        return body;
    };

    let Some(model_id) = model.as_str() else {
        return body;
    };

    let Some(upstream_model) = aliases.get(model_id) else {
        return body;
    };

    *model = Value::String(upstream_model.clone());

    serde_json::to_vec(&json_body)
        .map(Bytes::from)
        .unwrap_or(body)
}

fn extract_request_model(body: &Bytes) -> Option<String> {
    serde_json::from_slice::<Value>(body)
        .ok()
        .and_then(|json_body| json_body.get("model").and_then(|value| value.as_str()).map(str::to_string))
}

pub fn build_gateway_provider_config(provider: &Provider, port: u16) -> serde_json::Value {
    let mut provider_config = provider.settings_config.clone();
    let models = configured_provider_models(provider);
    let default_model_id = models
        .first()
        .map(|model| model.id.clone())
        .unwrap_or_else(|| format!("switch-cc/{}:default", provider.id));

    let model_id_for_suffix = |suffix: &str| {
        models
            .iter()
            .find(|model| model.id.ends_with(&format!(":{suffix}")))
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

pub async fn start_or_update(state: &AppState, provider: &Provider, port: u16) -> Result<(), String> {
    let target_base_url = provider_target_base_url(provider)?;
    let upstream_auth = configured_upstream_auth(provider);
    let models = configured_provider_models(provider);
    let model_aliases = build_model_aliases(&models);

    let (route_state, should_spawn) = {
        let mut runtime = state
            .api_gateway_runtime
            .lock()
            .map_err(|e| format!("获取 API Gateway 运行时锁失败: {}", e))?;

        let route_state = runtime.route_state.clone().unwrap_or_else(|| {
            let route_state = Arc::new(RwLock::new(RouteState {
                provider_id: provider.id.clone(),
                provider_name: provider.name.clone(),
                target_base_url: target_base_url.clone(),
                upstream_auth: upstream_auth.clone(),
                models: models.clone(),
                model_aliases: model_aliases.clone(),
            }));
            runtime.route_state = Some(route_state.clone());
            route_state
        });

        let should_spawn = runtime.server_handle.is_none();
        if should_spawn {
            let client = reqwest::Client::builder()
                .build()
                .map_err(|e| format!("初始化 API Gateway HTTP 客户端失败: {}", e))?;
            let server_state = GatewayServerState {
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
        route.provider_id = provider.id.clone();
        route.provider_name = provider.name.clone();
        route.target_base_url = target_base_url.clone();
        route.upstream_auth = upstream_auth;
        route.models = models;
        route.model_aliases = model_aliases;
    }

    if should_spawn {
        log::info!(
            "API Gateway 已启动，监听 {}，目标供应商 {} -> {}",
            gateway_base_url(port),
            provider.name,
            target_base_url
        );
    } else {
        log::info!("API Gateway 路由已更新: {} -> {}", provider.name, target_base_url);
    }

    Ok(())
}

pub fn stop(state: &AppState) -> Result<(), String> {
    let mut runtime = state
        .api_gateway_runtime
        .lock()
        .map_err(|e| format!("获取 API Gateway 运行时锁失败: {}", e))?;

    if let Some(shutdown_tx) = runtime.shutdown_tx.take() {
        let _ = shutdown_tx.send(());
    }

    if let Some(server_handle) = runtime.server_handle.take() {
        server_handle.abort();
    }

    log::info!("API Gateway 已停止");
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
        log::info!(
            "API Gateway 命中模型列表: provider={} path={}",
            route.provider_name,
            request_path
        );
        return Json(build_models_response(&route)).into_response();
    }

    if let Some(model) = request_model.as_deref() {
        log::info!(
            "API Gateway 收到请求: method={} path={} model={}",
            method,
            request_path,
            model
        );
    } else {
        log::info!(
            "API Gateway 收到请求: method={} path={}",
            method,
            request_path
        );
    }

    match forward_request(state, method, uri, headers, body).await {
        Ok(response) => response,
        Err(error) => {
            log::error!("API Gateway 转发失败: {}", error);
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
    let (target_base_url, model_aliases, upstream_auth) = {
        let route = state.route_state.read().await;
        (
            route.target_base_url.clone(),
            route.model_aliases.clone(),
            route.upstream_auth.clone(),
        )
    };

    let target_url = build_target_url(&target_base_url, &uri)?;
    let reqwest_method = reqwest::Method::from_bytes(method.as_str().as_bytes())
        .map_err(|e| format!("不支持的 HTTP 方法: {}", e))?;

    let mut request_builder = state.client.request(reqwest_method, target_url.clone());
    for (name, value) in headers.iter() {
        if should_skip_request_header(name) {
            continue;
        }
        request_builder = request_builder.header(name, value);
    }

    request_builder = apply_upstream_auth_headers(request_builder, &target_base_url, &upstream_auth);

    let original_model = extract_request_model(&body);
    let rewritten_body = if method == Method::POST && uri.path() == "/v1/messages" {
        rewrite_model_aliases(body, &model_aliases)
    } else {
        body
    };
    let rewritten_model = extract_request_model(&rewritten_body);

    if original_model != rewritten_model {
        log::info!(
            "API Gateway 模型重写: {} -> {}",
            original_model.as_deref().unwrap_or("<none>"),
            rewritten_model.as_deref().unwrap_or("<none>")
        );
    }

    log::info!(
        "API Gateway 转发上游: method={} url={} model={}",
        method,
        target_url,
        rewritten_model.as_deref().or(original_model.as_deref()).unwrap_or("<none>")
    );

    let upstream_response = request_builder
        .body(rewritten_body)
        .send()
        .await
        .map_err(|e| format!("请求上游失败: {}", e))?;

    let status = upstream_response.status();
    log::info!("API Gateway 上游响应: status={} url={}", status, target_url);
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
    target_base_url: &str,
    upstream_auth: &UpstreamAuth,
) -> reqwest::RequestBuilder {
    let is_official_anthropic = target_base_url.contains("api.anthropic.com");
    let is_minimax = target_base_url.contains("api.minimaxi.com");

    if let Some(api_key) = upstream_auth.api_key.as_deref() {
        request_builder = request_builder.header(AUTHORIZATION, format!("Bearer {}", api_key));
        if !is_minimax {
            request_builder = request_builder.header("x-api-key", api_key);
        }
        return request_builder;
    }

    if let Some(auth_token) = upstream_auth.auth_token.as_deref() {
        request_builder = request_builder.header(AUTHORIZATION, format!("Bearer {}", auth_token));

        if !is_official_anthropic && !is_minimax {
            request_builder = request_builder.header("x-api-key", auth_token);
        }
    }

    request_builder
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
        let config = build_gateway_provider_config(&provider, 8787);
        let env = config.get("env").and_then(|value| value.as_object()).unwrap();

        assert_eq!(
            env.get("ANTHROPIC_BASE_URL").and_then(|value| value.as_str()),
            Some("http://127.0.0.1:8787")
        );
        assert_eq!(
            env.get("ANTHROPIC_MODEL").and_then(|value| value.as_str()),
            Some("switch-cc/minimax:default")
        );
    }

    #[test]
    fn configured_models_embed_provider_name_for_picker() {
        let provider = test_provider();
        let models = configured_provider_models(&provider);

        assert_eq!(models.len(), 1);
        assert_eq!(models[0].id, "switch-cc/minimax:default");
        assert_eq!(models[0].display_name, "MiniMax");
        assert_eq!(models[0].upstream_model, "MiniMax-M2.7");
    }

    #[test]
    fn rewrite_model_aliases_swaps_gateway_model_id() {
        let body = Bytes::from(
            serde_json::to_vec(&json!({
                "model": "switch-cc/minimax:default",
                "messages": [{"role": "user", "content": "hello"}]
            }))
            .unwrap(),
        );
        let aliases = std::collections::HashMap::from([(
            "switch-cc/minimax:default".to_string(),
            "MiniMax-M2.7".to_string(),
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
                "model": "switch-cc/minimax:default",
                "messages": [{"role": "user", "content": "hello"}]
            }))
            .unwrap(),
        );

        assert_eq!(extract_request_model(&body).as_deref(), Some("switch-cc/minimax:default"));
    }

    #[test]
    fn configured_upstream_auth_reads_provider_credentials() {
        let provider = test_provider();
        let auth = configured_upstream_auth(&provider);

        assert_eq!(auth.api_key, None);
        assert_eq!(auth.auth_token.as_deref(), Some("sk-test"));
    }

    #[test]
    fn minimax_uses_bearer_auth_without_x_api_key() {
        let client = reqwest::Client::new();
        let request = apply_upstream_auth_headers(
            client.get("https://example.com"),
            "https://api.minimaxi.com/anthropic",
            &UpstreamAuth {
                api_key: None,
                auth_token: Some("sk-test".to_string()),
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
}