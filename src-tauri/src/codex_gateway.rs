use crate::provider::CodexProvider;
use crate::store::AppState;
use async_stream::stream;
use axum::{
    extract::State,
    http::StatusCode,
    response::{sse::Event, sse::KeepAlive, IntoResponse, Response, Sse},
    routing::{get, post},
    Json, Router,
};
use eventsource_stream::Eventsource;
use futures_util::StreamExt;
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::convert::Infallible;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;
use tauri::{Emitter, Manager};
use tokio::sync::{oneshot, RwLock};
use uuid::Uuid;

#[derive(Clone)]
struct GatewayServerState {
    app_handle: tauri::AppHandle,
    client: reqwest::Client,
    route_state: Arc<RwLock<RouteState>>,
}

/// Provider adapter that normalizes request/response differences across LLM providers.
#[derive(Debug, Clone, PartialEq, Eq)]
enum ProviderAdapter {
    /// Default adapter — passes messages through as-is (OpenAI-compatible).
    Default,
    /// MiniMax adapter — normalizes unsupported roles (e.g. developer → system).
    MiniMax,
    /// DeepSeek adapter — normalizes unsupported roles (e.g. developer → system).
    DeepSeek,
}

impl ProviderAdapter {
    /// Detect the appropriate adapter from the upstream URL.
    fn from_upstream_url(url: &str) -> Self {
        let lower = url.to_lowercase();
        if lower.contains("minimaxi") || lower.contains("minimax") {
            Self::MiniMax
        } else if lower.contains("deepseek") {
            Self::DeepSeek
        } else {
            Self::Default
        }
    }

    /// Normalize a message role for upstream compatibility.
    fn normalize_role<'a>(&self, role: &'a str) -> &'a str {
        match self {
            Self::Default => role,
            Self::MiniMax => match role {
                "developer" => "system",
                other => other,
            },
            Self::DeepSeek => match role {
                "developer" => "system",
                other => other,
            },
        }
    }

    /// Normalize the full message list for upstream compatibility.
    fn normalize_messages(&self, messages: Vec<Value>) -> Vec<Value> {
        match self {
            Self::Default => messages,
            Self::MiniMax => merge_system_messages(messages),
            Self::DeepSeek => messages,
        }
    }

    /// Normalize an upstream response message into separate reasoning/text channels.
    fn sanitize_response_message(&self, message: &Value) -> ResponseContentParts {
        let mut parts = match self {
            Self::Default | Self::DeepSeek => ResponseContentParts {
                text: extract_message_text(message.get("content")),
                ..Default::default()
            },
            Self::MiniMax => split_minimax_response_text(&extract_message_text(message.get("content"))),
        };

        append_response_segment(
            &mut parts.reasoning,
            &extract_message_text(message.get("reasoning_content")),
        );

        parts
    }

    /// Normalize upstream response text for downstream compatibility.
    fn sanitize_response_text(&self, text: &str) -> String {
        match self {
            Self::Default => text.to_string(),
            Self::MiniMax => split_minimax_response_text(text).text,
            Self::DeepSeek => text.to_string(),
        }
    }

    /// Normalize one streaming delta into separate reasoning/text channels.
    fn sanitize_stream_delta(&self, stream_state: &mut StreamState, delta: &Value) -> ResponseContentParts {
        let mut parts = match self {
            Self::Default | Self::DeepSeek => ResponseContentParts {
                text: extract_message_text(delta.get("content")),
                ..Default::default()
            },
            Self::MiniMax => {
                split_minimax_stream_text_delta(stream_state, &extract_message_text(delta.get("content")))
            }
        };

        append_response_segment(
            &mut parts.reasoning,
            &extract_message_text(delta.get("reasoning_content")),
        );

        parts
    }
}

fn merge_system_messages(messages: Vec<Value>) -> Vec<Value> {
    let mut normalized = Vec::with_capacity(messages.len());
    let mut merged_system_index: Option<usize> = None;

    for mut message in messages {
        let is_system = message.get("role").and_then(Value::as_str) == Some("system");
        if !is_system {
            normalized.push(message);
            continue;
        }

        let message_text = extract_message_text(message.get("content"));

        if let Some(index) = merged_system_index {
            if let Some(existing) = normalized.get_mut(index).and_then(Value::as_object_mut) {
                let existing_text = existing
                    .get("content")
                    .map(|content| extract_message_text(Some(content)))
                    .unwrap_or_default();
                let combined = match (existing_text.is_empty(), message_text.is_empty()) {
                    (true, _) => message_text,
                    (_, true) => existing_text,
                    (false, false) => format!("{existing_text}\n\n{message_text}"),
                };
                existing.insert("content".to_string(), Value::String(combined));
            }
            continue;
        }

        if let Some(object) = message.as_object_mut() {
            object.insert("content".to_string(), Value::String(message_text));
        }
        merged_system_index = Some(normalized.len());
        normalized.push(message);
    }

    normalized
}

#[derive(Debug, Clone)]
struct RouteState {
    enabled: bool,
    provider_id: String,
    provider_name: String,
    target_base_url: String,
    target_model_name: String,
    api_key: String,
    adapter: ProviderAdapter,
}

#[derive(Default)]
pub struct CodexGatewayRuntime {
    server_handle: Option<tauri::async_runtime::JoinHandle<()>>,
    shutdown_tx: Option<oneshot::Sender<()>>,
    route_state: Option<Arc<RwLock<RouteState>>>,
}

#[derive(Debug, Clone)]
pub struct GatewayRouteSnapshot {
    pub provider_id: String,
    pub provider_name: String,
    pub target_base_url: String,
    pub target_model_name: String,
}

#[derive(Debug, Default, Clone)]
struct UsageTotals {
    input_tokens: i64,
    output_tokens: i64,
    total_tokens: i64,
}

#[derive(Debug, Default, Clone, PartialEq, Eq)]
struct ResponseContentParts {
    reasoning: String,
    text: String,
}

#[derive(Debug, Clone)]
struct ToolCallState {
    call_id: String,
    name: String,
    arguments: String,
}

#[derive(Debug, Default)]
struct MiniMaxResponseTextState {
    inside_think_block: bool,
    saw_think_block: bool,
    pending_text: String,
}

#[derive(Debug, Default)]
struct StreamState {
    message_text: String,
    message_started: bool,
    reasoning_text: String,
    reasoning_started: bool,
    tool_calls: BTreeMap<usize, ToolCallState>,
    minimax_response_text: MiniMaxResponseTextState,
}

pub fn gateway_base_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}/v1")
}

pub fn health_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}/health")
}

pub fn provider_target_base_url(provider: &CodexProvider) -> String {
    provider.codex_config.upstream_url.trim_end_matches('/').to_string()
}

pub fn is_running(state: &AppState) -> Result<bool, String> {
    let runtime = state
        .codex_gateway_runtime
        .lock()
        .map_err(|error| format!("获取 Codex Gateway 运行时锁失败: {}", error))?;
    Ok(runtime.server_handle.is_some())
}

pub async fn get_route_snapshot(state: &AppState) -> Result<Option<GatewayRouteSnapshot>, String> {
    let route_state = {
        let runtime = state
            .codex_gateway_runtime
            .lock()
            .map_err(|error| format!("获取 Codex Gateway 运行时锁失败: {}", error))?;
        runtime.route_state.clone()
    };

    let Some(route_state) = route_state else {
        return Ok(None);
    };

    let route = route_state.read().await;
    Ok(Some(GatewayRouteSnapshot {
        provider_id: route.provider_id.clone(),
        provider_name: route.provider_name.clone(),
        target_base_url: route.target_base_url.clone(),
        target_model_name: route.target_model_name.clone(),
    }))
}

pub async fn start_or_update(state: &AppState, provider: &CodexProvider, port: u16) -> Result<(), String> {
    provider.validate()?;
    let target_base_url = provider_target_base_url(provider);
    let adapter = ProviderAdapter::from_upstream_url(&target_base_url);
    let next_route = RouteState {
        enabled: true,
        provider_id: provider.id.clone(),
        provider_name: provider.name.clone(),
        target_base_url,
        target_model_name: provider.codex_config.model_name.trim().to_string(),
        api_key: provider.codex_config.api_key.trim().to_string(),
        adapter,
    };

    let (route_state, should_spawn) = {
        let mut runtime = state
            .codex_gateway_runtime
            .lock()
            .map_err(|error| format!("获取 Codex Gateway 运行时锁失败: {}", error))?;

        let route_state = runtime.route_state.clone().unwrap_or_else(|| {
            let route_state = Arc::new(RwLock::new(next_route.clone()));
            runtime.route_state = Some(route_state.clone());
            route_state
        });

        let should_spawn = runtime.server_handle.is_none();
        if should_spawn {
            let server_state = GatewayServerState {
                app_handle: state.app_handle()?.clone(),
                client: reqwest::Client::builder()
                    .connect_timeout(std::time::Duration::from_secs(30))
                    .tcp_keepalive(std::time::Duration::from_secs(60))
                    .pool_idle_timeout(std::time::Duration::from_secs(90))
                    .build()
                    .map_err(|error| format!("初始化 Codex Gateway HTTP 客户端失败: {}", error))?,
                route_state: route_state.clone(),
            };
            let (shutdown_tx, shutdown_rx) = oneshot::channel();
            let server_handle = tauri::async_runtime::spawn(run_server(port, server_state, shutdown_rx));
            runtime.shutdown_tx = Some(shutdown_tx);
            runtime.server_handle = Some(server_handle);
        }

        Ok::<_, String>((route_state, should_spawn))
    }?;

    *route_state.write().await = next_route.clone();

    let message = if should_spawn {
        format!(
            "Codex Gateway 已启动，监听 {}，当前上游 {} -> {}",
            gateway_base_url(port),
            next_route.provider_name,
            next_route.target_base_url
        )
    } else {
        format!(
            "Codex Gateway 路由已更新: {} -> {} ({})",
            next_route.provider_name,
            next_route.target_base_url,
            next_route.target_model_name
        )
    };

    log::info!("{}", message);
    emit_log(state.app_handle()?, "info", message);
    Ok(())
}

