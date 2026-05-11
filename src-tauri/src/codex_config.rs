use crate::codex_gateway;
use crate::provider::CodexProvider;
use dirs;
use std::fs;
use std::path::PathBuf;
use toml_edit::{value, DocumentMut, Item, Table};

pub const LOCAL_GATEWAY_PROVIDER_KEY: &str = "switch_cc_gateway";

pub fn get_codex_config_dir() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or("无法获取用户目录")?;
    Ok(home_dir.join(".codex"))
}

pub fn get_codex_config_path() -> Result<PathBuf, String> {
    Ok(get_codex_config_dir()?.join("config.toml"))
}

pub fn has_local_gateway_provider() -> Result<bool, String> {
    let document = load_document()?;
    Ok(document
        .get("model_providers")
        .and_then(Item::as_table_like)
        .and_then(|providers| providers.get(LOCAL_GATEWAY_PROVIDER_KEY))
        .is_some())
}

pub fn install_local_gateway_provider(provider: &CodexProvider, port: u16) -> Result<(), String> {
    upsert_local_gateway_provider(provider, port, true)
}

pub fn sync_local_gateway_provider(provider: &CodexProvider, port: u16) -> Result<(), String> {
    upsert_local_gateway_provider(provider, port, false)
}

fn upsert_local_gateway_provider(
    provider: &CodexProvider,
    port: u16,
    create_if_missing: bool,
) -> Result<(), String> {
    let mut document = load_document()?;

    let already_installed = document
        .get("model_providers")
        .and_then(Item::as_table_like)
        .and_then(|providers| providers.get(LOCAL_GATEWAY_PROVIDER_KEY))
        .is_some();

    if !already_installed && !create_if_missing {
        return Ok(());
    }

    document["model"] = value(provider.codex_config.model_name.clone());
    document["model_provider"] = value(LOCAL_GATEWAY_PROVIDER_KEY);
    document["preferred_auth_method"] = value("apikey");

    let providers_table = ensure_root_table(&mut document, "model_providers")?;
    let gateway_table = ensure_child_table(providers_table, LOCAL_GATEWAY_PROVIDER_KEY)?;
    write_gateway_provider_config(gateway_table, provider, port);

    save_document(&document)
}

fn write_gateway_provider_config(gateway_table: &mut Table, provider: &CodexProvider, port: u16) {
    gateway_table["name"] = value(format!("Switch CC Gateway ({})", provider.name));
    gateway_table["base_url"] = value(codex_gateway::gateway_base_url(port));
    gateway_table["wire_api"] = value("responses");
    gateway_table["requires_openai_auth"] = value(false);
    gateway_table.remove("env_key");
    gateway_table.remove("upstream_url");
}

fn load_document() -> Result<DocumentMut, String> {
    let config_path = get_codex_config_path()?;
    if !config_path.exists() {
        return Ok(DocumentMut::new());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|error| format!("读取 Codex 配置文件失败: {}", error))?;

    content
        .parse::<DocumentMut>()
        .map_err(|error| format!("解析 Codex 配置文件失败: {}", error))
}

fn save_document(document: &DocumentMut) -> Result<(), String> {
    let config_path = get_codex_config_path()?;
    if let Some(parent) = config_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("创建 Codex 配置目录失败: {}", error))?;
        }
    }

    let temp_path = config_path.with_extension("tmp");
    fs::write(&temp_path, document.to_string())
        .map_err(|error| format!("写入 Codex 临时配置文件失败: {}", error))?;
    fs::rename(&temp_path, &config_path)
        .map_err(|error| format!("保存 Codex 配置文件失败: {}", error))?;

    Ok(())
}

fn ensure_root_table<'a>(document: &'a mut DocumentMut, key: &str) -> Result<&'a mut Table, String> {
    if !document.as_table().contains_key(key) {
        document[key] = Item::Table(Table::new());
    }

    document[key]
        .as_table_mut()
        .ok_or_else(|| format!("{} 必须是一个 TOML table", key))
}

fn ensure_child_table<'a>(table: &'a mut Table, key: &str) -> Result<&'a mut Table, String> {
    if !table.contains_key(key) {
        table[key] = Item::Table(Table::new());
    }

    table[key]
        .as_table_mut()
        .ok_or_else(|| format!("{} 必须是一个 TOML table", key))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider::CodexProviderConfig;

    fn test_provider() -> CodexProvider {
        CodexProvider {
            id: "mimo".to_string(),
            name: "MiMo".to_string(),
            codex_config: CodexProviderConfig {
                provider_name: "mimo".to_string(),
                upstream_url: "https://token-plan-sgp.xiaomimimo.com/v1".to_string(),
                api_key: "tp-test".to_string(),
                model_name: "mimo-v2-pro".to_string(),
            },
            website_url: None,
            category: None,
            created_at: None,
        }
    }

    #[test]
    fn upsert_gateway_provider_updates_model_and_provider_block() {
        let mut document = "model = \"old\"\n\n[projects.\"/tmp\"]\ntrust_level = \"trusted\"\n"
            .parse::<DocumentMut>()
            .unwrap();
        let provider = test_provider();

        document["model"] = value(provider.codex_config.model_name.clone());
        document["model_provider"] = value(LOCAL_GATEWAY_PROVIDER_KEY);
        document["preferred_auth_method"] = value("apikey");
        let providers_table = ensure_root_table(&mut document, "model_providers").unwrap();
        let gateway_table = ensure_child_table(providers_table, LOCAL_GATEWAY_PROVIDER_KEY).unwrap();
        gateway_table["env_key"] = value("DUMMY_KEY");
        gateway_table["upstream_url"] = value(provider.codex_config.upstream_url.trim());
        write_gateway_provider_config(gateway_table, &provider, 7373);

        assert_eq!(document["model"].as_str(), Some("mimo-v2-pro"));
        assert_eq!(document["model_provider"].as_str(), Some(LOCAL_GATEWAY_PROVIDER_KEY));
        assert_eq!(
            document["model_providers"][LOCAL_GATEWAY_PROVIDER_KEY]["base_url"].as_str(),
            Some("http://127.0.0.1:7373/v1")
        );
        assert!(!document["model_providers"][LOCAL_GATEWAY_PROVIDER_KEY]
            .as_table_like()
            .unwrap()
            .contains_key("env_key"));
        assert!(!document["model_providers"][LOCAL_GATEWAY_PROVIDER_KEY]
            .as_table_like()
            .unwrap()
            .contains_key("upstream_url"));
        assert_eq!(document["projects"]["/tmp"]["trust_level"].as_str(), Some("trusted"));
    }
}