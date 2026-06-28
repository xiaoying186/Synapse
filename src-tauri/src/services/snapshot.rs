use crate::store;

#[derive(Debug, Clone, serde::Serialize)]
pub struct ProtectedSnapshotRollbackReceipt {
    pub source_snapshot: store::SnapshotRecord,
    pub protection_snapshot: store::SnapshotRecord,
    pub object_type: String,
    pub object_id: String,
    pub restored_state: String,
    pub audit_event: store::AuditEvent,
}

pub fn create(
    object_type: String,
    object_id: String,
    reason: String,
    payload: serde_json::Value,
) -> Result<store::SnapshotRecord, String> {
    store::create_snapshot(object_type, object_id, reason, payload)
        .map_err(|error| format!("Snapshot could not be created: {error}"))
}

pub fn list(
    object_type: Option<String>,
    object_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<store::SnapshotRecord>, String> {
    store::list_snapshots(object_type, object_id, limit.unwrap_or(25))
        .map_err(|error| format!("Snapshots are unavailable: {error}"))
}

pub fn rollback_protected(snapshot_id: String) -> Result<ProtectedSnapshotRollbackReceipt, String> {
    let snapshot_id = snapshot_id.trim().to_string();
    if snapshot_id.is_empty() {
        return Err("Snapshot id cannot be empty.".to_string());
    }
    let source_snapshot = store::get_snapshot(snapshot_id)
        .map_err(|error| format!("Snapshot is unavailable: {error}"))?;
    let saga = begin_service_saga(
        "rollback-protected-snapshot",
        &source_snapshot.object_id,
        serde_json::json!({
            "source_snapshot_id": source_snapshot.id,
            "object_type": source_snapshot.object_type,
        }),
    )?;
    let result = match source_snapshot.object_type.as_str() {
        "task-direction" => rollback_task_direction(source_snapshot),
        "arsenal-allow-state" => rollback_arsenal_allow_state(source_snapshot),
        "arsenal-custom-tool" => rollback_custom_tool(source_snapshot),
        "zhishu-item" => Err(
            "Zhishu snapshots use the dedicated Zhishu restore action to preserve memory safeguards."
                .to_string(),
        ),
        _ => Err(format!(
            "Snapshot object type is not restorable here: {}",
            source_snapshot.object_type
        )),
    };
    finish_service_saga(&saga.id, result)
}

fn begin_service_saga(
    kind: &str,
    target_id: &str,
    metadata: serde_json::Value,
) -> Result<store::SagaTransaction, String> {
    store::begin_saga(kind.to_string(), target_id.to_string(), metadata)
        .map_err(|error| format!("Saga could not be started: {error}"))
}

fn finish_service_saga<T>(saga_id: &str, result: Result<T, String>) -> Result<T, String> {
    match result {
        Ok(value) => {
            store::transition_saga(saga_id.to_string(), "committed".to_string())
                .map_err(|error| format!("Saga could not be committed: {error}"))?;
            Ok(value)
        }
        Err(error) => {
            let _ = store::transition_saga(saga_id.to_string(), "failed".to_string());
            Err(error)
        }
    }
}

fn rollback_custom_tool(
    source_snapshot: store::SnapshotRecord,
) -> Result<ProtectedSnapshotRollbackReceipt, String> {
    let operation = source_snapshot
        .payload
        .get("operation")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| "Custom tool snapshot payload is missing operation.".to_string())?;
    let protection_payload = match operation {
        "create" => {
            crate::arsenal::custom_tool_remove_snapshot_payload(&source_snapshot.object_id)?
        }
        "remove" => crate::arsenal::custom_tool_create_snapshot_payload_from_remove_snapshot(
            &source_snapshot.payload,
        )?,
        _ => {
            return Err(format!(
                "Unsupported custom tool snapshot operation: {operation}"
            ))
        }
    };
    let protection_snapshot = store::create_snapshot(
        "arsenal-custom-tool".to_string(),
        source_snapshot.object_id.clone(),
        "before-custom-tool-rollback".to_string(),
        protection_payload,
    )
    .map_err(|error| format!("Custom tool protection snapshot failed: {error}"))?;
    let restored = crate::arsenal::restore_custom_tool_snapshot(&source_snapshot.payload)?;
    let audit_event = super::audit_event::record_change(
        "rollback-custom-arsenal-tool",
        "arsenal-custom-tool",
        &restored.id,
        "high",
        if operation == "create" {
            "removed"
        } else {
            "registered"
        },
        serde_json::json!({ "source_snapshot_id": source_snapshot.id, "protection_snapshot_id": protection_snapshot.id }),
        serde_json::json!({ "allow_state": restored.allow_state }),
    )?;
    Ok(ProtectedSnapshotRollbackReceipt {
        object_type: "arsenal-custom-tool".to_string(),
        object_id: restored.id,
        restored_state: if operation == "create" {
            "removed".to_string()
        } else {
            "registered".to_string()
        },
        source_snapshot,
        protection_snapshot,
        audit_event,
    })
}

