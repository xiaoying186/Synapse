use serde::Serialize;

use crate::store::{self, StoreError, TaskDirection, TaskRunRecord};

#[derive(Debug, Clone, Serialize)]
pub struct ExecutorContractPreview {
    pub executor_state: String,
    pub detail: String,
    pub required_gates: Vec<String>,
    pub run_previews: Vec<ExecutorRunPreview>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExecutorRunPreview {
    pub run_id: String,
    pub task_direction_title: String,
    pub readiness: String,
    pub lane: String,
    pub blocked_reason: Option<String>,
    pub gates: Vec<String>,
    pub push_enabled: bool,
    pub push_channels: Vec<String>,
}

pub fn preview() -> Result<ExecutorContractPreview, StoreError> {
    Ok(preview_from_runs_and_directions(
        store::task_run_records(8)?,
        store::task_directions(100)?,
    ))
}

#[cfg(test)]
fn preview_from_runs(runs: Vec<TaskRunRecord>) -> ExecutorContractPreview {
    preview_from_runs_and_directions(runs, Vec::new())
}

fn preview_from_runs_and_directions(
    runs: Vec<TaskRunRecord>,
    directions: Vec<TaskDirection>,
) -> ExecutorContractPreview {
    ExecutorContractPreview {
        executor_state: "local-executor-contract".to_string(),
        detail: "Executor contract allows approved local Task Run records to use internal candidate mining only; tools, browsers, network, agents, and scripts remain disabled."
            .to_string(),
        required_gates: vec![
            "run-approved".to_string(),
            "direction-active".to_string(),
            "policy-preview-ready".to_string(),
            "source-gates-if-online".to_string(),
            "push-delivery-if-enabled".to_string(),
            "tool-allowlist-if-tool-needed".to_string(),
            "executor-implementation-present".to_string(),
        ],
        run_previews: runs
            .into_iter()
            .map(|run| {
                let direction_active = directions
                    .iter()
                    .find(|direction| direction.id == run.task_direction_id)
                    .map(|direction| direction.active)
                    .unwrap_or(true);
                run_preview(run, direction_active)
            })
            .collect(),
    }
}

fn run_preview(run: TaskRunRecord, direction_active: bool) -> ExecutorRunPreview {
    let is_candidate_deepen = run.trigger_kind == "candidate-deepen";
    let (readiness, lane, blocked_reason) = if run.execution_state == "completed" {
        (
            "completed".to_string(),
            if is_candidate_deepen {
                "candidate-deepen".to_string()
            } else {
                "local-task".to_string()
            },
            Some("Local executor completed this run.".to_string()),
        )
    } else if run.execution_state == "running" {
        (
            "running".to_string(),
            if is_candidate_deepen {
                "candidate-deepen".to_string()
            } else {
                "local-task".to_string()
            },
            Some("Local executor is processing this run.".to_string()),
        )
    } else if run.execution_state == "failed" {
        (
            "failed".to_string(),
            if is_candidate_deepen {
                "candidate-deepen".to_string()
            } else {
                "local-task".to_string()
            },
            run.error_summary
                .clone()
                .or_else(|| Some("Local executor failed this run.".to_string())),
        )
    } else if run.approval_state != "approved" {
        (
            "blocked".to_string(),
            "approval".to_string(),
            Some("Task run is not approved.".to_string()),
        )
    } else if run.execution_state == "blocked" {
        (
            "blocked".to_string(),
            "blocked".to_string(),
            Some("Task run was rejected or blocked before execution.".to_string()),
        )
    } else if !direction_active {
        (
            "blocked".to_string(),
            "direction-state".to_string(),
            Some("Task direction is inactive.".to_string()),
        )
    } else if run.online_enabled {
        (
            "blocked".to_string(),
            "source-gates".to_string(),
            Some("Online runs require real retrieval gates before execution.".to_string()),
        )
    } else if is_candidate_deepen && run.source_candidate_id.is_none() {
        (
            "blocked".to_string(),
            "source-candidate".to_string(),
            Some("Candidate deepening runs require a recorded source candidate.".to_string()),
        )
    } else if is_candidate_deepen {
        (
            "ready-local-deepening".to_string(),
            "candidate-deepen".to_string(),
            Some("Ready for internal candidate deepening only.".to_string()),
        )
    } else {
        (
            "ready-local-execution".to_string(),
            "local-task".to_string(),
            Some("Ready for the internal local executor only.".to_string()),
        )
    };

    let mut gates = vec![
        "approval-state".to_string(),
        "execution-state".to_string(),
        "network-policy".to_string(),
        "executor-disabled".to_string(),
    ];
    if is_candidate_deepen {
        gates.push("source-candidate".to_string());
    }
    if !direction_active && run.execution_state != "completed" {
        gates.push("direction-active".to_string());
    }
    if run.push_enabled {
        gates.push("push-delivery".to_string());
    }

    ExecutorRunPreview {
        run_id: run.id,
        task_direction_title: run.task_direction_title,
        readiness,
        lane,
        blocked_reason,
        gates,
        push_enabled: run.push_enabled,
        push_channels: run.push_channels,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(
        id: &str,
        approval_state: &str,
        execution_state: &str,
        online_enabled: bool,
    ) -> TaskRunRecord {
        TaskRunRecord {
            id: id.to_string(),
            created_at_ms: 1,
            task_direction_id: "direction-1".to_string(),
            task_direction_title: "Local scan".to_string(),
            trigger_kind: "manual-request".to_string(),
            idempotency_key: format!("test:{id}"),
            schedule_frequency: "manual".to_string(),
            online_enabled,
            output_template: "auto".to_string(),
            push_enabled: false,
            push_channels: Vec::new(),
            lifecycle_state: String::new(),
            approval_state: approval_state.to_string(),
            execution_state: execution_state.to_string(),
            detail: "test".to_string(),
            generated_candidate_ids: Vec::new(),
            started_at_ms: None,
            completed_at_ms: None,
            failed_at_ms: None,
            error_summary: None,
            cancelled_at_ms: None,
            archived_at_ms: None,
            source_candidate_id: None,
        }
    }

    fn candidate_deepen_run(source_candidate_id: Option<String>) -> TaskRunRecord {
        TaskRunRecord {
            trigger_kind: "candidate-deepen".to_string(),
            source_candidate_id,
            ..run("run-1", "approved", "approved-not-started", false)
        }
    }

    fn direction(active: bool) -> TaskDirection {
        TaskDirection {
            id: "direction-1".to_string(),
            created_at_ms: 1,
            updated_at_ms: 1,
            title: "Local scan".to_string(),
            description: "test".to_string(),
            priority: 3,
            active,
            keywords: Vec::new(),
            schedule_frequency: "manual".to_string(),
            online_enabled: false,
            push_enabled: false,
            push_channels: Vec::new(),
            output_template: "auto".to_string(),
        }
    }

    #[test]
    fn approved_local_run_is_ready_for_local_execution() {
        let preview = preview_from_runs(vec![run(
            "run-1",
            "approved",
            "approved-not-started",
            false,
        )]);

        assert_eq!(preview.run_previews[0].readiness, "ready-local-execution");
        assert_eq!(preview.run_previews[0].lane, "local-task");
        assert!(preview
            .required_gates
            .contains(&"direction-active".to_string()));
    }

    #[test]
    fn online_run_is_blocked_until_source_gates_exist() {
        let preview =
            preview_from_runs(vec![run("run-1", "approved", "approved-not-started", true)]);

        assert_eq!(preview.run_previews[0].readiness, "blocked");
        assert_eq!(preview.run_previews[0].lane, "source-gates");
    }

    #[test]
    fn push_enabled_run_reports_delivery_gate_without_blocking_local_execution() {
        let mut run = run("run-1", "approved", "approved-not-started", false);
        run.push_enabled = true;
        run.push_channels = vec!["feishu".to_string()];
        let preview = preview_from_runs(vec![run]);

        assert_eq!(preview.run_previews[0].readiness, "ready-local-execution");
        assert!(preview
            .required_gates
            .contains(&"push-delivery-if-enabled".to_string()));
        assert!(preview.run_previews[0]
            .gates
            .contains(&"push-delivery".to_string()));
        assert_eq!(
            preview.run_previews[0].push_channels,
            vec!["feishu".to_string()]
        );
    }

    #[test]
    fn completed_run_is_reported_as_completed() {
        let preview = preview_from_runs(vec![run("run-1", "approved", "completed", false)]);

        assert_eq!(preview.run_previews[0].readiness, "completed");
    }

    #[test]
    fn inactive_direction_blocks_ready_run_preview() {
        let preview = preview_from_runs_and_directions(
            vec![run("run-1", "approved", "approved-not-started", false)],
            vec![direction(false)],
        );

        assert_eq!(preview.run_previews[0].readiness, "blocked");
        assert_eq!(preview.run_previews[0].lane, "direction-state");
        assert!(preview.run_previews[0]
            .gates
            .contains(&"direction-active".to_string()));
    }

    #[test]
    fn candidate_deepen_run_has_dedicated_ready_lane() {
        let preview =
            preview_from_runs(vec![candidate_deepen_run(Some("candidate-1".to_string()))]);

        assert_eq!(preview.run_previews[0].readiness, "ready-local-deepening");
        assert_eq!(preview.run_previews[0].lane, "candidate-deepen");
        assert!(preview.run_previews[0]
            .gates
            .contains(&"source-candidate".to_string()));
    }

    #[test]
    fn candidate_deepen_run_without_source_is_blocked() {
        let preview = preview_from_runs(vec![candidate_deepen_run(None)]);

        assert_eq!(preview.run_previews[0].readiness, "blocked");
        assert_eq!(preview.run_previews[0].lane, "source-candidate");
    }
}
