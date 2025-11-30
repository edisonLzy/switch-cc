use crate::config;
use crate::provider::Provider;
use crate::settings::Settings;
use crate::store::{AppMode, AppState};
use std::collections::HashMap;
use tauri::{AppHandle, Emitter, Manager, State};

#[tauri::command]
pub async fn get_providers(
    state: State<'_, AppState>,
) -> Result<HashMap<String, Provider>, String> {
    let config = state
        .config
        .lock()
        .map_err(|e| format!("获取锁失败: {}", e))?;
    Ok(config.providers.clone())
}

#[tauri::command]
pub async fn get_current_provider(state: State<'_, AppState>) -> Result<String, String> {
    let config = state
        .config
        .lock()
        .map_err(|e| format!("获取锁失败: {}", e))?;
    Ok(config.current.clone())
}

#[tauri::command]
pub async fn add_provider(state: State<'_, AppState>, provider: Provider) -> Result<(), String> {
    // 验证供应商配置
    provider.validate()?;

    let mut config = state
        .config
        .lock()
        .map_err(|e| format!("获取锁失败: {}", e))?;

    // 检查ID是否已存在
    if config.providers.contains_key(&provider.id) {
        return Err("供应商ID已存在".to_string());
    }

    config.providers.insert(provider.id.clone(), provider);

    // 如果是第一个供应商，设为当前
    if config.current.is_empty() {
        config.current = config.providers.keys().next().unwrap().clone();
    }

    drop(config);
    state.save()
}

#[tauri::command]
pub async fn update_provider(state: State<'_, AppState>, provider: Provider) -> Result<(), String> {
    // 验证供应商配置
    provider.validate()?;

    let mut config = state
        .config
        .lock()
        .map_err(|e| format!("获取锁失败: {}", e))?;

    if !config.providers.contains_key(&provider.id) {
        return Err("供应商不存在".to_string());
    }

    // 如果更新的是当前供应商，同时更新Claude配置
    let is_current = config.current == provider.id;

    config
        .providers
        .insert(provider.id.clone(), provider.clone());

    if is_current {
        // 合并Claude配置文件（只覆盖provider中指定的键）
        config::merge_claude_config(&provider.settings_config)?;
    }

    drop(config);
    state.save()
}

#[tauri::command]
pub async fn delete_provider(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let mut config = state
        .config
        .lock()
        .map_err(|e| format!("获取锁失败: {}", e))?;

    if !config.providers.contains_key(&id) {
        return Err("供应商不存在".to_string());
    }

    config.providers.remove(&id);

    // 如果删除的是当前供应商，切换到其他供应商
    if config.current == id {
        config.current = config
            .providers
            .keys()
            .next()
            .unwrap_or(&String::new())
            .clone();
    }

    drop(config);
    state.save()
}

#[tauri::command]
pub async fn switch_provider(
    app: AppHandle,
    state: State<'_, AppState>,
    provider_id: String,
) -> Result<bool, String> {
    let mut config = state
        .config
        .lock()
        .map_err(|e| format!("获取锁失败: {}", e))?;

    let provider = config
        .providers
        .get(&provider_id)
        .ok_or("供应商不存在")?
        .clone();

    // 合并Claude配置文件（只覆盖provider中指定的键）
    config::merge_claude_config(&provider.settings_config)?;

    // 更新当前供应商
    config.current = provider_id.clone();

    drop(config);
    state.save()?;

    // 更新托盘菜单
    if let Ok(new_menu) = crate::create_tray_menu(&app, state.inner()) {
        if let Some(tray) = app.tray_by_id("main") {
            if let Err(e) = tray.set_menu(Some(new_menu)) {
                log::error!("更新托盘菜单失败: {}", e);
            }
        }
    }

    // 发射事件到前端（明确发送到主窗口）
    let event_data = serde_json::json!({
        "providerId": provider_id
    });
    if let Err(e) = app.emit_to("main", "provider-switched", event_data) {
        log::error!("发射供应商切换事件失败: {}", e);
    }

    Ok(true)
}

#[tauri::command]
pub async fn import_current_config_as_default(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    // 尝试读取现有的Claude配置
    let claude_config = match config::read_claude_config() {
        Ok(config) => config,
        Err(_) => {
            return Ok(serde_json::json!({
                "success": false,
                "message": "未找到现有的Claude配置文件"
            }));
        }
    };

    // 创建默认供应商
    let default_provider = Provider::new(
        "imported_default".to_string(),
        "已导入配置".to_string(),
        claude_config,
        None,
        Some("custom".to_string()),
    );

    let mut config = state
        .config
        .lock()
        .map_err(|e| format!("获取锁失败: {}", e))?;

    // 只有在没有供应商时才导入
    if !config.providers.is_empty() {
        return Ok(serde_json::json!({
            "success": false,
            "message": "已存在供应商配置"
        }));
    }

    config
        .providers
        .insert(default_provider.id.clone(), default_provider.clone());
    config.current = default_provider.id;

    drop(config);
    state.save()?;

    Ok(serde_json::json!({
        "success": true,
        "message": "成功导入默认配置"
    }))
}