pub async fn stop(state: &AppState) -> Result<(), String> {
    let (route_state, shutdown_tx, server_handle) = {
        let mut runtime = state
            .codex_gateway_runtime
            .lock()
            .map_err(|error| format!("获取 Codex Gateway 运行时锁失败: {}", error))?;

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
            .map_err(|error| format!("等待 Codex Gateway 停止失败: {}", error))?;
    }

    log::info!("Codex Gateway 已停止");
    emit_log(state.app_handle()?, "info", "Codex Gateway 已停止");
    Ok(())
}

fn emit_log(app_handle: &tauri::AppHandle, level: &str, message: impl Into<String>) {
    let message = message.into();
    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    if disk_logging_enabled(app_handle) {
        if let Err(error) = append_log_to_disk(&timestamp, level, &message) {
            log::warn!("Codex Gateway 写入磁盘日志失败: {}", error);
        }
    }

    let payload = json!({
        "timestamp": timestamp,
        "level": level,
        "message": message,
    });
    let _ = app_handle.emit("codex-gateway-log", payload);
}

pub fn log_directory() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or("无法获取用户目录")?;
    Ok(home_dir.join(".switchcc").join("logs"))
}

fn disk_logging_enabled(app_handle: &tauri::AppHandle) -> bool {
    let state = app_handle.state::<AppState>();
    state
        .config
        .lock()
        .map(|config| config.codex_gateway.disk_logging_enabled)
        .unwrap_or(false)
}

fn append_log_to_disk(timestamp: &str, level: &str, message: &str) -> Result<(), String> {
    let log_dir = log_directory()?;
    if !log_dir.exists() {
        fs::create_dir_all(&log_dir).map_err(|error| format!("创建日志目录失败: {}", error))?;
    }

    let log_file_path = log_dir.join(format!(
        "codex-gateway-{}.log",
        chrono::Local::now().format("%Y-%m-%d")
    ));

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file_path)
        .map_err(|error| format!("打开日志文件失败: {}", error))?;

    writeln!(file, "[{}] [{}] {}", timestamp, level.to_uppercase(), message)
        .map_err(|error| format!("写入日志文件失败: {}", error))
}

async fn run_server(
    port: u16,
    server_state: GatewayServerState,
    mut shutdown_rx: oneshot::Receiver<()>,
) {
    let app_handle = server_state.app_handle.clone();
    let app = Router::new()
        .route("/health", get(get_health).head(head_health))
        .route("/v1/models", get(get_models))
        .route("/v1/responses", post(post_responses))
        .with_state(server_state);

    let listener = match tokio::net::TcpListener::bind(("127.0.0.1", port)).await {
        Ok(listener) => listener,
        Err(error) => {
            log::error!("Codex Gateway 监听端口 {} 失败: {}", port, error);
            emit_log(
                &app_handle,
                "error",
                format!("Codex Gateway 监听端口 {} 失败: {}", port, error),
            );
            return;
        }
    };

    let server = axum::serve(listener, app);
    tokio::select! {
        result = server => {
            if let Err(error) = result {
                log::error!("Codex Gateway 服务异常退出: {}", error);
                emit_log(
                    &app_handle,
                    "error",
                    format!("Codex Gateway 服务异常退出: {}", error),
                );
            }
        }
        _ = &mut shutdown_rx => {}
    }
}

async fn get_health(State(state): State<GatewayServerState>) -> impl IntoResponse {
    let route = state.route_state.read().await;
    Json(json!({
        "ok": route.enabled,
        "providerId": route.provider_id,
        "providerName": route.provider_name,
        "targetBaseUrl": route.target_base_url,
        "targetModelName": route.target_model_name,
    }))
}

async fn head_health() -> impl IntoResponse {
    StatusCode::OK
}

async fn get_models(State(state): State<GatewayServerState>) -> impl IntoResponse {
    let route = state.route_state.read().await;
    Json(json!({
        "object": "list",
        "data": [{
            "id": route.target_model_name,
            "object": "model",
            "created": chrono::Utc::now().timestamp(),
            "owned_by": route.provider_name,
        }]
    }))
}

