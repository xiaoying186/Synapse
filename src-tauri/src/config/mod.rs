//! Runtime configuration loading and diagnostics.

use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf, Prefix};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{OnceLock, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

const DEFAULT_STORAGE_DATA_DIR: &str = ".synapse";
const APP_CONFIG_FILE_NAME: &str = "synapse.config.toml";
const DEFAULT_APP_CONFIG_TEMPLATE: &str = include_str!("../../../synapse.config.toml");
static RUNTIME_CONFIG_PATH: OnceLock<RwLock<Option<PathBuf>>> = OnceLock::new();
static RUNTIME_SETTINGS_TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);

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
    pub storage_data_dir: String,
    pub aggregation_http_source_url: String,
    pub aggregation_http_cross_check_urls: String,
    pub aggregation_http_source_ids: String,
    pub browser_allowed_hosts: String,
    pub smtp_host: String,
    pub smtp_port: u64,
    pub smtp_from: String,
    pub smtp_to: String,
    pub feishu_webhook_url: String,
    pub wechat_webhook_url: String,
    pub external_delivery_enabled: bool,
    pub agent_execution_enabled: bool,
    pub script_execution_enabled: bool,
    pub relay_enabled: bool,
    pub relay_endpoint: String,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RuntimeSettingsPreview {
    pub state: String,
    pub config_path: String,
    pub mode: String,
    pub storage_data_dir: String,
    pub scheduler_background_loop_enabled: bool,
    pub scheduler_poll_interval_seconds: u64,
    pub restart_required: bool,
    pub editable_fields: Vec<String>,
    pub blocked_fields: Vec<String>,
    pub gates: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RuntimeSettingsUpdateRequest {
    pub mode: String,
    pub storage_data_dir: String,
    pub scheduler_background_loop_enabled: bool,
    pub scheduler_poll_interval_seconds: u64,
    pub confirmed: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct RuntimeSettingsUpdateReceipt {
    pub state: String,
    pub config_path: String,
    pub backup_path: String,
    pub changed_fields: Vec<String>,
    pub restart_required: bool,
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
            storage_data_dir: DEFAULT_STORAGE_DATA_DIR.to_string(),
            aggregation_http_source_url: String::new(),
            aggregation_http_cross_check_urls: String::new(),
            aggregation_http_source_ids: String::new(),
            browser_allowed_hosts: String::new(),
            smtp_host: String::new(),
            smtp_port: 587,
            smtp_from: String::new(),
            smtp_to: String::new(),
            feishu_webhook_url: String::new(),
            wechat_webhook_url: String::new(),
            external_delivery_enabled: false,
            agent_execution_enabled: false,
            script_execution_enabled: false,
            relay_enabled: false,
            relay_endpoint: String::new(),
            warnings: Vec::new(),
        }
    }
}

pub fn read_runtime_config() -> RuntimeConfig {
    read_runtime_config_from_path(&config_path())
}

pub(crate) fn runtime_config_path_for_status() -> PathBuf {
    config_path()
}

pub(crate) fn read_runtime_config_from_path(path: &Path) -> RuntimeConfig {
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
        storage_data_dir: string_or_default(
            &raw,
            "storage",
            "data_dir",
            &defaults.storage_data_dir,
            &mut warnings,
        ),
        aggregation_http_source_url: string_or_default(
            &raw,
            "aggregation",
            "http_source_url",
            &defaults.aggregation_http_source_url,
            &mut warnings,
        ),
        aggregation_http_cross_check_urls: string_or_default(
            &raw,
            "aggregation",
            "http_cross_check_urls",
            &defaults.aggregation_http_cross_check_urls,
            &mut warnings,
        ),
        aggregation_http_source_ids: string_or_default(
            &raw,
            "aggregation",
            "http_source_ids",
            &defaults.aggregation_http_source_ids,
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
        script_execution_enabled: bool_or_default(
            &raw,
            "safety",
            "script_execution_enabled",
            defaults.script_execution_enabled,
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

pub(crate) fn configure_runtime_config_path(path: PathBuf) -> std::io::Result<()> {
    if !path.is_file() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("runtime config file was not found: {}", path.display()),
        ));
    }
    let lock = RUNTIME_CONFIG_PATH.get_or_init(|| RwLock::new(None));
    let mut current = lock
        .write()
        .map_err(|_| std::io::Error::other("runtime config lock poisoned"))?;
    if let Some(existing) = current.as_ref() {
        if existing != &path {
            return Err(std::io::Error::new(
                std::io::ErrorKind::AlreadyExists,
                format!("runtime config path is already configured: {}", existing.display()),
            ));
        }
        return Ok(());
    }
    *current = Some(path);
    Ok(())
}

