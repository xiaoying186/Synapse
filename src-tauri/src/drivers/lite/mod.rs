//! Lite driver: local linear execution with auto-fallback.

use async_trait::async_trait;

use crate::kernel::Plan;
use crate::policy;
use crate::traits::{DriverError, DriverReceipt, ExecutionDriver, Mode};

pub struct LiteDriver;

pub fn preview_receipt(plan: &Plan) -> DriverReceipt {
    let enforcement = policy::enforce_for_plan(plan, false, false);
    let blocked_reason = match (enforcement.blocked_reason.as_deref(), plan.risk.as_str()) {
        (Some(reason), _) => Some(reason),
        (None, "destructive") => {
            Some("Destructive plans require manual approval before Lite execution.")
        }
        (None, "medium" | "high") => {
            Some("Reviewable plans must pass audit before Lite execution.")
        }
        _ => None,
    };

    DriverReceipt {
        mode: Mode::Lite.label().to_string(),
        status: if blocked_reason.is_some() {
            "waiting".to_string()
        } else {
            "ready".to_string()
        },
        accepted_steps: if plan.risk == "destructive" {
            1.min(plan.steps.len())
        } else {
            plan.steps.len()
        },
        blocked_reason: blocked_reason.map(str::to_string),
    }
}

#[async_trait]
impl ExecutionDriver for LiteDriver {
    fn mode(&self) -> Mode {
        Mode::Lite
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
            route: "L0_SINGLE direct path".to_string(),
        }
    }

    #[test]
    fn low_risk_lite_plan_is_ready() {
        let receipt = preview_receipt(&plan("low"));

        assert_eq!(receipt.status, "ready");
        assert_eq!(receipt.accepted_steps, 2);
        assert!(receipt.blocked_reason.is_none());
    }

    #[test]
    fn destructive_lite_plan_waits_for_approval() {
        let receipt = preview_receipt(&plan("destructive"));

        assert_eq!(receipt.status, "waiting");
        assert_eq!(receipt.accepted_steps, 1);
        assert!(receipt.blocked_reason.is_some());
    }

    #[test]
    fn policy_gated_lite_plan_waits_for_review() {
        let mut plan = plan("low");
        plan.audit_required = true;

        let receipt = preview_receipt(&plan);

        assert_eq!(receipt.status, "waiting");
        assert_eq!(receipt.accepted_steps, 2);
        assert!(receipt.blocked_reason.is_some());
    }
}
