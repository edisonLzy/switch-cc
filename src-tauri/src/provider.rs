use serde::{Deserialize, Serialize};
use serde_json::json;

/// 供应商类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ProviderType {
    Claude,
    Codex,
}

impl Default for ProviderType {
    fn default() -> Self {
        ProviderType::Claude
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provider {
    pub id: String,
    pub name: String,
    #[serde(rename = "settingsConfig")]
    pub settings_config: serde_json::Value, // Claude/Codex settings 配置对象
    #[serde(rename = "websiteUrl")]
    pub website_url: Option<String>,
    pub category: Option<String>, // 供应商分类
    #[serde(rename = "createdAt")]
    pub created_at: Option<u64>, // 创建时间戳（毫秒）
    #[serde(rename = "providerType", default)]
    pub provider_type: ProviderType, // 供应商类型 (Claude 或 Codex)
}

impl Provider {
    pub fn new(
        id: String,
        name: String,
        settings_config: serde_json::Value,
        website_url: Option<String>,
        category: Option<String>,
        provider_type: ProviderType,
    ) -> Self {
        Self {
            id,
            name,
            settings_config,
            website_url,
            category,
            created_at: Some(chrono::Utc::now().timestamp_millis() as u64),
            provider_type,
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

        match self.provider_type {
            ProviderType::Claude => self.validate_claude_config(),
            ProviderType::Codex => self.validate_codex_config(),
        }
    }

    /// 验证 Claude 供应商配置
    fn validate_claude_config(&self) -> Result<(), String> {
        // 检查 env 节点
        let env = self.settings_config.get("env").ok_or("缺少 env 配置节")?;

        if !env.is_object() {
            return Err("env 必须是一个对象".to_string());
        }

        // 检查认证配置 (支持 ANTHROPIC_AUTH_TOKEN 或 ANTHROPIC_API_KEY)
        if env.get("ANTHROPIC_AUTH_TOKEN").is_none() && env.get("ANTHROPIC_API_KEY").is_none() {
            return Err("缺少认证配置 (ANTHROPIC_AUTH_TOKEN 或 ANTHROPIC_API_KEY)".to_string());
        }

        Ok(())
    }

    /// 验证 Codex 供应商配置
    fn validate_codex_config(&self) -> Result<(), String> {
        // 检查 openai 节点
        let openai = self.settings_config.get("openai").ok_or("缺少 openai 配置节")?;

        if !openai.is_object() {
            return Err("openai 必须是一个对象".to_string());
        }

        // 检查认证配置
        if openai.get("api_key").is_none() {
            return Err("缺少认证配置 (openai.api_key)".to_string());
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_claude_with_auth_token_only() {
        let provider = Provider {
            id: "test-1".to_string(),
            name: "Test Provider".to_string(),
            settings_config: json!({
                "env": {
                    "ANTHROPIC_AUTH_TOKEN": "sk-ant-test123"
                }
            }),
            website_url: None,
            category: None,
            created_at: None,
            provider_type: ProviderType::Claude,
        };

        assert!(provider.validate().is_ok());
    }

    #[test]
    fn test_validate_claude_with_api_key_only() {
        let provider = Provider {
            id: "test-2".to_string(),
            name: "Test Provider".to_string(),
            settings_config: json!({
                "env": {
                    "ANTHROPIC_API_KEY": "sk-ant-test456"
                }
            }),
            website_url: None,
            category: None,
            created_at: None,
            provider_type: ProviderType::Claude,
        };

        assert!(provider.validate().is_ok());
    }

    #[test]
    fn test_validate_claude_with_both_tokens() {
        let provider = Provider {
            id: "test-3".to_string(),
            name: "Test Provider".to_string(),
            settings_config: json!({
                "env": {
                    "ANTHROPIC_AUTH_TOKEN": "sk-ant-test123",
                    "ANTHROPIC_API_KEY": "sk-ant-test456"
                }
            }),
            website_url: None,
            category: None,
            created_at: None,
            provider_type: ProviderType::Claude,
        };

        assert!(provider.validate().is_ok());
    }

    #[test]
    fn test_validate_claude_fails_without_auth() {
        let provider = Provider {
            id: "test-4".to_string(),
            name: "Test Provider".to_string(),
            settings_config: json!({
                "env": {
                    "OTHER_KEY": "value"
                }
            }),
            website_url: None,
            category: None,
            created_at: None,
            provider_type: ProviderType::Claude,
        };

        let result = provider.validate();
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            "缺少认证配置 (ANTHROPIC_AUTH_TOKEN 或 ANTHROPIC_API_KEY)"
        );
    }

    #[test]
    fn test_validate_fails_with_empty_name() {
        let provider = Provider {
            id: "test-5".to_string(),
            name: "   ".to_string(),
            settings_config: json!({
                "env": {
                    "ANTHROPIC_AUTH_TOKEN": "sk-ant-test123"
                }
            }),
            website_url: None,
            category: None,
            created_at: None,
            provider_type: ProviderType::Claude,
        };

        let result = provider.validate();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "供应商名称不能为空");
    }

    #[test]
    fn test_validate_claude_fails_without_env() {
        let provider = Provider {
            id: "test-6".to_string(),
            name: "Test Provider".to_string(),
            settings_config: json!({
                "other": "config"
            }),
            website_url: None,
            category: None,
            created_at: None,
            provider_type: ProviderType::Claude,
        };

        let result = provider.validate();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "缺少 env 配置节");
    }

    #[test]
    fn test_validate_fails_with_non_object_config() {
        let provider = Provider {
            id: "test-7".to_string(),
            name: "Test Provider".to_string(),
            settings_config: json!("not an object"),
            website_url: None,
            category: None,
            created_at: None,
            provider_type: ProviderType::Claude,
        };

        let result = provider.validate();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "配置必须是一个对象");
    }

    #[test]
    fn test_validate_claude_fails_with_non_object_env() {
        let provider = Provider {
            id: "test-8".to_string(),
            name: "Test Provider".to_string(),
            settings_config: json!({
                "env": "not an object"
            }),
            website_url: None,
            category: None,
            created_at: None,
            provider_type: ProviderType::Claude,
        };

        let result = provider.validate();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "env 必须是一个对象");
    }