pub(crate) fn ensure_app_config_file(app_data_dir: &Path) -> std::io::Result<PathBuf> {
    fs::create_dir_all(app_data_dir)?;
    let path = app_data_dir.join(APP_CONFIG_FILE_NAME);
    if path.exists() {
        if path.is_file() {
            return Ok(path);
        }
        return Err(std::io::Error::new(
            std::io::ErrorKind::AlreadyExists,
            format!("runtime config path is not a file: {}", path.display()),
        ));
    }

    match fs::OpenOptions::new().write(true).create_new(true).open(&path) {
        Ok(mut file) => {
            file.write_all(DEFAULT_APP_CONFIG_TEMPLATE.as_bytes())?;
            file.sync_all()?;
        }
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
        Err(error) => return Err(error),
    }
    Ok(path)
}

pub(crate) fn preview_runtime_settings() -> RuntimeSettingsPreview {
    runtime_settings_preview(config_path(), read_runtime_config())
}

pub(crate) fn preflight_runtime_settings_update(
    request: RuntimeSettingsUpdateRequest,
) -> Result<RuntimeSettingsPreview, String> {
    let path = config_path();
    let current = read_runtime_config();
    let next = normalize_runtime_settings(&current, &request)?;
    Ok(runtime_settings_preview(path, next))
}

pub(crate) fn update_runtime_settings(
    request: RuntimeSettingsUpdateRequest,
) -> Result<RuntimeSettingsUpdateReceipt, String> {
    update_runtime_settings_at(config_path(), request)
}

fn update_runtime_settings_at(
    path: PathBuf,
    request: RuntimeSettingsUpdateRequest,
) -> Result<RuntimeSettingsUpdateReceipt, String> {
    if !request.confirmed {
        return Err("runtime settings update requires explicit confirmation".to_string());
    }
    let current = read_runtime_config_from_path(&path);
    let next = normalize_runtime_settings(&current, &request)?;
    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("runtime config could not be read: {error}"))?;
    let updated = update_runtime_settings_content(&raw, &next);
    let backup_path = path.with_file_name(format!("{APP_CONFIG_FILE_NAME}.bak"));
    write_runtime_settings_atomically(&backup_path, &raw)
        .map_err(|error| format!("runtime config backup could not be written: {error}"))?;
    write_runtime_settings_atomically(&path, &updated)
        .map_err(|error| format!("runtime config could not be written: {error}"))?;

    Ok(RuntimeSettingsUpdateReceipt {
        state: "runtime-settings-written-restart-required".to_string(),
        config_path: path.display().to_string(),
        backup_path: backup_path.display().to_string(),
        changed_fields: changed_runtime_setting_fields(&current, &next),
        restart_required: true,
    })
}

fn write_runtime_settings_atomically(path: &Path, content: &str) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let temporary_path = runtime_settings_temporary_path(path);
    let write_result = (|| {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary_path)?;
        file.write_all(content.as_bytes())?;
        file.flush()?;
        file.sync_all()?;
        replace_runtime_settings_file(&temporary_path, path)
    })();

    if write_result.is_err() {
        let _ = fs::remove_file(&temporary_path);
    }
    write_result
}

fn runtime_settings_temporary_path(path: &Path) -> PathBuf {
    let sequence = RUNTIME_SETTINGS_TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(APP_CONFIG_FILE_NAME);
    let now_millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    path.with_file_name(format!(
        ".{file_name}.runtime-settings-{}-{now_millis}-{sequence}.tmp",
        std::process::id()
    ))
}

