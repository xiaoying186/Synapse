use serde::{Deserialize, Serialize};

use crate::{arsenal, store};

#[derive(Debug, Clone, Deserialize)]
pub struct AgentTeamRequest {
    pub run_id: String,
    pub team_mode: String,
    pub context_mode: String,
    pub goal: String,
    pub participant_tool_ids: Vec<String>,
    pub max_rounds: u8,
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
    pub participants: Vec<arsenal::ToolDescriptor>,
    pub steps: Vec<AgentTeamStep>,
    pub gates: Vec<String>,
    pub process_started: bool,
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

    Ok(AgentTeamPreview {
        run_id: run.id,
        team_mode: team_mode.to_string(),
        context_mode: context_mode.to_string(),
        goal,
        state: state.to_string(),
        max_rounds: request.max_rounds,
        estimated_agent_calls,
        participants,
        steps,
        gates: vec![
            "2-to-4-distinct-agents".to_string(),
            "maximum-3-rounds".to_string(),
            "explicit-call-budget".to_string(),
            "per-agent-output-quarantine".to_string(),
            "no-direct-agent-to-memory-write".to_string(),
            "task-run-approved".to_string(),
            "blueprint-preview-only".to_string(),
            "final-execution-approval-not-implemented".to_string(),
        ],
        process_started: false,
    })
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
