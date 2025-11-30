use crate::config;
use crate::provider::Provider;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AppMode {
    Main,
    MenuBar,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
    pub providers: HashMap<String, Provider>,
    pub current: String,
    pub app_mode: AppMode,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            providers: HashMap::new(),
            current: String::new(),
            app_mode: AppMode::Main,
        }
    }
}

impl AppConfig {
    pub fn ensure_default_providers(&mut self) {
        // 如果没有供应商，可以在这里添加默认的官方供应商
        if self.providers.is_empty() {
            let official_provider = Provider {
                id: "official".to_string(),
                name: "Claude 官方".to_string(),
                settings_config: serde_json::json!({
                    "env": {
                        "ANTHROPIC_AUTH_TOKEN": ""
                    }
                }),
                website_url: Some("https://claude.ai".to_string()),
                category: Some("official".to_string()),
                created_at: Some(chrono::Utc::now().timestamp_millis() as u64),
                provider_type: crate::provider::ProviderType::Claude,
            };
            self.providers
                .insert("official".to_string(), official_provider);
        }
    }
}

pub struct AppState {
    pub config: Mutex<AppConfig>,
}

impl AppState {
    pub fn new() -> Self {
        let config = config::load_config().unwrap_or_default();
        Self {
            config: Mutex::new(config),
        }
    }

    pub fn save(&self) -> Result<(), String> {
        let config = self
            .config
            .lock()
            .map_err(|e| format!("获取锁失败: {}", e))?;
        config::save_config(&*config)
    }

    pub fn set_app_mode(&self, mode: AppMode) -> Result<(), String> {
        let mut config = self
            .config
            .lock()
            .map_err(|e| format!("获取锁失败: {}", e))?;
        config.app_mode = mode;
        drop(config);
        self.save()
    }

    pub fn get_app_mode(&self) -> Result<AppMode, String> {
        let config = self
            .config
            .lock()
            .map_err(|e| format!("获取锁失败: {}", e))?;
        Ok(config.app_mode.clone())
    }
}
