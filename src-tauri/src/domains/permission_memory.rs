use serde::Serialize;

use crate::store;

#[derive(Debug, Clone, Serialize)]
pub struct PermissionMemoryCandidate {
    pub id: String,
    pub scope: String,
    pub tool_scope: String,
    pub permission_level: String,
    pub action_pattern: String,
    pub reuse_conditions: Vec<String>,
    pub expires_after: String,
    pub revoked: bool,
    pub audit_ref: String,
    pub reuse_state: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PermissionMemoryPreview {
    pub generated_at_ms: u128,
    pub state: String,
    pub candidates: Vec<PermissionMemoryCandidate>,
    pub gates: Vec<String>,
    pub non_reusable_risks: Vec<String>,
    pub auto_grants_permissions: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct PermissionReusePreflight {
    pub generated_at_ms: u128,
    pub state: String,
    pub candidate_id: String,
    pub candidate_state: String,
    pub permission_level: String,
    pub scope: String,
    pub tool_scope: String,
    pub requested_action: String,
    pub auto_grant_started: bool,
    pub permission_reused: bool,
    pub durable_policy_write_started: bool,
    pub requires_same_scope: bool,
    pub requires_fresh_audit_reference: bool,
    pub requires_explicit_review: bool,
    pub requires_expiry_check: bool,
    pub high_risk_blocked: bool,
    pub gates: Vec<String>,
    pub blockers: Vec<String>,
    pub denied_actions: Vec<String>,
}

pub fn preview() -> PermissionMemoryPreview {
    PermissionMemoryPreview {
        generated_at_ms: store::now_millis(),
        state: "candidate-preview-only".to_string(),
        candidates: vec![
            PermissionMemoryCandidate {
                id: "pm-local-readonly-code-context".to_string(),
                scope: "current-project".to_string(),
                tool_scope: "codegraph-structural-context".to_string(),
                permission_level: "read-only-observation".to_string(),
                action_pattern: "reuse structural code context for planning prompts".to_string(),
                reuse_conditions: vec![
                    "same-project-root".to_string(),
                    "same-tool-scope".to_string(),
                    "no-file-content-ingest".to_string(),
                    "no-command-execution".to_string(),
                    "fresh-audit-reference-required".to_string(),
                ],
                expires_after: "session-or-24h-review".to_string(),
                revoked: false,
                audit_ref: "pending-user-review".to_string(),
                reuse_state: "review-required-before-reuse".to_string(),
            },
            PermissionMemoryCandidate {
                id: "pm-task-center-preview-push".to_string(),
                scope: "current-device".to_string(),
                tool_scope: "notification-preview-metadata".to_string(),
                permission_level: "preview-only".to_string(),
                action_pattern: "reuse push preference metadata for schedule previews".to_string(),
                reuse_conditions: vec![
                    "external-delivery-disabled".to_string(),
                    "no-webhook-send".to_string(),
                    "no-account-action".to_string(),
                    "fresh-audit-reference-required".to_string(),
                ],
                expires_after: "until-config-or-channel-change".to_string(),
                revoked: false,
                audit_ref: "pending-user-review".to_string(),
                reuse_state: "metadata-only-not-delivery-permission".to_string(),
            },
        ],
        gates: vec![
            "not-a-permanent-whitelist".to_string(),
            "scope-tool-level-pattern-required".to_string(),
            "expiry-and-revocation-required".to_string(),
            "audit-reference-required".to_string(),
            "high-risk-never-auto-reuse".to_string(),
            "explicit-review-before-action".to_string(),
            "no-policy-engine-auto-grant".to_string(),
        ],
        non_reusable_risks: vec![
            "cross-project".to_string(),
            "delete-move-cleanup".to_string(),
            "account-or-session-action".to_string(),
            "publish-or-submit".to_string(),
            "trade-or-financial-action".to_string(),
            "durable-zhishu-write".to_string(),
            "external-agent-execution".to_string(),
        ],
        auto_grants_permissions: false,
    }
}

pub fn preflight_reuse(candidate_id: String, requested_action: String) -> PermissionReusePreflight {
    let preview = preview();
    let requested_candidate_id = candidate_id.trim();
    let candidate = preview
        .candidates
        .iter()
        .find(|candidate| candidate.id == requested_candidate_id)
        .or_else(|| preview.candidates.first());
    let requested_action = requested_action.trim();
    let requested_action = if requested_action.is_empty() {
        "unspecified-permission-reuse".to_string()
    } else {
        requested_action.to_string()
    };
    let high_risk_blocked = preview
        .non_reusable_risks
        .iter()
        .any(|risk| requested_action.contains(risk));

    PermissionReusePreflight {
        generated_at_ms: store::now_millis(),
        state: "permission-reuse-review-required".to_string(),
        candidate_id: candidate
            .map(|candidate| candidate.id.clone())
            .unwrap_or_else(|| "permission-memory-candidate-missing".to_string()),
        candidate_state: candidate
            .map(|candidate| candidate.reuse_state.clone())
            .unwrap_or_else(|| "candidate-not-found".to_string()),
        permission_level: candidate
            .map(|candidate| candidate.permission_level.clone())
            .unwrap_or_else(|| "none".to_string()),
        scope: candidate
            .map(|candidate| candidate.scope.clone())
            .unwrap_or_else(|| "none".to_string()),
        tool_scope: candidate
            .map(|candidate| candidate.tool_scope.clone())
            .unwrap_or_else(|| "none".to_string()),
        requested_action,
        auto_grant_started: false,
        permission_reused: false,
        durable_policy_write_started: false,
        requires_same_scope: true,
        requires_fresh_audit_reference: true,
        requires_explicit_review: true,
        requires_expiry_check: true,
        high_risk_blocked,
        gates: vec![
            "same-scope-required-before-permission-reuse".to_string(),
            "same-tool-scope-required-before-permission-reuse".to_string(),
            "fresh-audit-reference-required".to_string(),
            "expiry-check-required-before-permission-reuse".to_string(),
            "explicit-review-before-action".to_string(),
            "high-risk-never-auto-reuse".to_string(),
            "no-policy-engine-auto-grant".to_string(),
        ],
        blockers: vec![
            "permission-reuse-not-user-approved".to_string(),
            "fresh-audit-reference-not-attached".to_string(),
            "expiry-check-not-confirmed".to_string(),
            "policy-engine-auto-grant-disabled".to_string(),
        ],
        denied_actions: vec![
            "cross-project".to_string(),
            "delete-move-cleanup".to_string(),
            "account-or-session-action".to_string(),
            "publish-or-submit".to_string(),
            "trade-or-financial-action".to_string(),
            "durable-zhishu-write".to_string(),
            "external-agent-execution".to_string(),
            "auto-grant-permission".to_string(),
        ],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preview_is_not_an_auto_grant_or_permanent_whitelist() {
        let preview = preview();

        assert_eq!(preview.state, "candidate-preview-only");
        assert!(!preview.auto_grants_permissions);
        assert!(preview
            .gates
            .contains(&"not-a-permanent-whitelist".to_string()));
        assert!(preview
            .gates
            .contains(&"no-policy-engine-auto-grant".to_string()));
    }

    #[test]
    fn candidates_include_required_reuse_fields() {
        let preview = preview();

        assert!(preview.candidates.iter().all(|candidate| {
            !candidate.scope.is_empty()
                && !candidate.tool_scope.is_empty()
                && !candidate.permission_level.is_empty()
                && !candidate.action_pattern.is_empty()
                && !candidate.reuse_conditions.is_empty()
                && !candidate.expires_after.is_empty()
                && !candidate.audit_ref.is_empty()
        }));
        assert!(preview
            .non_reusable_risks
            .contains(&"cross-project".to_string()));
        assert!(preview
            .non_reusable_risks
            .contains(&"trade-or-financial-action".to_string()));
    }

    #[test]
    fn permission_reuse_preflight_never_auto_grants_or_writes_policy() {
        let preflight = preflight_reuse(
            "pm-local-readonly-code-context".to_string(),
            "trade-or-financial-action".to_string(),
        );

        assert_eq!(preflight.state, "permission-reuse-review-required");
        assert_eq!(preflight.candidate_id, "pm-local-readonly-code-context");
        assert!(!preflight.auto_grant_started);
        assert!(!preflight.permission_reused);
        assert!(!preflight.durable_policy_write_started);
        assert!(preflight.requires_same_scope);
        assert!(preflight.requires_fresh_audit_reference);
        assert!(preflight.requires_explicit_review);
        assert!(preflight.requires_expiry_check);
        assert!(preflight.high_risk_blocked);
        assert!(preflight
            .gates
            .contains(&"no-policy-engine-auto-grant".to_string()));
        assert!(preflight
            .blockers
            .contains(&"permission-reuse-not-user-approved".to_string()));
        assert!(preflight
            .denied_actions
            .contains(&"auto-grant-permission".to_string()));
    }
}