async fn post_responses(
    State(state): State<GatewayServerState>,
    Json(body): Json<Value>,
) -> Response {
    let route = state.route_state.read().await.clone();
    if !route.enabled {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "error": "codex_gateway_disabled",
                "message": "Codex Gateway 已关闭",
            })),
        )
            .into_response();
    }

    let chat_request = match build_chat_request(&body, &route) {
        Ok(request) => request,
        Err(error) => {
            emit_log(&state.app_handle, "error", format!("Codex Gateway 请求转换失败: {}", error));
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "error": "invalid_responses_request",
                    "message": error,
                })),
            )
                .into_response();
        }
    };

    let stream_requested = body
        .get("stream")
        .and_then(Value::as_bool)
        .unwrap_or(true);

    emit_log(
        &state.app_handle,
        "info",
        format!(
            "Codex Gateway 收到请求: model={} stream={} upstream={}",
            route.target_model_name, stream_requested, route.target_base_url
        ),
    );

    let upstream_url = match build_chat_completions_url(&route.target_base_url) {
        Ok(url) => url,
        Err(error) => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({
                    "error": "invalid_upstream_url",
                    "message": error,
                })),
            )
                .into_response();
        }
    };

    if !stream_requested {
        let upstream_response = match build_upstream_request(
            &state.client,
            &route,
            &upstream_url,
            &chat_request,
            false,
        )
        .send()
        .await
        {
            Ok(response) => response,
            Err(error) => {
                emit_log(&state.app_handle, "error", format!("Codex Gateway 上游请求失败: {}", error));
                return (
                    StatusCode::BAD_GATEWAY,
                    Json(json!({
                        "error": "upstream_request_failed",
                        "message": error.to_string(),
                    })),
                )
                    .into_response();
            }
        };

        let status = upstream_response.status();
        if !status.is_success() {
            let body_text = upstream_response.text().await.unwrap_or_default();
            emit_log(
                &state.app_handle,
                "error",
                format!("Codex Gateway 上游返回错误: status={} body={}", status, body_text),
            );
            return (status, body_text).into_response();
        }

        emit_log(
            &state.app_handle,
            "info",
            format!("Codex Gateway 转发上游成功: {}", upstream_url),
        );

        let upstream_json = match upstream_response.json::<Value>().await {
            Ok(json) => json,
            Err(error) => {
                return (
                    StatusCode::BAD_GATEWAY,
                    Json(json!({
                        "error": "invalid_upstream_response",
                        "message": error.to_string(),
                    })),
                )
                    .into_response();
            }
        };

        return Json(build_non_stream_response(&upstream_json, &route)).into_response();
    }

    let response_id = format!("resp_{}", Uuid::new_v4().simple());
    let reasoning_item_id = format!("rsn_{}", Uuid::new_v4().simple());
    let message_item_id = format!("msg_{}", Uuid::new_v4().simple());
    let app_handle = state.app_handle.clone();
    let target_model_name = route.target_model_name.clone();
    let client = state.client.clone();

    let event_stream = stream! {
        let stream_started_at = Instant::now();
        let mut raw_event_count = 0usize;
        let mut parsed_chunk_count = 0usize;
        let mut forwarded_text_event_count = 0usize;
        let mut forwarded_text_chars = 0usize;
        let mut forwarded_tool_call_delta_count = 0usize;
        let mut first_upstream_event_logged = false;

        emit_log(
            &app_handle,
            "info",
            format!(
                "Codex Gateway SSE 下游流已创建: response_id={} model={} upstream={}",
                response_id, target_model_name, upstream_url
            ),
        );

        emit_log(
            &app_handle,
            "info",
            format!(
                "Codex Gateway SSE 向下游发送 response.created: response_id={} elapsed_ms={}",
                response_id,
                stream_started_at.elapsed().as_millis()
            ),
        );
        yield Ok::<Event, Infallible>(json_event(
            "response.created",
            json!({
                "type": "response.created",
                "response": { "id": response_id }
            }),
        ));

        emit_log(
            &app_handle,
            "info",
            format!(
                "Codex Gateway SSE 开始请求上游: response_id={} url={} elapsed_ms={}",
                response_id,
                upstream_url,
                stream_started_at.elapsed().as_millis()
            ),
        );

        let upstream_response = match build_upstream_request(
            &client,
            &route,
            &upstream_url,
            &chat_request,
            true,
        )
        .send()
        .await
        {
            Ok(response) => response,
            Err(error) => {
                emit_log(&app_handle, "error", format!("Codex Gateway 上游请求失败: {}", error));
                yield Ok(json_event(
                    "response.failed",
                    response_failed_event(&response_id, error.to_string()),
                ));
                return;
            }
        };

        let status = upstream_response.status();
        if !status.is_success() {
            let body_text = upstream_response.text().await.unwrap_or_default();
            let error_message = format!("上游返回错误: status={} body={}", status, body_text);
            emit_log(&app_handle, "error", format!("Codex Gateway {}", error_message));
            emit_log(
                &app_handle,
                "error",
                format!(
                    "Codex Gateway SSE 向下游发送 response.failed: response_id={} reason={} elapsed_ms={}",
                    response_id,
                    error_message,
                    stream_started_at.elapsed().as_millis()
                ),
            );
            yield Ok(json_event(
                "response.failed",
                response_failed_event(&response_id, error_message),
            ));
            return;
        }

        emit_log(
            &app_handle,
            "info",
            format!(
                "Codex Gateway SSE 上游 HTTP 已连接: response_id={} status={} url={} elapsed_ms={}",
                response_id,
                status,
                upstream_url,
                stream_started_at.elapsed().as_millis()
            ),
        );

        let mut usage_totals = UsageTotals::default();
        let mut stream_state = StreamState::default();
        let mut upstream_stream = upstream_response.bytes_stream().eventsource();
        let mut received_done_event = false;
        let mut saw_terminal_finish_reason = false;

        let max_consecutive_errors = 5usize;
        let read_timeout = std::time::Duration::from_secs(300);
        let mut consecutive_errors = 0usize;

        loop {
            let next_event = match tokio::time::timeout(read_timeout, upstream_stream.next()).await {
                Ok(Some(next_event)) => next_event,
                Ok(None) => {
                    emit_log(
                        &app_handle,
                        "warn",
                        format!(
                            "Codex Gateway SSE 上游流自然结束: response_id={} raw_events={} parsed_chunks={} forwarded_text_events={} forwarded_text_chars={} tool_call_deltas={} elapsed_ms={}",
                            response_id,
                            raw_event_count,
                            parsed_chunk_count,
                            forwarded_text_event_count,
                            forwarded_text_chars,
                            forwarded_tool_call_delta_count,
                            stream_started_at.elapsed().as_millis()
                        ),
                    );
                    break;
                }
                Err(_) => {
                    consecutive_errors += 1;
                    emit_log(&app_handle, "warn", format!(
                        "Codex Gateway SSE 读取超时 ({}/{}): response_id={} 超过 {} 秒未收到上游事件 raw_events={} parsed_chunks={} elapsed_ms={}",
                        consecutive_errors,
                        max_consecutive_errors,
                        response_id,
                        read_timeout.as_secs()
                        ,raw_event_count
                        ,parsed_chunk_count
                        ,stream_started_at.elapsed().as_millis()
                    ));
                    if consecutive_errors >= max_consecutive_errors {
                        emit_log(&app_handle, "error", format!(
                            "Codex Gateway 连续 {} 次读取超时，中断流: response_id={} raw_events={} parsed_chunks={} forwarded_text_events={} forwarded_text_chars={} tool_call_deltas={} elapsed_ms={}",
                            max_consecutive_errors,
                            response_id,
                            raw_event_count,
                            parsed_chunk_count,
                            forwarded_text_event_count,
                            forwarded_text_chars,
                            forwarded_tool_call_delta_count,
                            stream_started_at.elapsed().as_millis()
                        ));
                        emit_log(
                            &app_handle,
                            "error",
                            format!(
                                "Codex Gateway SSE 向下游发送 response.failed: response_id={} reason=连续 {} 次 SSE 读取超时 elapsed_ms={}",
                                response_id,
                                max_consecutive_errors,
                                stream_started_at.elapsed().as_millis()
                            ),
                        );
                        yield Ok(json_event(
                            "response.failed",
                            response_failed_event(
                                &response_id,
                                format!(
                                    "连续 {} 次 SSE 读取超时: 超过 {} 秒未收到上游事件",
                                    max_consecutive_errors,
                                    read_timeout.as_secs()
                                ),
                            ),
                        ));
                        return;
                    }
                    continue;
                }
            };

            match next_event {
                Ok(event) => {
                    consecutive_errors = 0;
                    raw_event_count += 1;
                    let data = event.data.trim();

                    if !first_upstream_event_logged {
                        first_upstream_event_logged = true;
                        emit_log(
                            &app_handle,
                            "info",
                            format!(
                                "Codex Gateway SSE 收到上游首包: response_id={} raw_event={} data_len={} elapsed_ms={}",
                                response_id,
                                raw_event_count,
                                data.len(),
                                stream_started_at.elapsed().as_millis()
                            ),
                        );
                    }

                    if data.is_empty() {
                        emit_log(
                            &app_handle,
                            "info",
                            format!(
                                "Codex Gateway SSE 收到空事件: response_id={} raw_event={} elapsed_ms={}",
                                response_id,
                                raw_event_count,
                                stream_started_at.elapsed().as_millis()
                            ),
                        );
                        continue;
                    }

                    if data == "[DONE]" {
                        received_done_event = true;
                        emit_log(
                            &app_handle,
                            "info",
                            format!(
                                "Codex Gateway SSE 收到上游 DONE: response_id={} raw_event={} parsed_chunks={} forwarded_text_events={} forwarded_text_chars={} tool_call_deltas={} elapsed_ms={}",
                                response_id,
                                raw_event_count,
                                parsed_chunk_count,
                                forwarded_text_event_count,
                                forwarded_text_chars,
                                forwarded_tool_call_delta_count,
                                stream_started_at.elapsed().as_millis()
                            ),
                        );
                        continue;
                    }

                    let chunk = match serde_json::from_str::<Value>(data) {
                        Ok(chunk) => chunk,
                        Err(error) => {
                            emit_log(
                                &app_handle,
                                "warn",
                                format!(
                                    "Codex Gateway SSE 单条解析失败 (跳过): response_id={} raw_event={} data_len={} preview={} error={}",
                                    response_id,
                                    raw_event_count,
                                    data.len(),
                                    preview_text_for_log(data, 120),
                                    error
                                ),
                            );
                            continue;
                        }
                    };

                    parsed_chunk_count += 1;
                    let mut chunk_delta_chars = 0usize;
                    let mut chunk_message_chars = 0usize;
                    let mut chunk_tool_call_deltas = 0usize;
                    let mut chunk_finish_reasons = Vec::new();
                    let usage_present = chunk.get("usage").is_some();

                    usage_totals.merge(chunk.get("usage"));

                    if let Some(choices) = chunk.get("choices").and_then(Value::as_array) {
                        for choice in choices {
                            if let Some(finish_reason) = choice_finish_reason(choice) {
                                saw_terminal_finish_reason = true;
                                chunk_finish_reasons.push(finish_reason.to_string());
                            }

                            if let Some(delta) = choice.get("delta") {
                                let delta_parts = route.adapter.sanitize_stream_delta(&mut stream_state, delta);

                                if !delta_parts.reasoning.is_empty() {
                                    if !stream_state.reasoning_started {
                                        stream_state.reasoning_started = true;
                                        emit_log(
                                            &app_handle,
                                            "info",
                                            format!(
                                                "Codex Gateway SSE 向下游发送 reasoning output_item.added: response_id={} raw_event={} parsed_chunk={} elapsed_ms={}",
                                                response_id,
                                                raw_event_count,
                                                parsed_chunk_count,
                                                stream_started_at.elapsed().as_millis()
                                            ),
                                        );
                                        yield Ok(json_event(
                                            "response.output_item.added",
                                            reasoning_item_added_event(&reasoning_item_id),
                                        ));
                                        emit_log(
                                            &app_handle,
                                            "info",
                                            format!(
                                                "Codex Gateway SSE 向下游发送 response.reasoning_summary_part.added: response_id={} item_id={} elapsed_ms={}",
                                                response_id,
                                                reasoning_item_id,
                                                stream_started_at.elapsed().as_millis()
                                            ),
                                        );
                                        yield Ok(json_event(
                                            "response.reasoning_summary_part.added",
                                            reasoning_summary_part_added_event(&reasoning_item_id),
                                        ));
                                    }

                                    stream_state.reasoning_text.push_str(&delta_parts.reasoning);
                                    emit_log(
                                        &app_handle,
                                        "info",
                                        format!(
                                            "Codex Gateway SSE 向下游转发 reasoning 增量: response_id={} raw_event={} parsed_chunk={} delta_chars={} preview={} elapsed_ms={}",
                                            response_id,
                                            raw_event_count,
                                            parsed_chunk_count,
                                            delta_parts.reasoning.chars().count(),
                                            preview_text_for_log(&delta_parts.reasoning, 80),
                                            stream_started_at.elapsed().as_millis()
                                        ),
                                    );
                                    yield Ok(json_event(
                                        "response.reasoning_summary_text.delta",
                                        reasoning_summary_text_delta_event(&reasoning_item_id, &delta_parts.reasoning),
                                    ));
                                }

                                let delta_text = delta_parts.text;
                                if !delta_text.is_empty() {
                                    let delta_chars = delta_text.chars().count();
                                    chunk_delta_chars += delta_chars;
                                    if !stream_state.message_started {
                                        stream_state.message_started = true;
                                        emit_log(
                                            &app_handle,
                                            "info",
                                            format!(
                                                "Codex Gateway SSE 向下游发送 response.output_item.added: response_id={} raw_event={} parsed_chunk={} elapsed_ms={}",
                                                response_id,
                                                raw_event_count,
                                                parsed_chunk_count,
                                                stream_started_at.elapsed().as_millis()
                                            ),
                                        );
                                        yield Ok(json_event(
                                            "response.output_item.added",
                                            assistant_message_added_event(&message_item_id, ""),
                                        ));
                                    }

                                    stream_state.message_text.push_str(&delta_text);
                                    forwarded_text_event_count += 1;
                                    forwarded_text_chars += delta_chars;
                                    emit_log(
                                        &app_handle,
                                        "info",
                                        format!(
                                            "Codex Gateway SSE 向下游转发文本增量: response_id={} raw_event={} parsed_chunk={} delta_chars={} total_chars={} preview={} elapsed_ms={}",
                                            response_id,
                                            raw_event_count,
                                            parsed_chunk_count,
                                            delta_chars,
                                            forwarded_text_chars,
                                            preview_text_for_log(&delta_text, 80),
                                            stream_started_at.elapsed().as_millis()
                                        ),
                                    );
                                    yield Ok(json_event(
                                        "response.output_text.delta",
                                        json!({
                                            "type": "response.output_text.delta",
                                            "delta": delta_text,
                                        }),
                                    ));
                                }

                                if let Some(tool_calls) = delta.get("tool_calls").and_then(Value::as_array) {
                                    chunk_tool_call_deltas += tool_calls.len();
                                    forwarded_tool_call_delta_count += tool_calls.len();
                                    emit_log(
                                        &app_handle,
                                        "info",
                                        format!(
                                            "Codex Gateway SSE 收到工具调用增量: response_id={} raw_event={} parsed_chunk={} delta_count={} total_delta_count={} elapsed_ms={}",
                                            response_id,
                                            raw_event_count,
                                            parsed_chunk_count,
                                            tool_calls.len(),
                                            forwarded_tool_call_delta_count,
                                            stream_started_at.elapsed().as_millis()
                                        ),
                                    );
                                    apply_tool_call_deltas(&mut stream_state.tool_calls, tool_calls, &response_id);
                                }
                            }

                            if let Some(message) = choice.get("message") {
                                let message_parts = route.adapter.sanitize_response_message(message);
                                let message_text = message_parts.text;
                                if !message_parts.reasoning.is_empty() {
                                    stream_state.reasoning_text = message_parts.reasoning;
                                    stream_state.reasoning_started = true;
                                    emit_log(
                                        &app_handle,
                                        "info",
                                        format!(
                                            "Codex Gateway SSE 收到完整 reasoning 覆盖: response_id={} raw_event={} parsed_chunk={} reasoning_chars={} preview={} elapsed_ms={}",
                                            response_id,
                                            raw_event_count,
                                            parsed_chunk_count,
                                            stream_state.reasoning_text.chars().count(),
                                            preview_text_for_log(&stream_state.reasoning_text, 80),
                                            stream_started_at.elapsed().as_millis()
                                        ),
                                    );
                                }
                                if !message_text.is_empty() {
                                    chunk_message_chars += message_text.chars().count();
                                    stream_state.message_text = message_text;
                                    stream_state.message_started = true;
                                    stream_state.minimax_response_text = MiniMaxResponseTextState::default();
                                    emit_log(
                                        &app_handle,
                                        "info",
                                        format!(
                                            "Codex Gateway SSE 收到完整 message 覆盖: response_id={} raw_event={} parsed_chunk={} message_chars={} preview={} elapsed_ms={}",
                                            response_id,
                                            raw_event_count,
                                            parsed_chunk_count,
                                            chunk_message_chars,
                                            preview_text_for_log(&stream_state.message_text, 80),
                                            stream_started_at.elapsed().as_millis()
                                        ),
                                    );
                                }

                                if let Some(tool_calls) = message.get("tool_calls").and_then(Value::as_array) {
                                    chunk_tool_call_deltas += tool_calls.len();
                                    forwarded_tool_call_delta_count += tool_calls.len();
                                    emit_log(
                                        &app_handle,
                                        "info",
                                        format!(
                                            "Codex Gateway SSE 收到完整 message 工具调用: response_id={} raw_event={} parsed_chunk={} delta_count={} total_delta_count={} elapsed_ms={}",
                                            response_id,
                                            raw_event_count,
                                            parsed_chunk_count,
                                            tool_calls.len(),
                                            forwarded_tool_call_delta_count,
                                            stream_started_at.elapsed().as_millis()
                                        ),
                                    );
                                    apply_tool_call_deltas(&mut stream_state.tool_calls, tool_calls, &response_id);
                                }
                            }
                        }
                    }

                    emit_log(
                        &app_handle,
                        "info",
                        format!(
                            "Codex Gateway SSE 已处理 chunk: response_id={} raw_event={} parsed_chunk={} usage_present={} delta_chars={} message_chars={} tool_call_deltas={} finish_reasons={} elapsed_ms={}",
                            response_id,
                            raw_event_count,
                            parsed_chunk_count,
                            usage_present,
                            chunk_delta_chars,
                            chunk_message_chars,
                            chunk_tool_call_deltas,
                            if chunk_finish_reasons.is_empty() {
                                "none".to_string()
                            } else {
                                chunk_finish_reasons.join("|")
                            },
                            stream_started_at.elapsed().as_millis()
                        ),
                    );
                }
                Err(error) => {
                    consecutive_errors += 1;
                    emit_log(&app_handle, "warn", format!(
                        "Codex Gateway SSE 读取错误 ({}/{}): response_id={} raw_events={} parsed_chunks={} elapsed_ms={} error={}",
                        consecutive_errors,
                        max_consecutive_errors,
                        response_id,
                        raw_event_count,
                        parsed_chunk_count,
                        stream_started_at.elapsed().as_millis(),
                        error
                    ));
                    if consecutive_errors >= max_consecutive_errors {
                        emit_log(&app_handle, "error", format!(
                            "Codex Gateway 连续 {} 次读取失败，中断流: response_id={} raw_events={} parsed_chunks={} forwarded_text_events={} forwarded_text_chars={} tool_call_deltas={} elapsed_ms={}",
                            max_consecutive_errors,
                            response_id,
                            raw_event_count,
                            parsed_chunk_count,
                            forwarded_text_event_count,
                            forwarded_text_chars,
                            forwarded_tool_call_delta_count,
                            stream_started_at.elapsed().as_millis()
                        ));
                        emit_log(
                            &app_handle,
                            "error",
                            format!(
                                "Codex Gateway SSE 向下游发送 response.failed: response_id={} reason=连续 {} 次 SSE 读取失败 elapsed_ms={}",
                                response_id,
                                max_consecutive_errors,
                                stream_started_at.elapsed().as_millis()
                            ),
                        );
                        yield Ok(json_event(
                            "response.failed",
                            response_failed_event(&response_id, format!("连续 {} 次 SSE 读取失败: {}", max_consecutive_errors, error)),
                        ));
                        return;
                    }
                    continue;
                }
            }
        }

        if !received_done_event
            && !saw_terminal_finish_reason
            && stream_state.reasoning_text.is_empty()
            && stream_state.message_text.is_empty()
            && stream_state.tool_calls.is_empty()
        {
            let error_message = "上游 SSE 在返回任何内容前中断";
            emit_log(
                &app_handle,
                "error",
                format!(
                    "Codex Gateway {}: response_id={} raw_events={} parsed_chunks={} elapsed_ms={}",
                    error_message,
                    response_id,
                    raw_event_count,
                    parsed_chunk_count,
                    stream_started_at.elapsed().as_millis()
                ),
            );
            emit_log(
                &app_handle,
                "error",
                format!(
                    "Codex Gateway SSE 向下游发送 response.failed: response_id={} reason={} elapsed_ms={}",
                    response_id,
                    error_message,
                    stream_started_at.elapsed().as_millis()
                ),
            );
            yield Ok(json_event(
                "response.failed",
                response_failed_event(&response_id, error_message),
            ));
            return;
        }

        if !received_done_event && !saw_terminal_finish_reason {
            emit_log(
                &app_handle,
                "warn",
                format!(
                    "Codex Gateway 上游 SSE 未返回完成标记，但已有内容，继续完成响应: response_id={} raw_events={} parsed_chunks={} forwarded_text_events={} forwarded_text_chars={} tool_call_deltas={} elapsed_ms={}",
                    response_id,
                    raw_event_count,
                    parsed_chunk_count,
                    forwarded_text_event_count,
                    forwarded_text_chars,
                    forwarded_tool_call_delta_count,
                    stream_started_at.elapsed().as_millis()
                ),
            );
        }

        let output_items = stream_output_items(&reasoning_item_id, &message_item_id, &stream_state);

        if stream_state.reasoning_started {
            emit_log(
                &app_handle,
                "info",
                format!(
                    "Codex Gateway SSE 向下游发送 reasoning output_item.done: response_id={} item_id={} reasoning_chars={} elapsed_ms={}",
                    response_id,
                    reasoning_item_id,
                    stream_state.reasoning_text.chars().count(),
                    stream_started_at.elapsed().as_millis()
                ),
            );
            yield Ok(json_event(
                "response.output_item.done",
                reasoning_item_done_event(&reasoning_item_id, &stream_state.reasoning_text),
            ));
        }

        if stream_state.message_started {
            emit_log(
                &app_handle,
                "info",
                format!(
                    "Codex Gateway SSE 向下游发送 response.output_item.done: response_id={} item_id={} text_chars={} elapsed_ms={}",
                    response_id,
                    message_item_id,
                    stream_state.message_text.chars().count(),
                    stream_started_at.elapsed().as_millis()
                ),
            );
            yield Ok(json_event(
                "response.output_item.done",
                assistant_message_done_event(&message_item_id, &stream_state.message_text),
            ));
        }

        for tool_call in stream_state.tool_calls.into_values() {
            emit_log(
                &app_handle,
                "info",
                format!(
                    "Codex Gateway SSE 向下游发送 function_call done: response_id={} call_id={} name={} argument_chars={} elapsed_ms={}",
                    response_id,
                    tool_call.call_id,
                    tool_call.name,
                    tool_call.arguments.chars().count(),
                    stream_started_at.elapsed().as_millis()
                ),
            );
            yield Ok(json_event(
                "response.output_item.done",
                function_call_done_event(&tool_call),
            ));
        }

        emit_log(
            &app_handle,
            "info",
            format!(
                "Codex Gateway SSE 向下游发送 response.completed: response_id={} raw_events={} parsed_chunks={} forwarded_text_events={} forwarded_text_chars={} tool_call_deltas={} done_event={} terminal_finish_reason={} elapsed_ms={}",
                response_id,
                raw_event_count,
                parsed_chunk_count,
                forwarded_text_event_count,
                forwarded_text_chars,
                forwarded_tool_call_delta_count,
                received_done_event,
                saw_terminal_finish_reason,
                stream_started_at.elapsed().as_millis()
            ),
        );
        yield Ok(json_event(
            "response.completed",
            response_completed_event(&response_id, &target_model_name, output_items, &usage_totals),
        ));
    };

    Sse::new(event_stream)
        .keep_alive(
            KeepAlive::new()
                .interval(std::time::Duration::from_secs(3))
                .text("ping"),
        )
        .into_response()
}

