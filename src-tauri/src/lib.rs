mod commands;
mod config;
mod menubar;
mod provider;
mod settings;
mod store;

use store::AppState;
use tauri::{
    menu::{CheckMenuItem, Menu, MenuBuilder, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg(target_os = "macos")]
use tauri::RunEvent;

/// 创建动态托盘菜单
pub fn create_tray_menu(
    app: &tauri::AppHandle,
    app_state: &AppState,
) -> Result<Menu<tauri::Wry>, String> {
    let config = app_state
        .config
        .lock()
        .map_err(|e| format!("获取锁失败: {}", e))?;

    let mut menu_builder = MenuBuilder::new(app);

    // 顶部：打开主界面
    let show_main_item = MenuItem::with_id(app, "show_main", "打开主界面", true, None::<&str>)
        .map_err(|e| format!("创建打开主界面菜单失败: {}", e))?;
    menu_builder = menu_builder.item(&show_main_item).separator();

    // 添加所有供应商
    if !config.providers.is_empty() {
        for (id, provider) in &config.providers {
            let is_current = config.current == *id;
            let item = CheckMenuItem::with_id(
                app,
                format!("provider_{}", id),
                &provider.name,
                true,
                is_current,
                None::<&str>,
            )
            .map_err(|e| format!("创建菜单项失败: {}", e))?;
            menu_builder = menu_builder.item(&item);
        }
    } else {
        // 没有供应商时显示提示
        let empty_hint = MenuItem::with_id(
            app,
            "empty_hint",
            "  (无供应商，请在主界面添加)",
            false,
            None::<&str>,
        )
        .map_err(|e| format!("创建空提示失败: {}", e))?;
        menu_builder = menu_builder.item(&empty_hint);
    }

    // 分隔符和退出菜单
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)
        .map_err(|e| format!("创建退出菜单失败: {}", e))?;

    menu_builder = menu_builder.separator().item(&quit_item);

    menu_builder
        .build()
        .map_err(|e| format!("构建菜单失败: {}", e))
}

/// 处理托盘菜单事件
fn handle_tray_menu_event(app: &tauri::AppHandle, event_id: &str) {
    log::info!("处理托盘菜单事件: {}", event_id);

    match event_id {
        "show_main" => {
            // 切换到主界面模式并显示窗口
            if let Some(app_state) = app.try_state::<AppState>() {
                let _ = app_state.set_app_mode(crate::store::AppMode::Main);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        "quit" => {
            log::info!("退出应用");
            app.exit(0);
        }
        id if id.starts_with("provider_") => {
            let provider_id = id.strip_prefix("provider_").unwrap();
            log::info!("切换到供应商: {}", provider_id);

            // 执行切换
            let app_handle = app.clone();
            let provider_id = provider_id.to_string();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = switch_provider_internal(&app_handle, provider_id).await {
                    log::error!("切换供应商失败: {}", e);
                }
            });
        }
        _ => {
            log::warn!("未处理的菜单事件: {}", event_id);
        }
    }
}

/// 内部切换供应商函数
async fn switch_provider_internal(
    app: &tauri::AppHandle,
    provider_id: String,
) -> Result<(), String> {
    if let Some(app_state) = app.try_state::<AppState>() {
        // switch_provider 命令会处理所有逻辑：
        // 1. 更新配置和 Claude 配置文件
        // 2. 更新托盘菜单
        // 3. 发射事件到主窗口前端
        commands::switch_provider(app.clone(), app_state.clone().into(), provider_id).await?;
    }
    Ok(())
}

/// 更新托盘菜单的Tauri命令
#[tauri::command]
async fn update_tray_menu(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<bool, String> {
    if let Ok(new_menu) = create_tray_menu(&app, state.inner()) {
        if let Some(tray) = app.tray_by_id("main") {
            tray.set_menu(Some(new_menu))
                .map_err(|e| format!("更新托盘菜单失败: {}", e))?;
            return Ok(true);
        }
    }
    Ok(false)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // 单实例插件
    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }

    let builder = builder
        // 拦截窗口关闭：根据设置决定是否最小化到托盘
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                let settings = settings::get_settings();

                if settings.minimize_to_tray_on_close {
                    api.prevent_close();
                    let _ = window.hide();
                } else {
                    window.app_handle().exit(0);
                }
            }
            _ => {}
        })
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // 注册 Updater 插件（如果配置）
            #[cfg(desktop)]
            {
                if let Err(e) = app
                    .handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())
                {
                    log::warn!("初始化 Updater 插件失败，已跳过：{}", e);
                }
            }

            // 初始化日志
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // 初始化应用状态
            let app_state = AppState::new();

            // 初始化配置文件
            {
                let mut config_guard = app_state.config.lock().unwrap();
                config_guard.ensure_default_providers();
            }

            // 保存配置
            let _ = app_state.save();

            // 创建动态托盘菜单
            let menu = create_tray_menu(&app.handle(), &app_state)?;

            // 构建托盘
            let tray_builder = TrayIconBuilder::with_id("main")
                .on_tray_icon_event(|_tray, event| match event {
                    TrayIconEvent::Click { .. } => {}
                    _ => log::debug!("unhandled event {event:?}"),
                })
                .menu(&menu)
                .on_menu_event(|app, event| {
                    handle_tray_menu_event(app, &event.id.0);
                })
                .show_menu_on_left_click(true)
                .icon(app.default_window_icon().unwrap().clone());

            let _tray = tray_builder.build(app)?;

            // 注入全局状态
            app.manage(app_state);

            // 确保 MenuBar 窗口在启动时隐藏
            if let Some(menubar_window) = app.get_webview_window("menubar") {
                let _ = menubar_window.hide();

                // 在 macOS 上设置窗口不显示在 Dock 中
                #[cfg(target_os = "macos")]
                {
                    use tauri::Manager;
                    if let Some(window) = app.get_webview_window("menubar") {
                        // 尝试设置窗口级别和行为
                        let _ = window.set_skip_taskbar(true);
                    }
                }

                log::info!("MenuBar 窗口已在启动时隐藏");
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_providers,
            commands::get_current_provider,
            commands::add_provider,
            commands::update_provider,
            commands::delete_provider,
            commands::switch_provider,
            commands::import_current_config_as_default,
            commands::get_claude_config_status,
            commands::get_claude_config,
            commands::get_claude_config_path,
            commands::open_config_folder,
            commands::pick_directory,
            commands::open_external,
            commands::get_app_config_path,
            commands::open_app_config_folder,
            commands::get_settings,
            commands::save_settings,
            commands::check_for_updates,
            commands::get_app_version,
            commands::is_portable_mode,
            commands::set_app_mode,
            commands::get_app_mode,
            commands::show_menubar,
            commands::hide_menubar,
            commands::launch_claude_with_provider,
            update_tray_menu,
        ]);

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(|app_handle, event| {
        #[cfg(target_os = "macos")]
        match event {
            RunEvent::Reopen { .. } => {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        }

        #[cfg(not(target_os = "macos"))]
        {
            let _ = (app_handle, event);
        }
    });
}
