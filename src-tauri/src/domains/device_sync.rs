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
    pub snapshot: store::SnapshotRecord,
    pub audit_event: store::AuditEvent,
    pub saga: store::SagaTransaction,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeviceSyncImportApplyPreflight {
    pub generated_at_ms: u128,
    pub package_id: String,
    pub source_device_id: String,
    pub local_device_id: String,
    pub state: String,
    pub preview_state: String,
    pub can_apply: bool,
    pub allow_replace: bool,
    pub requires_explicit_replace: bool,
    pub import_started: bool,
    pub durable_write_started: bool,
    pub backup_required: bool,
    pub audit_required: bool,
    pub rollback_snapshot_required: bool,
    pub cloud_source_of_truth: bool,
    pub gates: Vec<String>,
    pub blockers: Vec<String>,
    pub denied_actions: Vec<String>,
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
    let previous_zhishu = store::export_zhishu_repository()?;
    let previous_state = state()?;
    let saga = store::begin_saga(
        "device-sync-import".to_string(),
        previous_state.device_id.clone(),
        serde_json::json!({
            "package_id": package.package_id,
            "source_device_id": package.source_device_id,
            "allow_replace": allow_replace,
        }),
    )?;
    let snapshot = match store::create_snapshot(
        "device-sync-import".to_string(),
        previous_state.device_id.clone(),
        "before-device-sync-import".to_string(),
        serde_json::json!({
            "zhishu": previous_zhishu,
            "device_sync_state": previous_state,
            "saga_id": saga.id,
        }),
    ) {
        Ok(snapshot) => snapshot,
        Err(error) => return fail_saga(&saga, error),
    };
    let imported = match store::import_zhishu_repository(serde_json::to_string(&package.zhishu)?) {
        Ok(imported) => imported,
        Err(error) => return fail_saga(&saga, error),
    };
    let mut sync_state = previous_state.clone();
    sync_state.last_synced_hash = Some(package.content_hash);
    sync_state.last_imported_at_ms = Some(store::now_millis());
    let audit_event = finalize_import_commit(
        || write_state(&sync_state),
        || store::append_audit_event(store::NewAuditEvent {
        actor: "taiheng".to_string(),
        action: "import-device-sync-package".to_string(),
        target_type: "device-sync".to_string(),
        target_id: sync_state.device_id.clone(),
        risk_level: "high".to_string(),
        decision: preview.state.clone(),
        input: serde_json::json!({
            "allow_replace": allow_replace,
            "package_id": package.package_id,
            "snapshot_id": snapshot.id,
            "saga_id": saga.id,
        }),
        result_summary: serde_json::json!({
            "memory_items": imported.memory_items,
            "relations": imported.relations,
            "maintenance_findings": imported.maintenance_findings,
            "last_synced_hash": sync_state.last_synced_hash,
            "rollback_snapshot_id": snapshot.id,
        }),
        error: None,
        }),
        || compensate_import_state(&saga, &previous_zhishu, &previous_state),
    )?;
    let saga = match store::transition_saga(saga.id.clone(), "committed".to_string()) {
        Ok(saga) => saga,
        Err(error) => {
            return finish_compensation(
                error,
                compensate_import_state(&saga, &previous_zhishu, &previous_state),
            )
        }
    };
    Ok(DeviceSyncImportReceipt {
        preview,
        imported,
        state: sync_state,
        snapshot,
        audit_event,
        saga,
    })
}

fn fail_saga<T>(saga: &store::SagaTransaction, error: store::StoreError) -> Result<T, store::StoreError> {
    let _ = store::transition_saga(saga.id.clone(), "failed".to_string());
    Err(error)
}

fn finalize_import_commit<T, FState, FAudit, FCompensate>(
    write_state: FState,
    write_audit: FAudit,
    compensate: FCompensate,
) -> Result<T, store::StoreError>
where
    FState: FnOnce() -> Result<(), store::StoreError>,
    FAudit: FnOnce() -> Result<T, store::StoreError>,
    FCompensate: FnOnce() -> Result<(), store::StoreError>,
{
    if let Err(error) = write_state() {
        return finish_compensation(error, compensate());
    }
    match write_audit() {
        Ok(value) => Ok(value),
        Err(error) => finish_compensation(error, compensate()),
    }
}

