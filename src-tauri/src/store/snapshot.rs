use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::store::{now_millis, paths, read_json_records, write_json_records, StoreError};

const MAX_SNAPSHOTS: usize = 500;
const SUPPORTED_OBJECT_TYPES: [&str; 4] = [
    "zhishu-item",
    "task-direction",
    "arsenal-allow-state",
    "arsenal-custom-tool",
];

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SnapshotRecord {
    pub id: String,
    pub object_type: String,
    pub object_id: String,
    pub version: u64,
    pub reason: String,
    pub created_at_ms: u128,
    pub payload: serde_json::Value,
}

pub fn create_snapshot(
    object_type: String,
    object_id: String,
    reason: String,
    payload: serde_json::Value,
) -> Result<SnapshotRecord, StoreError> {
    create_snapshot_at(
        &paths::snapshot_path(),
        object_type,
        object_id,
        reason,
        payload,
    )
}

pub fn list_snapshots(
    object_type: Option<String>,
    object_id: Option<String>,
    limit: usize,
) -> Result<Vec<SnapshotRecord>, StoreError> {
    list_snapshots_at(
        &paths::snapshot_path(),
        object_type.as_deref(),
        object_id.as_deref(),
        limit,
    )
}

pub fn get_snapshot(snapshot_id: String) -> Result<SnapshotRecord, StoreError> {
    get_snapshot_at(&paths::snapshot_path(), &snapshot_id)
}

pub(crate) fn create_snapshot_at(
    path: &Path,
    object_type: String,
    object_id: String,
    reason: String,
    payload: serde_json::Value,
) -> Result<SnapshotRecord, StoreError> {
    let object_type = normalize_object_type(&object_type)?;
    let object_id = require_value(object_id, "snapshot object id")?;
    let reason = require_value(reason, "snapshot reason")?;
    let mut records = read_snapshot_records(path)?;
    let version = records
        .iter()
        .filter(|record| record.object_type == object_type && record.object_id == object_id)
        .map(|record| record.version)
        .max()
        .unwrap_or(0)
        + 1;
    let now = now_millis();
    let record = SnapshotRecord {
        id: format!("snapshot-{now}-{}", records.len() + 1),
        object_type,
        object_id,
        version,
        reason,
        created_at_ms: now,
        payload,
    };

    records.insert(0, record.clone());
    records.truncate(MAX_SNAPSHOTS);
    write_json_records(path, &records)?;

    Ok(record)
}

pub(crate) fn list_snapshots_at(
    path: &Path,
    object_type: Option<&str>,
    object_id: Option<&str>,
    limit: usize,
) -> Result<Vec<SnapshotRecord>, StoreError> {
    let object_type = object_type.map(normalize_object_type).transpose()?;
    let object_id = object_id
        .map(|value| require_value(value.to_string(), "snapshot object id"))
        .transpose()?;
    let mut records = read_snapshot_records(path)?
        .into_iter()
        .filter(|record| {
            object_type
                .as_ref()
                .is_none_or(|value| record.object_type == *value)
                && object_id
                    .as_ref()
                    .is_none_or(|value| record.object_id == *value)
        })
        .collect::<Vec<_>>();

    records.truncate(limit.min(100));
    Ok(records)
}

pub(crate) fn get_snapshot_at(
    path: &Path,
    snapshot_id: &str,
) -> Result<SnapshotRecord, StoreError> {
    let snapshot_id = snapshot_id.trim();
    if snapshot_id.is_empty() {
        return Err(StoreError::InvalidInput(
            "snapshot id cannot be empty".to_string(),
        ));
    }

    read_snapshot_records(path)?
        .into_iter()
        .find(|record| record.id == snapshot_id)
        .ok_or_else(|| StoreError::NotFound(snapshot_id.to_string()))
}

fn read_snapshot_records(path: &Path) -> Result<Vec<SnapshotRecord>, StoreError> {
    read_json_records(path)
}

fn normalize_object_type(value: &str) -> Result<String, StoreError> {
    let normalized = value.trim().to_ascii_lowercase();
    if SUPPORTED_OBJECT_TYPES.contains(&normalized.as_str()) {
        return Ok(normalized);
    }

    Err(StoreError::InvalidInput(format!(
        "unsupported snapshot object type: {value}"
    )))
}

fn require_value(value: String, label: &str) -> Result<String, StoreError> {
    let value = value.trim().to_string();
    if value.is_empty() {
        return Err(StoreError::InvalidInput(format!("{label} cannot be empty")));
    }
    Ok(value)
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;

    use serde_json::json;

    use super::*;

    fn temp_snapshot_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("synapse-snapshot-{name}-{}.json", now_millis()))
    }

    #[test]
    fn creates_incrementing_versions_for_each_object() {
        let path = temp_snapshot_path("versions");

        let first = create_snapshot_at(
            &path,
            "zhishu-item".to_string(),
            "memory-1".to_string(),
            "before-review".to_string(),
            json!({ "state": "candidate" }),
        )
        .unwrap();
        let second = create_snapshot_at(
            &path,
            "zhishu-item".to_string(),
            "memory-1".to_string(),
            "before-review".to_string(),
            json!({ "state": "accepted" }),
        )
        .unwrap();
        let other = create_snapshot_at(
            &path,
            "task-direction".to_string(),
            "direction-1".to_string(),
            "manual-baseline".to_string(),
            json!({ "active": true }),
        )
        .unwrap();

        assert_eq!(first.version, 1);
        assert_eq!(second.version, 2);
        assert_eq!(other.version, 1);

        let _ = fs::remove_file(path);
    }

    #[test]
    fn lists_newest_matching_snapshots_first() {
        let path = temp_snapshot_path("list");

        create_snapshot_at(
            &path,
            "zhishu-item".to_string(),
            "memory-1".to_string(),
            "first".to_string(),
            json!({ "state": 1 }),
        )
        .unwrap();
        create_snapshot_at(
            &path,
            "zhishu-item".to_string(),
            "memory-1".to_string(),
            "second".to_string(),
            json!({ "state": 2 }),
        )
        .unwrap();
        create_snapshot_at(
            &path,
            "zhishu-item".to_string(),
            "memory-2".to_string(),
            "other".to_string(),
            json!({ "state": 3 }),
        )
        .unwrap();

        let records = list_snapshots_at(&path, Some("zhishu-item"), Some("memory-1"), 10).unwrap();

        assert_eq!(records.len(), 2);
        assert_eq!(records[0].version, 2);
        assert_eq!(records[1].version, 1);

        let _ = fs::remove_file(path);
    }

    #[test]
    fn rejects_unknown_snapshot_object_types() {
        let path = temp_snapshot_path("unknown-type");

        let error = create_snapshot_at(
            &path,
            "unknown".to_string(),
            "object-1".to_string(),
            "test".to_string(),
            json!({}),
        )
        .unwrap_err();

        assert!(error
            .to_string()
            .contains("unsupported snapshot object type"));
        assert!(!path.exists());
    }
}