#[cfg(windows)]
fn replace_runtime_settings_file(source: &Path, destination: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;

    const MOVEFILE_REPLACE_EXISTING: u32 = 0x1;
    const MOVEFILE_WRITE_THROUGH: u32 = 0x8;

    #[link(name = "Kernel32")]
    unsafe extern "system" {
        fn MoveFileExW(
            existing_file_name: *const u16,
            new_file_name: *const u16,
            flags: u32,
        ) -> i32;
    }

    let source_wide = source
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let destination_wide = destination
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let result = unsafe {
        MoveFileExW(
            source_wide.as_ptr(),
            destination_wide.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if result == 0 {
        return Err(std::io::Error::last_os_error());
    }
    Ok(())
}

#[cfg(not(windows))]
fn replace_runtime_settings_file(source: &Path, destination: &Path) -> std::io::Result<()> {
    fs::rename(source, destination)
}

fn runtime_settings_preview(path: PathBuf, config: RuntimeConfig) -> RuntimeSettingsPreview {
    RuntimeSettingsPreview {
        state: "runtime-settings-preview".to_string(),
        config_path: path.display().to_string(),
        mode: config.mode,
        storage_data_dir: config.storage_data_dir,
        scheduler_background_loop_enabled: config.scheduler_background_loop_enabled,
        scheduler_poll_interval_seconds: config.scheduler_poll_interval_seconds,
        restart_required: true,
        editable_fields: vec![
            "system.mode".to_string(),
            "storage.data_dir".to_string(),
            "scheduler.background_loop_enabled".to_string(),
            "scheduler.poll_interval_seconds".to_string(),
        ],
        blocked_fields: vec![
            "safety.external_delivery_enabled".to_string(),
            "safety.agent_execution_enabled".to_string(),
            "safety.script_execution_enabled".to_string(),
            "sync.relay.enabled".to_string(),
        ],
        gates: vec![
            "low-risk-fields-only".to_string(),
            "explicit-confirmation-required-before-write".to_string(),
            "local-backup-before-write".to_string(),
            "restart-required-before-activation".to_string(),
        ],
    }
}

fn normalize_runtime_settings(
    current: &RuntimeConfig,
    request: &RuntimeSettingsUpdateRequest,
) -> Result<RuntimeConfig, String> {
    let mode = request.mode.trim().to_ascii_lowercase();
    if !matches!(mode.as_str(), "lite" | "pro") {
        return Err("mode must be lite or pro".to_string());
    }
    let storage_data_dir = request.storage_data_dir.trim().to_string();
    if !is_safe_storage_data_dir(&storage_data_dir) {
        return Err("storage.data_dir must be a non-empty relative path without '..' or a local absolute disk path".to_string());
    }
    if request.scheduler_poll_interval_seconds == 0
        || request.scheduler_poll_interval_seconds > 86_400
    {
        return Err("scheduler.poll_interval_seconds must be between 1 and 86400".to_string());
    }
    Ok(RuntimeConfig {
        mode,
        storage_data_dir,
        scheduler_background_loop_enabled: request.scheduler_background_loop_enabled,
        scheduler_poll_interval_seconds: request.scheduler_poll_interval_seconds,
        warnings: current.warnings.clone(),
        ..current.clone()
    })
}

fn changed_runtime_setting_fields(current: &RuntimeConfig, next: &RuntimeConfig) -> Vec<String> {
    [
        ("system.mode", current.mode != next.mode),
        ("storage.data_dir", current.storage_data_dir != next.storage_data_dir),
        (
            "scheduler.background_loop_enabled",
            current.scheduler_background_loop_enabled != next.scheduler_background_loop_enabled,
        ),
        (
            "scheduler.poll_interval_seconds",
            current.scheduler_poll_interval_seconds != next.scheduler_poll_interval_seconds,
        ),
    ]
    .into_iter()
    .filter_map(|(field, changed)| changed.then_some(field.to_string()))
    .collect()
}

fn update_runtime_settings_content(raw: &str, next: &RuntimeConfig) -> String {
    let updates = [
        ("system", "mode", format!("\"{}\"", next.mode)),
        ("storage", "data_dir", toml_string(&next.storage_data_dir)),
        (
            "scheduler",
            "background_loop_enabled",
            next.scheduler_background_loop_enabled.to_string(),
        ),
        (
            "scheduler",
            "poll_interval_seconds",
            next.scheduler_poll_interval_seconds.to_string(),
        ),
    ];
    updates.into_iter().fold(raw.to_string(), |content, (section, key, value)| {
        replace_toml_value(&content, section, key, &value)
    })
}

fn replace_toml_value(raw: &str, section: &str, key: &str, value: &str) -> String {
    let mut active_section = false;
    let mut replaced = false;
    let mut lines = Vec::new();
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            active_section = trimmed.trim_matches(['[', ']']) == section;
        }
        if active_section && !replaced {
            if let Some((candidate_key, _)) = trimmed.split_once('=') {
                if candidate_key.trim() == key {
                    lines.push(format!("{key} = {value}"));
                    replaced = true;
                    continue;
                }
            }
        }
        lines.push(line.to_string());
    }
    if !replaced {
        lines.push(String::new());
        lines.push(format!("[{section}]"));
        lines.push(format!("{key} = {value}"));
    }
    format!("{}\n", lines.join("\n"))
}

