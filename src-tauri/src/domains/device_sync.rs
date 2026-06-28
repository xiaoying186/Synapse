use reqwest::Url;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::{config, store};

const SYNC_SCHEMA_VERSION: u16 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceSyncState {
    pub device_id: String,
    pub device_label: String,
    pub last_synced_hash: Option<String>,
    pub last_exported_at_ms: Option<u128>,
    pub last_imported_at_ms: Option<u128>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceSyncPackage {
    pub schema_version: u16,
    pub package_id: String,
    pub source_device_id: String,
    pub source_device_label: String,
    pub created_at_ms: u128,
    pub base_hash: Option<String>,
    pub content_hash: String,
    pub zhishu: store::ZhishuRepositoryBundle,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeviceSyncImportPreview {
    pub package_id: String,
    pub source_device_id: String,
    pub source_device_label: String,
    pub local_device_id: String,
    pub local_hash: String,
    pub base_hash: Option<String>,
    pub incoming_hash: String,
    pub state: String,
    pub can_import: bool,
    pub requires_explicit_replace: bool,
    pub gates: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeviceSyncImportReceipt {
    pub preview: DeviceSyncImportPreview,
    pub imported: store::ZhishuRepositoryImportReceipt,
    pub state: DeviceSyncState,
}

#[derive(Debug, Clone, Serialize)]
pub struct RelayPreview {
    pub enabled: bool,
    pub endpoint_configured: bool,
    pub endpoint_valid: bool,
    pub token_present: bool,
    pub state: String,
    pub gates: Vec<String>,
    pub network_started: bool,
}

pub fn state() -> Result<DeviceSyncState, store::StoreError> {
    let path = store::device_sync_state_path();
    let mut records = store::read_json_records::<DeviceSyncState>(&path)?;
    if let Some(record) = records.pop() {
        return Ok(record);
    }
    let runtime = config::read_runtime_config();
    let now = store::now_millis();
    let record = DeviceSyncState {
        device_id: format!("device-{}-{now}", sanitize_id(&runtime.instance_id)),
        device_label: runtime.instance_id,
        last_synced_hash: None,
        last_exported_at_ms: None,
        last_imported_at_ms: None,
    };
    store::write_json_records(&path, std::slice::from_ref(&record))?;
    Ok(record)
}

pub fn export_package() -> Result<DeviceSyncPackage, store::StoreError> {
    let mut sync_state = state()?;
    let zhishu = store::export_zhishu_repository()?;
    let content_hash = hash_bundle(&zhishu)?;
    let now = store::now_millis();
    let package = DeviceSyncPackage {
        schema_version: SYNC_SCHEMA_VERSION,
        package_id: format!("sync-package-{now}"),
        source_device_id: sync_state.device_id.clone(),
        source_device_label: sync_state.device_label.clone(),
        created_at_ms: now,
        base_hash: sync_state.last_synced_hash.clone(),
        content_hash,
        zhishu,
    };
    sync_state.last_exported_at_ms = Some(now);
    write_state(&sync_state)?;
    Ok(package)
}

pub fn preview_import(raw: String) -> Result<DeviceSyncImportPreview, store::StoreError> {
    let package = parse_package(&raw)?;
    let sync_state = state()?;
    let local_bundle = store::export_zhishu_repository()?;
    let local_hash = hash_bundle(&local_bundle)?;
    let local_empty = local_bundle.memory_items.is_empty()
        && local_bundle.relations.is_empty()
        && local_bundle.maintenance_findings.is_empty();
    let (state, can_import, requires_explicit_replace) = if package.content_hash == local_hash {
        ("already-synchronized", false, false)
    } else if package
        .base_hash
        .as_ref()
        .is_some_and(|base| base == &local_hash)
    {
        ("fast-forward-ready", true, false)
    } else if sync_state
        .last_synced_hash
        .as_ref()
        .is_some_and(|last| Some(last) == package.base_hash.as_ref())
    {
        ("conflict-local-and-remote-changed", false, false)
    } else if local_empty {
        ("initial-import-ready", true, false)
    } else {
        ("initial-import-requires-replace", true, true)
    };

    Ok(DeviceSyncImportPreview {
        package_id: package.package_id,
        source_device_id: package.source_device_id,
        source_device_label: package.source_device_label,
        local_device_id: sync_state.device_id,
        local_hash,
        base_hash: package.base_hash,
        incoming_hash: package.content_hash,
        state: state.to_string(),
        can_import,
        requires_explicit_replace,
        gates: vec![
            "schema-version-check".to_string(),
            "sha256-content-integrity".to_string(),
            "device-identity-visible".to_string(),
            "base-hash-conflict-detection".to_string(),
            "explicit-replace-for-nonempty-initial-import".to_string(),
            "no-automatic-merge".to_string(),
            "no-credentials-or-environment-data".to_string(),
        ],
    })
}

pub fn import_package(
    raw: String,
    allow_replace: bool,
) -> Result<DeviceSyncImportReceipt, store::StoreError> {
    let preview = preview_import(raw.clone())?;
    if !preview.can_import {
        return Err(store::StoreError::InvalidInput(format!(
            "sync package import is blocked: {}",
            preview.state
        )));
    }
    if preview.requires_explicit_replace && !allow_replace {
        return Err(store::StoreError::InvalidInput(
            "sync package requires explicit replace approval".to_string(),
        ));
    }
    let package = parse_package(&raw)?;
    let imported = store::import_zhishu_repository(serde_json::to_string(&package.zhishu)?)?;
    let mut sync_state = state()?;
    sync_state.last_synced_hash = Some(package.content_hash);
    sync_state.last_imported_at_ms = Some(store::now_millis());
    write_state(&sync_state)?;
    Ok(DeviceSyncImportReceipt {
        preview,
        imported,
        state: sync_state,
    })
}

pub fn relay_preview() -> RelayPreview {
    let runtime = config::read_runtime_config();
    let endpoint_configured = !runtime.relay_endpoint.trim().is_empty();
    let endpoint_valid = endpoint_configured
        && Url::parse(runtime.relay_endpoint.trim()).is_ok_and(|url| {
            url.scheme() == "https"
                && url.username().is_empty()
                && url.password().is_none()
                && url.fragment().is_none()
        });
    let token_present =
        std::env::var("SYNAPSE_RELAY_TOKEN").is_ok_and(|value| !value.trim().is_empty());
    let state = if !runtime.relay_enabled {
        "disabled"
    } else if !endpoint_configured {
        "blocked-endpoint-not-configured"
    } else if !endpoint_valid {
        "blocked-endpoint-invalid"
    } else if !token_present {
        "blocked-token-unavailable"
    } else {
        "ready-for-future-upload-implementation"
    };
    RelayPreview {
        enabled: runtime.relay_enabled,
        endpoint_configured,
        endpoint_valid,
        token_present,
        state: state.to_string(),
        gates: vec![
            "disabled-by-default".to_string(),
            "https-endpoint-only".to_string(),
            "token-from-environment-only".to_string(),
            "package-integrity-before-upload".to_string(),
            "no-network-upload-in-this-stage".to_string(),
        ],
        network_started: false,
    }
}

fn parse_package(raw: &str) -> Result<DeviceSyncPackage, store::StoreError> {
    let package = serde_json::from_str::<DeviceSyncPackage>(raw)?;
    if package.schema_version > SYNC_SCHEMA_VERSION {
        return Err(store::StoreError::InvalidInput(format!(
            "unsupported device sync schema version: {}",
            package.schema_version
        )));
    }
    let actual_hash = hash_bundle(&package.zhishu)?;
    if actual_hash != package.content_hash {
        return Err(store::StoreError::InvalidInput(
            "device sync package content hash does not match payload".to_string(),
        ));
    }
    Ok(package)
}

fn hash_bundle(bundle: &store::ZhishuRepositoryBundle) -> Result<String, store::StoreError> {
    let raw = serde_json::to_vec(bundle)?;
    Ok(hex::encode(Sha256::digest(raw)))
}

fn write_state(state: &DeviceSyncState) -> Result<(), store::StoreError> {
    store::write_json_records(
        &store::device_sync_state_path(),
        std::slice::from_ref(state),
    )
}

fn sanitize_id(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' {
                character
            } else {
                '-'
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bundle_hash_is_stable_and_changes_with_content() {
        let empty = bundle(Vec::new());
        let populated = bundle(vec![serde_json::json!({"id": "one"})]);
        assert_eq!(hash_bundle(&empty).unwrap(), hash_bundle(&empty).unwrap());
        assert_ne!(
            hash_bundle(&empty).unwrap(),
            hash_bundle(&populated).unwrap()
        );
    }

    #[test]
    fn rejects_tampered_and_future_packages() {
        let zhishu = bundle(Vec::new());
        let mut package = DeviceSyncPackage {
            schema_version: SYNC_SCHEMA_VERSION,
            package_id: "package-1".to_string(),
            source_device_id: "device-1".to_string(),
            source_device_label: "Device".to_string(),
            created_at_ms: 1,
            base_hash: None,
            content_hash: hash_bundle(&zhishu).unwrap(),
            zhishu,
        };
        package.content_hash = "tampered".to_string();
        assert!(parse_package(&serde_json::to_string(&package).unwrap()).is_err());
        package.content_hash = hash_bundle(&package.zhishu).unwrap();
        package.schema_version = SYNC_SCHEMA_VERSION + 1;
        assert!(parse_package(&serde_json::to_string(&package).unwrap()).is_err());
    }

    fn bundle(memory_items: Vec<serde_json::Value>) -> store::ZhishuRepositoryBundle {
        store::ZhishuRepositoryBundle {
            schema_version: store::STORE_SCHEMA_VERSION,
            memory_items,
            relations: Vec::new(),
            maintenance_findings: Vec::new(),
        }
    }
}
