//! Runtime configuration loading and diagnostics.

use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct RuntimeConfig {
    pub app_name: String,
    pub instance_id: String,
    pub mode: String,
    pub execution_level: String,
    pub failure_strategy: String,
    pub sandbox: String,
    pub max_steps: usize,
    pub step_timeout_seconds: u64,
    pub mode_lock_auto: bool,
    pub scheduler_background_loop_enabled: bool,
    pub scheduler_poll_interval_seconds: u64,
    pub aggregation_http_source_url: String,
    pub browser_allowed_hosts: String,
    pub smtp_host: String,
    pub smtp_port: u64,
    pub smtp_from: String,
    pub smtp_to: String,
    pub feishu_webhook_url: String,
    pub wechat_webhook_url: String,
    pub external_delivery_enabled: bool,
    pub agent_execution_enabled: bool,
    pub relay_enabled: bool,
    pub relay_endpoint: String,
    pub warnings: Vec<String>,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            app_name: "Synapse".to_string(),
            instance_id: "synapse-local-01".to_string(),
            mode: "lite".to_string(),
            execution_level: "L0_SINGLE".to_string(),
            failure_strategy: "auto_fallback".to_string(),
            sandbox: "wasi".to_string(),
            max_steps: 128,
            step_timeout_seconds: 60,
            mode_lock_auto: true,
            scheduler_background_loop_enabled: false,
            scheduler_poll_interval_seconds: 30,
            aggregation_http_source_url: String::new(),
            browser_allowed_hosts: String::new(),
            smtp_host: String::new(),
            smtp_port: 587,
            smtp_from: String::new(),
            smtp_to: String::new(),
            feishu_webhook_url: String::new(),
            wechat_webhook_url: String::new(),
            external_delivery_enabled: false,
            agent_execution_enabled: false,
            relay_enabled: false,
            relay_endpoint: String::new(),
            warnings: Vec::new(),
        }
    }
}

pub fn read_runtime_config() -> RuntimeConfig {
    let path = config_path();
    let Ok(raw) = fs::read_to_string(&path) else {
        let mut config = RuntimeConfig::default();
        config
            .warnings
            .push(format!("Config file not found: {}", path.display()));
        return config;
    };

    let defaults = RuntimeConfig::default();
    let mut warnings = Vec::new();

    let config = RuntimeConfig {
        app_name: string_or_default(
            &raw,
            "system",
            "app_name",
            &defaults.app_name,
            &mut warnings,
        ),
        instance_id: string_or_default(
            &raw,
            "system",
            "instance_id",
            &defaults.instance_id,
            &mut warnings,
        ),
        mode: string_or_default(&raw, "system", "mode", &defaults.mode, &mut warnings),
        execution_level: string_or_default(
            &raw,
            "execution",
            "level",
            &defaults.execution_level,
            &mut warnings,
        ),
        failure_strategy: string_or_default(
            &raw,
            "execution",
            "failure_strategy",
            &defaults.failure_strategy,
            &mut warnings,
        ),
        sandbox: string_or_default(&raw, "sandbox", "default", &defaults.sandbox, &mut warnings),
        max_steps: usize_or_default(
            &raw,
            "execution",
            "max_steps",
            defaults.max_steps,
            &mut warnings,
        ),
        step_timeout_seconds: u64_or_default(
            &raw,
            "execution",
            "step_timeout_seconds",
            defaults.step_timeout_seconds,
            &mut warnings,
        ),
        mode_lock_auto: bool_or_default(
            &raw,
            "system",
            "mode_lock_auto",
            defaults.mode_lock_auto,
            &mut warnings,
        ),
        scheduler_background_loop_enabled: bool_or_default(
            &raw,
            "scheduler",
            "background_loop_enabled",
            defaults.scheduler_background_loop_enabled,
            &mut warnings,
        ),
        scheduler_poll_interval_seconds: u64_or_default(
            &raw,
            "scheduler",
            "poll_interval_seconds",
            defaults.scheduler_poll_interval_seconds,
            &mut warnings,
        ),
        aggregation_http_source_url: string_or_default(
            &raw,
            "aggregation",
            "http_source_url",
            &defaults.aggregation_http_source_url,
            &mut warnings,
        ),
        browser_allowed_hosts: string_or_default(
            &raw,
            "browser",
            "allowed_hosts",
            &defaults.browser_allowed_hosts,
            &mut warnings,
        ),
        smtp_host: string_or_default(
            &raw,
            "notifications.email",
            "smtp_host",
            &defaults.smtp_host,
            &mut warnings,
        ),
        smtp_port: u64_or_default(
            &raw,
            "notifications.email",
            "smtp_port",
            defaults.smtp_port,
            &mut warnings,
        ),
        smtp_from: string_or_default(
            &raw,
            "notifications.email",
            "from",
            &defaults.smtp_from,
            &mut warnings,
        ),
        smtp_to: string_or_default(
            &raw,
            "notifications.email",
            "to",
            &defaults.smtp_to,
            &mut warnings,
        ),
        feishu_webhook_url: string_or_default(
            &raw,
            "notifications.feishu",
            "webhook_url",
            &defaults.feishu_webhook_url,
            &mut warnings,
        ),
        wechat_webhook_url: string_or_default(
            &raw,
            "notifications.wechat",
            "webhook_url",
            &defaults.wechat_webhook_url,
            &mut warnings,
        ),
        external_delivery_enabled: bool_or_default(
            &raw,
            "safety",
            "external_delivery_enabled",
            defaults.external_delivery_enabled,
            &mut warnings,
        ),
        agent_execution_enabled: bool_or_default(
            &raw,
            "safety",
            "agent_execution_enabled",
            defaults.agent_execution_enabled,
            &mut warnings,
        ),
        relay_enabled: bool_or_default(
            &raw,
            "sync.relay",
            "enabled",
            defaults.relay_enabled,
            &mut warnings,
        ),
        relay_endpoint: string_or_default(
            &raw,
            "sync.relay",
            "endpoint",
            &defaults.relay_endpoint,
            &mut warnings,
        ),
        warnings,
    };

    validate_config(config)
}