#[tauri::command]
pub async fn get_claude_config_status() -> Result<serde_json::Value, String> {
    let exists = config::claude_config_exists();
    let path = config::get_claude_config_path().unwrap_or_default();

    Ok(serde_json::json!({
        "exists": exists,
        "path": path.to_string_lossy()
    }))
}

#[tauri::command]
pub async fn get_claude_config() -> Result<serde_json::Value, String> {
    let exists = config::claude_config_exists();
    let path = config::get_claude_config_path().unwrap_or_default();

    if exists {
        match config::read_claude_config() {
            Ok(content) => Ok(serde_json::json!({
                "exists": true,
                "content": content,
                "path": path.to_string_lossy()
            })),
            Err(e) => Ok(serde_json::json!({
                "exists": true,
                "content": null,
                "path": path.to_string_lossy(),
                "error": e
            })),
        }
    } else {
        Ok(serde_json::json!({
            "exists": false,
            "path": path.to_string_lossy()
        }))
    }
}

#[tauri::command]
pub async fn get_claude_config_path() -> Result<String, String> {
    let path = config::get_claude_config_path()?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn open_config_folder() -> Result<(), String> {
    let claude_dir = config::get_claude_config_dir()?;

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&claude_dir)
            .spawn()
            .map_err(|e| format!("打开文件夹失败: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&claude_dir)
            .spawn()
            .map_err(|e| format!("打开文件夹失败: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&claude_dir)
            .spawn()
            .map_err(|e| format!("打开文件夹失败: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn pick_directory(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    use tokio::sync::oneshot;

    let (tx, rx) = oneshot::channel();

    app.dialog().file().pick_folder(move |path| {
        let result = path.map(|p| p.to_string());
        let _ = tx.send(result);
    });

    match rx.await {
        Ok(result) => Ok(result),
        Err(_) => Err("Failed to get directory selection result".to_string()),
    }
}

#[tauri::command]
pub async fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;

    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| format!("打开链接失败: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_app_config_path() -> Result<String, String> {
    let path = config::get_app_config_path()?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn open_app_config_folder() -> Result<(), String> {
    let config_dir = config::get_app_config_dir()?;

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&config_dir)
            .spawn()
            .map_err(|e| format!("打开文件夹失败: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&config_dir)
            .spawn()
            .map_err(|e| format!("打开文件夹失败: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&config_dir)
            .spawn()
            .map_err(|e| format!("打开文件夹失败: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_settings() -> Result<Settings, String> {
    Ok(crate::settings::get_settings())
}

#[tauri::command]
pub async fn save_settings(settings: Settings) -> Result<(), String> {
    crate::settings::save_settings(&settings)
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<(), String> {
    // 这里可以实现更新检查逻辑
    // 目前只是打开GitHub releases页面
    let url = "https://github.com/edisonLzy/switch-cc/releases";

    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| format!("打开更新页面失败: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_app_version() -> Result<String, String> {
    // 从 Cargo.toml 获取版本号
    Ok(env!("CARGO_PKG_VERSION").to_string())
}

#[tauri::command]
pub async fn is_portable_mode() -> Result<bool, String> {
    // 检查是否为便携模式（例如检查可执行文件目录下是否有portable.txt）
    Ok(false)
}

#[tauri::command]
pub async fn set_app_mode(
    state: State<'_, AppState>,
    app: AppHandle,
    mode: AppMode,
) -> Result<(), String> {
    state.set_app_mode(mode.clone())?;

    // 发送事件通知前端
    let event_data = serde_json::json!({
        "mode": match mode {
            AppMode::Main => "main",
            AppMode::MenuBar => "menubar",
        }
    });

    app.emit("app-mode-changed", event_data)
        .map_err(|e| format!("发送模式切换事件失败: {}", e))?;

    // 显示/隐藏对应窗口
    match mode {
        AppMode::Main => {
            if let Some(main_window) = app.get_webview_window("main") {
                let _ = main_window.show();
                let _ = main_window.set_focus();
            }
            if let Some(menubar_window) = app.get_webview_window("menubar") {
                let _ = menubar_window.hide();
            }
        }
        AppMode::MenuBar => {
            if let Some(main_window) = app.get_webview_window("main") {
                let _ = main_window.hide();
            }
            if let Some(menubar_window) = app.get_webview_window("menubar") {
                let _ = menubar_window.show();
                let _ = menubar_window.set_focus();
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn get_app_mode(state: State<'_, AppState>) -> Result<String, String> {
    println!("=== get_app_mode called ===");
    match state.get_app_mode() {
        Ok(mode) => {
            let mode_str = match mode {
                AppMode::Main => "main".to_string(),
                AppMode::MenuBar => "menubar".to_string(),
            };
            println!("返回应用模式: {}", mode_str);
            Ok(mode_str)
        }
        Err(e) => {
            println!("get_app_mode 错误: {}", e);
            Err(e)
        }
    }
}

#[tauri::command]
pub async fn show_menubar(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("menubar") {
        let _ = window.show();
        let _ = window.set_focus();
    }
    Ok(())
}

#[tauri::command]
pub async fn hide_menubar(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("menubar") {
        let _ = window.hide();
    }
    Ok(())
}

#[tauri::command]
pub async fn launch_claude_with_provider(
    state: State<'_, AppState>,
    provider_id: String,
) -> Result<(), String> {
    let config = state
        .config
        .lock()
        .map_err(|e| format!("获取锁失败: {}", e))?;

    let provider = config
        .providers
        .get(&provider_id)
        .ok_or("供应商不存在")?
        .clone();

    drop(config);

    // 提取环境变量
    let env_obj = provider
        .settings_config
        .get("env")
        .ok_or("缺少 env 配置节")?;

    let env_map = env_obj.as_object().ok_or("env 必须是一个对象")?;

    // 验证并收集环境变量（仅允许安全的键名）
    let mut safe_env_vars = Vec::new();
    for (key, value) in env_map {
        // 只允许以字母开头，包含字母、数字和下划线的键名
        if !key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
            || !key.starts_with(|c: char| c.is_ascii_alphabetic())
        {
            return Err(format!("Invalid environment variable name: {}", key));
        }

        if let Some(val_str) = value.as_str() {
            safe_env_vars.push((key.clone(), val_str.to_string()));
        }
    }

    // 根据不同平台启动终端并运行 claude
    #[cfg(target_os = "macos")]
    {
        // macOS: 使用 osascript 启动 Terminal.app
        // 使用单引号包裹值以防止shell注入，并转义单引号
        let env_exports = safe_env_vars
            .iter()
            .map(|(key, val)| {
                let escaped_val = val.replace("'", "'\\''");
                format!("export {}='{}'", key, escaped_val)
            })
            .collect::<Vec<_>>()
            .join("; ");

        let script = format!(
            "tell application \"Terminal\"\n\
             activate\n\
             do script \"{} && claude\"\n\
             end tell",
            env_exports.replace("\"", "\\\"")
        );

        std::process::Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .spawn()
            .map_err(|e| format!("启动终端失败: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        // Windows: 直接使用环境变量而不是通过 set 命令
        // 这样可以避免 shell 注入问题
        let mut cmd = std::process::Command::new("cmd");
        cmd.arg("/k").arg("claude");

        // 直接设置环境变量
        for (key, val) in &safe_env_vars {
            cmd.env(key, val);
        }

        // 尝试使用 Windows Terminal，如果失败则回退到 cmd
        let mut wt_cmd = std::process::Command::new("wt.exe");
        wt_cmd.arg("cmd").arg("/k").arg("claude");
        for (key, val) in &safe_env_vars {
            wt_cmd.env(key, val);
        }

        let result = wt_cmd.spawn();

        if result.is_err() {
            // 回退到普通 cmd
            cmd.spawn().map_err(|e| format!("启动终端失败: {}", e))?;
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Linux: 使用 bash -c 并使用单引号包裹值以防止 shell 注入
        let env_exports = safe_env_vars
            .iter()
            .map(|(key, val)| {
                let escaped_val = val.replace("'", "'\\''");
                format!("export {}='{}'", key, escaped_val)
            })
            .collect::<Vec<_>>()
            .join("; ");

        let command = format!("{} && claude", env_exports);

        // 尝试常见的 Linux 终端
        let terminals = vec![
            ("gnome-terminal", vec!["--", "bash", "-c", &command]),
            ("konsole", vec!["-e", "bash", "-c", &command]),
            ("xterm", vec!["-e", "bash", "-c", &command]),
            ("x-terminal-emulator", vec!["-e", "bash", "-c", &command]),
        ];

        let mut launched = false;
        for (terminal, args) in terminals {
            if let Ok(_) = std::process::Command::new(terminal).args(&args).spawn() {
                launched = true;
                break;
            }
        }

        if !launched {
            return Err("无法找到可用的终端模拟器".to_string());
        }
    }

    Ok(())
}