impl RuntimeConfig {
    pub fn aggregation_source_urls(&self) -> Vec<String> {
        let mut urls = Vec::new();
        for value in std::iter::once(self.aggregation_http_source_url.as_str())
            .chain(self.aggregation_http_cross_check_urls.split(','))
        {
            let url = value.trim();
            if !url.is_empty() && !urls.iter().any(|configured| configured == url) {
                urls.push(url.to_string());
            }
        }
        urls
    }

    pub fn aggregation_source_ids(&self) -> Vec<String> {
        self.aggregation_http_source_ids
            .split(',')
            .map(str::trim)
            .filter(|id| !id.is_empty())
            .map(str::to_string)
            .collect()
    }
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
    runtime_config_path().unwrap_or_else(|| project_root().join("synapse.config.toml"))
}

fn runtime_config_path() -> Option<PathBuf> {
    RUNTIME_CONFIG_PATH
        .get()
        .and_then(|lock| lock.read().ok().and_then(|value| value.clone()))
}

pub(crate) fn storage_data_root() -> PathBuf {
    storage_data_root_in(&project_root(), &read_runtime_config().storage_data_dir)
}

pub(crate) fn storage_data_root_in(base: &Path, storage_data_dir: &str) -> PathBuf {
    let configured = PathBuf::from(storage_data_dir);
    if configured.is_absolute() {
        configured
    } else {
        base.join(configured)
    }
}

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri must live inside the project root")
        .to_path_buf()
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

        return Some(unescape_toml_basic_string(value.trim().trim_matches('"')));
    }

    None
}

fn unescape_toml_basic_string(value: &str) -> String {
    let mut result = String::new();
    let mut chars = value.chars();
    while let Some(character) = chars.next() {
        if character != '\\' {
            result.push(character);
            continue;
        }
        match chars.next() {
            Some('\\') => result.push('\\'),
            Some('"') => result.push('"'),
            Some('n') => result.push('\n'),
            Some('r') => result.push('\r'),
            Some('t') => result.push('\t'),
            Some(other) => {
                result.push('\\');
                result.push(other);
            }
            None => result.push('\\'),
        }
    }
    result
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

    if !is_safe_storage_data_dir(&config.storage_data_dir) {
        config.warnings.push(format!(
            "storage.data_dir must be a non-empty relative path without '..' or a local absolute disk path; using {DEFAULT_STORAGE_DATA_DIR}."
        ));
        config.storage_data_dir = DEFAULT_STORAGE_DATA_DIR.to_string();
    }

    config
}

fn is_safe_relative_storage_data_dir(value: &str) -> bool {
    let path = Path::new(value.trim());
    !value.trim().is_empty()
        && !path.is_absolute()
        && path.components().any(|component| matches!(component, Component::Normal(_)))
        && path
            .components()
            .all(|component| matches!(component, Component::Normal(_) | Component::CurDir))
}

fn is_safe_storage_data_dir(value: &str) -> bool {
    let value = value.trim();
    if is_safe_relative_storage_data_dir(value) {
        return true;
    }

    let path = Path::new(value);
    if !path.is_absolute() || path.components().any(|component| matches!(component, Component::ParentDir)) {
        return false;
    }

    #[cfg(windows)]
    {
        matches!(path.components().next(),
            Some(Component::Prefix(prefix))
                if matches!(prefix.kind(), Prefix::Disk(_) | Prefix::VerbatimDisk(_))
        ) && path.components().any(|component| matches!(component, Component::Normal(_)))
    }

    #[cfg(not(windows))]
    {
        path.components().any(|component| matches!(component, Component::Normal(_)))
    }
}