fn finish_compensation<T>(
    original_error: store::StoreError,
    compensation: Result<(), store::StoreError>,
) -> Result<T, store::StoreError> {
    match compensation {
        Ok(()) => Err(original_error),
        Err(compensation_error) => Err(store::StoreError::InvalidInput(format!(
            "device sync import failed: {original_error}; compensation failed: {compensation_error}"
        ))),
    }
}

fn compensate_import_state(
    saga: &store::SagaTransaction,
    previous_zhishu: &store::ZhishuRepositoryBundle,
    previous_state: &DeviceSyncState,
) -> Result<(), store::StoreError> {
    let _ = store::transition_saga(saga.id.clone(), "compensating".to_string());
    let result = restore_import_state(
        || {
            store::import_zhishu_repository(
                serde_json::to_string(previous_zhishu).map_err(store::StoreError::from)?,
            )
            .map(|_| ())
        },
        || write_state(previous_state),
    );
    if result.is_ok() {
        let _ = store::transition_saga(saga.id.clone(), "compensated".to_string());
    } else {
        let _ = store::transition_saga(saga.id.clone(), "failed".to_string());
    }
    result
}

fn restore_import_state<FRepository, FState>(
    restore_repository: FRepository,
    restore_state: FState,
) -> Result<(), store::StoreError>
where
    FRepository: FnOnce() -> Result<(), store::StoreError>,
    FState: FnOnce() -> Result<(), store::StoreError>,
{
    let repository_result = restore_repository();
    let state_result = restore_state();
    match (repository_result, state_result) {
        (Ok(()), Ok(())) => Ok(()),
        (Err(repository_error), Ok(())) => Err(store::StoreError::InvalidInput(format!(
            "device sync import compensation failed: Zhishu repository rollback: {repository_error}"
        ))),
        (Ok(()), Err(state_error)) => Err(store::StoreError::InvalidInput(format!(
            "device sync import compensation failed: device sync state rollback: {state_error}"
        ))),
        (Err(repository_error), Err(state_error)) => Err(store::StoreError::InvalidInput(format!(
            "device sync import compensation failed: Zhishu repository rollback: {repository_error}; device sync state rollback: {state_error}"
        ))),
    }
}

pub fn preflight_import_apply(
    raw: String,
    allow_replace: bool,
) -> Result<DeviceSyncImportApplyPreflight, store::StoreError> {
    let preview = preview_import(raw)?;
    Ok(build_import_apply_preflight(preview, allow_replace))
}

