//! Local prototype storage for plan history, memory, and Task Center state.
//!
//! Storage is deliberately simple for now: capped JSON files under the project
//! root. The domain modules keep the current behavior while making room for the
//! Zhishu and permission layers to grow without crowding one file.

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{de::DeserializeOwned, Deserialize, Serialize};

mod audit_event;
mod history;
mod memory;
mod notification_delivery_attempt;
mod paths;
mod provider_receipt;
mod queue;
mod repository;
mod saga;
mod scheduler_state;
mod snapshot;
mod source_observation;
mod task_artifact;
mod task_center;
mod zhishu_maintenance;
mod zhishu_relation;

pub(crate) use audit_event::append_audit_event_at;
pub use audit_event::{append_audit_event, list_audit_events, AuditEvent, NewAuditEvent};
pub use history::{
    append_preview, append_review, clear_history, recent_plans, PlanRecord, ReviewRecord,
};
pub use memory::{
    append_experience, append_inspiration, append_synthesis_association, append_synthesis_summary,
    append_zhishu_item, recent_memory_items, review_memory_item, rollback_memory_item_snapshot,
    MemoryItem, MemoryRollbackReceipt,
};
pub use notification_delivery_attempt::{
    begin_notification_delivery_attempt, list_notification_delivery_attempts,
    reconcile_notification_delivery_attempt, transition_notification_delivery_attempt,
    NotificationDeliveryAttempt, NotificationDeliveryReconciliationReceipt,
};
pub(crate) use memory::{
    append_provider_artifact_zhishu_candidate_at, review_memory_item_with_protection_at,
};
pub(crate) use paths::{
    active_data_root, arsenal_allowlist_path, arsenal_tools_path, audit_event_path, device_sync_state_path,
    configure_runtime_data_root, local_apps_path, source_registry_approval_path, task_artifact_path,
};
#[cfg(test)]
pub(crate) use paths::with_test_data_root;
pub use provider_receipt::{
    create_provider_artifact_zhishu_candidate, create_provider_receipt_task_artifact,
    preflight_provider_artifact_zhishu_admission, preflight_provider_receipt_task_artifact,
    provider_receipt_review_candidates, review_provider_artifact_zhishu_admission,
    review_provider_artifact_zhishu_candidate, review_provider_receipt_review_candidate,
    stage_provider_receipt_review_candidate, ProviderArtifactAdmissionReview,
    ProviderArtifactAdmissionReviewReceipt, ProviderArtifactZhishuAdmissionPreflight,
    ProviderArtifactZhishuCandidateReceipt, ProviderArtifactZhishuFinalReviewReceipt,
    ProviderReceiptReviewCandidate, ProviderReceiptReviewDecisionReceipt,
    ProviderReceiptReviewQueueReceipt, ProviderReceiptTaskArtifactPreflight,
    ProviderReceiptTaskArtifactReceipt,
};
pub use queue::{append_execution, ExecutionRecord};
pub use repository::{
    export_zhishu_repository, import_zhishu_repository, ZhishuRepositoryBundle,
    ZhishuRepositoryImportReceipt,
};
#[cfg(test)]
pub(crate) use repository::import_zhishu_repository_at;
pub use saga::{begin_saga, get_saga, list_sagas, transition_saga, SagaTransaction};
pub use scheduler_state::{
    acquire_scheduler_lease, heartbeat_scheduler_lease, read_scheduler_state,
    record_scheduler_tick_result, release_scheduler_lease, SchedulerPersistentState,
};
pub(crate) use snapshot::create_snapshot_at;
pub use snapshot::{create_snapshot, get_snapshot, list_snapshots, SnapshotRecord};
pub use source_observation::{
    append_source_observations, list_source_observations, remove_source_observations, NewSourceObservationRecord,
    SourceObservationRecord,
};
pub(crate) use task_artifact::append_task_artifacts_at;
pub use task_artifact::{
    append_task_artifacts, list_task_artifacts, remove_task_artifacts, NewTaskArtifact, TaskArtifactRecord,
};
pub use task_center::{
    append_task_direction, archive_task_run, cancel_task_run, complete_domain_task_run,
    execute_task_run, generate_task_candidates, recover_interrupted_task_runs, request_task_run,
    restore_task_direction, restore_task_run, review_task_candidate, review_task_run, set_task_direction_active,
    task_candidates, task_directions, task_run_by_id, task_run_records, task_schedule_previews,
    task_scheduler_tick, TaskCandidate, TaskCandidateReview, TaskDirection,
    TaskRunExecutionReceipt, TaskRunRecord, TaskSchedulePreview, TaskSchedulerTick,
};
pub use zhishu_maintenance::{
    append_zhishu_maintenance_findings, list_zhishu_maintenance_findings,
    review_zhishu_maintenance_finding, NewZhishuMaintenanceFinding, ZhishuMaintenanceFinding,
};
pub use zhishu_relation::{
    append_zhishu_relations, list_zhishu_relations, review_zhishu_relation, NewZhishuRelation,
    ZhishuRelationRecord,
};

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("storage io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("storage json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("storage sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("record not found: {0}")]
    NotFound(String),
    #[error("invalid input: {0}")]
    InvalidInput(String),
}

pub(crate) const STORE_SCHEMA_VERSION: u16 = 1;
static TEMP_FILE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Deserialize)]
struct JsonRecordEnvelope<T> {
    #[serde(default)]
    schema_version: u16,
    records: Vec<T>,
}