    #[test]
    fn test_validate_codex_with_valid_config() {
        let provider = Provider {
            id: "codex-1".to_string(),
            name: "OpenAI Codex".to_string(),
            settings_config: json!({
                "openai": {
                    "api_key": "sk-test123",
                    "organization_id": "org-test"
                }
            }),
            website_url: Some("https://openai.com".to_string()),
            category: Some("official".to_string()),
            created_at: None,
            provider_type: ProviderType::Codex,
        };

        assert!(provider.validate().is_ok());
    }

    #[test]
    fn test_validate_codex_fails_without_openai_section() {
        let provider = Provider {
            id: "codex-2".to_string(),
            name: "OpenAI Codex".to_string(),
            settings_config: json!({
                "other": "config"
            }),
            website_url: None,
            category: None,
            created_at: None,
            provider_type: ProviderType::Codex,
        };

        let result = provider.validate();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "缺少 openai 配置节");
    }

    #[test]
    fn test_validate_codex_fails_without_api_key() {
        let provider = Provider {
            id: "codex-3".to_string(),
            name: "OpenAI Codex".to_string(),
            settings_config: json!({
                "openai": {
                    "organization_id": "org-test"
                }
            }),
            website_url: None,
            category: None,
            created_at: None,
            provider_type: ProviderType::Codex,
        };

        let result = provider.validate();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "缺少认证配置 (openai.api_key)");
    }

    #[test]
    fn test_validate_codex_fails_with_non_object_openai() {
        let provider = Provider {
            id: "codex-4".to_string(),
            name: "OpenAI Codex".to_string(),
            settings_config: json!({
                "openai": "not an object"
            }),
            website_url: None,
            category: None,
            created_at: None,
            provider_type: ProviderType::Codex,
        };

        let result = provider.validate();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "openai 必须是一个对象");
    }
}
