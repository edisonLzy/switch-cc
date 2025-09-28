use crate::config;
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub show_in_tray: bool,
    pub minimize_to_tray_on_close: bool,
    pub claude_config_dir: Option<String>,
    pub enable_menu_bar: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            show_in_tray: true,
            minimize_to_tray_on_close: true,
            claude_config_dir: None,
            enable_menu_bar: false,
        }
    }
}

/// 获取设置文件路径
fn get_settings_path() -> Result<std::path::PathBuf, String> {
    let config_dir = config::get_app_config_dir()?;
    Ok(config_dir.join("settings.json"))
}

/// 加载设置
pub fn get_settings() -> Settings {
    let settings_path = match get_settings_path() {
        Ok(path) => path,
        Err(_) => return Settings::default(),
    };

    if !settings_path.exists() {
        return Settings::default();
    }

    let content = match fs::read_to_string(&settings_path) {
        Ok(content) => content,
        Err(_) => return Settings::default(),
    };

    serde_json::from_str(&content).unwrap_or_default()
}

/// 保存设置
pub fn save_settings(settings: &Settings) -> Result<(), String> {
    let settings_path = get_settings_path()?;

    // 确保父目录存在
    if let Some(parent) = settings_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("创建设置目录失败: {}", e))?;
        }
    }

    let content = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("序列化设置失败: {}", e))?;

    fs::write(&settings_path, content)
        .map_err(|e| format!("写入设置文件失败: {}", e))?;

    Ok(())
}