#[derive(Debug, Serialize)]
struct JsonRecordEnvelopeRef<'a, T> {
    schema_version: u16,
    records: &'a [T],
}

pub(crate) fn read_json_records<T>(path: &Path) -> Result<Vec<T>, StoreError>
where
    T: DeserializeOwned,
{
    if let Some(collection) = repository::collection_for_path(path) {
        return repository::read_values(path, collection)?
            .into_iter()
            .map(serde_json::from_value)
            .collect::<Result<Vec<_>, _>>()
            .map_err(StoreError::from);
    }
    read_json_records_from_file(path)
}

pub(crate) fn read_json_records_from_file<T>(path: &Path) -> Result<Vec<T>, StoreError>
where
    T: DeserializeOwned,
{
    if !path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(path)?;
    if raw.trim().is_empty() {
        return Ok(Vec::new());
    }

    let value = serde_json::from_str::<serde_json::Value>(&raw)?;
    if value.is_array() {
        return Ok(serde_json::from_value(value)?);
    }

    let envelope = serde_json::from_value::<JsonRecordEnvelope<T>>(value)?;
    if envelope.schema_version > STORE_SCHEMA_VERSION {
        return Err(StoreError::InvalidInput(format!(
            "unsupported store schema version: {}",
            envelope.schema_version
        )));
    }
    Ok(envelope.records)
}

pub(crate) fn write_json_records<T>(path: &Path, records: &[T]) -> Result<(), StoreError>
where
    T: Serialize,
{
    if let Some(collection) = repository::collection_for_path(path) {
        let values = records
            .iter()
            .map(serde_json::to_value)
            .collect::<Result<Vec<_>, _>>()?;
        return repository::write_values(collection, &values);
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let envelope = JsonRecordEnvelopeRef {
        schema_version: STORE_SCHEMA_VERSION,
        records,
    };
    let raw = serde_json::to_string_pretty(&envelope)?;
    let temp_path = temporary_store_path(path);
    let write_result = write_and_sync_file(&temp_path, raw.as_bytes())
        .and_then(|_| replace_file(&temp_path, path));

    if write_result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    write_result?;

    Ok(())
}

fn temporary_store_path(path: &Path) -> PathBuf {
    let sequence = TEMP_FILE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("store.json");
    let temp_name = format!(
        ".{file_name}.tmp-{}-{}-{sequence}",
        std::process::id(),
        now_millis()
    );

    path.with_file_name(temp_name)
}

fn write_and_sync_file(path: &Path, raw: &[u8]) -> Result<(), StoreError> {
    let mut file = OpenOptions::new().write(true).create_new(true).open(path)?;
    file.write_all(raw)?;
    file.flush()?;
    file.sync_all()?;
    Ok(())
}

#[cfg(windows)]
fn replace_file(source: &Path, destination: &Path) -> Result<(), StoreError> {
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
        return Err(StoreError::Io(std::io::Error::last_os_error()));
    }

    Ok(())
}

#[cfg(not(windows))]
fn replace_file(source: &Path, destination: &Path) -> Result<(), StoreError> {
    fs::rename(source, destination)?;
    Ok(())
}

pub(crate) fn remove_file_if_exists(path: &Path) -> Result<(), StoreError> {
    if path.exists() {
        fs::remove_file(path)?;
    }

    Ok(())
}

pub(crate) fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

pub(crate) fn value_string(value: &serde_json::Value, key: &str, fallback: &str) -> String {
    value
        .get(key)
        .and_then(|value| value.as_str())
        .unwrap_or(fallback)
        .to_string()
}

pub(crate) fn normalize_tags(tags: Vec<String>) -> Vec<String> {
    let mut normalized = tags
        .into_iter()
        .map(|tag| tag.trim().to_ascii_lowercase())
        .filter(|tag| !tag.is_empty())
        .collect::<Vec<_>>();

    normalized.sort();
    normalized.dedup();
    normalized.truncate(12);
    normalized
}

