use reqwest::Url;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ProviderType {
    Claude,
    Codex,
}

impl Default for ProviderType {
    fn default() -> Self {
        Self::Claude
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodexProviderConfig {
    #[serde(rename = "providerName")]
    pub provider_name: String,
    #[serde(rename = "upstreamUrl")]
    pub upstream_url: String,
    #[serde(rename = "apiKey")]
    pub api_key: String,
    #[serde(rename = "modelName")]
    pub model_name: String,
}

impl CodexProviderConfig {
    pub fn validate(&self) -> Result<(), String> {
        if self.provider_name.trim().is_empty() {
            return Err("Codex 供应商名称不能为空".to_string());
        }

        if self.model_name.trim().is_empty() {
            return Err("Codex 模型名称不能为空".to_string());
        }

        if self.api_key.trim().is_empty() {
            return Err("Codex API Key 不能为空".to_string());
        }

        let upstream_url = self.upstream_url.trim();
        if upstream_url.is_empty() {
            return Err("Codex 上游地址不能为空".to_string());
        }

        Url::parse(upstream_url).map_err(|error| format!("Codex 上游地址无效: {}", error))?;

        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodexProvider {
    pub id: String,
    pub name: String,
    #[serde(rename = "codexConfig")]
    pub codex_config: CodexProviderConfig,
    #[serde(rename = "websiteUrl")]
    pub website_url: Option<String>,
    pub category: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<u64>,
}

impl CodexProvider {
    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("供应商名称不能为空".to_string());
        }

        self.codex_config.validate()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPayload {
    pub id: String,
    pub name: String,
    #[serde(rename = "providerType", default)]
    pub provider_type: ProviderType,
    #[serde(rename = "settingsConfig", default)]
    pub settings_config: Option<serde_json::Value>,
    #[serde(rename = "codexConfig", default)]
    pub codex_config: Option<CodexProviderConfig>,
    #[serde(rename = "websiteUrl")]
    pub website_url: Option<String>,
    pub category: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<u64>,
}

impl ProviderPayload {
    pub fn validate(&self) -> Result<(), String> {
        match self.provider_type {
            ProviderType::Claude => self.clone().into_claude_provider()?.validate(),
            ProviderType::Codex => self.clone().into_codex_provider()?.validate(),
        }
    }

    pub fn into_claude_provider(self) -> Result<Provider, String> {
        if self.provider_type != ProviderType::Claude {
            return Err("当前供应商不是 Claude 类型".to_string());
        }

        let settings_config = self
            .settings_config
            .ok_or_else(|| "缺少 Claude settingsConfig".to_string())?;

        Ok(Provider {
            id: self.id,
            name: self.name,
            settings_config,
            website_url: self.website_url,
            category: self.category,
            created_at: self.created_at,
        })
    }

    pub fn into_codex_provider(self) -> Result<CodexProvider, String> {
        if self.provider_type != ProviderType::Codex {
            return Err("当前供应商不是 Codex 类型".to_string());
        }

        let codex_config = self
            .codex_config
            .ok_or_else(|| "缺少 Codex codexConfig".to_string())?;

        Ok(CodexProvider {
            id: self.id,
            name: self.name,
            codex_config,
            website_url: self.website_url,
            category: self.category,
            created_at: self.created_at,
        })
    }

    pub fn from_claude_provider(provider: Provider) -> Self {
        Self {
            id: provider.id,
            name: provider.name,
            provider_type: ProviderType::Claude,
            settings_config: Some(provider.settings_config),
            codex_config: None,
            website_url: provider.website_url,
            category: provider.category,
            created_at: provider.created_at,
        }
    }

    pub fn from_codex_provider(provider: CodexProvider) -> Self {
        Self {
            id: provider.id,
            name: provider.name,
            provider_type: ProviderType::Codex,
            settings_config: None,
            codex_config: Some(provider.codex_config),
            website_url: provider.website_url,
            category: provider.category,
            created_at: provider.created_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provider {
    pub id: String,
    pub name: String,
    #[serde(rename = "settingsConfig")]
    pub settings_config: serde_json::Value, // Claude settings.json 配置对象
    #[serde(rename = "websiteUrl")]
    pub website_url: Option<String>,
    pub category: Option<String>, // 供应商分类
    #[serde(rename = "createdAt")]
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
        let env = self.settings_config.get("env").ok_or("缺少 env 配置节")?;

        if !env.is_object() {
            return Err("env 必须是一个对象".to_string());
        }

        // 检查认证配置: 兼容旧版 ANTHROPIC_* 字段和新的 apiGateway 认证策略
        if !self.has_legacy_auth(env) && !self.has_gateway_auth_config() {
            return Err("缺少认证配置 (ANTHROPIC_AUTH_TOKEN / ANTHROPIC_API_KEY / apiGateway.auth)".to_string());
        }

        Ok(())
    }

    fn has_legacy_auth(&self, env: &serde_json::Value) -> bool {
        env.get("ANTHROPIC_AUTH_TOKEN").is_some() || env.get("ANTHROPIC_API_KEY").is_some()
    }

    fn has_gateway_auth_config(&self) -> bool {
        let Some(api_gateway) = self.settings_config.get("apiGateway") else {
            return false;
        };

        let has_auth = api_gateway
            .get("auth")
            .and_then(|value| value.as_array())
            .map(|entries| {
                entries.iter().any(|entry| {
                    let name = entry.get("name").and_then(|item| item.as_str()).map(str::trim);
                    let value = entry.get("value").and_then(|item| item.as_str()).map(str::trim);
                    let env_var = entry.get("envVar").and_then(|item| item.as_str()).map(str::trim);

                    name.is_some_and(|value| !value.is_empty())
                        && (value.is_some_and(|value| !value.is_empty())
                            || env_var.is_some_and(|value| !value.is_empty()))
                })
            })
            .unwrap_or(false);

        let has_auth_headers = api_gateway
            .get("authHeaders")
            .and_then(|value| value.as_array())
            .map(|entries| {
                entries.iter().any(|entry| {
                    let name = entry.get("name").and_then(|item| item.as_str()).map(str::trim);
                    let value = entry.get("value").and_then(|item| item.as_str()).map(str::trim);
                    let env_var = entry.get("envVar").and_then(|item| item.as_str()).map(str::trim);

                    name.is_some_and(|value| !value.is_empty())
                        && (value.is_some_and(|value| !value.is_empty())
                            || env_var.is_some_and(|value| !value.is_empty()))
                })
            })
            .unwrap_or(false);

        has_auth || has_auth_headers
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_validate_with_auth_token_only() {
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
        };

        assert!(provider.validate().is_ok());
    }

    #[test]
    fn test_validate_with_api_key_only() {
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
        };

        assert!(provider.validate().is_ok());
    }

    #[test]
    fn test_validate_with_both_tokens() {
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
        };

        assert!(provider.validate().is_ok());
    }

    #[test]
    fn test_validate_fails_without_auth() {
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
        };

        let result = provider.validate();
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            "缺少认证配置 (ANTHROPIC_AUTH_TOKEN / ANTHROPIC_API_KEY / apiGateway.auth)"
        );
    }

    #[test]
    fn test_validate_with_api_gateway_auth_strategy() {
        let provider = Provider {
            id: "test-9".to_string(),
            name: "Gateway Strategy Provider".to_string(),
            settings_config: json!({
                "env": {
                    "ACCESS_TOKEN": "gateway-token"
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

        assert!(provider.validate().is_ok());
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
        };

        let result = provider.validate();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "供应商名称不能为空");
    }

    #[test]
    fn test_validate_fails_without_env() {
        let provider = Provider {
            id: "test-6".to_string(),
            name: "Test Provider".to_string(),
            settings_config: json!({
                "other": "config"
            }),
            website_url: None,
            category: None,
            created_at: None,
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
        };

        let result = provider.validate();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "配置必须是一个对象");
    }

    #[test]
    fn test_validate_fails_with_non_object_env() {
        let provider = Provider {
            id: "test-8".to_string(),
            name: "Test Provider".to_string(),
            settings_config: json!({
                "env": "not an object"
            }),
            website_url: None,
            category: None,
            created_at: None,
        };

        let result = provider.validate();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "env 必须是一个对象");
    }

    #[test]
    fn codex_provider_validation_requires_non_empty_fields() {
        let provider = CodexProvider {
            id: "codex-1".to_string(),
            name: "Xiaomi MiMo".to_string(),
            codex_config: CodexProviderConfig {
                provider_name: "mimo".to_string(),
                upstream_url: "https://token-plan-sgp.xiaomimimo.com/v1".to_string(),
                api_key: "tp-test".to_string(),
                model_name: "mimo-v2.5-pro".to_string(),
            },
            website_url: None,
            category: None,
            created_at: None,
        };

        assert!(provider.validate().is_ok());
    }

    #[test]
    fn provider_payload_converts_codex_provider() {
        let payload = ProviderPayload {
            id: "codex-1".to_string(),
            name: "MiMo".to_string(),
            provider_type: ProviderType::Codex,
            settings_config: None,
            codex_config: Some(CodexProviderConfig {
                provider_name: "mimo".to_string(),
                upstream_url: "https://token-plan-sgp.xiaomimimo.com/v1".to_string(),
                api_key: "tp-test".to_string(),
                model_name: "mimo-v2.5-pro".to_string(),
            }),
            website_url: None,
            category: None,
            created_at: None,
        };

        let provider = payload.into_codex_provider().unwrap();
        assert_eq!(provider.codex_config.model_name, "mimo-v2.5-pro");
    }
}
