//! Permission and guardrail preview.
//!
//! The policy layer does not execute or block real tools yet. It classifies the
//! requested action surface and tells the workbench which gates must exist
//! before future tool, browser, agent, script, or durable Zhishu writes can run.

use serde::Serialize;

use crate::kernel::Plan;

#[derive(Debug, Clone, Serialize)]
pub struct PolicyPreview {
    pub permission_level: String,
    pub decision: String,
    pub requires_review: bool,
    pub requires_explicit_approval: bool,
    pub action_tiers: Vec<String>,
    pub gates: Vec<PolicyGate>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PolicyGate {
    pub name: String,
    pub status: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PolicyEnforcement {
    pub decision: String,
    pub can_execute: bool,
    pub blocked_reason: Option<String>,
}

pub fn preview_for_plan(plan: &Plan) -> PolicyPreview {
    let action_tiers = action_tiers_for(&plan.intent, &plan.risk);
    let tool_or_external = action_tiers.iter().any(|tier| {
        matches!(
            tier.as_str(),
            "network-or-browser-action"
                | "computer-maintenance-action"
                | "push-delivery-action"
                | "agent-or-tool-action"
                | "script-or-local-app-action"
                | "durable-zhishu-write"
        )
    });

    match plan.risk.as_str() {
        "destructive" => PolicyPreview {
            permission_level: "guarded".to_string(),
            decision: "explicit-approval-required".to_string(),
            requires_review: true,
            requires_explicit_approval: true,
            action_tiers,
            gates: vec![
                gate(
                    "plan-audit",
                    "required",
                    "Destructive plans must pass audit before any later executor can proceed.",
                ),
                gate(
                    "explicit-approval",
                    "required",
                    "Delete, move, cleanup, format, or destructive actions require a separate approval step.",
                ),
                gate(
                    "execution-isolation",
                    "blocked",
                    "Real execution remains blocked until a dedicated guarded executor exists.",
                ),
            ],
        },
        "medium" | "high" => PolicyPreview {
            permission_level: "review".to_string(),
            decision: "review-required".to_string(),
            requires_review: true,
            requires_explicit_approval: tool_or_external,
            action_tiers,
            gates: review_gates(tool_or_external),
        },
        _ if tool_or_external => PolicyPreview {
            permission_level: "tool-review".to_string(),
            decision: "tool-permission-required".to_string(),
            requires_review: true,
            requires_explicit_approval: true,
            action_tiers,
            gates: vec![
                gate(
                    "tool-allowlist",
                    "required",
                    "External, browser, push delivery, agent, script, local app, or durable Zhishu actions need an allowlist and approval gate.",
                ),
                gate(
                    "preview-only",
                    "enforced",
                    "This build can preview the request but will not execute external actions.",
                ),
            ],
        },
        _ => PolicyPreview {
            permission_level: "observe".to_string(),
            decision: "direct-preview".to_string(),
            requires_review: false,
            requires_explicit_approval: false,
            action_tiers,
            gates: vec![
                gate(
                    "observation",
                    "ready",
                    "Read-only planning and local preview can proceed without extra approval.",
                ),
                gate(
                    "durable-write",
                    "not-requested",
                    "No durable Zhishu write or local modification is requested by this plan.",
                ),
            ],
        },
    }
}

pub fn enforce_for_plan(
    plan: &Plan,
    review_approved: bool,
    explicit_approval_recorded: bool,
) -> PolicyEnforcement {
    let preview = preview_for_plan(plan);

    if preview.requires_explicit_approval && !explicit_approval_recorded {
        return PolicyEnforcement {
            decision: "approval-required".to_string(),
            can_execute: false,
            blocked_reason: Some("Explicit approval is required before execution.".to_string()),
        };
    }

    if (preview.requires_review || plan.audit_required) && !review_approved {
        return PolicyEnforcement {
            decision: "review-required".to_string(),
            can_execute: false,
            blocked_reason: Some("Review is required before execution.".to_string()),
        };
    }

    PolicyEnforcement {
        decision: "allow-dry-run".to_string(),
        can_execute: true,
        blocked_reason: None,
    }
}

fn review_gates(tool_or_external: bool) -> Vec<PolicyGate> {
    let mut gates = vec![
        gate(
            "plan-audit",
            "required",
            "The plan must pass the existing audit gate before execution is promoted.",
        ),
        gate(
            "compensation",
            "planned",
            "Rollback or fallback behavior must stay visible in the execution preview.",
        ),
    ];

    if tool_or_external {
        gates.push(gate(
            "tool-or-hub-approval",
            "required",
            "Tool calls, browser actions, push delivery, scripts, local apps, or durable Zhishu writes need explicit approval.",
        ));
    }

    gates
}

fn action_tiers_for(intent: &str, risk: &str) -> Vec<String> {
    let lower = intent.to_ascii_lowercase();
    let mut tiers = vec!["read-only-observation".to_string()];

    if matches!(risk, "medium" | "high") {
        tiers.push("local-write-or-modify".to_string());
    }

    if risk == "destructive" {
        tiers.push("destructive-local-change".to_string());
    }

    if contains_any(
        &lower,
        &[
            "network", "online", "internet", "web", "browser", "browse", "fetch", "http", "https",
        ],
    ) {
        tiers.push("network-or-browser-action".to_string());
    }

    if contains_any(
        &lower,
        &[
            "cleanup",
            "clean up",
            "clear cache",
            "delete",
            "remove",
            "move file",
            "format",
            "disk",
            "c drive",
            "c:",
            "memory cleanup",
            "troubleshoot",
            "diagnostic",
            "repair windows",
        ],
    ) {
        tiers.push("computer-maintenance-action".to_string());
    }

    if contains_any(
        &lower,
        &[
            "push", "email", "mail", "feishu", "lark", "wechat", "weixin", "推送", "同步", "邮箱",
            "邮件", "飞书", "微信",
        ],
    ) {
        tiers.push("push-delivery-action".to_string());
    }

    if contains_any(
        &lower,
        &[
            "agent",
            "multi-agent",
            "agent team",
            "workflow team",
            "roundtable",
            "claude",
            "codex",
            "gemini",
            "hermes",
            "tool",
            "cli",
        ],
    ) {
        tiers.push("agent-or-tool-action".to_string());
    }

    if contains_any(
        &lower,
        &[
            "script",
            "python",
            "powershell",
            "app",
            "application",
            "launch",
            "open local",
        ],
    ) {
        tiers.push("script-or-local-app-action".to_string());
    }

    if contains_any(
        &lower,
        &[
            "memory",
            "knowledge",
            "hub",
            "zhishu",
            "persist",
            "promote",
            "智枢",
            "入库",
            "知识库",
            "记忆库",
        ],
    ) {
        tiers.push("durable-zhishu-write".to_string());
    }

    tiers.sort();
    tiers.dedup();
    tiers
}

fn contains_any(value: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| value.contains(needle))
}

fn gate(name: &str, status: &str, detail: &str) -> PolicyGate {
    PolicyGate {
        name: name.to_string(),
        status: status.to_string(),
        detail: detail.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::kernel::Plan;

    fn plan(intent: &str, risk: &str) -> Plan {
        Plan {
            intent: intent.to_string(),
            risk: risk.to_string(),
            steps: vec!["one".to_string()],
            constraints: json!({ "failure_strategy": "saga" }),
            context_refs: Vec::new(),
            audit_required: risk != "low",
            route: "L0_SINGLE direct path".to_string(),
        }
    }

    #[test]
    fn low_risk_observation_is_direct_preview() {
        let preview = preview_for_plan(&plan("summarize notes", "low"));

        assert_eq!(preview.permission_level, "observe");
        assert_eq!(preview.decision, "direct-preview");
        assert!(!preview.requires_review);
        assert!(preview
            .action_tiers
            .contains(&"read-only-observation".to_string()));
    }

    #[test]
    fn destructive_plan_requires_explicit_approval() {
        let preview = preview_for_plan(&plan("delete cache", "destructive"));

        assert_eq!(preview.permission_level, "guarded");
        assert_eq!(preview.decision, "explicit-approval-required");
        assert!(preview.requires_review);
        assert!(preview.requires_explicit_approval);
        assert!(preview
            .action_tiers
            .contains(&"destructive-local-change".to_string()));
    }

    #[test]
    fn browser_or_agent_request_is_tool_gated_even_when_risk_is_low() {
        let preview = preview_for_plan(&plan("browse web with codex agent", "low"));

        assert_eq!(preview.permission_level, "tool-review");
        assert_eq!(preview.decision, "tool-permission-required");
        assert!(preview.requires_review);
        assert!(preview.requires_explicit_approval);
        assert!(preview
            .action_tiers
            .contains(&"network-or-browser-action".to_string()));
        assert!(preview
            .action_tiers
            .contains(&"agent-or-tool-action".to_string()));
    }

    #[test]
    fn agent_team_request_is_tool_gated_even_when_risk_is_low() {
        let preview = preview_for_plan(&plan("run a roundtable review workflow team", "low"));

        assert_eq!(preview.permission_level, "tool-review");
        assert!(preview.requires_explicit_approval);
        assert!(preview
            .action_tiers
            .contains(&"agent-or-tool-action".to_string()));
    }

    #[test]
    fn push_delivery_request_is_tool_gated_even_when_risk_is_low() {
        let preview = preview_for_plan(&plan("email the daily summary", "low"));

        assert_eq!(preview.permission_level, "tool-review");
        assert!(preview.requires_explicit_approval);
        assert!(preview
            .action_tiers
            .contains(&"push-delivery-action".to_string()));
    }

    #[test]
    fn computer_cleanup_request_is_tool_gated_even_when_risk_is_low() {
        let preview = preview_for_plan(&plan("clean up C drive cache", "low"));

        assert_eq!(preview.permission_level, "tool-review");
        assert!(preview.requires_explicit_approval);
        assert!(preview
            .action_tiers
            .contains(&"computer-maintenance-action".to_string()));
    }

    #[test]
    fn local_app_launch_request_is_tool_gated_even_when_risk_is_low() {
        let preview = preview_for_plan(&plan("launch local notes app", "low"));

        assert_eq!(preview.permission_level, "tool-review");
        assert!(preview.requires_explicit_approval);
        assert!(preview
            .action_tiers
            .contains(&"script-or-local-app-action".to_string()));
    }

    #[test]
    fn chinese_zhishu_write_request_is_tool_gated() {
        let preview = preview_for_plan(&plan("把这条规则写入智枢知识库", "low"));

        assert_eq!(preview.permission_level, "tool-review");
        assert!(preview.requires_explicit_approval);
        assert!(preview
            .action_tiers
            .contains(&"durable-zhishu-write".to_string()));
    }

    #[test]
    fn chinese_push_delivery_request_is_tool_gated() {
        let preview = preview_for_plan(&plan("把报告推送到飞书和微信", "low"));

        assert_eq!(preview.permission_level, "tool-review");
        assert!(preview
            .action_tiers
            .contains(&"push-delivery-action".to_string()));
    }

    #[test]
    fn enforcement_blocks_until_review_or_approval_is_present() {
        let tool_plan = plan("browse web with codex agent", "low");
        let blocked = enforce_for_plan(&tool_plan, false, false);

        assert_eq!(blocked.decision, "approval-required");
        assert!(!blocked.can_execute);

        let approved = enforce_for_plan(&tool_plan, true, true);

        assert_eq!(approved.decision, "allow-dry-run");
        assert!(approved.can_execute);
    }

    #[test]
    fn enforcement_allows_plain_observation_dry_run() {
        let preview = enforce_for_plan(&plan("summarize notes", "low"), false, false);

        assert_eq!(preview.decision, "allow-dry-run");
        assert!(preview.can_execute);
    }
}