fn build_chat_request(body: &Value, route: &RouteState) -> Result<Value, String> {
    let messages = build_chat_messages(body, &route.adapter)?;
    if messages.is_empty() {
        return Err("Responses input 为空，无法转换为 Chat messages".to_string());
    }

    let mut request = serde_json::Map::new();
    request.insert("model".to_string(), Value::String(route.target_model_name.clone()));
    request.insert(
        "stream".to_string(),
        Value::Bool(body.get("stream").and_then(Value::as_bool).unwrap_or(true)),
    );
    request.insert("messages".to_string(), Value::Array(messages));

    copy_value(body, &mut request, "temperature");
    copy_value(body, &mut request, "top_p");
    copy_value(body, &mut request, "parallel_tool_calls");
    copy_value(body, &mut request, "stop");
    copy_value(body, &mut request, "seed");
    copy_value(body, &mut request, "presence_penalty");
    copy_value(body, &mut request, "frequency_penalty");
    copy_value(body, &mut request, "user");

    if let Some(max_tokens) = body.get("max_output_tokens") {
        request.insert("max_tokens".to_string(), max_tokens.clone());
    }

    if let Some(response_format) = body
        .get("text")
        .and_then(|text| text.get("format"))
        .cloned()
    {
        request.insert("response_format".to_string(), response_format);
    }

    if let Some(tool_choice) = map_tool_choice(body.get("tool_choice")) {
        request.insert("tool_choice".to_string(), tool_choice);
    }

    if let Some(tools) = body.get("tools").and_then(Value::as_array) {
        let mapped_tools = tools
            .iter()
            .filter_map(map_tool_definition)
            .collect::<Vec<_>>();
        if !mapped_tools.is_empty() {
            request.insert("tools".to_string(), Value::Array(mapped_tools));
        }
    }

    Ok(Value::Object(request))
}

