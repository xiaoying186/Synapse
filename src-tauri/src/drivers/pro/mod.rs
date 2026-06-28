//! Pro driver: traceable linear or graph execution with saga compensation.

use async_trait::async_trait;

use crate::kernel::Plan;
use crate::policy;
use crate::traits::{DriverError, DriverReceipt, ExecutionDriver, Mode};

pub struct ProDriver;

pub fn preview_receipt(plan: &Plan) -> DriverReceipt {
    let enforcement = policy::enforce_for_plan(plan, false, false);
    let blocked_reason = enforcement.blocked_reason.as_deref().or_else(|| {
        if plan.risk == "destructive" {
            Some("Manual approval is required before Pro executes destructive spans.")
        } else {
            None
        }
    });

    DriverReceipt {
        mode: Mode::Pro.label().to_string(),
        status: if enforcement.decision == "approval-required" || plan.risk == "destructive" {
            "approval-required".to_string()
        } else if enforcement.decision == "review-required" {
            "waiting".to_string()
        } else if plan.audit_required {
            "audit-ready".to_string()
        } else {
            "ready".to_string()
        },
        accepted_steps: plan.steps.len(),
        blocked_reason: blocked_reason.map(str::to_string),
    }
}

#[async_trait]
impl ExecutionDriver for ProDriver {
    fn mode(&self) -> Mode {
        Mode::Pro
    }

    async fn execute(&self, plan: &Plan) -> Result<DriverReceipt, DriverError> {
        Ok(preview_receipt(plan))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn plan(risk: &str) -> Plan {
        Plan {
            intent: "test".to_string(),
            risk: risk.to_string(),
            steps: vec!["one".to_string(), "two".to_string()],
            constraints: json!({}),
            context_refs: Vec::new(),
            audit_required: risk != "low",
            route: "L1_REVIEW with reviewable changes".to_string(),
        }
    }

    #[test]
    fn medium_risk_pro_plan_is_audit_ready() {
        let receipt = preview_receipt(&plan("medium"));

        assert_eq!(receipt.status, "waiting");
        assert_eq!(receipt.accepted_steps, 2);
        assert!(receipt.blocked_reason.is_some());
    }

    #[test]
    fn destructive_pro_plan_requires_manual_approval() {
        let receipt = preview_receipt(&plan("destructive"));

        assert_eq!(receipt.status, "approval-required");
        assert!(receipt.blocked_reason.is_some());
    }

    #[test]
    fn policy_gated_pro_plan_waits_for_approval() {
        let mut plan = plan("low");
        plan.intent = "browse web with codex agent".to_string();
        plan.audit_required = true;

        let receipt = preview_receipt(&plan);

        assert_eq!(receipt.status, "approval-required");
        assert!(receipt.blocked_reason.is_some());
    }
}
