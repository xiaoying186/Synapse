use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::store::{now_millis, paths, read_json_records, write_json_records, StoreError};
use crate::store::{append_audit_event, begin_saga, create_snapshot, transition_saga, AuditEvent, NewAuditEvent, SagaTransaction, SnapshotRecord};

const MAX_ATTEMPTS: usize = 500;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationDeliveryAttempt {
    pub id: String,
    pub idempotency_key: String,
    pub run_id: String,
    pub channel: String,
    pub state: String,
    pub artifact_id: Option<String>,
    pub audit_event_id: Option<String>,
    pub detail: String,
    pub created_at_ms: u128,
    pub updated_at_ms: u128,
}

#[derive(Debug, Clone, Serialize)]
pub struct NotificationDeliveryReconciliationReceipt {
    pub attempt: NotificationDeliveryAttempt,
    pub decision: String,
    pub retry_allowed: bool,
    pub snapshot: SnapshotRecord,
    pub audit_event: AuditEvent,
    pub saga: SagaTransaction,
}

pub fn begin_notification_delivery_attempt(
    idempotency_key: String,
    run_id: String,
    channel: String,
) -> Result<NotificationDeliveryAttempt, StoreError> {
    begin_at(&paths::notification_delivery_attempt_path(), idempotency_key, run_id, channel)
}

pub fn transition_notification_delivery_attempt(
    id: String,
    state: String,
    artifact_id: Option<String>,
    audit_event_id: Option<String>,
    detail: String,
) -> Result<NotificationDeliveryAttempt, StoreError> {
    transition_at(
        &paths::notification_delivery_attempt_path(),
        id,
        state,
        artifact_id,
        audit_event_id,
        detail,
    )
}

pub fn list_notification_delivery_attempts(limit: usize) -> Result<Vec<NotificationDeliveryAttempt>, StoreError> {
    let mut records = read_json_records(&paths::notification_delivery_attempt_path())?;
    records.truncate(limit.clamp(1, MAX_ATTEMPTS));
    Ok(records)
}

pub fn reconcile_notification_delivery_attempt(id: String, decision: String) -> Result<NotificationDeliveryReconciliationReceipt, StoreError> {
    let decision = match decision.trim().to_ascii_lowercase().as_str() {
        "confirmed-delivered" => "confirmed-delivered",
        "confirmed-not-delivered" => "confirmed-not-delivered",
        other => return Err(StoreError::InvalidInput(format!("unsupported notification reconciliation decision: {other}"))),
    };
    let path = paths::notification_delivery_attempt_path();
    let previous_records = read_json_records::<NotificationDeliveryAttempt>(&path)?;
    let before = previous_records.iter().find(|item| item.id == id).cloned().ok_or_else(|| StoreError::NotFound(id.clone()))?;
    if !matches!(before.state.as_str(), "prepared-before-network" | "prepared-audited" | "outcome-uncertain") {
        return Err(StoreError::InvalidInput(format!("notification attempt {} in state {} does not require reconciliation", before.id, before.state)));
    }
    let saga = begin_saga("notification-delivery-reconciliation".to_string(), id.clone(), serde_json::json!({ "decision": decision }))?;
    let snapshot = create_snapshot(
        "notification-delivery-attempt".to_string(),
        id.clone(),
        "before-notification-delivery-reconciliation".to_string(),
        serde_json::json!({ "attempt": before, "saga_id": saga.id }),
    )?;
    let target_state = if decision == "confirmed-delivered" { "reconciled-delivered" } else { "reconciled-not-delivered" };
    let attempt = match transition_at(&path, id.clone(), target_state.to_string(), None, None, format!("Human reconciliation decision: {decision}")) {
        Ok(attempt) => attempt,
        Err(error) => return fail_reconciliation_saga(&saga, error),
    };
    let audit_event = match append_audit_event(NewAuditEvent {
        actor: "local-user".to_string(),
        action: "reconcile-notification-delivery".to_string(),
        target_type: "notification-delivery-attempt".to_string(),
        target_id: id.clone(),
        risk_level: "critical".to_string(),
        decision: decision.to_string(),
        input: serde_json::json!({ "snapshot_id": snapshot.id, "saga_id": saga.id }),
        result_summary: serde_json::json!({ "retry_allowed": decision == "confirmed-not-delivered", "state": target_state }),
        error: None,
    }) {
        Ok(event) => event,
        Err(error) => return finish_reconciliation_compensation(&saga, &path, &previous_records, error),
    };
    let saga = match transition_saga(saga.id.clone(), "committed".to_string()) {
        Ok(saga) => saga,
        Err(error) => return finish_reconciliation_compensation(&saga, &path, &previous_records, error),
    };
    Ok(NotificationDeliveryReconciliationReceipt {
        attempt,
        decision: decision.to_string(),
        retry_allowed: decision == "confirmed-not-delivered",
        snapshot,
        audit_event,
        saga,
    })
}

fn begin_at(path: &Path, idempotency_key: String, run_id: String, channel: String) -> Result<NotificationDeliveryAttempt, StoreError> {
    let idempotency_key = required(idempotency_key, "notification idempotency key")?;
    let mut records = read_json_records::<NotificationDeliveryAttempt>(path)?;
    if let Some(existing) = records.iter().find(|item| item.idempotency_key == idempotency_key && item.state != "reconciled-not-delivered") {
        return Err(StoreError::InvalidInput(format!(
            "notification delivery attempt already exists in state {}; reconcile attempt {} before retrying",
            existing.state, existing.id
        )));
    }
    let now = now_millis();
    let attempt = NotificationDeliveryAttempt {
        id: format!("notification-attempt-{now}-{}", records.len() + 1),
        idempotency_key,
        run_id: required(run_id, "task run id")?,
        channel: required(channel, "notification channel")?,
        state: "prepared-before-network".to_string(),
        artifact_id: None,
        audit_event_id: None,
        detail: "No network request has started.".to_string(),
        created_at_ms: now,
        updated_at_ms: now,
    };
    records.insert(0, attempt.clone());
    records.truncate(MAX_ATTEMPTS);
    write_json_records(path, &records)?;
    Ok(attempt)
}