fn build_chat_messages(body: &Value, adapter: &ProviderAdapter) -> Result<Vec<Value>, String> {
    let mut messages = Vec::new();

    if let Some(instructions) = body.get("instructions").and_then(Value::as_str) {
        let instructions = instructions.trim();
        if !instructions.is_empty() {
            messages.push(json!({
                "role": adapter.normalize_role("system"),
                "content": instructions,
            }));
        }
    }

    match body.get("input") {
        Some(Value::String(text)) => {
            let text = text.trim();
            if !text.is_empty() {
                messages.push(json!({
                    "role": "user",
                    "content": text,
                }));
            }
        }
        Some(Value::Array(items)) => {
            for item in items {
                append_input_item_as_chat_message(&mut messages, item, adapter)?;
            }
        }
        Some(Value::Object(_)) => append_input_item_as_chat_message(&mut messages, body.get("input").unwrap(), adapter)?,
        Some(_) => return Err("Responses input 类型不受支持".to_string()),
        None => {}
    }

    Ok(adapter.normalize_messages(messages))
}

fn append_input_item_as_chat_message(messages: &mut Vec<Value>, item: &Value, adapter: &ProviderAdapter) -> Result<(), String> {
    let item_type = item.get("type").and_then(Value::as_str);
    let raw_role = item
        .get("role")
        .and_then(Value::as_str)
        .unwrap_or("user");
    let role = adapter.normalize_role(raw_role);

    match item_type {
        Some("message") | None if item.get("role").is_some() => {
            let content = map_message_content(item.get("content"));
            messages.push(json!({
                "role": role.to_string(),
                "content": content,
            }));
        }
        Some("input_text") | Some("output_text") | Some("text") => {
            let text = item.get("text").and_then(Value::as_str).unwrap_or("");
            messages.push(json!({
                "role": "user",
                "content": text,
            }));
        }
        Some("function_call") => {
            let call_id = item
                .get("call_id")
                .or_else(|| item.get("id"))
                .and_then(Value::as_str)
                .unwrap_or("call_legacy");
            let name = item.get("name").and_then(Value::as_str).unwrap_or("tool");
            let arguments = item
                .get("arguments")
                .and_then(Value::as_str)
                .unwrap_or("{}");
            messages.push(json!({
                "role": "assistant",
                "content": "",
                "tool_calls": [{
                    "id": call_id,
                    "type": "function",
                    "function": {
                        "name": name,
                        "arguments": arguments,
                    }
                }]
            }));
        }
        Some("custom_tool_call") => {
            let call_id = item
                .get("call_id")
                .or_else(|| item.get("id"))
                .and_then(Value::as_str)
                .unwrap_or("custom_call");
            let name = item.get("name").and_then(Value::as_str).unwrap_or("custom_tool");
            let arguments = normalize_custom_tool_arguments(item.get("input"));
            messages.push(json!({
                "role": "assistant",
                "content": "",
                "tool_calls": [{
                    "id": call_id,
                    "type": "function",
                    "function": {
                        "name": name,
                        "arguments": arguments,
                    }
                }]
            }));
        }
        Some("tool_search_call") => {
            let call_id = item
                .get("call_id")
                .or_else(|| item.get("id"))
                .and_then(Value::as_str)
                .unwrap_or("tool_search_call");
            let arguments = serde_json::to_string(item.get("arguments").unwrap_or(&json!({})))
                .map_err(|error| format!("序列化 tool_search_call 参数失败: {}", error))?;
            messages.push(json!({
                "role": "assistant",
                "content": "",
                "tool_calls": [{
                    "id": call_id,
                    "type": "function",
                    "function": {
                        "name": "tool_search",
                        "arguments": arguments,
                    }
                }]
            }));
        }
        Some("function_call_output") | Some("custom_tool_call_output") | Some("tool_search_output") => {
            let call_id = item
                .get("call_id")
                .or_else(|| item.get("id"))
                .and_then(Value::as_str)
                .ok_or_else(|| "tool output 缺少 call_id".to_string())?;
            messages.push(json!({
                "role": "tool",
                "tool_call_id": call_id,
                "content": extract_tool_output_text(item),
            }));
        }
        Some(_) => {
            let content = extract_message_text(item.get("content").or_else(|| item.get("output")));
            if !content.is_empty() {
                messages.push(json!({
                    "role": role.to_string(),
                    "content": content,
                }));
            }
        }
        None => {
            let content = extract_message_text(Some(item));
            if !content.is_empty() {
                messages.push(json!({
                    "role": role.to_string(),
                    "content": content,
                }));
            }
        }
    }

    Ok(())
}

fn map_message_content(content: Option<&Value>) -> Value {
    let Some(content) = content else {
        return Value::String(String::new());
    };

    match content {
        Value::String(text) => Value::String(text.clone()),
        Value::Array(items) => {
            let mut structured = Vec::new();
            let mut plain_text = String::new();

            for item in items {
                let item_type = item.get("type").and_then(Value::as_str).unwrap_or("text");
                match item_type {
                    "input_text" | "output_text" | "text" | "summary_text" | "reasoning_text" => {
                        if let Some(text) = item.get("text").and_then(Value::as_str) {
                            plain_text.push_str(text);
                            structured.push(json!({
                                "type": "text",
                                "text": text,
                            }));
                        }
                    }
                    "input_image" => {
                        if let Some(url) = item.get("image_url").and_then(Value::as_str).or_else(|| item.get("url").and_then(Value::as_str)) {
                            structured.push(json!({
                                "type": "image_url",
                                "image_url": { "url": url },
                            }));
                        }
                    }
                    _ => {}
                }
            }

            if structured.is_empty() {
                Value::String(plain_text)
            } else if structured.iter().all(|item| item.get("type").and_then(Value::as_str) == Some("text")) {
                Value::String(plain_text)
            } else {
                Value::Array(structured)
            }
        }
        _ => Value::String(extract_message_text(Some(content))),
    }
}

fn map_tool_definition(tool: &Value) -> Option<Value> {
    let tool_type = tool.get("type").and_then(Value::as_str).unwrap_or("function");
    let name = tool
        .get("function")
        .and_then(|function| function.get("name"))
        .or_else(|| tool.get("name"))
        .and_then(Value::as_str)?;

    let description = tool
        .get("function")
        .and_then(|function| function.get("description"))
        .or_else(|| tool.get("description"))
        .cloned()
        .unwrap_or(Value::Null);

    let parameters = tool
        .get("function")
        .and_then(|function| function.get("parameters"))
        .or_else(|| tool.get("parameters"))
        .or_else(|| tool.get("input_schema"))
        .cloned()
        .unwrap_or(json!({
            "type": "object",
            "properties": {},
        }));

    match tool_type {
        "function" | "custom" | "tool_search" => Some(json!({
            "type": "function",
            "function": {
                "name": name,
                "description": description,
                "parameters": parameters,
            }
        })),
        _ => None,
    }
}

fn map_tool_choice(tool_choice: Option<&Value>) -> Option<Value> {
    let tool_choice = tool_choice?;
    match tool_choice {
        Value::String(_) => Some(tool_choice.clone()),
        Value::Object(object) => {
            if object.get("type").and_then(Value::as_str) == Some("function") {
                let name = object.get("name").and_then(Value::as_str).or_else(|| {
                    object
                        .get("function")
                        .and_then(|function| function.get("name"))
                        .and_then(Value::as_str)
                })?;
                Some(json!({
                    "type": "function",
                    "function": { "name": name }
                }))
            } else {
                None
            }
        }
        _ => None,
    }
}

fn build_non_stream_response(upstream_response: &Value, route: &RouteState) -> Value {
    let response_id = format!("resp_{}", Uuid::new_v4().simple());
    let choice = upstream_response
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .cloned()
        .unwrap_or_else(|| json!({}));
    let message = choice.get("message").cloned().unwrap_or_else(|| json!({}));
    let parts = route.adapter.sanitize_response_message(&message);
    let mut output_items = Vec::new();

    if !parts.reasoning.is_empty() {
        output_items.push(reasoning_item(
            &format!("rsn_{}", Uuid::new_v4().simple()),
            &parts.reasoning,
            "completed",
        ));
    }

    if !parts.text.is_empty() {
        output_items.push(json!({
            "type": "message",
            "role": "assistant",
            "id": format!("msg_{}", Uuid::new_v4().simple()),
            "content": [{
                "type": "output_text",
                "text": parts.text,
            }]
        }));
    }

    if let Some(tool_calls) = message.get("tool_calls").and_then(Value::as_array) {
        for tool_call in tool_calls {
            let call_id = tool_call.get("id").and_then(Value::as_str).unwrap_or("call");
            let name = tool_call
                .get("function")
                .and_then(|function| function.get("name"))
                .and_then(Value::as_str)
                .unwrap_or("tool");
            let arguments = tool_call
                .get("function")
                .and_then(|function| function.get("arguments"))
                .and_then(Value::as_str)
                .unwrap_or("{}");
            output_items.push(json!({
                "type": "function_call",
                "call_id": call_id,
                "name": name,
                "arguments": arguments,
            }));
        }
    }

    json!({
        "id": response_id,
        "object": "response",
        "created_at": chrono::Utc::now().timestamp(),
        "status": "completed",
        "model": route.target_model_name,
        "output": output_items,
        "usage": UsageTotals::from_value(upstream_response.get("usage")).as_json(),
    })
}

