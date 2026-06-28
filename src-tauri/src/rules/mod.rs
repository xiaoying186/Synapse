//! Rule system primitives.
//!
//! Rules convert soft model preferences into hard execution constraints.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RulePolicy {
    pub mode: String,
    pub execution_level: String,
    pub failure_strategy: String,
    pub sandbox: String,
    pub max_steps: usize,
    pub step_timeout_seconds: u64,
    pub mode_lock_auto: bool,
}

pub fn route_for_risk(risk: &str, policy: &RulePolicy) -> String {
    match risk {
        "destructive" => format!("{} via high-risk sandbox", policy.execution_level),
        "medium" => format!("{} with reviewable changes", policy.execution_level),
        _ => format!("{} direct path", policy.execution_level),
    }
}

pub fn audit_required(risk: &str) -> bool {
    matches!(risk, "medium" | "high" | "destructive")
}

pub fn bounded_steps(mut steps: Vec<String>, max_steps: usize) -> Vec<String> {
    if steps.len() > max_steps {
        steps.truncate(max_steps);
    }

    steps
}

#[cfg(test)]
mod tests {
    use super::*;

    fn policy() -> RulePolicy {
        RulePolicy {
            mode: "Lite".to_string(),
            execution_level: "L0_SINGLE".to_string(),
            failure_strategy: "auto_fallback".to_string(),
            sandbox: "wasi".to_string(),
            max_steps: 2,
            step_timeout_seconds: 60,
            mode_lock_auto: true,
        }
    }

    #[test]
    fn routes_by_risk_level() {
        assert_eq!(route_for_risk("low", &policy()), "L0_SINGLE direct path");
        assert_eq!(
            route_for_risk("medium", &policy()),
            "L0_SINGLE with reviewable changes"
        );
        assert_eq!(
            route_for_risk("destructive", &policy()),
            "L0_SINGLE via high-risk sandbox"
        );
    }

    #[test]
    fn marks_audit_required_for_non_low_risk() {
        assert!(!audit_required("low"));
        assert!(audit_required("medium"));
        assert!(audit_required("destructive"));
    }

    #[test]
    fn bounds_steps_to_policy_limit() {
        let steps = vec!["one".to_string(), "two".to_string(), "three".to_string()];

        assert_eq!(
            bounded_steps(steps, 2),
            vec!["one".to_string(), "two".to_string()]
        );
    }
}
