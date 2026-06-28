//! Synapse kernel protocol layer.
//!
//! The model produces Plan IR only. The kernel materializes that IR into an
//! executable plan after constraints and context references have been injected.

use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::context::{references_for_risk, ContextReference};
use crate::rules::{audit_required, bounded_steps, route_for_risk, RulePolicy};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanIr {
    pub intent: String,
    pub risk: String,
    pub proposed_steps: Vec<String>,
    pub soft_constraints: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plan {
    pub intent: String,
    pub risk: String,
    pub steps: Vec<String>,
    pub constraints: serde_json::Value,
    pub context_refs: Vec<ContextReference>,
    pub audit_required: bool,
    pub route: String,
}

pub fn materialize(ir: PlanIr, policy: RulePolicy) -> Plan {
    let steps = bounded_steps(ir.proposed_steps, policy.max_steps);
    let route = route_for_risk(&ir.risk, &policy);
    let context_refs = references_for_risk(&ir.risk);
    let audit_required = audit_required(&ir.risk);

    Plan {
        intent: ir.intent,
        risk: ir.risk,
        steps,
        constraints: json!({
            "mode": policy.mode,
            "execution_level": policy.execution_level,
            "failure_strategy": policy.failure_strategy,
            "sandbox": policy.sandbox,
            "max_steps": policy.max_steps,
            "step_timeout_seconds": policy.step_timeout_seconds,
            "mode_lock_auto": policy.mode_lock_auto,
            "soft": ir.soft_constraints
        }),
        context_refs,
        audit_required,
        route,
    }
}