fn build_chat_completions_url(base_url: &str) -> Result<String, String> {
    let normalized = if base_url.ends_with('/') {
        base_url.to_string()
    } else {
        format!("{}/", base_url)
    };

    reqwest::Url::parse(&normalized)
        .and_then(|url| url.join("chat/completions"))
        .map(|url| url.to_string())
        .map_err(|error| format!("构建 Chat Completions 地址失败: {}", error))
}

fn build_upstream_request(
    client: &reqwest::Client,
    route: &RouteState,
    upstream_url: &str,
    chat_request: &Value,
    stream_requested: bool,
) -> reqwest::RequestBuilder {
    let mut request_builder = client
        .post(upstream_url.to_string())
        .bearer_auth(route.api_key.clone())
        .header(reqwest::header::CONTENT_TYPE, "application/json");

    if stream_requested {
        request_builder = request_builder.header(reqwest::header::ACCEPT, "text/event-stream");
    }

    request_builder.json(chat_request)
}

fn copy_value(source: &Value, target: &mut serde_json::Map<String, Value>, key: &str) {
    if let Some(value) = source.get(key) {
        target.insert(key.to_string(), value.clone());
    }
}

const MINIMAX_THINK_OPEN_TAG: &str = "<think>";
const MINIMAX_THINK_CLOSE_TAG: &str = "</think>";

fn append_response_segment(target: &mut String, segment: &str) {
    if segment.is_empty() {
        return;
    }

    target.push_str(segment);
}

fn split_minimax_response_text(text: &str) -> ResponseContentParts {
    let mut parts = ResponseContentParts::default();
    let mut remaining = text;

    loop {
        let Some(start) = remaining.find(MINIMAX_THINK_OPEN_TAG) else {
            parts.text.push_str(remaining);
            break;
        };

        parts.text.push_str(&remaining[..start]);
        let after_open = &remaining[start + MINIMAX_THINK_OPEN_TAG.len()..];
        let Some(end) = after_open.find(MINIMAX_THINK_CLOSE_TAG) else {
            parts.reasoning.push_str(after_open);
            break;
        };

        parts.reasoning.push_str(&after_open[..end]);
        remaining = &after_open[end + MINIMAX_THINK_CLOSE_TAG.len()..];
    }

    if !parts.reasoning.is_empty() {
        parts.text = parts.text.trim_start().to_string();
    }

    parts
}

fn split_minimax_stream_text_delta(stream_state: &mut StreamState, delta_text: &str) -> ResponseContentParts {
    let mut parts = ResponseContentParts::default();
    if delta_text.is_empty() {
        return parts;
    }

    let minimax_state = &mut stream_state.minimax_response_text;
    minimax_state.pending_text.push_str(delta_text);

    loop {
        if minimax_state.inside_think_block {
            if let Some(end) = minimax_state.pending_text.find(MINIMAX_THINK_CLOSE_TAG) {
                parts.reasoning.push_str(&minimax_state.pending_text[..end]);
                minimax_state
                    .pending_text
                    .drain(..end + MINIMAX_THINK_CLOSE_TAG.len());
                minimax_state.inside_think_block = false;
                continue;
            }

            let safe_len = safe_emittable_prefix_len(&minimax_state.pending_text, MINIMAX_THINK_CLOSE_TAG);
            if safe_len == 0 {
                break;
            }

            parts.reasoning.push_str(&minimax_state.pending_text[..safe_len]);
            minimax_state.pending_text.drain(..safe_len);
            break;
        }

        if let Some(start) = minimax_state.pending_text.find(MINIMAX_THINK_OPEN_TAG) {
            parts.text.push_str(&minimax_state.pending_text[..start]);
            minimax_state
                .pending_text
                .drain(..start + MINIMAX_THINK_OPEN_TAG.len());
            minimax_state.inside_think_block = true;
            minimax_state.saw_think_block = true;
            continue;
        }

        let safe_len = safe_emittable_prefix_len(&minimax_state.pending_text, MINIMAX_THINK_OPEN_TAG);
        if safe_len == 0 {
            break;
        }

        parts.text.push_str(&minimax_state.pending_text[..safe_len]);
        minimax_state.pending_text.drain(..safe_len);
        break;
    }

    if !stream_state.message_started && minimax_state.saw_think_block && !parts.text.is_empty() {
        parts.text = parts.text.trim_start().to_string();
    }

    parts
}

fn safe_emittable_prefix_len(text: &str, tag: &str) -> usize {
    text.len().saturating_sub(partial_tag_suffix_len(text, tag))
}

fn partial_tag_suffix_len(text: &str, tag: &str) -> usize {
    let max_len = std::cmp::min(text.len(), tag.len().saturating_sub(1));
    for len in (1..=max_len).rev() {
        if text.ends_with(&tag[..len]) {
            return len;
        }
    }
    0
}

fn extract_message_text(value: Option<&Value>) -> String {
    let Some(value) = value else {
        return String::new();
    };

    match value {
        Value::String(text) => text.clone(),
        Value::Array(items) => items
            .iter()
            .filter_map(|item| item.get("text").and_then(Value::as_str).map(str::to_string))
            .collect::<Vec<_>>()
            .join(""),
        Value::Object(object) => object
            .get("text")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        _ => String::new(),
    }
}

fn extract_tool_output_text(item: &Value) -> String {
    if let Some(output) = item.get("output") {
        return extract_message_text(Some(output));
    }

    if let Some(content) = item.get("content") {
        return extract_message_text(Some(content));
    }

    String::new()
}

fn normalize_custom_tool_arguments(input: Option<&Value>) -> String {
    match input {
        Some(Value::String(text)) => {
            let trimmed = text.trim();
            if trimmed.starts_with('{') || trimmed.starts_with('[') {
                trimmed.to_string()
            } else {
                json!({ "input": trimmed }).to_string()
            }
        }
        Some(value) => value.to_string(),
        None => "{}".to_string(),
    }
}

fn apply_tool_call_deltas(
    tool_calls: &mut BTreeMap<usize, ToolCallState>,
    deltas: &[Value],
    response_id: &str,
) {
    for (fallback_index, delta) in deltas.iter().enumerate() {
        let index = delta
            .get("index")
            .and_then(Value::as_u64)
            .unwrap_or(fallback_index as u64) as usize;
        let entry = tool_calls.entry(index).or_insert_with(|| ToolCallState {
            call_id: format!("call_{}_{}", response_id, index),
            name: String::new(),
            arguments: String::new(),
        });

        if let Some(id) = delta.get("id").and_then(Value::as_str) {
            entry.call_id = id.to_string();
        }

        if let Some(function) = delta.get("function") {
            if let Some(name) = function.get("name").and_then(Value::as_str) {
                if entry.name.is_empty() {
                    entry.name = name.to_string();
                } else if entry.name != name {
                    entry.name.push_str(name);
                }
            }

            if let Some(arguments) = function.get("arguments").and_then(Value::as_str) {
                entry.arguments.push_str(arguments);
            }
        }
    }
}

fn assistant_message_item(message_id: &str, text: &str) -> Value {
    json!({
        "type": "message",
        "role": "assistant",
        "id": message_id,
        "content": [{
            "type": "output_text",
            "text": text,
        }],
    })
}

fn reasoning_item(reasoning_id: &str, text: &str, status: &str) -> Value {
    let summary = if text.is_empty() {
        Vec::<Value>::new()
    } else {
        vec![json!({
            "type": "summary_text",
            "text": text,
        })]
    };

    json!({
        "type": "reasoning",
        "id": reasoning_id,
        "summary": summary,
        "status": status,
    })
}

fn reasoning_item_added_event(reasoning_id: &str) -> Value {
    json!({
        "type": "response.output_item.added",
        "item": reasoning_item(reasoning_id, "", "in_progress")
    })
}

fn reasoning_item_done_event(reasoning_id: &str, text: &str) -> Value {
    json!({
        "type": "response.output_item.done",
        "item": reasoning_item(reasoning_id, text, "completed")
    })
}

fn reasoning_summary_part_added_event(reasoning_id: &str) -> Value {
    json!({
        "type": "response.reasoning_summary_part.added",
        "item_id": reasoning_id,
        "summary_index": 0,
        "part": {
            "type": "summary_text",
            "text": "",
        }
    })
}

fn reasoning_summary_text_delta_event(reasoning_id: &str, delta: &str) -> Value {
    json!({
        "type": "response.reasoning_summary_text.delta",
        "item_id": reasoning_id,
        "summary_index": 0,
        "delta": delta,
    })
}

fn assistant_message_added_event(message_id: &str, text: &str) -> Value {
    json!({
        "type": "response.output_item.added",
        "item": assistant_message_item(message_id, text)
    })
}

fn assistant_message_done_event(message_id: &str, text: &str) -> Value {
    json!({
        "type": "response.output_item.done",
        "item": assistant_message_item(message_id, text)
    })
}

fn function_call_item(tool_call: &ToolCallState) -> Value {
    json!({
        "type": "function_call",
        "call_id": tool_call.call_id,
        "name": tool_call.name,
        "arguments": tool_call.arguments,
    })
}

fn function_call_done_event(tool_call: &ToolCallState) -> Value {
    json!({
        "type": "response.output_item.done",
        "item": function_call_item(tool_call)
    })
}

fn response_failed_event(response_id: &str, message: impl Into<String>) -> Value {
    json!({
        "type": "response.failed",
        "response": {
            "id": response_id,
            "status": "failed",
            "error": { "message": message.into() }
        }
    })
}