pub fn display_mode(mode: &str) -> String {
    match mode.to_ascii_lowercase().as_str() {
        "pro" => "Pro".to_string(),
        _ => "Lite".to_string(),
    }
}

pub fn display_sandbox(sandbox: &str) -> String {
    sandbox.to_ascii_uppercase()
}

fn config_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri must live inside the project root")
        .join("synapse.config.toml")
}

fn string_or_default(
    raw: &str,
    section: &str,
    key: &str,
    default: &str,
    warnings: &mut Vec<String>,
) -> String {
    read_toml_string(raw, section, key).unwrap_or_else(|| {
        warnings.push(format!("Missing [{section}].{key}; using default."));
        default.to_string()
    })
}

fn usize_or_default(
    raw: &str,
    section: &str,
    key: &str,
    default: usize,
    warnings: &mut Vec<String>,
) -> usize {
    read_toml_string(raw, section, key)
        .and_then(|value| value.parse().ok())
        .unwrap_or_else(|| {
            warnings.push(format!(
                "Invalid or missing [{section}].{key}; using default."
            ));
            default
        })
}

fn u64_or_default(
    raw: &str,
    section: &str,
    key: &str,
    default: u64,
    warnings: &mut Vec<String>,
) -> u64 {
    read_toml_string(raw, section, key)
        .and_then(|value| value.parse().ok())
        .unwrap_or_else(|| {
            warnings.push(format!(
                "Invalid or missing [{section}].{key}; using default."
            ));
            default
        })
}

fn bool_or_default(
    raw: &str,
    section: &str,
    key: &str,
    default: bool,
    warnings: &mut Vec<String>,
) -> bool {
    read_toml_string(raw, section, key)
        .and_then(|value| match value.to_ascii_lowercase().as_str() {
            "true" => Some(true),
            "false" => Some(false),
            _ => None,
        })
        .unwrap_or_else(|| {
            warnings.push(format!(
                "Invalid or missing [{section}].{key}; using default."
            ));
            default
        })
}

fn read_toml_string(raw: &str, section: &str, key: &str) -> Option<String> {
    let mut active_section = String::new();

    for line in raw.lines() {
        let clean = line.split('#').next().unwrap_or("").trim();

        if clean.is_empty() {
            continue;
        }

        if clean.starts_with('[') && clean.ends_with(']') {
            active_section = clean.trim_matches(['[', ']']).to_string();
            continue;
        }

        if active_section != section {
            continue;
        }

        let Some((candidate_key, value)) = clean.split_once('=') else {
            continue;
        };

        if candidate_key.trim() != key {
            continue;
        }

        return Some(value.trim().trim_matches('"').to_string());
    }

    None
}

fn validate_config(mut config: RuntimeConfig) -> RuntimeConfig {
    let mode = config.mode.to_ascii_lowercase();

    if !matches!(mode.as_str(), "lite" | "pro") {
        config.warnings.push(format!(
            "Unknown mode '{}'; UI will display Lite.",
            config.mode
        ));
    }

    if config.max_steps == 0 {
        config
            .warnings
            .push("max_steps must be greater than zero; using 1.".to_string());
        config.max_steps = 1;
    }

    if config.step_timeout_seconds == 0 {
        config
            .warnings
            .push("step_timeout_seconds must be greater than zero; using 1.".to_string());
        config.step_timeout_seconds = 1;
    }

    if config.scheduler_poll_interval_seconds == 0 {
        config
            .warnings
            .push("scheduler poll interval must be greater than zero; using 1.".to_string());
        config.scheduler_poll_interval_seconds = 1;
    }

    config
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_string_values_from_named_section() {
        let raw = r#"
            [system]
            mode = "pro"

            [execution]
            level = "L2_GRAPH"
        "#;

        assert_eq!(
            read_toml_string(raw, "system", "mode"),
            Some("pro".to_string())
        );
        assert_eq!(
            read_toml_string(raw, "execution", "level"),
            Some("L2_GRAPH".to_string())
        );
    }

    #[test]
    fn validates_zero_budget_values_to_one() {
        let config = RuntimeConfig {
            max_steps: 0,
            step_timeout_seconds: 0,
            scheduler_poll_interval_seconds: 0,
            ..RuntimeConfig::default()
        };

        let config = validate_config(config);

        assert_eq!(config.max_steps, 1);
        assert_eq!(config.step_timeout_seconds, 1);
        assert_eq!(config.scheduler_poll_interval_seconds, 1);
        assert_eq!(config.warnings.len(), 3);
    }

    #[test]
    fn display_helpers_normalize_user_facing_values() {
        assert_eq!(display_mode("pro"), "Pro");
        assert_eq!(display_mode("unknown"), "Lite");
        assert_eq!(display_sandbox("wasi"), "WASI");
    }
}