fn transition_at(path: &Path, id: String, state: String, artifact_id: Option<String>, audit_event_id: Option<String>, detail: String) -> Result<NotificationDeliveryAttempt, StoreError> {
    if !matches!(state.as_str(), "prepared-audited" | "provider-accepted" | "outcome-uncertain" | "receipt-recorded" | "audited" | "reconciled-delivered" | "reconciled-not-delivered") {
        return Err(StoreError::InvalidInput(format!("unsupported notification delivery attempt state: {state}")));
    }
    let mut records = read_json_records::<NotificationDeliveryAttempt>(path)?;
    let item = records.iter_mut().find(|item| item.id == id).ok_or_else(|| StoreError::NotFound(id.clone()))?;
    let valid_transition = matches!(
        (item.state.as_str(), state.as_str()),
        ("prepared-before-network", "prepared-audited")
            | ("prepared-audited", "provider-accepted")
            | ("prepared-audited", "outcome-uncertain")
            | ("provider-accepted", "receipt-recorded")
            | ("receipt-recorded", "audited")
            | ("prepared-before-network", "reconciled-delivered")
            | ("prepared-before-network", "reconciled-not-delivered")
            | ("prepared-audited", "reconciled-delivered")
            | ("prepared-audited", "reconciled-not-delivered")
            | ("outcome-uncertain", "reconciled-delivered")
            | ("outcome-uncertain", "reconciled-not-delivered")
    );
    if !valid_transition {
        return Err(StoreError::InvalidInput(format!(
            "invalid notification delivery attempt transition: {} -> {state}",
            item.state
        )));
    }
    item.state = state;
    item.artifact_id = artifact_id.or_else(|| item.artifact_id.clone());
    item.audit_event_id = audit_event_id.or_else(|| item.audit_event_id.clone());
    item.detail = required(detail, "notification attempt detail")?;
    item.updated_at_ms = now_millis();
    let updated = item.clone();
    write_json_records(path, &records)?;
    Ok(updated)
}

fn fail_reconciliation_saga<T>(saga: &SagaTransaction, error: StoreError) -> Result<T, StoreError> {
    let _ = transition_saga(saga.id.clone(), "failed".to_string());
    Err(error)
}

fn finish_reconciliation_compensation<T>(saga: &SagaTransaction, path: &Path, previous: &[NotificationDeliveryAttempt], error: StoreError) -> Result<T, StoreError> {
    let _ = transition_saga(saga.id.clone(), "compensating".to_string());
    match write_json_records(path, previous) {
        Ok(()) => { let _ = transition_saga(saga.id.clone(), "compensated".to_string()); Err(error) }
        Err(compensation_error) => {
            let _ = transition_saga(saga.id.clone(), "failed".to_string());
            Err(StoreError::InvalidInput(format!("notification reconciliation failed: {error}; compensation failed: {compensation_error}")))
        }
    }
}

fn required(value: String, label: &str) -> Result<String, StoreError> {
    let value = value.trim().to_string();
    if value.is_empty() { return Err(StoreError::InvalidInput(format!("{label} cannot be empty"))); }
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn duplicate_idempotency_key_is_blocked_even_after_provider_acceptance() {
        let path = std::env::temp_dir().join(format!("synapse-notification-attempt-{}.json", now_millis()));
        let first = begin_at(&path, "idem-1".into(), "run-1".into(), "feishu".into()).unwrap();
        transition_at(&path, first.id.clone(), "prepared-audited".into(), None, Some("audit-prepare".into()), "intent audited".into()).unwrap();
        transition_at(&path, first.id, "provider-accepted".into(), None, None, "HTTP 200".into()).unwrap();
        let duplicate = begin_at(&path, "idem-1".into(), "run-1".into(), "feishu".into());
        assert!(duplicate.unwrap_err().to_string().contains("reconcile"));
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn attempt_state_machine_rejects_skipping_pre_network_audit() {
        let path = std::env::temp_dir().join(format!("synapse-notification-attempt-order-{}.json", now_millis()));
        let first = begin_at(&path, "idem-order".into(), "run-1".into(), "wechat".into()).unwrap();
        let result = transition_at(&path, first.id, "provider-accepted".into(), None, None, "HTTP 200".into());
        assert!(result.unwrap_err().to_string().contains("invalid notification delivery attempt transition"));
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn confirmed_not_delivered_releases_idempotency_key_for_retry() {
        let path = std::env::temp_dir().join(format!("synapse-notification-attempt-retry-{}.json", now_millis()));
        let first = begin_at(&path, "idem-retry".into(), "run-1".into(), "feishu".into()).unwrap();
        transition_at(&path, first.id.clone(), "prepared-audited".into(), None, None, "audited".into()).unwrap();
        transition_at(&path, first.id.clone(), "outcome-uncertain".into(), None, None, "timeout".into()).unwrap();
        transition_at(&path, first.id, "reconciled-not-delivered".into(), None, None, "human confirmed".into()).unwrap();
        assert!(begin_at(&path, "idem-retry".into(), "run-1".into(), "feishu".into()).is_ok());
        let _ = std::fs::remove_file(path);
    }
}