fn stream_output_items(reasoning_id: &str, message_id: &str, stream_state: &StreamState) -> Vec<Value> {
    let mut output_items = Vec::new();

    if stream_state.reasoning_started {
        output_items.push(reasoning_item(reasoning_id, &stream_state.reasoning_text, "completed"));
    }

    if stream_state.message_started {
        output_items.push(assistant_message_item(message_id, &stream_state.message_text));
    }

    for tool_call in stream_state.tool_calls.values() {
        output_items.push(function_call_item(tool_call));
    }

    output_items
}

fn response_completed_event(
    response_id: &str,
    model: &str,
    output_items: Vec<Value>,
    usage_totals: &UsageTotals,
) -> Value {
    json!({
        "type": "response.completed",
        "response": {
            "id": response_id,
            "object": "response",
            "created_at": chrono::Utc::now().timestamp(),
            "status": "completed",
            "model": model,
            "output": output_items,
            "usage": usage_totals.as_json(),
        }
    })
}

fn choice_has_terminal_finish_reason(choice: &Value) -> bool {
    choice_finish_reason(choice).is_some()
}

fn choice_finish_reason<'a>(choice: &'a Value) -> Option<&'a str> {
    choice
        .get("finish_reason")
        .and_then(Value::as_str)
        .filter(|finish_reason| !finish_reason.is_empty())
}

fn preview_text_for_log(text: &str, max_chars: usize) -> String {
    let normalized = text.replace(['\n', '\r', '\t'], " ");
    let mut preview = normalized.chars().take(max_chars).collect::<String>();
    if normalized.chars().count() > max_chars {
        preview.push_str("...");
    }
    preview
}

fn json_event(kind: &str, payload: Value) -> Event {
    Event::default().event(kind).data(payload.to_string())
}

impl UsageTotals {
    fn merge(&mut self, usage: Option<&Value>) {
        let next = Self::from_value(usage);
        if next.total_tokens > 0 || next.input_tokens > 0 || next.output_tokens > 0 {
            *self = next;
        }
    }

    fn from_value(usage: Option<&Value>) -> Self {
        let input_tokens = usage
            .and_then(|value| usage_value(value, &["input_tokens", "prompt_tokens"]))
            .unwrap_or(0);
        let output_tokens = usage
            .and_then(|value| usage_value(value, &["output_tokens", "completion_tokens"]))
            .unwrap_or(0);
        let total_tokens = usage
            .and_then(|value| usage_value(value, &["total_tokens"]))
            .unwrap_or_else(|| {
                if input_tokens > 0 || output_tokens > 0 {
                    input_tokens + output_tokens
                } else {
                    0
                }
            });

        Self {
            input_tokens,
            output_tokens,
            total_tokens,
        }
    }

    fn as_json(&self) -> Value {
        json!({
            "input_tokens": self.input_tokens,
            "input_tokens_details": null,
            "output_tokens": self.output_tokens,
            "output_tokens_details": null,
            "total_tokens": self.total_tokens,
        })
    }
}

