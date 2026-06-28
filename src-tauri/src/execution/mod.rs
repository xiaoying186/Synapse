//! Execution preview generation.
//!
//! This is not the real executor yet. It builds a deterministic span plan that
//! shows how the current driver would route each materialized step.

use serde::Serialize;

use crate::kernel::Plan;

#[derive(Debug, Clone, Serialize)]
pub struct ExecutionSpan {
    pub id: String,
    pub label: String,
    pub status: String,
    pub lane: String,
    pub compensation: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExecutionPreview {
    pub strategy: String,
    pub route: String,
    pub spans: Vec<ExecutionSpan>,
}

pub fn preview_for_plan(plan: &Plan) -> ExecutionPreview {
    let strategy = plan
        .constraints
        .get("failure_strategy")
        .and_then(|value| value.as_str())
        .unwrap_or("auto_fallback")
        .to_string();

    let spans = plan
        .steps
        .iter()
        .enumerate()
        .map(|(index, step)| ExecutionSpan {
            id: format!("span-{}", index + 1),
            label: step.clone(),
            status: span_status(&plan.risk, index).to_string(),
            lane: span_lane(&plan.risk).to_string(),
            compensation: compensation_for(&plan.risk, &strategy),
        })
        .collect();

    ExecutionPreview {
        strategy,
        route: plan.route.clone(),
        spans,
    }
}

fn span_status(risk: &str, index: usize) -> &'static str {
    match risk {
        "destructive" if index > 0 => "blocked",
        "medium" | "high" if index > 1 => "waiting-audit",
        _ => "ready",
    }
}

fn span_lane(risk: &str) -> &'static str {
    match risk {
        "destructive" => "guarded",
        "medium" | "high" => "review",
        _ => "direct",
    }
}

fn compensation_for(risk: &str, strategy: &str) -> Option<String> {
    match risk {
        "destructive" => Some("manual approval before execution".to_string()),
        "medium" | "high" if strategy == "saga" => Some("rollback completed spans".to_string()),
        "medium" | "high" => Some("auto-fallback if validation fails".to_string()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn plan(risk: &str, strategy: &str) -> Plan {
        Plan {
            intent: "change a file".to_string(),
            risk: risk.to_string(),
            steps: vec!["one".to_string(), "two".to_string(), "three".to_string()],
            constraints: json!({ "failure_strategy": strategy }),
            context_refs: Vec::new(),
            audit_required: risk != "low",
            route: "L0_SINGLE direct path".to_string(),
        }
    }

    #[test]
    fn low_risk_spans_are_ready_and_direct() {
        let preview = preview_for_plan(&plan("low", "auto_fallback"));

        assert_eq!(preview.spans.len(), 3);
        assert!(preview.spans.iter().all(|span| span.status == "ready"));
        assert!(preview.spans.iter().all(|span| span.lane == "direct"));
    }

    #[test]
    fn medium_risk_waits_for_audit_after_initial_steps() {
        let preview = preview_for_plan(&plan("medium", "saga"));

        assert_eq!(preview.spans[0].status, "ready");
        assert_eq!(preview.spans[1].status, "ready");
        assert_eq!(preview.spans[2].status, "waiting-audit");
        assert_eq!(
            preview.spans[2].compensation,
            Some("rollback completed spans".to_string())
        );
    }

    #[test]
    fn destructive_risk_blocks_after_first_span() {
        let preview = preview_for_plan(&plan("destructive", "auto_fallback"));

        assert_eq!(preview.spans[0].status, "ready");
        assert_eq!(preview.spans[1].status, "blocked");
        assert_eq!(preview.spans[1].lane, "guarded");
    }
}
