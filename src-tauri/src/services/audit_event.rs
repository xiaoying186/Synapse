use crate::store::{self, NewAuditEvent};

pub fn record_change(
    action: &str,
    target_type: &str,
    target_id: &str,
    risk_level: &str,
    decision: &str,
    input: serde_json::Value,
    result_summary: serde_json::Value,
) -> Result<store::AuditEvent, String> {
    store::append_audit_event(NewAuditEvent {
        actor: "local-user".to_string(),
        action: action.to_string(),
        target_type: target_type.to_string(),
        target_id: target_id.to_string(),
        risk_level: risk_level.to_string(),
        decision: decision.to_string(),
        input,
        result_summary,
        error: None,
    })
    .map_err(|error| format!("State changed, but its audit event could not be saved: {error}"))
}

pub fn list(
    target_type: Option<String>,
    target_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<store::AuditEvent>, String> {
    store::list_audit_events(target_type, target_id, limit.unwrap_or(50))
        .map_err(|error| format!("Audit events are unavailable: {error}"))
}