fn rollback_task_direction(
    source_snapshot: store::SnapshotRecord,
) -> Result<ProtectedSnapshotRollbackReceipt, String> {
    let restored_record = task_direction_from_snapshot_payload(&source_snapshot.payload)?;
    let current = store::task_directions(50)
        .map_err(|error| format!("Task directions are unavailable: {error}"))?
        .into_iter()
        .find(|direction| direction.id == source_snapshot.object_id)
        .ok_or_else(|| {
            format!(
                "Task direction was not found: {}",
                source_snapshot.object_id
            )
        })?;
    let protection_snapshot = store::create_snapshot(
        "task-direction".to_string(),
        current.id.clone(),
        "before-task-direction-rollback".to_string(),
        serde_json::to_value(&current).map_err(|error| error.to_string())?,
    )
    .map_err(|error| format!("Task direction protection snapshot failed: {error}"))?;
    let restored = store::restore_task_direction(restored_record)
        .map_err(|error| format!("Task direction rollback failed: {error}"))?;
    let audit_event = super::audit_event::record_change(
        "rollback-task-direction",
        "task-direction",
        &restored.id,
        "high",
        "restored",
        serde_json::json!({
            "source_snapshot_id": source_snapshot.id,
            "protection_snapshot_id": protection_snapshot.id,
        }),
        serde_json::json!({
            "active": restored.active,
            "updated_at_ms": restored.updated_at_ms,
        }),
    )?;

    Ok(ProtectedSnapshotRollbackReceipt {
        source_snapshot,
        protection_snapshot,
        object_type: "task-direction".to_string(),
        object_id: restored.id,
        restored_state: if restored.active {
            "active".to_string()
        } else {
            "inactive".to_string()
        },
        audit_event,
    })
}

fn rollback_arsenal_allow_state(
    source_snapshot: store::SnapshotRecord,
) -> Result<ProtectedSnapshotRollbackReceipt, String> {
    let restore_state = arsenal_allow_state_from_snapshot_payload(&source_snapshot.payload)?;
    let current_tool = crate::arsenal::default_preview()
        .tools
        .into_iter()
        .find(|tool| tool.id == source_snapshot.object_id)
        .ok_or_else(|| format!("Arsenal tool was not found: {}", source_snapshot.object_id))?;
    let protection_snapshot = store::create_snapshot(
        "arsenal-allow-state".to_string(),
        current_tool.id.clone(),
        "before-arsenal-allow-state-rollback".to_string(),
        serde_json::json!({
            "tool": current_tool,
        }),
    )
    .map_err(|error| format!("Arsenal protection snapshot failed: {error}"))?;
    crate::arsenal::set_tool_allow_state(source_snapshot.object_id.clone(), restore_state.clone())
        .map_err(|error| format!("Arsenal allow-state rollback failed: {error}"))?;
    let audit_event = super::audit_event::record_change(
        "rollback-arsenal-allow-state",
        "arsenal-allow-state",
        &source_snapshot.object_id,
        "high",
        &restore_state,
        serde_json::json!({
            "source_snapshot_id": source_snapshot.id,
            "protection_snapshot_id": protection_snapshot.id,
        }),
        serde_json::json!({
            "allow_state": restore_state,
        }),
    )?;

    Ok(ProtectedSnapshotRollbackReceipt {
        object_type: "arsenal-allow-state".to_string(),
        object_id: source_snapshot.object_id.clone(),
        restored_state: restore_state,
        source_snapshot,
        protection_snapshot,
        audit_event,
    })
}

fn task_direction_from_snapshot_payload(
    payload: &serde_json::Value,
) -> Result<store::TaskDirection, String> {
    serde_json::from_value::<store::TaskDirection>(payload.clone())
        .map_err(|error| format!("Task direction snapshot payload is invalid: {error}"))
}

fn arsenal_allow_state_from_snapshot_payload(
    payload: &serde_json::Value,
) -> Result<String, String> {
    let allow_state = payload
        .get("tool")
        .and_then(|tool| tool.get("allow_state"))
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| "Arsenal snapshot payload is missing tool.allow_state.".to_string())?
        .trim()
        .to_ascii_lowercase();
    if !matches!(allow_state.as_str(), "allowed" | "blocked") {
        return Err("Arsenal snapshot tool.allow_state must be allowed or blocked.".to_string());
    }
    Ok(allow_state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_protected_rollback_snapshot_id() {
        let error = rollback_protected("  ".to_string()).unwrap_err();

        assert_eq!(error, "Snapshot id cannot be empty.");
    }

    #[test]
    fn task_direction_snapshot_payload_preserves_active_state() {
        let direction = task_direction_from_snapshot_payload(&serde_json::json!({
            "id": "direction-1",
            "created_at_ms": 1,
            "updated_at_ms": 2,
            "title": "Research",
            "description": "Review evidence",
            "priority": 4,
            "active": false,
            "keywords": ["evidence"]
        }))
        .unwrap();

        assert_eq!(direction.id, "direction-1");
        assert!(!direction.active);
        assert_eq!(direction.schedule_frequency, "manual");
    }

    #[test]
    fn task_direction_snapshot_payload_rejects_incomplete_record() {
        let error = task_direction_from_snapshot_payload(&serde_json::json!({
            "id": "direction-1",
            "active": true
        }))
        .unwrap_err();

        assert!(error.contains("Task direction snapshot payload is invalid"));
    }

    #[test]
    fn arsenal_snapshot_payload_normalizes_valid_allow_state() {
        let state = arsenal_allow_state_from_snapshot_payload(&serde_json::json!({
            "tool": { "allow_state": " BLOCKED " }
        }))
        .unwrap();

        assert_eq!(state, "blocked");
    }

    #[test]
    fn arsenal_snapshot_payload_rejects_unknown_allow_state() {
        let error = arsenal_allow_state_from_snapshot_payload(&serde_json::json!({
            "tool": { "allow_state": "maybe" }
        }))
        .unwrap_err();

        assert_eq!(
            error,
            "Arsenal snapshot tool.allow_state must be allowed or blocked."
        );
    }
}
