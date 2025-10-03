use crate::store::AppConfig;
use dirs;
use std::fs;
use std::path::PathBuf;

/// 获取应用配置目录
pub fn get_app_config_dir() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir()
        .ok_or("无法获取配置目录")?
        .join("switch-cc");

    // 确保目录存在
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| format!("创建配置目录失败: {}", e))?;
    }

    Ok(config_dir)
}

/// 获取应用配置文件路径
pub fn get_app_config_path() -> Result<PathBuf, String> {
    Ok(get_app_config_dir()?.join("config.json"))
}

/// 获取 Claude Code 配置目录
pub fn get_claude_config_dir() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or("无法获取用户目录")?;
    Ok(home_dir.join(".claude"))
}

/// 获取 Claude Code 配置文件路径
pub fn get_claude_config_path() -> Result<PathBuf, String> {
    let claude_dir = get_claude_config_dir()?;

    // 优先使用 settings.json，如果不存在则使用 claude.json
    let settings_path = claude_dir.join("settings.json");
    if settings_path.exists() {
        return Ok(settings_path);
    }

    Ok(claude_dir.join("claude.json"))
}

/// 检查 Claude 配置是否存在
pub fn claude_config_exists() -> bool {
    if let Ok(claude_dir) = get_claude_config_dir() {
        let settings_path = claude_dir.join("settings.json");
        let claude_path = claude_dir.join("claude.json");
        return settings_path.exists() || claude_path.exists();
    }
    false
}

/// 加载应用配置
pub fn load_config() -> Result<AppConfig, String> {
    let config_path = get_app_config_path()?;

    if !config_path.exists() {
        return Ok(AppConfig::default());
    }

    let content =
        fs::read_to_string(&config_path).map_err(|e| format!("读取配置文件失败: {}", e))?;

    let config: AppConfig =
        serde_json::from_str(&content).map_err(|e| format!("解析配置文件失败: {}", e))?;

    Ok(config)
}

/// 保存应用配置
pub fn save_config(config: &AppConfig) -> Result<(), String> {
    let config_path = get_app_config_path()?;

    // 确保父目录存在
    if let Some(parent) = config_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("创建配置目录失败: {}", e))?;
        }
    }

    let content =
        serde_json::to_string_pretty(config).map_err(|e| format!("序列化配置失败: {}", e))?;

    fs::write(&config_path, content).map_err(|e| format!("写入配置文件失败: {}", e))?;

    Ok(())
}

/// 读取 Claude 配置文件
pub fn read_claude_config() -> Result<serde_json::Value, String> {
    let config_path = get_claude_config_path()?;

    if !config_path.exists() {
        return Err("Claude 配置文件不存在".to_string());
    }

    let content =
        fs::read_to_string(&config_path).map_err(|e| format!("读取 Claude 配置文件失败: {}", e))?;

    let config: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("解析 Claude 配置文件失败: {}", e))?;

    Ok(config)
}

/// 合并 Claude 配置文件 - 只覆盖 provider 中指定的键
pub fn merge_claude_config(provider_config: &serde_json::Value) -> Result<(), String> {
    let config_path = get_claude_config_path()?;

    // 读取现有配置，如果不存在则创建默认配置
    let mut current_config = if config_path.exists() {
        read_claude_config()?
    } else {
        // 创建默认配置
        serde_json::json!({
            "env": {
                "ANTHROPIC_AUTH_TOKEN": ""
            }
        })
    };

    // 递归合并配置
    merge_json_objects(&mut current_config, provider_config);

    // 写入合并后的配置
    write_claude_config(&current_config)?;

    Ok(())
}

/// 合并JSON对象 - 只覆盖provider中存在的键
/// 对于顶层键，直接替换整个值（不递归合并）
fn merge_json_objects(target: &mut serde_json::Value, source: &serde_json::Value) {
    if let serde_json::Value::Object(source_map) = source {
        if let serde_json::Value::Object(target_map) = target {
            for (key, source_value) in source_map {
                // 直接替换整个键的值，不递归合并
                target_map.insert(key.clone(), source_value.clone());
            }
        } else {
            // 如果目标不是对象，直接替换
            *target = source.clone();
        }
    } else {
        // 如果源不是对象类型，直接替换
        *target = source.clone();
    }
}

/// 写入 Claude 配置文件
pub fn write_claude_config(config: &serde_json::Value) -> Result<(), String> {
    let config_path = get_claude_config_path()?;

    // 确保父目录存在
    if let Some(parent) = config_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("创建 Claude 配置目录失败: {}", e))?;
        }
    }

    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("序列化 Claude 配置失败: {}", e))?;

    // 原子写入：先写到临时文件，然后重命名
    let temp_path = config_path.with_extension("tmp");
    fs::write(&temp_path, content).map_err(|e| format!("写入临时文件失败: {}", e))?;

    fs::rename(&temp_path, &config_path).map_err(|e| format!("重命名配置文件失败: {}", e))?;

    Ok(())
}
