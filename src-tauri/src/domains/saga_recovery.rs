use serde::{Deserialize, Serialize};

use crate::store::{self, NewAuditEvent, SagaTransaction};

const RECOVERY_SAGA_LIMIT: usize = 50;

#[derive(Debug, Clone, Serialize)]
pub struct SagaRecoveryItem {
    pub saga: SagaTransaction,
    pub recovery_state: String,
    pub recommended_action: String,
    pub detail: String,
    pub gates: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SagaRecoveryPreview {
    pub generated_at_ms: u128,
    pub state: String,
    pub active_count: usize,
    pub items: Vec<SagaRecoveryItem>,
    pub gates: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SagaRecoveryReviewRequest {
    pub saga_id: String,
    pub decision: String,
    #[serde(default)]
    pub note: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SagaRecoveryReviewReceipt {
    pub saga: SagaTransaction,
    pub decision: String,
    pub audit_event: store::AuditEvent,
    pub state_changed: bool,
    pub gates: Vec<String>,
}

pub fn preview() -> Result<SagaRecoveryPreview, store::StoreError> {
    let sagas = store::list_sagas(RECOVERY_SAGA_LIMIT)?;
    Ok(preview_from_sagas(sagas))
}

pub fn record_review(
    request: SagaRecoveryReviewRequest,
) -> Result<SagaRecoveryReviewReceipt, store::StoreError> {
    let saga_id = required(request.saga_id, "saga id")?;
    let decision = normalize_decision(&request.decision)?;
    let note = request.note.trim().to_string();
    if decision == "recovered-externally" && note.is_empty() {
        return Err(store::StoreError::InvalidInput(
            "external recovery review needs an operator note".to_string(),
        ));
    }
    let original_saga = store::get_saga(saga_id.clone())?;
    if decision == "recovered-externally" && original_saga.state != "failed" {
        return Err(store::StoreError::InvalidInput(
            "only failed sagas can be marked recovered externally".to_string(),
        ));
    }
    let (saga, state_changed) = if decision == "recovered-externally" {
        (
            store::transition_saga(saga_id.clone(), "resolved".to_string())?,
            true,
        )
    } else {
        (original_saga, false)
    };
    let audit_event = store::append_audit_event(NewAuditEvent {
        actor: "local-user".to_string(),
        action: "review-saga-recovery".to_string(),
        target_type: "saga-transaction".to_string(),
        target_id: saga_id,
        risk_level: "manual-recovery-review".to_string(),
        decision: decision.clone(),
        input: serde_json::json!({
            "note": note,
            "saga_state": saga.state,
            "saga_kind": saga.kind,
        }),
        result_summary: serde_json::json!({
            "state_changed": state_changed,
            "saga_state": saga.state,
            "target_id": saga.target_id,
        }),
        error: None,
    })?;

    Ok(SagaRecoveryReviewReceipt {
        saga,
        decision,
        audit_event,
        state_changed,
        gates: recovery_review_gates(state_changed),
    })
}

fn preview_from_sagas(sagas: Vec<SagaTransaction>) -> SagaRecoveryPreview {
    let items = sagas
        .into_iter()
        .filter(|saga| is_recovery_visible(&saga.state))
        .map(recovery_item)
        .collect::<Vec<_>>();

    SagaRecoveryPreview {
        generated_at_ms: store::now_millis(),
        state: if items.is_empty() {
            "clean".to_string()
        } else {
            "manual-review-required".to_string()
        },
        active_count: items.len(),
        items,
        gates: vec![
            "read-only-recovery-preview".to_string(),
            "no-automatic-compensation".to_string(),
            "inspect-audit-before-retry".to_string(),
            "protect-current-state-before-manual-recovery".to_string(),
        ],
    }
}

fn recovery_item(saga: SagaTransaction) -> SagaRecoveryItem {
    let (recovery_state, recommended_action, detail) = match saga.state.as_str() {
        "pending" => (
            "incomplete".to_string(),
            "inspect-audit-and-target-state".to_string(),
            "Saga is still pending; verify whether the protected write completed before retrying.",
        ),
        "compensating" => (
            "compensation-in-progress".to_string(),
            "inspect-target-and-finish-compensation".to_string(),
            "Saga entered compensation; inspect the target and audit trail before marking any outcome.",
        ),
        "failed" => (
            "failed".to_string(),
            "manual-recovery-only".to_string(),
            "Saga failed; do not retry automatically. Review snapshots, audit trail, and target state.",
        ),
        _ => (
            "closed".to_string(),
            "no-action".to_string(),
            "Saga is closed and does not require recovery.",
        ),
    };

    SagaRecoveryItem {
        saga,
        recovery_state,
        recommended_action,
        detail: detail.to_string(),
        gates: vec![
            "no-state-change-from-preview".to_string(),
            "manual-operator-review-required".to_string(),
        ],
    }
}

fn is_recovery_visible(state: &str) -> bool {
    matches!(state, "pending" | "compensating" | "failed")
}

fn required(value: String, label: &str) -> Result<String, store::StoreError> {
    let value = value.trim().to_string();
    if value.is_empty() {
        return Err(store::StoreError::InvalidInput(format!(
            "{label} cannot be empty"
        )));
    }
    Ok(value)
}

fn normalize_decision(value: &str) -> Result<String, store::StoreError> {
    let value = value.trim().to_ascii_lowercase();
    if matches!(
        value.as_str(),
        "reviewed" | "deferred" | "recovered-externally"
    ) {
        Ok(value)
    } else {
        Err(store::StoreError::InvalidInput(
            "saga recovery decision must be reviewed, deferred, or recovered-externally"
                .to_string(),
        ))
    }
}

fn recovery_review_gates(state_changed: bool) -> Vec<String> {
    if state_changed {
        vec![
            "operator-confirmed-external-recovery".to_string(),
            "saga-state-changed-to-resolved".to_string(),
            "manual-recovery-remains-operator-owned".to_string(),
        ]
    } else {
        vec![
            "audit-only-review-receipt".to_string(),
            "no-saga-state-change".to_string(),
            "manual-recovery-remains-operator-owned".to_string(),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn saga(id: &str, state: &str) -> SagaTransaction {
        SagaTransaction {
            id: id.to_string(),
            kind: "review-memory-item".to_string(),
            target_id: "memory-1".to_string(),
            state: state.to_string(),
            metadata: serde_json::json!({ "source": "test" }),
            created_at_ms: 1,
            updated_at_ms: 2,
        }
    }

    #[test]
    fn shows_only_active_or_failed_sagas() {
        let preview = preview_from_sagas(vec![
            saga("pending", "pending"),
            saga("committed", "committed"),
            saga("failed", "failed"),
        ]);

        assert_eq!(preview.state, "manual-review-required");
        assert_eq!(preview.active_count, 2);
        assert!(preview.items.iter().any(|item| item.saga.id == "pending"));
        assert!(!preview.items.iter().any(|item| item.saga.id == "committed"));
    }

    #[test]
    fn failed_saga_requires_manual_recovery_only() {
        let item = recovery_item(saga("failed", "failed"));

        assert_eq!(item.recovery_state, "failed");
        assert_eq!(item.recommended_action, "manual-recovery-only");
        assert!(item
            .gates
            .contains(&"no-state-change-from-preview".to_string()));
    }

    #[test]
    fn accepts_only_known_manual_recovery_decisions() {
        assert_eq!(normalize_decision(" Reviewed ").unwrap(), "reviewed");
        assert_eq!(
            normalize_decision("recovered-externally").unwrap(),
            "recovered-externally"
        );
        assert!(normalize_decision("auto-fix").is_err());
    }

    #[test]
    fn recovery_review_gates_show_state_change() {
        let gates = recovery_review_gates(true);

        assert!(gates.contains(&"saga-state-changed-to-resolved".to_string()));
    }
}
