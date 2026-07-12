use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::{atomic::{AtomicBool, Ordering}, Arc, Mutex, OnceLock};

use crate::{arsenal, domains::agent_harness, store};

static TEAM_CANCELLATIONS: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();

fn cancellation_registry() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> {
    TEAM_CANCELLATIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

struct TeamExecutionRegistration { run_id: String }

impl Drop for TeamExecutionRegistration {
    fn drop(&mut self) {
        if let Ok(mut registry) = cancellation_registry().lock() { registry.remove(&self.run_id); }
    }
}

pub fn request_real_execution_cancel(run_id: String) -> Result<bool, store::StoreError> {
    let run_id = required(run_id, "task run id")?;
    let registry = cancellation_registry().lock().map_err(|_| store::StoreError::InvalidInput("agent team cancellation registry is unavailable".to_string()))?;
    if let Some(flag) = registry.get(&run_id) {
        flag.store(true, Ordering::SeqCst);
        return Ok(true);
    }
    Ok(false)
}

#[derive(Debug, Clone, Deserialize)]
pub struct AgentTeamRequest {
    pub run_id: String,
    pub team_mode: String,
    pub context_mode: String,
    pub goal: String,
    pub participant_tool_ids: Vec<String>,
    pub max_rounds: u8,
    #[serde(default)]
    pub max_agent_calls: Option<usize>,
    #[serde(default)]
    pub cancel_after_steps: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentTeamStep {
    pub order: usize,
    pub phase: String,
    pub participant_tool_id: String,
    pub input_source: String,
    pub output_policy: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentTeamPreview {
    pub run_id: String,
    pub team_mode: String,
    pub context_mode: String,
    pub goal: String,
    pub state: String,
    pub max_rounds: u8,
    pub estimated_agent_calls: usize,
    pub max_agent_calls: usize,
    pub cancel_after_steps: Option<usize>,
    pub participants: Vec<arsenal::ToolDescriptor>,
    pub steps: Vec<AgentTeamStep>,
    pub gates: Vec<String>,
    pub process_started: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentTeamStepReceipt {
    pub order: usize,
    pub phase: String,
    pub participant_tool_id: String,
    pub output_ref: String,
    pub output_sha256: String,
    pub process_started: bool,
    pub admission_state: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentTeamExecutionReceipt {
    pub preview: AgentTeamPreview,
    pub state: String,
    pub execution_mode: String,
    pub calls_completed: usize,
    pub calls_blocked: usize,
    pub stop_reason: String,
    pub process_started: bool,
    pub steps: Vec<AgentTeamStepReceipt>,
    pub artifact: store::TaskArtifactRecord,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentTeamRealStepPreflight {
    pub order: usize,
    pub phase: String,
    pub participant_tool_id: String,
    pub state: String,
    pub execution_enabled: bool,
    pub process_started: bool,
    pub task_content_sent: bool,
    pub blockers: Vec<agent_harness::RealAgentPreflightBlocker>,
    pub gates: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentTeamRealExecutionPreflight {
    pub preview: AgentTeamPreview,
    pub state: String,
    pub execution_enabled: bool,
    pub process_started: bool,
    pub task_content_sent: bool,
    pub executable_step_count: usize,
    pub blocked_step_count: usize,
    pub step_preflights: Vec<AgentTeamRealStepPreflight>,
    pub required_approvals: Vec<String>,
    pub gates: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentTeamRealStagingStepReceipt {
    pub order: usize,
    pub phase: String,
    pub participant_tool_id: String,
    pub state: String,
    pub input_sha256: String,
    pub blocker_ids: Vec<String>,
    pub process_started: bool,
    pub task_content_sent: bool,
    pub admission_state: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentTeamRealStagingReceipt {
    pub preflight: AgentTeamRealExecutionPreflight,
    pub state: String,
    pub execution_mode: String,
    pub staged_step_count: usize,
    pub executable_step_count: usize,
    pub blocked_step_count: usize,
    pub process_started: bool,
    pub task_content_sent: bool,
    pub steps: Vec<AgentTeamRealStagingStepReceipt>,
    pub artifact: store::TaskArtifactRecord,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentTeamRealExecutionStepReceipt {
    pub order: usize,
    pub phase: String,
    pub participant_tool_id: String,
    pub state: String,
    pub exit_code: i32,
    pub output_truncated: bool,
    pub artifact_id: String,
    pub output_sha256: String,
    pub process_started: bool,
    pub task_content_sent: bool,
    pub admission_state: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentTeamRealExecutionReceipt {
    pub preflight: AgentTeamRealExecutionPreflight,
    pub state: String,
    pub execution_mode: String,
    pub calls_completed: usize,
    pub calls_blocked: usize,
    pub stop_reason: String,
    pub process_started: bool,
    pub task_content_sent: bool,
    pub steps: Vec<AgentTeamRealExecutionStepReceipt>,
    pub artifact: store::TaskArtifactRecord,
    pub failure_detail: Option<String>,
    pub cancellation_observed: bool,
    pub rollback_snapshot: store::SnapshotRecord,
    pub audit_event: store::AuditEvent,
    pub saga: store::SagaTransaction,
}

pub fn preview(request: AgentTeamRequest) -> Result<AgentTeamPreview, store::StoreError> {
    let run_id = required(request.run_id, "task run id")?;
    let goal = required(request.goal, "team goal")?;
    let team_mode = normalize_team_mode(&request.team_mode)?;
    let context_mode = normalize_context_mode(&request.context_mode)?;
    if !(1..=3).contains(&request.max_rounds) {
        return Err(store::StoreError::InvalidInput(
            "agent team max rounds must be between 1 and 3".to_string(),
        ));
    }
    let max_agent_calls = normalize_call_budget(request.max_agent_calls)?;
    let cancel_after_steps = normalize_cancel_after_steps(request.cancel_after_steps)?;
    let mut participant_ids = request
        .participant_tool_ids
        .into_iter()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
    participant_ids.sort();
    participant_ids.dedup();
    if !(2..=4).contains(&participant_ids.len()) {
        return Err(store::StoreError::InvalidInput(
            "agent team requires 2 to 4 distinct participants".to_string(),
        ));
    }
    let run = store::task_run_by_id(run_id)?;
    let registry = arsenal::default_preview();
    let participants = participant_ids
        .iter()
        .map(|id| {
            registry
                .tools
                .iter()
                .find(|tool| tool.id == *id && tool.category == "agent")
                .cloned()
                .ok_or_else(|| {
                    store::StoreError::InvalidInput(format!("unknown agent team participant: {id}"))
                })
        })
        .collect::<Result<Vec<_>, _>>()?;
    let state = if participants
        .iter()
        .any(|tool| tool.discovery_state != "detected")
    {
        "blocked-participant-not-detected"
    } else if participants
        .iter()
        .any(|tool| tool.allow_state != "allowed")
    {
        "blocked-participant-not-allowed"
    } else if run.lifecycle_state != "approved"
        || run.approval_state != "approved"
        || run.execution_state != "approved-not-started"
    {
        "blocked-run-not-approved"
    } else {
        "blueprint-preview-ready"
    };
    let steps = build_steps(team_mode, context_mode, &participants, request.max_rounds);
    let estimated_agent_calls = match team_mode {
        "linear" => participants.len() * usize::from(request.max_rounds),
        "roundtable" => (participants.len() + 1) * usize::from(request.max_rounds),
        _ => unreachable!(),
    };
    let max_agent_calls = max_agent_calls.unwrap_or(estimated_agent_calls);

    Ok(AgentTeamPreview {
        run_id: run.id,
        team_mode: team_mode.to_string(),
        context_mode: context_mode.to_string(),
        goal,
        state: state.to_string(),
        max_rounds: request.max_rounds,
        estimated_agent_calls,
        max_agent_calls,
        cancel_after_steps,
        participants,
        steps,
        gates: vec![
            "2-to-4-distinct-agents".to_string(),
            "maximum-3-rounds".to_string(),
            "explicit-call-budget".to_string(),
            "budget-stop-records-blocked-calls".to_string(),
            "operator-cancel-records-partial-receipt".to_string(),
            "per-agent-output-quarantine".to_string(),
            "no-direct-agent-to-memory-write".to_string(),
            "task-run-approved".to_string(),
            "real-execution-requires-safety-enable-and-final-approval".to_string(),
        ],
        process_started: false,
    })
}

pub fn execute_fake(
    request: AgentTeamRequest,
    approved: bool,
) -> Result<AgentTeamExecutionReceipt, store::StoreError> {
    let preview = preview(request)?;
    if preview.state != "blueprint-preview-ready" {
        return Err(store::StoreError::InvalidInput(format!(
            "agent team fake execution is blocked: {}",
            preview.state
        )));
    }
    if !approved {
        return Err(store::StoreError::InvalidInput(
            "agent team fake execution requires explicit approval".to_string(),
        ));
    }

    let run = store::task_run_by_id(preview.run_id.clone())?;
    let execution = build_limited_fake_execution(&preview);
    let artifact = store::append_task_artifacts(
        run.id,
        run.task_direction_id,
        vec![store::NewTaskArtifact {
            artifact_type: "agent-team-fake-execution-receipt".to_string(),
            reference_id: format!("agent-team-fake-{}", store::now_millis()),
            title: format!("Agent team fake execution: {}", preview.goal),
            summary: format!(
                "{} fake agent calls completed and {} blocked; no external agent process was started.",
                execution.completed.len(),
                execution.calls_blocked
            ),
            metadata: serde_json::json!({
                "execution_mode": "fake-agent-harness",
                "team_mode": preview.team_mode,
                "context_mode": preview.context_mode,
                "participant_count": preview.participants.len(),
                "estimated_agent_calls": preview.estimated_agent_calls,
                "max_agent_calls": preview.max_agent_calls,
                "cancel_after_steps": preview.cancel_after_steps,
                "calls_completed": execution.completed.len(),
                "calls_blocked": execution.calls_blocked,
                "stop_reason": execution.stop_reason,
                "process_started": false,
                "external_process_started": false,
                "output_admission": "quarantine-only",
                "no_direct_memory_write": true,
                "step_receipts": execution.completed.clone(),
            }),
        }],
    )?
    .remove(0);

    Ok(AgentTeamExecutionReceipt {
        preview,
        state: execution.state,
        execution_mode: "fake-agent-harness".to_string(),
        calls_completed: execution.completed.len(),
        calls_blocked: execution.calls_blocked,
        stop_reason: execution.stop_reason,
        process_started: false,
        steps: execution.completed,
        artifact,
    })
}

pub fn preflight_real_execution(
    request: AgentTeamRequest,
) -> Result<AgentTeamRealExecutionPreflight, store::StoreError> {
    let preview = preview(request)?;
    let step_preflights = preview
        .steps
        .iter()
        .map(|step| real_step_preflight(&preview, step))
        .collect::<Result<Vec<_>, _>>()?;
    let execution_enabled = preview.state == "blueprint-preview-ready"
        && step_preflights.iter().all(|step| step.execution_enabled);
    let state = real_team_preflight_state(&preview.state, &step_preflights);
    let executable_step_count = step_preflights
        .iter()
        .filter(|step| step.execution_enabled)
        .count();
    let blocked_step_count = step_preflights
        .iter()
        .filter(|step| !step.execution_enabled)
        .count();

    Ok(AgentTeamRealExecutionPreflight {
        preview,
        state,
        execution_enabled,
        process_started: false,
        task_content_sent: false,
        executable_step_count,
        blocked_step_count,
        step_preflights,
        required_approvals: vec![
            "blueprint-preview-ready".to_string(),
            "all-participants-pass-agent-harness-preflight".to_string(),
            "all-steps-use-supported-real-agent-adapters".to_string(),
            "repository-trust-pass".to_string(),
            "command-safety-pass-or-reviewed".to_string(),
            "external-agent-execution-gate-enabled".to_string(),
            "explicit-human-team-execution-approval".to_string(),
            "output-quarantine-before-memory".to_string(),
        ],
        gates: vec![
            "per-step-agent-harness-preflight".to_string(),
            "no-process-spawn".to_string(),
            "no-task-content-sent".to_string(),
            "all-steps-must-pass-before-team-execution".to_string(),
            "team-synthesizer-real-adapter-not-implemented".to_string(),
            "external-agent-execution-gate-required".to_string(),
            "quarantine-output-before-memory".to_string(),
        ],
    })
}

pub fn stage_real_execution(
    request: AgentTeamRequest,
    approved: bool,
) -> Result<AgentTeamRealStagingReceipt, store::StoreError> {
    let preflight = preflight_real_execution(request)?;
    if !approved {
        return Err(store::StoreError::InvalidInput(
            "agent team real staging requires explicit approval".to_string(),
        ));
    }
    if preflight.preview.state != "blueprint-preview-ready" {
        return Err(store::StoreError::InvalidInput(format!(
            "agent team real staging is blocked by blueprint: {}",
            preflight.preview.state
        )));
    }

    let steps = build_real_staging_step_receipts(&preflight);
    let run = store::task_run_by_id(preflight.preview.run_id.clone())?;
    let artifact = store::append_task_artifacts(
        run.id,
        run.task_direction_id,
        vec![store::NewTaskArtifact {
            artifact_type: "agent-team-real-staging-receipt".to_string(),
            reference_id: format!("agent-team-real-staging-{}", store::now_millis()),
            title: format!("Agent team real staging: {}", preflight.preview.goal),
            summary: format!(
                "{} real-agent steps staged, {} executable, {} blocked; no process was started.",
                steps.len(),
                preflight.executable_step_count,
                preflight.blocked_step_count
            ),
            metadata: serde_json::json!({
                "execution_mode": "real-agent-staging-only",
                "team_mode": preflight.preview.team_mode,
                "context_mode": preflight.preview.context_mode,
                "execution_enabled": preflight.execution_enabled,
                "staged_step_count": steps.len(),
                "executable_step_count": preflight.executable_step_count,
                "blocked_step_count": preflight.blocked_step_count,
                "process_started": false,
                "task_content_sent": false,
                "output_admission": "quarantine-before-memory",
                "no_direct_memory_write": true,
                "required_approvals": preflight.required_approvals.clone(),
                "gates": preflight.gates.clone(),
                "step_receipts": steps.clone(),
            }),
        }],
    )?
    .remove(0);

    Ok(AgentTeamRealStagingReceipt {
        state: "real-agent-staging-receipt-recorded".to_string(),
        execution_mode: "real-agent-staging-only".to_string(),
        staged_step_count: steps.len(),
        executable_step_count: preflight.executable_step_count,
        blocked_step_count: preflight.blocked_step_count,
        process_started: false,
        task_content_sent: false,
        steps,
        artifact,
        preflight,
    })
}

pub fn execute_real(
    request: AgentTeamRequest,
    approved: bool,
) -> Result<AgentTeamRealExecutionReceipt, store::StoreError> {
    let preflight = preflight_real_execution(request)?;
    if !approved {
        return Err(store::StoreError::InvalidInput(
            "agent team real execution requires explicit final approval".to_string(),
        ));
    }
    if !preflight.execution_enabled {
        return Err(store::StoreError::InvalidInput(format!(
            "agent team real execution is blocked: {}",
            preflight.state
        )));
    }

    let run = store::task_run_by_id(preflight.preview.run_id.clone())?;
    let cancellation = Arc::new(AtomicBool::new(false));
    {
        let mut registry = cancellation_registry().lock().map_err(|_| store::StoreError::InvalidInput("agent team cancellation registry is unavailable".to_string()))?;
        if registry.insert(preflight.preview.run_id.clone(), cancellation.clone()).is_some() {
            return Err(store::StoreError::InvalidInput("agent team execution is already active for this Task Run".to_string()));
        }
    }
    let _registration = TeamExecutionRegistration { run_id: preflight.preview.run_id.clone() };
    let saga = store::begin_saga(
        "agent-team-real-execution".to_string(),
        preflight.preview.run_id.clone(),
        serde_json::json!({
            "team_mode": preflight.preview.team_mode,
            "context_mode": preflight.preview.context_mode,
            "max_agent_calls": preflight.preview.max_agent_calls,
        }),
    )?;
    let rollback_snapshot = match store::create_snapshot(
        "task-run".to_string(),
        preflight.preview.run_id.clone(),
        "before-agent-team-real-execution".to_string(),
        serde_json::json!({
            "saga_id": saga.id,
            "process_started": false,
            "task_content_sent": false,
            "preflight_state": preflight.state,
        }),
    ) {
        Ok(snapshot) => snapshot,
        Err(error) => return fail_real_execution_saga(&saga, error),
    };
    let executable_steps = preflight
        .preview
        .steps
        .iter()
        .take(preflight.preview.max_agent_calls)
        .take(
            preflight
                .preview
                .cancel_after_steps
                .unwrap_or(preflight.preview.steps.len()),
        )
        .cloned()
        .collect::<Vec<_>>();
    let mut step_receipts = Vec::new();
    let mut failure_detail = None;
    let mut cancellation_observed = false;
    for step in executable_steps {
        if cancellation.load(Ordering::SeqCst) {
            cancellation_observed = true;
            break;
        }
        let input = real_step_input(&preflight.preview, &step);
        let output = match agent_harness::execute_codex_quarantined(
            agent_harness::AgentDryRunRequest {
                tool_id: step.participant_tool_id.clone(),
                run_id: preflight.preview.run_id.clone(),
                mode: preflight.preview.context_mode.clone(),
                input,
            },
            true,
            "agent-team-real-output-quarantine",
            "agent-team-real-output",
            Some(&format!("Agent team step {}", step.order)),
            Some(cancellation.clone()),
        ) {
            Ok(output) => output,
            Err(error) => {
                cancellation_observed = cancellation.load(Ordering::SeqCst)
                    || error.to_string().contains("cancelled by operator");
                failure_detail = Some(store::short_text(&error.to_string(), 500));
                break;
            }
        };
        let mut hasher = Sha256::new();
        hasher.update(output.artifact.summary.as_bytes());
        hasher.update(output.artifact.id.as_bytes());
        let output_sha256 = hex::encode(hasher.finalize());
        step_receipts.push(AgentTeamRealExecutionStepReceipt {
            order: step.order,
            phase: step.phase,
            participant_tool_id: step.participant_tool_id,
            state: output.state,
            exit_code: output.exit_code,
            output_truncated: output.output_truncated,
            artifact_id: output.artifact.id,
            output_sha256,
            process_started: true,
            task_content_sent: true,
            admission_state: "quarantined-real-output-review-required".to_string(),
        });
    }

    let calls_completed = step_receipts.len();
    let calls_blocked = preflight
        .preview
        .estimated_agent_calls
        .saturating_sub(calls_completed);
    let stop_reason = if cancellation_observed {
        "operator-cancelled".to_string()
    } else if failure_detail.is_some() {
        "step-failed".to_string()
    } else if calls_completed == preflight.preview.estimated_agent_calls {
        "completed".to_string()
    } else if preflight
        .preview
        .cancel_after_steps
        .is_some_and(|limit| limit <= calls_completed)
    {
        "operator-cancelled".to_string()
    } else {
        "budget-exhausted".to_string()
    };
    let receipt_state = if failure_detail.is_some() || cancellation_observed {
        "real-agent-partial-execution-receipt-recorded"
    } else {
        "real-agent-execution-receipt-recorded"
    };
    let artifact = match store::append_task_artifacts(
        run.id,
        run.task_direction_id,
        vec![store::NewTaskArtifact {
            artifact_type: "agent-team-real-execution-receipt".to_string(),
            reference_id: format!("agent-team-real-execution-{}", store::now_millis()),
            title: format!("Agent team real execution: {}", preflight.preview.goal),
            summary: format!(
                "{} real-agent steps completed and {} blocked; outputs remain quarantined.",
                calls_completed, calls_blocked
            ),
            metadata: serde_json::json!({
                "execution_mode": "real-agent-guarded-execution",
                "team_mode": preflight.preview.team_mode,
                "context_mode": preflight.preview.context_mode,
                "calls_completed": calls_completed,
                "calls_blocked": calls_blocked,
                "stop_reason": stop_reason,
                "process_started": calls_completed > 0,
                "task_content_sent": calls_completed > 0,
                "output_admission": "quarantine-review-before-memory",
                "no_direct_memory_write": true,
                "required_approvals": preflight.required_approvals.clone(),
                "gates": preflight.gates.clone(),
                "step_receipts": step_receipts.clone(),
                "failure_detail": failure_detail,
                "cancellation_observed": cancellation_observed,
                "rollback_snapshot_id": rollback_snapshot.id,
                "saga_id": saga.id,
            }),
        }],
    ) {
        Ok(mut artifacts) => artifacts.remove(0),
        Err(error) => return fail_real_execution_saga(&saga, error),
    };
    let audit_event = match store::append_audit_event(store::NewAuditEvent {
        actor: "taiheng".to_string(),
        action: "execute-real-agent-team".to_string(),
        target_type: "task-run".to_string(),
        target_id: preflight.preview.run_id.clone(),
        risk_level: "critical".to_string(),
        decision: receipt_state.to_string(),
        input: serde_json::json!({
            "approved": approved,
            "team_mode": preflight.preview.team_mode,
            "context_mode": preflight.preview.context_mode,
            "snapshot_id": rollback_snapshot.id,
            "saga_id": saga.id,
        }),
        result_summary: serde_json::json!({
            "artifact_id": artifact.id,
            "calls_completed": calls_completed,
            "calls_blocked": calls_blocked,
            "stop_reason": stop_reason,
            "process_started": calls_completed > 0 || failure_detail.is_some(),
            "task_content_sent": calls_completed > 0 || failure_detail.is_some(),
            "output_admission": "quarantine-review-before-memory",
            "cancellation_observed": cancellation_observed,
        }),
        error: failure_detail.clone(),
    }) {
        Ok(event) => event,
        Err(error) => {
            return finish_real_execution_compensation(
                error,
                compensate_final_team_artifact(&saga, &artifact),
            )
        }
    };
    let saga = finalize_real_team_commit(
        || store::transition_saga(saga.id.clone(), "committed".to_string()),
        || compensate_final_team_artifact(&saga, &artifact),
    )?;

    Ok(AgentTeamRealExecutionReceipt {
        preflight,
        state: receipt_state.to_string(),
        execution_mode: "real-agent-guarded-execution".to_string(),
        calls_completed,
        calls_blocked,
        stop_reason,
        process_started: calls_completed > 0,
        task_content_sent: calls_completed > 0,
        steps: step_receipts,
        artifact,
        failure_detail,
        cancellation_observed,
        rollback_snapshot,
        audit_event,
        saga,
    })
}

fn fail_real_execution_saga<T>(saga: &store::SagaTransaction, error: store::StoreError) -> Result<T, store::StoreError> {
    let _ = store::transition_saga(saga.id.clone(), "failed".to_string());
    Err(error)
}

fn finalize_real_team_commit<T, FCommit, FCompensate>(
    commit: FCommit,
    compensate: FCompensate,
) -> Result<T, store::StoreError>
where
    FCommit: FnOnce() -> Result<T, store::StoreError>,
    FCompensate: FnOnce() -> Result<(), store::StoreError>,
{
    match commit() {
        Ok(value) => Ok(value),
        Err(error) => finish_real_execution_compensation(error, compensate()),
    }
}

fn finish_real_execution_compensation<T>(
    original_error: store::StoreError,
    compensation: Result<(), store::StoreError>,
) -> Result<T, store::StoreError> {
    match compensation {
        Ok(()) => Err(original_error),
        Err(compensation_error) => Err(store::StoreError::InvalidInput(format!(
            "real agent team execution failed: {original_error}; final artifact compensation failed: {compensation_error}"
        ))),
    }
}

fn compensate_final_team_artifact(
    saga: &store::SagaTransaction,
    artifact: &store::TaskArtifactRecord,
) -> Result<(), store::StoreError> {
    let _ = store::transition_saga(saga.id.clone(), "compensating".to_string());
    match store::remove_task_artifacts(vec![artifact.id.clone()]) {
        Ok(()) => {
            let _ = store::transition_saga(saga.id.clone(), "compensated".to_string());
            Ok(())
        }
        Err(error) => {
            let _ = store::transition_saga(saga.id.clone(), "failed".to_string());
            Err(error)
        }
    }
}

fn build_real_staging_step_receipts(
    preflight: &AgentTeamRealExecutionPreflight,
) -> Vec<AgentTeamRealStagingStepReceipt> {
    preflight
        .step_preflights
        .iter()
        .map(|step| {
            let input = real_step_input(
                &preflight.preview,
                &AgentTeamStep {
                    order: step.order,
                    phase: step.phase.clone(),
                    participant_tool_id: step.participant_tool_id.clone(),
                    input_source: "team-goal-and-reviewed-context".to_string(),
                    output_policy: "quarantine-before-memory".to_string(),
                },
            );
            let mut hasher = Sha256::new();
            hasher.update(step.participant_tool_id.as_bytes());
            hasher.update(b":");
            hasher.update(input.as_bytes());
            let input_sha256 = hex::encode(hasher.finalize());
            AgentTeamRealStagingStepReceipt {
                order: step.order,
                phase: step.phase.clone(),
                participant_tool_id: step.participant_tool_id.clone(),
                state: step.state.clone(),
                input_sha256,
                blocker_ids: step
                    .blockers
                    .iter()
                    .map(|blocker| blocker.id.clone())
                    .collect(),
                process_started: false,
                task_content_sent: false,
                admission_state: "quarantined-staging-only".to_string(),
            }
        })
        .collect()
}

fn real_step_preflight(
    preview: &AgentTeamPreview,
    step: &AgentTeamStep,
) -> Result<AgentTeamRealStepPreflight, store::StoreError> {
    if step.participant_tool_id == "team-synthesizer" {
        return Ok(AgentTeamRealStepPreflight {
            order: step.order,
            phase: step.phase.clone(),
            participant_tool_id: step.participant_tool_id.clone(),
            state: "blocked-synthesizer-real-adapter-not-implemented".to_string(),
            execution_enabled: false,
            process_started: false,
            task_content_sent: false,
            blockers: vec![agent_harness::RealAgentPreflightBlocker {
                id: "team-synthesizer-real-adapter-not-implemented".to_string(),
                state: "blocked".to_string(),
                detail: "Roundtable synthesis remains a quarantined local step until a guarded real adapter exists."
                    .to_string(),
            }],
            gates: vec![
                "no-process-spawn".to_string(),
                "no-task-content-sent".to_string(),
                "synthesizer-output-quarantine-required".to_string(),
            ],
        });
    }

    let preflight = agent_harness::preflight_real_execution(agent_harness::AgentDryRunRequest {
        tool_id: step.participant_tool_id.clone(),
        run_id: preview.run_id.clone(),
        mode: preview.context_mode.clone(),
        input: real_step_input(preview, step),
    })?;

    Ok(AgentTeamRealStepPreflight {
        order: step.order,
        phase: step.phase.clone(),
        participant_tool_id: step.participant_tool_id.clone(),
        state: preflight.state,
        execution_enabled: preflight.execution_enabled,
        process_started: false,
        task_content_sent: false,
        blockers: preflight.blockers,
        gates: preflight.gates,
    })
}

fn real_step_input(preview: &AgentTeamPreview, step: &AgentTeamStep) -> String {
    format!(
        "Agent team goal: {}\nTeam mode: {}\nContext mode: {}\nStep {} / {}.\nInput source: {}.\nOutput policy: {}.\nOperate read-only and return quarantinable output only.",
        preview.goal,
        preview.team_mode,
        preview.context_mode,
        step.order,
        step.phase,
        step.input_source,
        step.output_policy
    )
}

fn real_team_preflight_state(
    preview_state: &str,
    step_preflights: &[AgentTeamRealStepPreflight],
) -> String {
    if preview_state != "blueprint-preview-ready" {
        return "real-team-preflight-blocked-by-blueprint".to_string();
    }
    if step_preflights.iter().all(|step| step.execution_enabled) {
        "ready-for-final-human-team-execution-approval".to_string()
    } else {
        "real-team-execution-blocked-by-default".to_string()
    }
}

fn build_steps(
    team_mode: &str,
    context_mode: &str,
    participants: &[arsenal::ToolDescriptor],
    max_rounds: u8,
) -> Vec<AgentTeamStep> {
    let mut steps = Vec::new();
    for round in 1..=max_rounds {
        for (index, participant) in participants.iter().enumerate() {
            steps.push(AgentTeamStep {
                order: steps.len() + 1,
                phase: format!("round-{round}"),
                participant_tool_id: participant.id.clone(),
                input_source: if team_mode == "linear" && index > 0 {
                    "previous-participant-quarantined-output"
                } else {
                    "team-goal-and-reviewed-context"
                }
                .to_string(),
                output_policy: if context_mode == "deep" {
                    "quarantine-then-review-before-memory"
                } else {
                    "quarantine-only"
                }
                .to_string(),
            });
        }
        if team_mode == "roundtable" {
            steps.push(AgentTeamStep {
                order: steps.len() + 1,
                phase: format!("round-{round}-synthesis"),
                participant_tool_id: "team-synthesizer".to_string(),
                input_source: "all-round-quarantined-outputs".to_string(),
                output_policy: "quarantine-only".to_string(),
            });
        }
    }
    steps
}

fn build_fake_step_receipts(preview: &AgentTeamPreview) -> Vec<AgentTeamStepReceipt> {
    preview
        .steps
        .iter()
        .map(|step| {
            let output_ref = format!(
                "{}:{}:{}:{}",
                preview.run_id, preview.team_mode, step.order, step.participant_tool_id
            );
            let mut hasher = Sha256::new();
            hasher.update(output_ref.as_bytes());
            hasher.update(preview.goal.as_bytes());
            let output_sha256 = hex::encode(hasher.finalize());
            AgentTeamStepReceipt {
                order: step.order,
                phase: step.phase.clone(),
                participant_tool_id: step.participant_tool_id.clone(),
                output_ref,
                output_sha256,
                process_started: false,
                admission_state: "quarantined".to_string(),
            }
        })
        .collect()
}

#[derive(Debug, Clone)]
struct LimitedFakeExecution {
    completed: Vec<AgentTeamStepReceipt>,
    calls_blocked: usize,
    state: String,
    stop_reason: String,
}

fn build_limited_fake_execution(preview: &AgentTeamPreview) -> LimitedFakeExecution {
    let all_receipts = build_fake_step_receipts(preview);
    let budget_limit = preview.max_agent_calls.min(all_receipts.len());
    let cancel_limit = preview
        .cancel_after_steps
        .unwrap_or(all_receipts.len())
        .min(all_receipts.len());
    let completed_limit = budget_limit.min(cancel_limit);
    let completed = all_receipts
        .into_iter()
        .take(completed_limit)
        .collect::<Vec<_>>();
    let calls_blocked = preview
        .estimated_agent_calls
        .saturating_sub(completed.len());
    let stop_reason = if completed.len() == preview.estimated_agent_calls {
        "completed".to_string()
    } else if preview
        .cancel_after_steps
        .is_some_and(|limit| limit <= completed.len())
        && cancel_limit <= budget_limit
    {
        "operator-cancelled".to_string()
    } else {
        "budget-exhausted".to_string()
    };
    let state = match stop_reason.as_str() {
        "completed" => "fake-execution-receipt-recorded",
        "operator-cancelled" => "fake-execution-cancelled-receipt-recorded",
        _ => "fake-execution-budget-stopped-receipt-recorded",
    }
    .to_string();

    LimitedFakeExecution {
        completed,
        calls_blocked,
        state,
        stop_reason,
    }
}

fn normalize_call_budget(value: Option<usize>) -> Result<Option<usize>, store::StoreError> {
    match value {
        Some(0) => Err(store::StoreError::InvalidInput(
            "agent team call budget must be at least 1".to_string(),
        )),
        Some(value) if value > 12 => Err(store::StoreError::InvalidInput(
            "agent team call budget cannot exceed 12".to_string(),
        )),
        other => Ok(other),
    }
}

fn normalize_cancel_after_steps(value: Option<usize>) -> Result<Option<usize>, store::StoreError> {
    match value {
        Some(0) => Err(store::StoreError::InvalidInput(
            "agent team cancellation step must be at least 1".to_string(),
        )),
        Some(value) if value > 12 => Err(store::StoreError::InvalidInput(
            "agent team cancellation step cannot exceed 12".to_string(),
        )),
        other => Ok(other),
    }
}

fn normalize_team_mode(value: &str) -> Result<&'static str, store::StoreError> {
    match value.trim().to_ascii_lowercase().as_str() {
        "linear" => Ok("linear"),
        "roundtable" => Ok("roundtable"),
        other => Err(store::StoreError::InvalidInput(format!(
            "unsupported agent team mode: {other}"
        ))),
    }
}

fn normalize_context_mode(value: &str) -> Result<&'static str, store::StoreError> {
    match value.trim().to_ascii_lowercase().as_str() {
        "native" => Ok("native"),
        "deep" => Ok("deep"),
        other => Err(store::StoreError::InvalidInput(format!(
            "unsupported agent team context mode: {other}"
        ))),
    }
}

fn required(value: String, label: &str) -> Result<String, store::StoreError> {
    let value = value.trim().to_string();
    if value.is_empty() {
        return Err(store::StoreError::InvalidInput(format!(
            "{label} cannot be empty"
        )));
    }
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn active_real_team_execution_accepts_operator_cancellation() {
        let run_id = format!("run-cancel-{}", store::now_millis());
        let flag = Arc::new(AtomicBool::new(false));
        cancellation_registry().lock().unwrap().insert(run_id.clone(), flag.clone());
        assert!(request_real_execution_cancel(run_id.clone()).unwrap());
        assert!(flag.load(Ordering::SeqCst));
        cancellation_registry().lock().unwrap().remove(&run_id);
        assert!(!request_real_execution_cancel(run_id).unwrap());
    }

    #[test]
    fn linear_steps_handoff_quarantined_outputs() {
        let participants = vec![tool("agent-a"), tool("agent-b")];
        let steps = build_steps("linear", "native", &participants, 1);

        assert_eq!(steps.len(), 2);
        assert_eq!(
            steps[1].input_source,
            "previous-participant-quarantined-output"
        );
    }

    #[test]
    fn roundtable_adds_synthesis_with_bounded_calls() {
        let participants = vec![tool("agent-a"), tool("agent-b")];
        let steps = build_steps("roundtable", "deep", &participants, 2);

        assert_eq!(steps.len(), 6);
        assert_eq!(steps[2].participant_tool_id, "team-synthesizer");
        assert!(steps[0].output_policy.contains("review-before-memory"));
    }

    #[test]
    fn fake_step_receipts_are_deterministic_quarantined_and_process_free() {
        let participants = vec![tool("agent-a"), tool("agent-b")];
        let preview = AgentTeamPreview {
            run_id: "run-1".to_string(),
            team_mode: "linear".to_string(),
            context_mode: "deep".to_string(),
            goal: "Review a release plan".to_string(),
            state: "blueprint-preview-ready".to_string(),
            max_rounds: 1,
            estimated_agent_calls: 2,
            max_agent_calls: 2,
            cancel_after_steps: None,
            participants: participants.clone(),
            steps: build_steps("linear", "deep", &participants, 1),
            gates: Vec::new(),
            process_started: false,
        };

        let receipts = build_fake_step_receipts(&preview);
        let repeated = build_fake_step_receipts(&preview);

        assert_eq!(receipts.len(), 2);
        assert_eq!(receipts[0].output_sha256, repeated[0].output_sha256);
        assert_eq!(receipts[0].admission_state, "quarantined");
        assert!(!receipts[0].process_started);
        assert_eq!(receipts[0].output_sha256.len(), 64);
    }

    #[test]
    fn fake_execution_budget_blocks_remaining_calls_without_process_start() {
        let participants = vec![tool("agent-a"), tool("agent-b")];
        let preview = AgentTeamPreview {
            run_id: "run-1".to_string(),
            team_mode: "roundtable".to_string(),
            context_mode: "native".to_string(),
            goal: "Budgeted review".to_string(),
            state: "blueprint-preview-ready".to_string(),
            max_rounds: 2,
            estimated_agent_calls: 6,
            max_agent_calls: 3,
            cancel_after_steps: None,
            participants: participants.clone(),
            steps: build_steps("roundtable", "native", &participants, 2),
            gates: Vec::new(),
            process_started: false,
        };

        let execution = build_limited_fake_execution(&preview);

        assert_eq!(execution.completed.len(), 3);
        assert_eq!(execution.calls_blocked, 3);
        assert_eq!(execution.stop_reason, "budget-exhausted");
        assert_eq!(
            execution.state,
            "fake-execution-budget-stopped-receipt-recorded"
        );
        assert!(execution.completed.iter().all(|step| !step.process_started));
    }

    #[test]
    fn fake_execution_cancel_blocks_remaining_calls_with_cancel_reason() {
        let participants = vec![tool("agent-a"), tool("agent-b")];
        let preview = AgentTeamPreview {
            run_id: "run-1".to_string(),
            team_mode: "linear".to_string(),
            context_mode: "deep".to_string(),
            goal: "Cancellable review".to_string(),
            state: "blueprint-preview-ready".to_string(),
            max_rounds: 2,
            estimated_agent_calls: 4,
            max_agent_calls: 4,
            cancel_after_steps: Some(1),
            participants: participants.clone(),
            steps: build_steps("linear", "deep", &participants, 2),
            gates: Vec::new(),
            process_started: false,
        };

        let execution = build_limited_fake_execution(&preview);

        assert_eq!(execution.completed.len(), 1);
        assert_eq!(execution.calls_blocked, 3);
        assert_eq!(execution.stop_reason, "operator-cancelled");
        assert_eq!(execution.state, "fake-execution-cancelled-receipt-recorded");
        assert_eq!(execution.completed[0].admission_state, "quarantined");
    }

    #[test]
    fn real_team_preflight_blocks_when_any_step_is_not_execution_enabled() {
        let blocked = AgentTeamRealStepPreflight {
            order: 1,
            phase: "round-1".to_string(),
            participant_tool_id: "agent-codex".to_string(),
            state: "real-agent-execution-blocked-by-default".to_string(),
            execution_enabled: false,
            process_started: false,
            task_content_sent: false,
            blockers: vec![agent_harness::RealAgentPreflightBlocker {
                id: "external-agent-execution-gate-disabled".to_string(),
                state: "blocked".to_string(),
                detail: "Execution gate is disabled.".to_string(),
            }],
            gates: vec![
                "no-process-spawn".to_string(),
                "no-task-content-sent".to_string(),
            ],
        };
        let ready = AgentTeamRealStepPreflight {
            order: 2,
            phase: "round-1".to_string(),
            participant_tool_id: "agent-codex-2".to_string(),
            state: "ready-for-final-human-execution-approval".to_string(),
            execution_enabled: true,
            process_started: false,
            task_content_sent: false,
            blockers: Vec::new(),
            gates: vec![
                "no-process-spawn".to_string(),
                "no-task-content-sent".to_string(),
            ],
        };

        let state = real_team_preflight_state("blueprint-preview-ready", &[ready, blocked]);

        assert_eq!(state, "real-team-execution-blocked-by-default");
    }

    #[test]
    fn real_team_preflight_ready_state_requires_blueprint_and_all_steps_ready() {
        let ready = AgentTeamRealStepPreflight {
            order: 1,
            phase: "round-1".to_string(),
            participant_tool_id: "agent-codex".to_string(),
            state: "ready-for-final-human-execution-approval".to_string(),
            execution_enabled: true,
            process_started: false,
            task_content_sent: false,
            blockers: Vec::new(),
            gates: vec![
                "no-process-spawn".to_string(),
                "no-task-content-sent".to_string(),
            ],
        };

        assert_eq!(
            real_team_preflight_state("blueprint-preview-ready", std::slice::from_ref(&ready)),
            "ready-for-final-human-team-execution-approval"
        );
        assert_eq!(
            real_team_preflight_state("blocked-run-not-approved", &[ready]),
            "real-team-preflight-blocked-by-blueprint"
        );
    }

    #[test]
    fn real_step_input_preserves_readonly_quarantine_contract() {
        let participants = vec![tool("agent-codex"), tool("agent-claude")];
        let preview = AgentTeamPreview {
            run_id: "run-1".to_string(),
            team_mode: "linear".to_string(),
            context_mode: "deep".to_string(),
            goal: "Review release readiness".to_string(),
            state: "blueprint-preview-ready".to_string(),
            max_rounds: 1,
            estimated_agent_calls: 2,
            max_agent_calls: 2,
            cancel_after_steps: None,
            participants: participants.clone(),
            steps: build_steps("linear", "deep", &participants, 1),
            gates: Vec::new(),
            process_started: false,
        };

        let input = real_step_input(&preview, &preview.steps[1]);

        assert!(input.contains("Review release readiness"));
        assert!(input.contains("previous-participant-quarantined-output"));
        assert!(input.contains("Operate read-only"));
        assert!(input.contains("quarantinable output only"));
    }

    #[test]
    fn real_staging_receipts_hash_inputs_and_never_start_processes() {
        let participants = vec![tool("agent-codex"), tool("agent-claude")];
        let preview = AgentTeamPreview {
            run_id: "run-1".to_string(),
            team_mode: "linear".to_string(),
            context_mode: "deep".to_string(),
            goal: "Stage real team execution".to_string(),
            state: "blueprint-preview-ready".to_string(),
            max_rounds: 1,
            estimated_agent_calls: 2,
            max_agent_calls: 2,
            cancel_after_steps: None,
            participants: participants.clone(),
            steps: build_steps("linear", "deep", &participants, 1),
            gates: Vec::new(),
            process_started: false,
        };
        let preflight = AgentTeamRealExecutionPreflight {
            preview,
            state: "real-team-execution-blocked-by-default".to_string(),
            execution_enabled: false,
            process_started: false,
            task_content_sent: false,
            executable_step_count: 1,
            blocked_step_count: 1,
            step_preflights: vec![
                AgentTeamRealStepPreflight {
                    order: 1,
                    phase: "round-1".to_string(),
                    participant_tool_id: "agent-codex".to_string(),
                    state: "ready-for-final-human-execution-approval".to_string(),
                    execution_enabled: true,
                    process_started: false,
                    task_content_sent: false,
                    blockers: Vec::new(),
                    gates: vec!["no-process-spawn".to_string()],
                },
                AgentTeamRealStepPreflight {
                    order: 2,
                    phase: "round-1".to_string(),
                    participant_tool_id: "agent-claude".to_string(),
                    state: "real-agent-execution-blocked-by-default".to_string(),
                    execution_enabled: false,
                    process_started: false,
                    task_content_sent: false,
                    blockers: vec![agent_harness::RealAgentPreflightBlocker {
                        id: "external-agent-execution-gate-disabled".to_string(),
                        state: "blocked".to_string(),
                        detail: "Execution gate disabled.".to_string(),
                    }],
                    gates: vec!["no-task-content-sent".to_string()],
                },
            ],
            required_approvals: vec!["explicit-human-team-execution-approval".to_string()],
            gates: vec!["quarantine-output-before-memory".to_string()],
        };

        let receipts = build_real_staging_step_receipts(&preflight);
        let serialized = serde_json::to_string(&receipts).unwrap();

        assert_eq!(receipts.len(), 2);
        assert_eq!(receipts[0].input_sha256.len(), 64);
        assert_eq!(receipts[0].admission_state, "quarantined-staging-only");
        assert!(receipts.iter().all(|step| !step.process_started));
        assert!(receipts.iter().all(|step| !step.task_content_sent));
        assert!(receipts[1]
            .blocker_ids
            .contains(&"external-agent-execution-gate-disabled".to_string()));
        assert!(!serialized.contains("Stage real team execution"));
    }

    #[test]
    fn final_team_commit_failure_compensates_only_the_final_receipt() {
        let events = std::cell::RefCell::new(Vec::new());
        let result = finalize_real_team_commit::<(), _, _>(
            || {
                events.borrow_mut().push("commit-saga");
                Err(store::StoreError::InvalidInput("commit failed".to_string()))
            },
            || {
                events.borrow_mut().push("remove-final-team-artifact");
                Ok(())
            },
        );

        assert!(result.is_err());
        assert_eq!(
            events.into_inner(),
            vec!["commit-saga", "remove-final-team-artifact"]
        );
    }

    fn tool(id: &str) -> arsenal::ToolDescriptor {
        arsenal::ToolDescriptor {
            id: id.to_string(),
            label: id.to_string(),
            registry_source: "test".to_string(),
            category: "agent".to_string(),
            invocation_mode: "native".to_string(),
            allow_state: "allowed".to_string(),
            risk_level: "high".to_string(),
            ingestion_policy: "quarantine-output".to_string(),
            capabilities: Vec::new(),
            discovery_state: "detected".to_string(),
            detected_path: Some(format!("{id}.exe")),
        }
    }
}
