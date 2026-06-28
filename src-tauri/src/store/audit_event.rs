use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::store::{now_millis, paths, read_json_records, write_json_records, StoreError};

const MAX_AUDIT_EVENTS: usize = 1_000;

#[derive(Debug, Clone)]
pub struct NewAuditEvent {
    pub actor: String,
    pub action: String,
    pub target_type: String,
    pub target_id: String,
    pub risk_level: String,
    pub decision: String,
    pub input: serde_json::Value,
    pub result_summary: serde_json::Value,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AuditEvent {
    pub id: String,
    pub actor: String,
    pub action: String,
    pub target_type: String,
    pub target_id: String,
    pub risk_level: String,
    pub decision: String,
    pub input_hash: String,
    pub result_summary: serde_json::Value,
    pub error: Option<String>,
    pub created_at_ms: u128,
}

pub fn append_audit_event(event: NewAuditEvent) -> Result<AuditEvent, StoreError> {
    append_audit_event_at(&paths::audit_event_path(), event)
}

pub fn list_audit_events(
    target_type: Option<String>,
    target_id: Option<String>,
    limit: usize,
) -> Result<Vec<AuditEvent>, StoreError> {
    list_audit_events_at(
        &paths::audit_event_path(),
        target_type.as_deref(),
        target_id.as_deref(),
        limit,
    )
}

pub(crate) fn append_audit_event_at(
    path: &Path,
    event: NewAuditEvent,
) -> Result<AuditEvent, StoreError> {
    let actor = require_value(event.actor, "audit actor")?;
    let action = require_value(event.action, "audit action")?;
    let target_type = require_value(event.target_type, "audit target type")?;
    let target_id = require_value(event.target_id, "audit target id")?;
    let risk_level = require_value(event.risk_level, "audit risk level")?;
    let decision = require_value(event.decision, "audit decision")?;
    let input_hash = hash_json(&event.input)?;
    let mut records = read_audit_events(path)?;
    let now = now_millis();
    let record = AuditEvent {
        id: format!("audit-{now}-{}", records.len() + 1),
        actor,
        action,
        target_type,
        target_id,
        risk_level,
        decision,
        input_hash,
        result_summary: event.result_summary,
        error: event.error,
        created_at_ms: now,
    };

    records.insert(0, record.clone());
    records.truncate(MAX_AUDIT_EVENTS);
    write_json_records(path, &records)?;
    Ok(record)
}

pub(crate) fn list_audit_events_at(
    path: &Path,
    target_type: Option<&str>,
    target_id: Option<&str>,
    limit: usize,
) -> Result<Vec<AuditEvent>, StoreError> {
    let target_type = normalize_optional_filter(target_type);
    let target_id = normalize_optional_filter(target_id);
    let mut records = read_audit_events(path)?
        .into_iter()
        .filter(|record| {
            target_type
                .as_ref()
                .is_none_or(|value| record.target_type == *value)
                && target_id
                    .as_ref()
                    .is_none_or(|value| record.target_id == *value)
        })
        .collect::<Vec<_>>();

    records.truncate(limit.min(200));
    Ok(records)
}

fn read_audit_events(path: &Path) -> Result<Vec<AuditEvent>, StoreError> {
    read_json_records(path)
}

fn hash_json(value: &serde_json::Value) -> Result<String, StoreError> {
    let bytes = serde_json::to_vec(value)?;
    let hash = bytes.iter().fold(0xcbf29ce484222325_u64, |hash, byte| {
        (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
    });
    Ok(format!("{hash:016x}"))
}

fn require_value(value: String, label: &str) -> Result<String, StoreError> {
    let value = value.trim().to_string();
    if value.is_empty() {
        return Err(StoreError::InvalidInput(format!("{label} cannot be empty")));
    }
    Ok(value)
}

fn normalize_optional_filter(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;

    use serde_json::json;

    use super::*;

    fn temp_audit_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("synapse-audit-{name}-{}.json", now_millis()))
    }

    fn event(target_id: &str, decision: &str) -> NewAuditEvent {
        NewAuditEvent {
            actor: "local-user".to_string(),
            action: "review-memory-item".to_string(),
            target_type: "zhishu-item".to_string(),
            target_id: target_id.to_string(),
            risk_level: "durable-zhishu-write".to_string(),
            decision: decision.to_string(),
            input: json!({ "decision": decision }),
            result_summary: json!({ "admission_state": decision }),
            error: None,
        }
    }

    #[test]
    fn appends_hashed_audit_event_without_raw_input() {
        let path = temp_audit_path("append");

        let record = append_audit_event_at(&path, event("memory-1", "accepted")).unwrap();
        let raw = fs::read_to_string(&path).unwrap();

        assert_eq!(record.target_id, "memory-1");
        assert_eq!(record.input_hash.len(), 16);
        assert!(!raw.contains(r#""input""#));

        let _ = fs::remove_file(path);
    }

    #[test]
    fn filters_audit_events_by_target() {
        let path = temp_audit_path("filter");
        append_audit_event_at(&path, event("memory-1", "accepted")).unwrap();
        append_audit_event_at(&path, event("memory-2", "rejected")).unwrap();

        let records =
            list_audit_events_at(&path, Some("zhishu-item"), Some("memory-1"), 10).unwrap();

        assert_eq!(records.len(), 1);
        assert_eq!(records[0].target_id, "memory-1");

        let _ = fs::remove_file(path);
    }
}