pub(crate) fn short_text(value: &str, max_chars: usize) -> String {
    let mut text = value.trim().chars().take(max_chars).collect::<String>();
    if value.trim().chars().count() > max_chars {
        text.push_str("...");
    }
    text
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;

    use serde::{Deserialize, Serialize};
    use serde_json::Value;

    use super::*;

    #[derive(Debug, PartialEq, Serialize, Deserialize)]
    struct TestRecord {
        name: String,
    }

    fn temp_store_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("synapse-store-{name}-{}.json", now_millis()))
    }

    #[test]
    fn reads_legacy_record_array() {
        let path = temp_store_path("legacy-array");
        fs::write(&path, r#"[{"name":"old"}]"#).unwrap();

        let records = read_json_records::<TestRecord>(&path).unwrap();

        assert_eq!(
            records,
            vec![TestRecord {
                name: "old".to_string()
            }]
        );

        let _ = fs::remove_file(path);
    }

    #[test]
    fn reads_schema_envelope_records() {
        let path = temp_store_path("schema-envelope");
        fs::write(
            &path,
            r#"{"schema_version":1,"records":[{"name":"wrapped"}]}"#,
        )
        .unwrap();

        let records = read_json_records::<TestRecord>(&path).unwrap();

        assert_eq!(
            records,
            vec![TestRecord {
                name: "wrapped".to_string()
            }]
        );

        let _ = fs::remove_file(path);
    }

    #[test]
    fn reads_schema_zero_envelope_records() {
        let path = temp_store_path("schema-zero-envelope");
        fs::write(
            &path,
            r#"{"schema_version":0,"records":[{"name":"schema-zero"}]}"#,
        )
        .unwrap();

        let records = read_json_records::<TestRecord>(&path).unwrap();

        assert_eq!(
            records,
            vec![TestRecord {
                name: "schema-zero".to_string()
            }]
        );

        let _ = fs::remove_file(path);
    }

    #[test]
    fn reads_envelope_without_schema_version_as_schema_zero() {
        let path = temp_store_path("missing-schema-version");
        fs::write(&path, r#"{"records":[{"name":"implicit-zero"}]}"#).unwrap();

        let records = read_json_records::<TestRecord>(&path).unwrap();

        assert_eq!(
            records,
            vec![TestRecord {
                name: "implicit-zero".to_string()
            }]
        );

        let _ = fs::remove_file(path);
    }

    #[test]
    fn rejects_future_schema_envelope_records() {
        let path = temp_store_path("future-schema-envelope");
        fs::write(
            &path,
            r#"{"schema_version":999,"records":[{"name":"future"}]}"#,
        )
        .unwrap();

        let error = read_json_records::<TestRecord>(&path).unwrap_err();

        assert!(error
            .to_string()
            .contains("unsupported store schema version"));

        let _ = fs::remove_file(path);
    }

    #[test]
    fn writes_schema_envelope_records() {
        let path = temp_store_path("write-envelope");

        write_json_records(
            &path,
            &[TestRecord {
                name: "new".to_string(),
            }],
        )
        .unwrap();

        let raw = fs::read_to_string(&path).unwrap();
        let value = serde_json::from_str::<Value>(&raw).unwrap();

        assert_eq!(value["schema_version"], STORE_SCHEMA_VERSION);
        assert_eq!(value["records"][0]["name"], "new");

        let _ = fs::remove_file(path);
    }

    #[test]
    fn replaces_existing_store_records() {
        let path = temp_store_path("replace-existing");
        fs::write(&path, r#"{"schema_version":1,"records":[{"name":"old"}]}"#).unwrap();

        write_json_records(
            &path,
            &[TestRecord {
                name: "new".to_string(),
            }],
        )
        .unwrap();

        let records = read_json_records::<TestRecord>(&path).unwrap();
        assert_eq!(
            records,
            vec![TestRecord {
                name: "new".to_string()
            }]
        );

        let _ = fs::remove_file(path);
    }

    #[cfg(windows)]
    #[test]
    fn failed_replacement_preserves_existing_store_and_removes_temp_file() {
        let path = temp_store_path("failed-replacement");
        let original = r#"{"schema_version":1,"records":[{"name":"old"}]}"#;
        fs::write(&path, original).unwrap();

        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_readonly(true);
        fs::set_permissions(&path, permissions).unwrap();

        let result = write_json_records(
            &path,
            &[TestRecord {
                name: "new".to_string(),
            }],
        );

        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_readonly(false);
        fs::set_permissions(&path, permissions).unwrap();

        assert!(result.is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), original);

        let file_name = path.file_name().unwrap().to_string_lossy();
        let temp_prefix = format!(".{file_name}.tmp-");
        let leftover_temp_files = path
            .parent()
            .unwrap()
            .read_dir()
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with(&temp_prefix)
            })
            .count();
        assert_eq!(leftover_temp_files, 0);

        let _ = fs::remove_file(path);
    }
}