fn build_import_apply_preflight(
    preview: DeviceSyncImportPreview,
    allow_replace: bool,
) -> DeviceSyncImportApplyPreflight {
    let replace_blocked = preview.requires_explicit_replace && !allow_replace;
    let can_apply = preview.can_import && !replace_blocked;
    let mut blockers = Vec::new();
    if !preview.can_import {
        blockers.push(format!("import-preview-blocked-{}", preview.state));
    }
    if replace_blocked {
        blockers.push("explicit-replace-approval-not-granted".to_string());
    }
    blockers.extend([
        "rollback-snapshot-not-created".to_string(),
        "import-audit-record-not-opened".to_string(),
    ]);

    DeviceSyncImportApplyPreflight {
        generated_at_ms: store::now_millis(),
        package_id: preview.package_id,
        source_device_id: preview.source_device_id,
        local_device_id: preview.local_device_id,
        state: if can_apply {
            "device-sync-import-apply-review-required".to_string()
        } else {
            "device-sync-import-apply-blocked".to_string()
        },
        preview_state: preview.state,
        can_apply,
        allow_replace,
        requires_explicit_replace: preview.requires_explicit_replace,
        import_started: false,
        durable_write_started: false,
        backup_required: true,
        audit_required: true,
        rollback_snapshot_required: true,
        cloud_source_of_truth: false,
        gates: vec![
            "schema-version-check".to_string(),
            "sha256-content-integrity".to_string(),
            "device-identity-visible".to_string(),
            "base-hash-conflict-detection".to_string(),
            "explicit-replace-for-nonempty-initial-import".to_string(),
            "rollback-snapshot-before-import".to_string(),
            "audit-required-before-device-sync-import".to_string(),
            "local-device-remains-source-of-truth".to_string(),
            "no-automatic-merge".to_string(),
            "no-credentials-or-environment-data".to_string(),
        ],
        blockers,
        denied_actions: vec![
            "import-without-preview".to_string(),
            "replace-without-explicit-approval".to_string(),
            "cloud-relay-as-source-of-truth".to_string(),
            "automatic-merge".to_string(),
            "credential-or-environment-import".to_string(),
        ],
    }
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
    use std::{cell::RefCell, fs, path::PathBuf};

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

    #[test]
    fn import_apply_preflight_never_writes_and_blocks_replace_without_approval() {
        let preview = DeviceSyncImportPreview {
            package_id: "package-1".to_string(),
            source_device_id: "device-other".to_string(),
            source_device_label: "Other device".to_string(),
            local_device_id: "device-local".to_string(),
            local_hash: "local".to_string(),
            base_hash: None,
            incoming_hash: "incoming".to_string(),
            state: "initial-import-requires-replace".to_string(),
            can_import: true,
            requires_explicit_replace: true,
            gates: vec![],
        };
        let preflight = build_import_apply_preflight(preview, false);

        assert_eq!(preflight.state, "device-sync-import-apply-blocked");
        assert!(!preflight.can_apply);
        assert!(!preflight.import_started);
        assert!(!preflight.durable_write_started);
        assert!(preflight.backup_required);
        assert!(preflight.audit_required);
        assert!(preflight.rollback_snapshot_required);
        assert!(!preflight.cloud_source_of_truth);
        assert!(preflight
            .gates
            .contains(&"local-device-remains-source-of-truth".to_string()));
        assert!(preflight
            .blockers
            .contains(&"explicit-replace-approval-not-granted".to_string()));
        assert!(preflight
            .denied_actions
            .contains(&"cloud-relay-as-source-of-truth".to_string()));
    }

    #[test]
    fn import_commit_compensates_state_failure_before_audit() {
        let events = std::cell::RefCell::new(Vec::new());
        let result = finalize_import_commit::<(), _, _, _>(
            || {
                events.borrow_mut().push("state");
                Err(store::StoreError::InvalidInput("state failed".to_string()))
            },
            || {
                events.borrow_mut().push("audit");
                Ok(())
            },
            || {
                events.borrow_mut().push("compensate");
                Ok(())
            },
        );

        assert!(result.is_err());
        assert_eq!(events.into_inner(), vec!["state", "compensate"]);
    }

    #[test]
    fn import_commit_compensates_audit_failure_after_state_write() {
        let events = std::cell::RefCell::new(Vec::new());
        let result = finalize_import_commit::<(), _, _, _>(
            || {
                events.borrow_mut().push("state");
                Ok(())
            },
            || {
                events.borrow_mut().push("audit");
                Err(store::StoreError::InvalidInput("audit failed".to_string()))
            },
            || {
                events.borrow_mut().push("compensate");
                Ok(())
            },
        );

        assert!(result.is_err());
        assert_eq!(events.into_inner(), vec!["state", "audit", "compensate"]);
    }

    #[test]
    fn import_compensation_reports_temporary_repository_rollback_failure_and_restores_state() {
        let database = temporary_database_path("device-sync-compensation");
        let previous = bundle(Vec::new());
        store::import_zhishu_repository_at(&database, serde_json::to_string(&previous).unwrap())
            .unwrap();

        let lock = rusqlite::Connection::open(&database).unwrap();
        lock.execute_batch("BEGIN EXCLUSIVE").unwrap();
        let events = RefCell::new(Vec::new());
        let result = restore_import_state(
            || {
                events.borrow_mut().push("repository");
                store::import_zhishu_repository_at(
                    &database,
                    serde_json::to_string(&previous).unwrap(),
                )
                .map(|_| ())
            },
            || {
                events.borrow_mut().push("state");
                Ok(())
            },
        );
        lock.execute_batch("ROLLBACK").unwrap();

        let error = result.unwrap_err().to_string();
        assert!(error.contains("Zhishu repository rollback"));
        assert_eq!(events.into_inner(), vec!["repository", "state"]);

        let _ = fs::remove_file(&database);
        let _ = fs::remove_file(database.with_extension("db-shm"));
        let _ = fs::remove_file(database.with_extension("db-wal"));
    }

    fn bundle(memory_items: Vec<serde_json::Value>) -> store::ZhishuRepositoryBundle {
        store::ZhishuRepositoryBundle {
            schema_version: store::STORE_SCHEMA_VERSION,
            memory_items,
            relations: Vec::new(),
            maintenance_findings: Vec::new(),
        }
    }

    fn temporary_database_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("synapse-{name}-{}.db", store::now_millis()))
    }
}