fn usage_value(usage: &Value, keys: &[&str]) -> Option<i64> {
    keys.iter()
        .find_map(|key| usage.get(*key).and_then(Value::as_i64))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_route() -> RouteState {
        RouteState {
            enabled: true,
            provider_id: "mimo".to_string(),
            provider_name: "MiMo".to_string(),
            target_base_url: "https://token-plan-sgp.xiaomimimo.com/v1".to_string(),
            target_model_name: "mimo-v2-pro".to_string(),
            api_key: "tp-test".to_string(),
            adapter: ProviderAdapter::Default,
        }
    }

    fn minimax_test_route() -> RouteState {
        RouteState {
            enabled: true,
            provider_id: "minimax".to_string(),
            provider_name: "MiniMax".to_string(),
            target_base_url: "https://api.minimaxi.com/v1".to_string(),
            target_model_name: "MiniMax-Text-01".to_string(),
            api_key: "mm-test".to_string(),
            adapter: ProviderAdapter::MiniMax,
        }
    }

    fn deepseek_test_route() -> RouteState {
        RouteState {
            enabled: true,
            provider_id: "deepseek".to_string(),
            provider_name: "DeepSeek".to_string(),
            target_base_url: "https://api.deepseek.com/v1".to_string(),
            target_model_name: "deepseek-chat".to_string(),
            api_key: "ds-test".to_string(),
            adapter: ProviderAdapter::DeepSeek,
        }
    }

    #[test]
    fn build_chat_request_maps_messages_and_tool_outputs() {
        let request = json!({
            "stream": true,
            "instructions": "system prompt",
            "input": [
                {
                    "type": "message",
                    "role": "user",
                    "content": [{ "type": "input_text", "text": "hello" }]
                },
                {
                    "type": "function_call",
                    "call_id": "call-1",
                    "name": "search",
                    "arguments": "{\"query\":\"hello\"}"
                },
                {
                    "type": "function_call_output",
                    "call_id": "call-1",
                    "output": [{ "type": "input_text", "text": "world" }]
                }
            ],
            "tools": [
                {
                    "type": "function",
                    "name": "search",
                    "description": "search docs",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": { "type": "string" }
                        }
                    }
                }
            ]
        });

        let chat_request = build_chat_request(&request, &test_route()).unwrap();
        let messages = chat_request.get("messages").and_then(Value::as_array).unwrap();
        let tools = chat_request.get("tools").and_then(Value::as_array).unwrap();

        assert_eq!(chat_request.get("model").and_then(Value::as_str), Some("mimo-v2-pro"));
        assert_eq!(messages.len(), 4);
        assert_eq!(messages[0].get("role").and_then(Value::as_str), Some("system"));
        assert_eq!(messages[1].get("role").and_then(Value::as_str), Some("user"));
        assert_eq!(messages[2].get("role").and_then(Value::as_str), Some("assistant"));
        assert_eq!(messages[3].get("role").and_then(Value::as_str), Some("tool"));
        assert_eq!(tools[0]["function"]["name"].as_str(), Some("search"));
    }

    #[test]
    fn build_non_stream_response_maps_text_and_tool_calls() {
        let upstream = json!({
            "usage": {
                "input_tokens": 10,
                "output_tokens": 5,
                "total_tokens": 15
            },
            "choices": [{
                "message": {
                    "content": "done",
                    "tool_calls": [{
                        "id": "call-1",
                        "type": "function",
                        "function": {
                            "name": "search",
                            "arguments": "{\"query\":\"hello\"}"
                        }
                    }]
                }
            }]
        });

        let response = build_non_stream_response(&upstream, &test_route());
        let output = response.get("output").and_then(Value::as_array).unwrap();

        assert_eq!(response.get("status").and_then(Value::as_str), Some("completed"));
        assert_eq!(output.len(), 2);
        assert_eq!(output[0]["type"].as_str(), Some("message"));
        assert_eq!(output[1]["type"].as_str(), Some("function_call"));
        assert_eq!(response["usage"]["total_tokens"].as_i64(), Some(15));
    }

    #[test]
    fn build_non_stream_response_with_reasoning_content_maps_reasoning_item() {
        let upstream = json!({
            "choices": [{
                "message": {
                    "reasoning_content": "internal reasoning",
                    "content": "Hello there"
                }
            }]
        });

        let response = build_non_stream_response(&upstream, &test_route());
        let output = response.get("output").and_then(Value::as_array).unwrap();

        assert_eq!(output.len(), 2);
        assert_eq!(output[0]["type"].as_str(), Some("reasoning"));
        assert_eq!(output[0]["summary"][0]["text"].as_str(), Some("internal reasoning"));
        assert_eq!(output[1]["type"].as_str(), Some("message"));
        assert_eq!(output[1]["content"][0]["text"].as_str(), Some("Hello there"));
    }

    #[test]
    fn build_non_stream_response_with_minimax_adapter_maps_think_block_to_reasoning() {
        let upstream = json!({
            "choices": [{
                "message": {
                    "content": "<think>internal reasoning</think>\n\nHello there"
                }
            }]
        });

        let response = build_non_stream_response(&upstream, &minimax_test_route());
        let output = response.get("output").and_then(Value::as_array).unwrap();

        assert_eq!(output.len(), 2);
        assert_eq!(output[0]["type"].as_str(), Some("reasoning"));
        assert_eq!(output[0]["summary"][0]["text"].as_str(), Some("internal reasoning"));
        assert_eq!(output[1]["content"][0]["text"].as_str(), Some("Hello there"));
    }

    #[test]
    fn apply_tool_call_deltas_accumulates_arguments() {
        let mut tool_calls = BTreeMap::new();
        apply_tool_call_deltas(
            &mut tool_calls,
            &[
                json!({
                    "index": 0,
                    "id": "call-1",
                    "function": { "name": "search", "arguments": "{\"q\":" }
                }),
                json!({
                    "index": 0,
                    "function": { "arguments": "\"hello\"}" }
                }),
            ],
            "resp-1",
        );

        let tool_call = tool_calls.get(&0).unwrap();
        assert_eq!(tool_call.call_id, "call-1");
        assert_eq!(tool_call.name, "search");
        assert_eq!(tool_call.arguments, "{\"q\":\"hello\"}");
    }

    #[test]
    fn terminal_finish_reason_detection_matches_stream_completion_semantics() {
        assert!(choice_has_terminal_finish_reason(&json!({
            "finish_reason": "stop"
        })));
        assert!(choice_has_terminal_finish_reason(&json!({
            "finish_reason": "tool_calls"
        })));
        assert!(!choice_has_terminal_finish_reason(&json!({
            "finish_reason": null
        })));
        assert!(!choice_has_terminal_finish_reason(&json!({})));
    }

    #[test]
    fn stream_completed_event_contains_terminal_response_shape() {
        let mut stream_state = StreamState {
            reasoning_text: "thinking".to_string(),
            reasoning_started: true,
            message_text: "done".to_string(),
            message_started: true,
            tool_calls: BTreeMap::new(),
            ..Default::default()
        };
        stream_state.tool_calls.insert(
            0,
            ToolCallState {
                call_id: "call-1".to_string(),
                name: "search".to_string(),
                arguments: "{\"q\":\"hello\"}".to_string(),
            },
        );

        let usage = UsageTotals {
            input_tokens: 11,
            output_tokens: 7,
            total_tokens: 18,
        };
        let event = response_completed_event(
            "resp-1",
            "mimo-v2-pro",
            stream_output_items("rsn-1", "msg-1", &stream_state),
            &usage,
        );
        let response = &event["response"];
        let output = response["output"].as_array().unwrap();

        assert_eq!(event["type"].as_str(), Some("response.completed"));
        assert_eq!(response["id"].as_str(), Some("resp-1"));
        assert_eq!(response["object"].as_str(), Some("response"));
        assert_eq!(response["status"].as_str(), Some("completed"));
        assert_eq!(response["model"].as_str(), Some("mimo-v2-pro"));
        assert_eq!(output.len(), 3);
        assert_eq!(output[0]["type"].as_str(), Some("reasoning"));
        assert_eq!(output[0]["id"].as_str(), Some("rsn-1"));
        assert_eq!(output[1]["type"].as_str(), Some("message"));
        assert_eq!(output[1]["id"].as_str(), Some("msg-1"));
        assert_eq!(output[2]["type"].as_str(), Some("function_call"));
        assert_eq!(response["usage"]["total_tokens"].as_i64(), Some(18));
    }

    #[test]
    fn default_adapter_stream_delta_maps_reasoning_content() {
        let adapter = ProviderAdapter::Default;
        let mut stream_state = StreamState::default();

        let delta = adapter.sanitize_stream_delta(
            &mut stream_state,
            &json!({
                "reasoning_content": "reasoning",
                "content": "Hello"
            }),
        );

        assert_eq!(delta.reasoning, "reasoning");
        assert_eq!(delta.text, "Hello");
    }

    #[test]
    fn minimax_stream_text_delta_splits_reasoning_and_visible_text_across_chunks() {
        let adapter = ProviderAdapter::MiniMax;
        let mut stream_state = StreamState::default();

        let first = adapter.sanitize_stream_delta(&mut stream_state, &json!({
            "content": "<think>internal"
        }));
        assert_eq!(first.reasoning, "internal");
        assert_eq!(first.text, "");

        let second = adapter.sanitize_stream_delta(&mut stream_state, &json!({
            "content": " reasoning</think>\n\nHello"
        }));
        assert_eq!(second.reasoning, " reasoning");
        assert_eq!(second.text, "Hello");
        stream_state.reasoning_started = true;
        stream_state.reasoning_text.push_str(&first.reasoning);
        stream_state.reasoning_text.push_str(&second.reasoning);
        stream_state.message_started = true;
        stream_state.message_text.push_str(&second.text);

        let third = adapter.sanitize_stream_delta(&mut stream_state, &json!({
            "content": " there"
        }));
        assert_eq!(third.reasoning, "");
        assert_eq!(third.text, " there");
        stream_state.message_text.push_str(&third.text);

        assert_eq!(stream_state.reasoning_text, "internal reasoning");
        assert_eq!(stream_state.message_text, "Hello there");
    }

    #[test]
    fn stream_output_items_include_reasoning_before_message() {
        let stream_state = StreamState {
            reasoning_text: "internal reasoning".to_string(),
            reasoning_started: true,
            message_text: "Hello there".to_string(),
            message_started: true,
            ..Default::default()
        };

        let output = stream_output_items("rsn-1", "msg-1", &stream_state);

        assert_eq!(output.len(), 2);
        assert_eq!(output[0]["type"].as_str(), Some("reasoning"));
        assert_eq!(output[1]["type"].as_str(), Some("message"));
    }

    #[test]
    fn default_adapter_preserves_think_block_response_text() {
        let adapter = ProviderAdapter::Default;
        assert_eq!(
            adapter.sanitize_response_text("<think>internal reasoning</think>\n\nHello there"),
            "<think>internal reasoning</think>\n\nHello there"
        );
    }

    #[test]
    fn usage_totals_support_prompt_and_completion_fallbacks() {
        let usage = UsageTotals::from_value(Some(&json!({
            "prompt_tokens": 13,
            "completion_tokens": 5,
        })));

        assert_eq!(usage.input_tokens, 13);
        assert_eq!(usage.output_tokens, 5);
        assert_eq!(usage.total_tokens, 18);
    }

    #[test]
    fn provider_adapter_detects_minimax_from_url() {
        assert_eq!(
            ProviderAdapter::from_upstream_url("https://api.minimaxi.com/v1"),
            ProviderAdapter::MiniMax
        );
        assert_eq!(
            ProviderAdapter::from_upstream_url("https://api.minimax.com/v1"),
            ProviderAdapter::MiniMax
        );
        assert_eq!(
            ProviderAdapter::from_upstream_url("https://token-plan-sgp.xiaomimimo.com/v1"),
            ProviderAdapter::Default
        );
        assert_eq!(
            ProviderAdapter::from_upstream_url("https://api.openai.com/v1"),
            ProviderAdapter::Default
        );
        assert_eq!(
            ProviderAdapter::from_upstream_url("https://api.deepseek.com/v1"),
            ProviderAdapter::DeepSeek
        );
    }

    #[test]
    fn deepseek_adapter_normalizes_developer_role_to_system() {
        let adapter = ProviderAdapter::DeepSeek;
        assert_eq!(adapter.normalize_role("developer"), "system");
        assert_eq!(adapter.normalize_role("user"), "user");
        assert_eq!(adapter.normalize_role("assistant"), "assistant");
        assert_eq!(adapter.normalize_role("tool"), "tool");
    }

    #[test]
    fn minimax_adapter_normalizes_developer_role_to_system() {
        let adapter = ProviderAdapter::MiniMax;
        assert_eq!(adapter.normalize_role("developer"), "system");
        assert_eq!(adapter.normalize_role("user"), "user");
        assert_eq!(adapter.normalize_role("assistant"), "assistant");
        assert_eq!(adapter.normalize_role("tool"), "tool");
    }

    #[test]
    fn default_adapter_preserves_developer_role() {
        let adapter = ProviderAdapter::Default;
        assert_eq!(adapter.normalize_role("developer"), "developer");
        assert_eq!(adapter.normalize_role("system"), "system");
    }

    #[test]
    fn build_chat_request_with_minimax_adapter_merges_system_messages() {
        let request = json!({
            "stream": true,
            "instructions": "You are a helpful assistant",
            "input": [
                {
                    "type": "message",
                    "role": "developer",
                    "content": [{ "type": "input_text", "text": "be precise" }]
                },
                {
                    "type": "message",
                    "role": "user",
                    "content": [{ "type": "input_text", "text": "hello" }]
                }
            ]
        });

        let chat_request = build_chat_request(&request, &minimax_test_route()).unwrap();
        let messages = chat_request.get("messages").and_then(Value::as_array).unwrap();

        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].get("role").and_then(Value::as_str), Some("system"));
        assert_eq!(
            messages[0].get("content").and_then(Value::as_str),
            Some("You are a helpful assistant\n\nbe precise")
        );
        assert_eq!(messages[1].get("role").and_then(Value::as_str), Some("user"));
    }

    #[test]
    fn build_chat_request_with_deepseek_adapter_converts_developer_to_system() {
        let request = json!({
            "stream": true,
            "instructions": "You are a helpful assistant",
            "input": [
                {
                    "type": "message",
                    "role": "developer",
                    "content": [{ "type": "input_text", "text": "be precise" }]
                },
                {
                    "type": "message",
                    "role": "user",
                    "content": [{ "type": "input_text", "text": "hello" }]
                }
            ]
        });

        let chat_request = build_chat_request(&request, &deepseek_test_route()).unwrap();
        let messages = chat_request.get("messages").and_then(Value::as_array).unwrap();

        assert_eq!(messages.len(), 3);
        assert_eq!(messages[0].get("role").and_then(Value::as_str), Some("system"));
        assert_eq!(messages[0].get("content").and_then(Value::as_str), Some("You are a helpful assistant"));
        assert_eq!(messages[1].get("role").and_then(Value::as_str), Some("system"));
        assert_eq!(messages[1].get("content").and_then(Value::as_str), Some("be precise"));
        assert_eq!(messages[2].get("role").and_then(Value::as_str), Some("user"));
    }

    #[test]
    fn build_chat_request_with_default_adapter_preserves_developer_role() {
        let request = json!({
            "stream": false,
            "input": [
                {
                    "type": "message",
                    "role": "developer",
                    "content": [{ "type": "input_text", "text": "be precise" }]
                },
                {
                    "type": "message",
                    "role": "user",
                    "content": [{ "type": "input_text", "text": "hello" }]
                }
            ]
        });

        let chat_request = build_chat_request(&request, &test_route()).unwrap();
        let messages = chat_request.get("messages").and_then(Value::as_array).unwrap();

        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].get("role").and_then(Value::as_str), Some("developer"));
        assert_eq!(messages[1].get("role").and_then(Value::as_str), Some("user"));
    }

    #[test]
    fn build_chat_request_with_default_adapter_keeps_multiple_system_messages() {
        let request = json!({
            "stream": false,
            "instructions": "You are a helpful assistant",
            "input": [
                {
                    "type": "message",
                    "role": "system",
                    "content": [{ "type": "input_text", "text": "be precise" }]
                },
                {
                    "type": "message",
                    "role": "user",
                    "content": [{ "type": "input_text", "text": "hello" }]
                }
            ]
        });

        let chat_request = build_chat_request(&request, &test_route()).unwrap();
        let messages = chat_request.get("messages").and_then(Value::as_array).unwrap();

        assert_eq!(messages.len(), 3);
        assert_eq!(messages[0].get("role").and_then(Value::as_str), Some("system"));
        assert_eq!(messages[0].get("content").and_then(Value::as_str), Some("You are a helpful assistant"));
        assert_eq!(messages[1].get("role").and_then(Value::as_str), Some("system"));
        assert_eq!(messages[1].get("content").and_then(Value::as_str), Some("be precise"));
        assert_eq!(messages[2].get("role").and_then(Value::as_str), Some("user"));
    }

}