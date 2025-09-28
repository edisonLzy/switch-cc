use tauri::{AppHandle, Manager, Position, Size};

/// MenuBar 窗口管理
pub struct MenuBarManager {
    app: AppHandle,
}

impl MenuBarManager {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    /// 显示 MenuBar 窗口
    pub fn show(&self) -> Result<(), String> {
        if let Some(window) = self.app.get_webview_window("menubar") {
            // 设置窗口位置（例如在屏幕右上角）
            let _ = self.position_menubar_window(&window);
            
            let _ = window.show();
            let _ = window.set_focus();
            
            log::info!("MenuBar 窗口已显示");
        } else {
            log::warn!("MenuBar 窗口不存在");
        }
        Ok(())
    }

    /// 隐藏 MenuBar 窗口
    pub fn hide(&self) -> Result<(), String> {
        if let Some(window) = self.app.get_webview_window("menubar") {
            let _ = window.hide();
            log::info!("MenuBar 窗口已隐藏");
        }
        Ok(())
    }

    /// 切换 MenuBar 窗口显示状态
    pub fn toggle(&self) -> Result<(), String> {
        if let Some(window) = self.app.get_webview_window("menubar") {
            match window.is_visible() {
                Ok(true) => self.hide(),
                Ok(false) => self.show(),
                Err(_) => self.show(),
            }
        } else {
            Err("MenuBar 窗口不存在".to_string())
        }
    }

    /// 定位 MenuBar 窗口位置
    fn position_menubar_window(&self, window: &tauri::WebviewWindow) -> Result<(), String> {
        #[cfg(target_os = "macos")]
        {
            // macOS: 在屏幕顶部菜单栏下方居中显示
            let screen_size = window.current_monitor()
                .map_err(|e| format!("获取屏幕信息失败: {}", e))?
                .and_then(|monitor| monitor.size().ok())
                .unwrap_or(tauri::Size::Physical(tauri::PhysicalSize { width: 1920, height: 1080 }));

            let window_size = window.outer_size()
                .map_err(|e| format!("获取窗口大小失败: {}", e))?;

            let x = (screen_size.width as i32 - window_size.width as i32) / 2;
            let y = 30; // 菜单栏下方一点

            let _ = window.set_position(Position::Physical(tauri::PhysicalPosition { x, y }));
        }

        #[cfg(target_os = "windows")]
        {
            // Windows: 在屏幕右上角显示
            let screen_size = window.current_monitor()
                .map_err(|e| format!("获取屏幕信息失败: {}", e))?
                .and_then(|monitor| monitor.size().ok())
                .unwrap_or(tauri::Size::Physical(tauri::PhysicalSize { width: 1920, height: 1080 }));

            let window_size = window.outer_size()
                .map_err(|e| format!("获取窗口大小失败: {}", e))?;

            let x = screen_size.width as i32 - window_size.width as i32 - 20;
            let y = 50;

            let _ = window.set_position(Position::Physical(tauri::PhysicalPosition { x, y }));
        }

        #[cfg(target_os = "linux")]
        {
            // Linux: 在屏幕右上角显示
            let screen_size = window.current_monitor()
                .map_err(|e| format!("获取屏幕信息失败: {}", e))?
                .and_then(|monitor| monitor.size().ok())
                .unwrap_or(tauri::Size::Physical(tauri::PhysicalSize { width: 1920, height: 1080 }));

            let window_size = window.outer_size()
                .map_err(|e| format!("获取窗口大小失败: {}", e))?;

            let x = screen_size.width as i32 - window_size.width as i32 - 20;
            let y = 50;

            let _ = window.set_position(Position::Physical(tauri::PhysicalPosition { x, y }));
        }

        Ok(())
    }
}