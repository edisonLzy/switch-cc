use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provider {
    pub id: String,
    pub name: String,
    pub settings_config: serde_json::Value, // Claude settings.json 配置对象
    pub website_url: Option<String>,
    pub category: Option<String>, // 供应商分类
    pub created_at: Option<u64>, // 创建时间戳（毫秒）
}

impl Provider {
    pub fn new(
        id: String,
        name: String,
        settings_config: serde_json::Value,
        website_url: Option<String>,
        category: Option<String>,
    ) -> Self {
        Self {
            id,
            name,
            settings_config,
            website_url,
            category,
            created_at: Some(chrono::Utc::now().timestamp_millis() as u64),
        }
    }

    /// 验证供应商配置是否有效
    pub fn validate(&self) -> Result<(), String> {
        // 检查必要字段
        if self.name.trim().is_empty() {
            return Err("供应商名称不能为空".to_string());
        }

        // 检查配置格式
        if !self.settings_config.is_object() {
            return Err("配置必须是一个对象".to_string());
        }

        // 检查 env 节点
        let env = self.settings_config
            .get("env")
            .ok_or("缺少 env 配置节")?;

        if !env.is_object() {
            return Err("env 必须是一个对象".to_string());
        }

        // 检查 ANTHROPIC_AUTH_TOKEN
        if env.get("ANTHROPIC_AUTH_TOKEN").is_none() {
            return Err("缺少 ANTHROPIC_AUTH_TOKEN".to_string());
        }

        Ok(())
    }
}