fn toml_string(value: &str) -> String {
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

#[cfg(test)]
mod tests {
    use std::fs;

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

    #[test]
    fn aggregation_source_urls_deduplicates_primary_and_cross_checks() {
        let config = RuntimeConfig {
            aggregation_http_source_url: "https://primary.example/feed".to_string(),
            aggregation_http_cross_check_urls:
                " https://secondary.example/feed,https://primary.example/feed, ,https://third.example/feed "
                    .to_string(),
            ..RuntimeConfig::default()
        };

        assert_eq!(
            config.aggregation_source_urls(),
            vec![
                "https://primary.example/feed".to_string(),
                "https://secondary.example/feed".to_string(),
                "https://third.example/feed".to_string(),
            ]
        );
    }

    #[test]
    fn validates_storage_data_dir_as_relative_or_local_absolute_path() {
        let valid = validate_config(RuntimeConfig {
            storage_data_dir: "private-data/synapse".to_string(),
            ..RuntimeConfig::default()
        });
        assert_eq!(valid.storage_data_dir, "private-data/synapse");

        let absolute = validate_config(RuntimeConfig {
            storage_data_dir: r"E:\Synapse\.synapse".to_string(),
            ..RuntimeConfig::default()
        });
        assert_eq!(absolute.storage_data_dir, r"E:\Synapse\.synapse");

        let invalid = validate_config(RuntimeConfig {
            storage_data_dir: "../outside-project".to_string(),
            ..RuntimeConfig::default()
        });
        assert_eq!(invalid.storage_data_dir, DEFAULT_STORAGE_DATA_DIR);
        assert!(invalid
            .warnings
            .iter()
            .any(|warning| warning.contains("storage.data_dir")));

        let network = validate_config(RuntimeConfig {
            storage_data_dir: r"\\server\synapse".to_string(),
            ..RuntimeConfig::default()
        });
        assert_eq!(network.storage_data_dir, DEFAULT_STORAGE_DATA_DIR);
    }

    #[test]
    fn storage_data_root_stays_within_the_selected_runtime_base() {
        assert_eq!(
            storage_data_root_in(Path::new("runtime-base"), ".synapse"),
            PathBuf::from("runtime-base").join(".synapse")
        );
        assert_eq!(
            storage_data_root_in(Path::new("runtime-base"), r"E:\Synapse\.synapse"),
            PathBuf::from(r"E:\Synapse\.synapse")
        );
    }

    #[test]
    fn reads_runtime_config_from_an_explicit_local_path() {
        let path = std::env::temp_dir().join(format!(
            "synapse-runtime-config-{}.toml",
            crate::store::now_millis()
        ));
        fs::write(
            &path,
            r#"
[system]
app_name = "Synapse Local"

[storage]
data_dir = "private-store"
"#,
        )
        .unwrap();

        let config = read_runtime_config_from_path(&path);
        assert_eq!(config.app_name, "Synapse Local");
        assert_eq!(config.storage_data_dir, "private-store");
        let _ = fs::remove_file(path);
    }

    #[test]
    fn creates_a_safe_app_config_template_without_overwriting_existing_config() {
        let root = std::env::temp_dir().join(format!(
            "synapse-app-config-{}",
            crate::store::now_millis()
        ));
        let path = ensure_app_config_file(&root).unwrap();
        let template = fs::read_to_string(&path).unwrap();
        assert!(template.contains("external_delivery_enabled = false"));
        assert!(template.contains("agent_execution_enabled = false"));

        fs::write(&path, "[system]\napp_name = \"Preserved\"\n").unwrap();
        let same_path = ensure_app_config_file(&root).unwrap();
        assert_eq!(same_path, path);
        assert_eq!(fs::read_to_string(&path).unwrap(), "[system]\napp_name = \"Preserved\"\n");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn low_risk_settings_preview_rejects_unsafe_values_and_lists_blocked_fields() {
        let current = RuntimeConfig::default();
        let invalid = RuntimeSettingsUpdateRequest {
            mode: "pro".to_string(),
            storage_data_dir: "../outside".to_string(),
            scheduler_background_loop_enabled: false,
            scheduler_poll_interval_seconds: 30,
            confirmed: false,
        };
        assert!(normalize_runtime_settings(&current, &invalid).is_err());

        let request = RuntimeSettingsUpdateRequest {
            mode: "pro".to_string(),
            storage_data_dir: "private-store".to_string(),
            scheduler_background_loop_enabled: true,
            scheduler_poll_interval_seconds: 90,
            confirmed: false,
        };
        let next = normalize_runtime_settings(&current, &request).unwrap();
        let preview = runtime_settings_preview(PathBuf::from("fixture.toml"), next.clone());
        assert_eq!(preview.state, "runtime-settings-preview");
        assert!(preview.restart_required);
        assert!(preview
            .blocked_fields
            .contains(&"safety.agent_execution_enabled".to_string()));
        assert_eq!(changed_runtime_setting_fields(&current, &next).len(), 4);
    }

    #[test]
    fn runtime_settings_content_preserves_unrelated_secret_fields() {
        let raw = r#"[system]
mode = "lite"

[storage]
data_dir = ".synapse"

[scheduler]
background_loop_enabled = false
poll_interval_seconds = 30

[notifications.feishu]
webhook_url = ""
"#;
        let next = RuntimeConfig {
            mode: "pro".to_string(),
            storage_data_dir: "private-store".to_string(),
            scheduler_background_loop_enabled: true,
            scheduler_poll_interval_seconds: 120,
            ..RuntimeConfig::default()
        };
        let updated = update_runtime_settings_content(raw, &next);
        assert_eq!(read_toml_string(&updated, "system", "mode"), Some("pro".to_string()));
        assert_eq!(
            read_toml_string(&updated, "storage", "data_dir"),
            Some("private-store".to_string())
        );
        assert_eq!(
            read_toml_string(&updated, "scheduler", "background_loop_enabled"),
            Some("true".to_string())
        );
        assert!(updated.contains("webhook_url = \"\""));

        let absolute = RuntimeConfig {
            storage_data_dir: r"E:\Synapse\.synapse".to_string(),
            ..RuntimeConfig::default()
        };
        let updated = update_runtime_settings_content(raw, &absolute);
        assert_eq!(
            read_toml_string(&updated, "storage", "data_dir"),
            Some(r"E:\Synapse\.synapse".to_string())
        );
    }

    #[test]
    fn runtime_settings_update_writes_durable_backup_and_preserves_unrelated_fields() {
        let root = std::env::temp_dir().join(format!(
            "synapse-runtime-settings-update-{}",
            crate::store::now_millis()
        ));
        fs::create_dir_all(&root).unwrap();
        let path = root.join(APP_CONFIG_FILE_NAME);
        let original = r#"[system]
mode = "lite"

[storage]
data_dir = ".synapse"

[scheduler]
background_loop_enabled = false
poll_interval_seconds = 30

[notifications.feishu]
webhook_url = ""
"#;
        fs::write(&path, original).unwrap();

        let receipt = update_runtime_settings_at(
            path.clone(),
            RuntimeSettingsUpdateRequest {
                mode: "pro".to_string(),
                storage_data_dir: "private-store".to_string(),
                scheduler_background_loop_enabled: true,
                scheduler_poll_interval_seconds: 120,
                confirmed: true,
            },
        )
        .unwrap();

        assert_eq!(receipt.state, "runtime-settings-written-restart-required");
        assert_eq!(fs::read_to_string(path.with_file_name(format!("{APP_CONFIG_FILE_NAME}.bak"))).unwrap(), original);
        let updated = fs::read_to_string(&path).unwrap();
        assert_eq!(read_toml_string(&updated, "system", "mode"), Some("pro".to_string()));
        assert_eq!(
            read_toml_string(&updated, "storage", "data_dir"),
            Some("private-store".to_string())
        );
        assert!(updated.contains("webhook_url = \"\""));
        let temporary_files = fs::read_dir(&root)
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().contains(".runtime-settings-"))
            .count();
        assert_eq!(temporary_files, 0);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn runtime_settings_update_requires_confirmation_without_writing_backup() {
        let root = std::env::temp_dir().join(format!(
            "synapse-runtime-settings-confirmation-{}",
            crate::store::now_millis()
        ));
        fs::create_dir_all(&root).unwrap();
        let path = root.join(APP_CONFIG_FILE_NAME);
        let original = "[system]\nmode = \"lite\"\n";
        fs::write(&path, original).unwrap();

        let result = update_runtime_settings_at(
            path.clone(),
            RuntimeSettingsUpdateRequest {
                mode: "pro".to_string(),
                storage_data_dir: "private-store".to_string(),
                scheduler_background_loop_enabled: true,
                scheduler_poll_interval_seconds: 120,
                confirmed: false,
            },
        );

        assert!(result.is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), original);
        assert!(!path.with_file_name(format!("{APP_CONFIG_FILE_NAME}.bak")).exists());
        let _ = fs::remove_dir_all(root);
    }
}
