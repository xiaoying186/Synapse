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
}
