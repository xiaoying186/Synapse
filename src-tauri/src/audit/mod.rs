//! Cognitive audit bridge.
//!
//! The audit bridge is the only path that can promote session traces into
//! working memory or durable knowledge.

use serde::Serialize;

use crate::kernel::Plan;

#[derive(Debug, Clone, Serialize)]
pub struct AuditStage {
    pub name: String,
    pub scope: String,
    pub status: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AuditReport {
    pub required: bool,
    pub decision: String,
    pub stages: Vec<AuditStage>,
    pub promotable_facts: Vec<String>,
}

pub fn preview_for_plan(plan: &Plan) -> AuditReport {
    let mut stages = vec![AuditStage {
        name: "Trace capture".to_string(),
        scope: "L0 Session".to_string(),
        status: "ready".to_string(),
        detail: "Raw interaction remains session-bound until extraction.".to_string(),
    }];

    if plan.audit_required {
        stages.push(AuditStage {
            name: "Shadow validation".to_string(),
            scope: "L1 Working".to_string(),
            status: "queued".to_string(),
            detail: "Structured facts must pass a shadow run before promotion.".to_string(),
        });
    } else {
        stages.push(AuditStage {
            name: "Shadow validation".to_string(),
            scope: "L1 Working".to_string(),
            status: "skipped".to_string(),
            detail: "Low-risk plans stay in trace logs unless later pinned.".to_string(),
        });
    }

    stages.push(AuditStage {
        name: "Knowledge promotion".to_string(),
        scope: "L2 Knowledge".to_string(),
        status: l2_status(&plan.risk).to_string(),
        detail: l2_detail(&plan.risk).to_string(),
    });

    AuditReport {
        required: plan.audit_required,
        decision: audit_decision(&plan.risk, plan.audit_required).to_string(),
        stages,
        promotable_facts: promotable_facts(plan),
    }
}

pub async fn run_audit() -> AuditReport {
    AuditReport {
        required: false,
        decision: "idle".to_string(),
        stages: Vec::new(),
        promotable_facts: Vec::new(),
    }
}

fn audit_decision(risk: &str, audit_required: bool) -> &'static str {
    match risk {
        "destructive" => "manual approval required",
        "medium" | "high" => "shadow validation required",
        _ if audit_required => "policy review required",
        _ => "log only",
    }
}

fn l2_status(risk: &str) -> &'static str {
    match risk {
        "destructive" => "blocked",
        "medium" | "high" => "pending",
        _ => "not requested",
    }
}

fn l2_detail(risk: &str) -> &'static str {
    match risk {
        "destructive" => "Durable writes are blocked until a human approves the trace.",
        "medium" | "high" => "Promotion can occur only after the shadow result is accepted.",
        _ => "No durable memory write is proposed for this plan.",
    }
}

fn promotable_facts(plan: &Plan) -> Vec<String> {
    if !plan.audit_required {
        return Vec::new();
    }

    vec![
        format!("intent: {}", plan.intent),
        format!("risk: {}", plan.risk),
        format!("route: {}", plan.route),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn plan(risk: &str, audit_required: bool) -> Plan {
        Plan {
            intent: "edit config".to_string(),
            risk: risk.to_string(),
            steps: vec!["step".to_string()],
            constraints: json!({ "failure_strategy": "auto_fallback" }),
            context_refs: Vec::new(),
            audit_required,
            route: "L0_SINGLE with reviewable changes".to_string(),
        }
    }

    #[test]
    fn low_risk_plan_is_log_only() {
        let report = preview_for_plan(&plan("low", false));

        assert_eq!(report.decision, "log only");
        assert_eq!(report.stages[1].status, "skipped");
        assert!(report.promotable_facts.is_empty());
    }

    #[test]
    fn medium_risk_plan_requires_shadow_validation() {
        let report = preview_for_plan(&plan("medium", true));

        assert_eq!(report.decision, "shadow validation required");
        assert_eq!(report.stages[1].status, "queued");
        assert_eq!(report.stages[2].status, "pending");
        assert_eq!(report.promotable_facts.len(), 3);
    }

    #[test]
    fn low_risk_policy_gated_plan_requires_review() {
        let report = preview_for_plan(&plan("low", true));

        assert_eq!(report.decision, "policy review required");
        assert_eq!(report.stages[1].status, "queued");
        assert_eq!(report.stages[2].status, "not requested");
        assert_eq!(report.promotable_facts.len(), 3);
    }

    #[test]
    fn destructive_plan_blocks_knowledge_promotion() {
        let report = preview_for_plan(&plan("destructive", true));

        assert_eq!(report.decision, "manual approval required");
        assert_eq!(report.stages[2].status, "blocked");
    }
}
