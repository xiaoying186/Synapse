//! Arsenal registry model.
//!
//! This module does not launch or execute tools. It only models the registry,
//! PATH discovery, and allowlist decisions future executors must obey.

use std::env;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::store::{self, StoreError};

#[derive(Debug, Clone, Serialize)]
pub struct AdapterExecutionReceipt {
    pub tool_id: String,
    pub run_id: String,
    pub execution_mode: String,
    pub state: String,
    pub requires_approval: bool,
    pub output_summary: String,
    pub duration_ms: u128,
    pub artifact: Option<store::TaskArtifactRecord>,
    pub gates: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDescriptor {
    pub id: String,
    pub label: String,
    pub registry_source: String,
    pub category: String,
    pub invocation_mode: String,
    pub allow_state: String,
    pub risk_level: String,
    pub ingestion_policy: String,
    pub capabilities: Vec<String>,
    pub discovery_state: String,
    pub detected_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolAllowRecord {
    pub tool_id: String,
    pub allow_state: String,
    pub updated_at_ms: u128,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CustomToolRecord {
    id: String,
    label: String,
    category: String,
    invocation_mode: String,
    risk_level: String,
    ingestion_policy: String,
    #[serde(default)]
    capabilities: Vec<String>,
    #[serde(default)]
    command_candidates: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomToolDraft {
    pub id: String,
    pub label: String,
    pub category: String,
    pub invocation_mode: String,
    pub risk_level: String,
    pub ingestion_policy: String,
    #[serde(default)]
    pub capabilities: Vec<String>,
    #[serde(default)]
    pub command_candidates: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ArsenalPreview {
    pub registry_state: String,
    pub allowed_tools: usize,
    pub blocked_tools: usize,
    pub tools: Vec<ToolDescriptor>,
    pub gates: Vec<String>,
}

pub fn set_tool_allow_state(
    tool_id: String,
    allow_state: String,
) -> Result<ArsenalPreview, StoreError> {
    let tool_id = tool_id.trim().to_string();
    let allow_state = normalize_allow_state(&allow_state)?;
    let tools = registry_tools();

    let Some(tool) = tools.iter().find(|tool| tool.id == tool_id) else {
        return Err(StoreError::InvalidInput(format!(
            "unknown arsenal tool id: {tool_id}"
        )));
    };
    validate_allow_transition(tool, &allow_state)?;

    let path = store::arsenal_allowlist_path();
    let mut records = read_allow_records()?;
    let now = store::now_millis();
    if let Some(record) = records.iter_mut().find(|record| record.tool_id == tool_id) {
        record.allow_state = allow_state;
        record.updated_at_ms = now;
    } else {
        records.push(ToolAllowRecord {
            tool_id,
            allow_state,
            updated_at_ms: now,
        });
    }
    records.sort_by(|left, right| left.tool_id.cmp(&right.tool_id));
    store::write_json_records(&path, &records)?;

    Ok(default_preview())
}

pub fn dry_run_mock_adapter(
    run_id: String,
    input: String,
) -> Result<AdapterExecutionReceipt, StoreError> {
    let run = store::task_run_by_id(run_id.clone())?;
    let tool = mock_tool()?;
    let input = validate_mock_input(input)?;
    let receipt = mock_dry_run_receipt(&tool, &run, &input);
    store::append_audit_event(store::NewAuditEvent {
        actor: "local-user".to_string(),
        action: "dry-run-arsenal-adapter".to_string(),
        target_type: "arsenal-tool".to_string(),
        target_id: tool.id.clone(),
        risk_level: tool.risk_level.clone(),
        decision: receipt.state.clone(),
        input: serde_json::json!({ "run_id": run_id, "input": input }),
        result_summary: serde_json::json!({
            "execution_mode": receipt.execution_mode,
            "requires_approval": receipt.requires_approval,
        }),
        error: None,
    })?;
    Ok(receipt)
}

pub fn execute_mock_adapter(
    run_id: String,
    input: String,
    approved: bool,
) -> Result<AdapterExecutionReceipt, StoreError> {
    let run = store::task_run_by_id(run_id.clone())?;
    let tool = mock_tool()?;
    execute_mock_adapter_with(
        tool,
        run,
        input,
        approved,
        &store::task_artifact_path(),
        &store::audit_event_path(),
    )
}

fn execute_mock_adapter_with(
    tool: ToolDescriptor,
    run: store::TaskRunRecord,
    input: String,
    approved: bool,
    artifact_path: &std::path::Path,
    audit_path: &std::path::Path,
) -> Result<AdapterExecutionReceipt, StoreError> {
    let input = validate_mock_input(input)?;
    if tool.id != "mock-cli" {
        return Err(StoreError::InvalidInput(
            "only the built-in mock-cli adapter can execute in this stage".to_string(),
        ));
    }
    if tool.allow_state != "allowed" {
        return Err(StoreError::InvalidInput(
            "mock-cli must be explicitly allowed before execution".to_string(),
        ));
    }
    if !approved {
        return Err(StoreError::InvalidInput(
            "mock-cli execution requires explicit approval".to_string(),
        ));
    }
    if run.approval_state != "approved" || run.lifecycle_state != "approved" {
        return Err(StoreError::InvalidInput(
            "Task Run must be approved and waiting before adapter execution".to_string(),
        ));
    }

    let started_at = store::now_millis();
    let output_summary = format!(
        "mock-cli accepted {} character{} for deterministic local validation.",
        input.chars().count(),
        if input.chars().count() == 1 { "" } else { "s" }
    );
    let artifact = store::append_task_artifacts_at(
        artifact_path,
        run.id.clone(),
        run.task_direction_id.clone(),
        vec![store::NewTaskArtifact {
            artifact_type: "mock-adapter-output".to_string(),
            reference_id: format!("mock-output-{}", run.id),
            title: "Mock adapter output".to_string(),
            summary: output_summary.clone(),
            metadata: serde_json::json!({
                "tool_id": tool.id,
                "input_length": input.chars().count(),
                "network_used": false,
                "process_spawned": false,
            }),
        }],
    )?
    .into_iter()
    .next()
    .ok_or_else(|| StoreError::InvalidInput("mock adapter produced no artifact".to_string()))?;
    let duration_ms = store::now_millis().saturating_sub(started_at);
    let receipt = AdapterExecutionReceipt {
        tool_id: tool.id.clone(),
        run_id: run.id.clone(),
        execution_mode: "execute".to_string(),
        state: "completed".to_string(),
        requires_approval: false,
        output_summary,
        duration_ms,
        artifact: Some(artifact.clone()),
        gates: mock_adapter_gates(),
    };

    store::append_audit_event_at(
        audit_path,
        store::NewAuditEvent {
            actor: "local-user".to_string(),
            action: "execute-arsenal-adapter".to_string(),
            target_type: "arsenal-tool".to_string(),
            target_id: tool.id,
            risk_level: tool.risk_level,
            decision: "completed".to_string(),
            input: serde_json::json!({ "run_id": run.id, "input": input }),
            result_summary: serde_json::json!({
                "artifact_id": artifact.id,
                "duration_ms": duration_ms,
                "network_used": false,
                "process_spawned": false,
            }),
            error: None,
        },
    )?;
    Ok(receipt)
}

fn mock_dry_run_receipt(
    tool: &ToolDescriptor,
    run: &store::TaskRunRecord,
    input: &str,
) -> AdapterExecutionReceipt {
    AdapterExecutionReceipt {
        tool_id: tool.id.clone(),
        run_id: run.id.clone(),
        execution_mode: "dry-run".to_string(),
        state: "approval-required".to_string(),
        requires_approval: true,
        output_summary: format!(
            "Would validate {} characters without spawning a process or using network access.",
            input.chars().count()
        ),
        duration_ms: 0,
        artifact: None,
        gates: mock_adapter_gates(),
    }
}

fn mock_adapter_gates() -> Vec<String> {
    vec![
        "tool-allowlist".to_string(),
        "task-run-approved".to_string(),
        "explicit-execution-approval".to_string(),
        "bounded-input".to_string(),
        "audit-required".to_string(),
        "artifact-index-required".to_string(),
        "no-process-spawn".to_string(),
        "no-network".to_string(),
    ]
}

fn validate_mock_input(input: String) -> Result<String, StoreError> {
    let input = input.trim().to_string();
    if input.is_empty() {
        return Err(StoreError::InvalidInput(
            "mock adapter input cannot be empty".to_string(),
        ));
    }
    if input.chars().count() > 2_000 {
        return Err(StoreError::InvalidInput(
            "mock adapter input exceeds 2000 characters".to_string(),
        ));
    }
    Ok(input)
}

fn mock_tool() -> Result<ToolDescriptor, StoreError> {
    default_preview()
        .tools
        .into_iter()
        .find(|tool| tool.id == "mock-cli")
        .ok_or_else(|| StoreError::NotFound("mock-cli".to_string()))
}

fn validate_allow_transition(tool: &ToolDescriptor, allow_state: &str) -> Result<(), StoreError> {
    if allow_state == "allowed" && tool.discovery_state != "detected" {
        return Err(StoreError::InvalidInput(format!(
            "arsenal tool must be detected before allow: {}",
            tool.id
        )));
    }

    Ok(())
}

pub fn preview_registry(tools: Vec<ToolDescriptor>) -> ArsenalPreview {
    let allowed_tools = tools
        .iter()
        .filter(|tool| tool.allow_state == "allowed")
        .count();
    let blocked_tools = tools.len().saturating_sub(allowed_tools);

    ArsenalPreview {
        registry_state: "preview-only".to_string(),
        allowed_tools,
        blocked_tools,
        tools,
        gates: vec![
            "allowlist-required".to_string(),
            "path-discovery-only".to_string(),
            "policy-preview-required".to_string(),
            "separate-native-and-deep-ingestion".to_string(),
            "no-execution-from-registry-preview".to_string(),
        ],
    }
}

pub fn default_preview() -> ArsenalPreview {
    let tools = apply_allow_records(registry_tools(), read_allow_records().unwrap_or_default());
    preview_registry(tools)
}

fn registry_tools() -> Vec<ToolDescriptor> {
    let mut tools = base_tools();
    let built_in_ids = tools.iter().map(|tool| tool.id.clone()).collect::<Vec<_>>();
    tools.extend(
        read_custom_tools()
            .unwrap_or_default()
            .into_iter()
            .filter(|tool| {
                !built_in_ids
                    .iter()
                    .any(|built_in_id| built_in_id == &tool.id)
            }),
    );
    tools.sort_by(|left, right| left.id.cmp(&right.id));
    tools
}

fn base_tools() -> Vec<ToolDescriptor> {
    vec![
        ToolDescriptor {
            id: "mock-cli".to_string(),
            label: "Mock CLI adapter".to_string(),
            registry_source: "built-in".to_string(),
            category: "test-adapter".to_string(),
            invocation_mode: "deep".to_string(),
            allow_state: "blocked".to_string(),
            risk_level: "low".to_string(),
            ingestion_policy: "artifact-only".to_string(),
            capabilities: vec![
                "adapter-dry-run".to_string(),
                "deterministic-output".to_string(),
                "no-process-spawn".to_string(),
            ],
            discovery_state: "detected".to_string(),
            detected_path: Some("builtin://mock-cli".to_string()),
        },
        descriptor(
            "agent-codex",
            "Codex CLI",
            "agent",
            "native",
            "blocked",
            "high",
            "quarantine-output",
            &["agent-runner", "native-cli", "code-assistant"],
            &["codex"],
        ),
        descriptor(
            "agent-claude",
            "Claude Code CLI",
            "agent",
            "native",
            "blocked",
            "high",
            "quarantine-output",
            &["agent-runner", "native-cli", "code-assistant"],
            &["claude"],
        ),
        descriptor(
            "agent-gemini",
            "Gemini CLI",
            "agent",
            "native",
            "blocked",
            "high",
            "quarantine-output",
            &["agent-runner", "native-cli", "research-assistant"],
            &["gemini"],
        ),
        descriptor(
            "agent-hermes",
            "Hermes CLI",
            "agent",
            "native",
            "blocked",
            "high",
            "quarantine-output",
            &["agent-runner", "native-cli", "workflow-assistant"],
            &["hermes"],
        ),
        descriptor(
            "agent-team-linear",
            "Agent team: linear workflow",
            "agent-team",
            "deep",
            "blocked",
            "high",
            "review-before-memory",
            &["agent-team", "linear-workflow", "sequenced-handoff"],
            &[],
        ),
        descriptor(
            "agent-team-roundtable",
            "Agent team: roundtable review",
            "agent-team",
            "deep",
            "blocked",
            "high",
            "review-before-memory",
            &[
                "agent-team",
                "roundtable-review",
                "multi-agent-deliberation",
            ],
            &[],
        ),
        descriptor(
            "browser-playwright",
            "Browser automation",
            "browser",
            "deep",
            "blocked",
            "high",
            "review-before-memory",
            &["browser-automation", "web-check", "ui-driving"],
            &["playwright"],
        ),
        descriptor(
            "python-local",
            "Python tool",
            "python-tool",
            "deep",
            "blocked",
            "medium",
            "review-before-memory",
            &["local-script", "data-transform", "computer-assistant"],
            &["python", "py", "python3"],
        ),
        descriptor(
            "computer-cleanup",
            "Computer cleanup assistant",
            "computer-assistant",
            "deep",
            "blocked",
            "high",
            "review-before-action",
            &["disk-cleanup", "memory-cleanup", "windows-maintenance"],
            &[],
        ),
        descriptor(
            "computer-troubleshoot",
            "Computer troubleshooting assistant",
            "computer-assistant",
            "deep",
            "blocked",
            "high",
            "review-before-action",
            &["diagnostics", "windows-fix", "agent-maintenance"],
            &[],
        ),
        descriptor(
            "local-app-bridge",
            "Local app bridge",
            "local-app",
            "native",
            "blocked",
            "high",
            "quarantine-output",
            &["local-app-control", "session-reuse", "user-approved-app"],
            &["notepad"],
        ),
        descriptor(
            "codegraph-index",
            "CodeGraph",
            "indexer",
            "deep",
            "blocked",
            "medium",
            "review-before-memory",
            &["code-index", "symbol-search", "impact-analysis"],
            &["codegraph"],
        ),
    ]
}

fn read_custom_tools() -> Result<Vec<ToolDescriptor>, StoreError> {
    let records = store::read_json_records::<CustomToolRecord>(&store::arsenal_tools_path())?;
    Ok(custom_tools_from_records(records))
}

fn custom_tools_from_records(records: Vec<CustomToolRecord>) -> Vec<ToolDescriptor> {
    records
        .into_iter()
        .filter_map(custom_tool_from_record)
        .collect()
}

fn custom_tool_from_record(record: CustomToolRecord) -> Option<ToolDescriptor> {
    let id = record.id.trim();
    let label = record.label.trim();
    if id.is_empty() || label.is_empty() {
        return None;
    }

    let command_candidates = record
        .command_candidates
        .iter()
        .map(String::as_str)
        .collect::<Vec<_>>();
    let (discovery_state, detected_path) = discover_command(&command_candidates);

    Some(ToolDescriptor {
        id: id.to_string(),
        label: label.to_string(),
        registry_source: "custom".to_string(),
        category: clean_custom_field(&record.category, "custom-tool"),
        invocation_mode: clean_custom_field(&record.invocation_mode, "deep"),
        allow_state: "blocked".to_string(),
        risk_level: clean_custom_field(&record.risk_level, "high"),
        ingestion_policy: clean_custom_field(&record.ingestion_policy, "review-before-memory"),
        capabilities: store::normalize_tags(record.capabilities),
        discovery_state,
        detected_path,
    })
}

pub fn preview_custom_tool_draft(draft: CustomToolDraft) -> Result<ToolDescriptor, String> {
    let id = draft.id.trim().to_string();
    if id.is_empty()
        || !id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err(
            "Custom tool id must use letters, numbers, hyphens, or underscores.".to_string(),
        );
    }
    if draft.label.trim().is_empty() {
        return Err("Custom tool label cannot be empty.".to_string());
    }
    let command_candidates = draft
        .command_candidates
        .into_iter()
        .map(|candidate| candidate.trim().to_string())
        .filter(|candidate| !candidate.is_empty())
        .collect::<Vec<_>>();
    if command_candidates.is_empty() {
        return Err("Custom tool needs at least one command candidate.".to_string());
    }

    custom_tool_from_record(CustomToolRecord {
        id,
        label: draft.label.trim().to_string(),
        category: draft.category,
        invocation_mode: draft.invocation_mode,
        risk_level: draft.risk_level,
        ingestion_policy: draft.ingestion_policy,
        capabilities: draft.capabilities,
        command_candidates,
    })
    .ok_or_else(|| "Custom tool draft could not be normalized.".to_string())
}

pub fn save_custom_tool_draft(draft: CustomToolDraft) -> Result<ToolDescriptor, String> {
    let preview = preview_custom_tool_draft(draft.clone())?;
    let path = store::arsenal_tools_path();
    let mut records = store::read_json_records::<CustomToolRecord>(&path)
        .map_err(|error| format!("Custom tool registry is unavailable: {error}"))?;
    insert_custom_tool_record(
        &mut records,
        custom_tool_record_from_draft(&draft, &preview),
    )?;
    store::create_snapshot(
        "arsenal-custom-tool".to_string(),
        preview.id.clone(),
        "before-custom-tool-create".to_string(),
        serde_json::json!({ "operation": "create", "draft": draft }),
    )
    .map_err(|error| format!("Custom tool protection snapshot could not be created: {error}"))?;
    records.insert(0, custom_tool_record_from_draft(&draft, &preview));
    store::write_json_records(&path, &records)
        .map_err(|error| format!("Custom tool registry could not be saved: {error}"))?;
    Ok(preview)
}

fn custom_tool_record_from_draft(
    draft: &CustomToolDraft,
    preview: &ToolDescriptor,
) -> CustomToolRecord {
    CustomToolRecord {
        id: preview.id.clone(),
        label: preview.label.clone(),
        category: draft.category.clone(),
        invocation_mode: draft.invocation_mode.clone(),
        risk_level: draft.risk_level.clone(),
        ingestion_policy: draft.ingestion_policy.clone(),
        capabilities: draft.capabilities.clone(),
        command_candidates: draft
            .command_candidates
            .iter()
            .map(|candidate| candidate.trim().to_string())
            .filter(|candidate| !candidate.is_empty())
            .collect(),
    }
}

fn insert_custom_tool_record(
    records: &mut Vec<CustomToolRecord>,
    record: CustomToolRecord,
) -> Result<(), String> {
    if records.iter().any(|existing| existing.id == record.id) {
        return Err(format!(
            "Custom tool id already exists: {}. Existing tools are never overwritten automatically.",
            record.id
        ));
    }
    records.insert(0, record);
    Ok(())
}

pub fn remove_custom_tool(tool_id: String) -> Result<ToolDescriptor, String> {
    let tool_id = tool_id.trim().to_string();
    if tool_id.is_empty() {
        return Err("Custom tool id cannot be empty.".to_string());
    }
    let path = store::arsenal_tools_path();
    let mut records = store::read_json_records::<CustomToolRecord>(&path)
        .map_err(|error| format!("Custom tool registry is unavailable: {error}"))?;
    let index = records
        .iter()
        .position(|record| record.id == tool_id)
        .ok_or_else(|| format!("Custom tool was not found: {tool_id}"))?;
    let record = records[index].clone();
    let descriptor = custom_tool_from_record(record.clone())
        .ok_or_else(|| "Custom tool record is invalid and cannot be removed safely.".to_string())?;
    store::create_snapshot(
        "arsenal-custom-tool".to_string(),
        descriptor.id.clone(),
        "before-custom-tool-remove".to_string(),
        serde_json::json!({ "operation": "remove", "record": record }),
    )
    .map_err(|error| format!("Custom tool protection snapshot could not be created: {error}"))?;
    records.remove(index);
    store::write_json_records(&path, &records)
        .map_err(|error| format!("Custom tool registry could not be saved: {error}"))?;
    Ok(descriptor)
}

pub fn restore_custom_tool_snapshot(payload: &serde_json::Value) -> Result<ToolDescriptor, String> {
    let operation = payload
        .get("operation")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| "Custom tool snapshot payload is missing operation.".to_string())?;
    let path = store::arsenal_tools_path();
    let mut records = store::read_json_records::<CustomToolRecord>(&path)
        .map_err(|error| format!("Custom tool registry is unavailable: {error}"))?;

    match operation {
        "create" => {
            let draft = serde_json::from_value::<CustomToolDraft>(
                payload
                    .get("draft")
                    .cloned()
                    .ok_or_else(|| "Custom tool create snapshot is missing draft.".to_string())?,
            )
            .map_err(|error| format!("Custom tool create snapshot is invalid: {error}"))?;
            let preview = preview_custom_tool_draft(draft)?;
            let index = records
                .iter()
                .position(|record| record.id == preview.id)
                .ok_or_else(|| format!("Custom tool was not found: {}", preview.id))?;
            records.remove(index);
            store::write_json_records(&path, &records)
                .map_err(|error| format!("Custom tool registry could not be restored: {error}"))?;
            Ok(preview)
        }
        "remove" => {
            let record = serde_json::from_value::<CustomToolRecord>(
                payload
                    .get("record")
                    .cloned()
                    .ok_or_else(|| "Custom tool remove snapshot is missing record.".to_string())?,
            )
            .map_err(|error| format!("Custom tool remove snapshot is invalid: {error}"))?;
            let descriptor = custom_tool_from_record(record.clone())
                .ok_or_else(|| "Custom tool remove snapshot record is invalid.".to_string())?;
            if records.iter().any(|existing| existing.id == descriptor.id) {
                return Err(format!("Custom tool already exists: {}", descriptor.id));
            }
            records.insert(0, record);
            store::write_json_records(&path, &records)
                .map_err(|error| format!("Custom tool registry could not be restored: {error}"))?;
            Ok(descriptor)
        }
        _ => Err(format!(
            "Unsupported custom tool snapshot operation: {operation}"
        )),
    }
}

pub fn custom_tool_remove_snapshot_payload(tool_id: &str) -> Result<serde_json::Value, String> {
    let records = store::read_json_records::<CustomToolRecord>(&store::arsenal_tools_path())
        .map_err(|error| format!("Custom tool registry is unavailable: {error}"))?;
    let record = records
        .into_iter()
        .find(|record| record.id == tool_id)
        .ok_or_else(|| format!("Custom tool was not found: {tool_id}"))?;
    Ok(serde_json::json!({ "operation": "remove", "record": record }))
}

pub fn custom_tool_create_snapshot_payload_from_remove_snapshot(
    payload: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let record = serde_json::from_value::<CustomToolRecord>(
        payload
            .get("record")
            .cloned()
            .ok_or_else(|| "Custom tool remove snapshot is missing record.".to_string())?,
    )
    .map_err(|error| format!("Custom tool remove snapshot is invalid: {error}"))?;
    let draft = CustomToolDraft {
        id: record.id,
        label: record.label,
        category: record.category,
        invocation_mode: record.invocation_mode,
        risk_level: record.risk_level,
        ingestion_policy: record.ingestion_policy,
        capabilities: record.capabilities,
        command_candidates: record.command_candidates,
    };
    preview_custom_tool_draft(draft.clone())?;
    Ok(serde_json::json!({ "operation": "create", "draft": draft }))
}

fn clean_custom_field(value: &str, fallback: &str) -> String {
    let value = value.trim().to_ascii_lowercase();
    if value.is_empty() {
        fallback.to_string()
    } else {
        value
    }
}

fn descriptor(
    id: &str,
    label: &str,
    category: &str,
    invocation_mode: &str,
    allow_state: &str,
    risk_level: &str,
    ingestion_policy: &str,
    capabilities: &[&str],
    command_candidates: &[&str],
) -> ToolDescriptor {
    let (discovery_state, detected_path) = discover_command(command_candidates);

    ToolDescriptor {
        id: id.to_string(),
        label: label.to_string(),
        registry_source: "built-in".to_string(),
        category: category.to_string(),
        invocation_mode: invocation_mode.to_string(),
        allow_state: allow_state.to_string(),
        risk_level: risk_level.to_string(),
        ingestion_policy: ingestion_policy.to_string(),
        capabilities: capabilities
            .iter()
            .map(|capability| capability.to_string())
            .collect(),
        discovery_state,
        detected_path,
    }
}

fn read_allow_records() -> Result<Vec<ToolAllowRecord>, StoreError> {
    store::read_json_records(&store::arsenal_allowlist_path())
}

fn apply_allow_records(
    mut tools: Vec<ToolDescriptor>,
    records: Vec<ToolAllowRecord>,
) -> Vec<ToolDescriptor> {
    for tool in &mut tools {
        if let Some(record) = records.iter().find(|record| record.tool_id == tool.id) {
            tool.allow_state =
                if record.allow_state == "allowed" && tool.discovery_state != "detected" {
                    "blocked".to_string()
                } else {
                    record.allow_state.clone()
                };
        }
    }

    tools
}

fn normalize_allow_state(value: &str) -> Result<String, StoreError> {
    match value.trim().to_ascii_lowercase().as_str() {
        "allowed" => Ok("allowed".to_string()),
        "blocked" => Ok("blocked".to_string()),
        other => Err(StoreError::InvalidInput(format!(
            "unsupported arsenal allow state: {other}"
        ))),
    }
}

fn discover_command(command_candidates: &[&str]) -> (String, Option<String>) {
    if command_candidates.is_empty() {
        return ("not-configured".to_string(), None);
    }

    let Some(path_value) = env::var_os("PATH") else {
        return ("missing".to_string(), None);
    };

    let paths = env::split_paths(&path_value).collect::<Vec<_>>();
    for directory in paths {
        for command in command_candidates {
            for candidate in candidate_paths(&directory, command) {
                if candidate.is_file() {
                    return (
                        "detected".to_string(),
                        Some(candidate.to_string_lossy().to_string()),
                    );
                }
            }
        }
    }

    ("missing".to_string(), None)
}

fn candidate_paths(directory: &PathBuf, command: &str) -> Vec<PathBuf> {
    let base = directory.join(command);
    let mut candidates = vec![base.clone()];

    if cfg!(windows) && !command.contains('.') {
        candidates.extend(["exe", "cmd", "bat", "ps1"].map(|extension| {
            let mut path = base.clone();
            path.set_extension(extension);
            path
        }));
    }

    candidates
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;

    use super::*;

    #[test]
    fn default_registry_is_preview_only_and_blocked() {
        let preview = default_preview();

        assert_eq!(preview.registry_state, "preview-only");
        assert_eq!(preview.allowed_tools, 0);
        assert_eq!(preview.blocked_tools, preview.tools.len());
        assert!(preview
            .gates
            .contains(&"no-execution-from-registry-preview".to_string()));
        assert!(preview.gates.contains(&"path-discovery-only".to_string()));
    }

    #[test]
    fn command_candidates_include_windows_shims() {
        let paths = candidate_paths(&PathBuf::from("C:/tools"), "codegraph");

        if cfg!(windows) {
            assert!(paths
                .iter()
                .any(|path| path.to_string_lossy().ends_with("codegraph.cmd")));
            assert!(paths
                .iter()
                .any(|path| path.to_string_lossy().ends_with("codegraph.ps1")));
        } else {
            assert_eq!(paths, vec![PathBuf::from("C:/tools").join("codegraph")]);
        }
    }

    #[test]
    fn registry_counts_allowed_tools() {
        let preview = preview_registry(vec![
            descriptor(
                "safe-script",
                "Safe script",
                "script",
                "deep",
                "allowed",
                "low",
                "review-before-memory",
                &["script"],
                &[],
            ),
            descriptor(
                "blocked-app",
                "Blocked app",
                "local-app",
                "native",
                "blocked",
                "high",
                "quarantine-output",
                &["local-app"],
                &[],
            ),
        ]);

        assert_eq!(preview.allowed_tools, 1);
        assert_eq!(preview.blocked_tools, 1);
        assert_eq!(preview.tools[0].discovery_state, "not-configured");
    }

    #[test]
    fn default_registry_distinguishes_placeholders_from_detected_local_app_bridge() {
        let preview = default_preview();
        let cleanup_tool = preview
            .tools
            .iter()
            .find(|tool| tool.id == "computer-cleanup")
            .unwrap();
        let app_bridge = preview
            .tools
            .iter()
            .find(|tool| tool.id == "local-app-bridge")
            .unwrap();

        assert_eq!(cleanup_tool.discovery_state, "not-configured");
        assert_eq!(cleanup_tool.allow_state, "blocked");
        assert!(cleanup_tool
            .capabilities
            .contains(&"windows-maintenance".to_string()));
        assert_eq!(app_bridge.discovery_state, "detected");
        assert_eq!(app_bridge.allow_state, "blocked");
        assert!(app_bridge
            .capabilities
            .contains(&"local-app-control".to_string()));
    }

    #[test]
    fn default_registry_includes_agent_team_placeholders() {
        let preview = default_preview();
        let linear_team = preview
            .tools
            .iter()
            .find(|tool| tool.id == "agent-team-linear")
            .unwrap();
        let roundtable_team = preview
            .tools
            .iter()
            .find(|tool| tool.id == "agent-team-roundtable")
            .unwrap();

        assert_eq!(linear_team.discovery_state, "not-configured");
        assert_eq!(linear_team.allow_state, "blocked");
        assert!(linear_team
            .capabilities
            .contains(&"sequenced-handoff".to_string()));
        assert_eq!(roundtable_team.discovery_state, "not-configured");
        assert!(roundtable_team
            .capabilities
            .contains(&"multi-agent-deliberation".to_string()));
    }

    #[test]
    fn custom_tool_records_become_blocked_preview_descriptors() {
        let tools = custom_tools_from_records(vec![CustomToolRecord {
            id: " custom-tool ".to_string(),
            label: " Custom Tool ".to_string(),
            category: "Local-App".to_string(),
            invocation_mode: "Deep".to_string(),
            risk_level: "Medium".to_string(),
            ingestion_policy: "Review-Before-Memory".to_string(),
            capabilities: vec!["Custom".to_string(), "Custom".to_string()],
            command_candidates: Vec::new(),
        }]);

        assert_eq!(tools.len(), 1);
        assert_eq!(tools[0].id, "custom-tool");
        assert_eq!(tools[0].label, "Custom Tool");
        assert_eq!(tools[0].registry_source, "custom");
        assert_eq!(tools[0].category, "local-app");
        assert_eq!(tools[0].allow_state, "blocked");
        assert_eq!(tools[0].discovery_state, "not-configured");
        assert_eq!(tools[0].capabilities, vec!["custom".to_string()]);
    }

    #[test]
    fn custom_tool_records_skip_empty_identity() {
        let tools = custom_tools_from_records(vec![CustomToolRecord {
            id: " ".to_string(),
            label: "No id".to_string(),
            category: "script".to_string(),
            invocation_mode: "deep".to_string(),
            risk_level: "low".to_string(),
            ingestion_policy: "review-before-memory".to_string(),
            capabilities: Vec::new(),
            command_candidates: Vec::new(),
        }]);

        assert!(tools.is_empty());
    }

    #[test]
    fn applies_allow_records_to_known_tools() {
        let tools = apply_allow_records(
            vec![detected_tool("safe-script")],
            vec![ToolAllowRecord {
                tool_id: "safe-script".to_string(),
                allow_state: "allowed".to_string(),
                updated_at_ms: 1,
            }],
        );

        assert_eq!(tools[0].allow_state, "allowed");
    }

    #[test]
    fn allowed_records_are_blocked_when_tool_is_no_longer_detected() {
        let tools = apply_allow_records(
            vec![descriptor(
                "safe-script",
                "Safe script",
                "script",
                "deep",
                "blocked",
                "low",
                "review-before-memory",
                &["script"],
                &[],
            )],
            vec![ToolAllowRecord {
                tool_id: "safe-script".to_string(),
                allow_state: "allowed".to_string(),
                updated_at_ms: 1,
            }],
        );

        assert_eq!(tools[0].discovery_state, "not-configured");
        assert_eq!(tools[0].allow_state, "blocked");
    }

    #[test]
    fn rejects_unknown_allow_state() {
        let error = normalize_allow_state("maybe").unwrap_err();

        assert!(error
            .to_string()
            .contains("unsupported arsenal allow state"));
    }

    #[test]
    fn rejects_allowing_undetected_tool() {
        let tool = descriptor(
            "missing-tool",
            "Missing tool",
            "script",
            "deep",
            "blocked",
            "low",
            "review-before-memory",
            &["script"],
            &[],
        );
        let error = validate_allow_transition(&tool, "allowed").unwrap_err();

        assert!(error.to_string().contains("must be detected before allow"));
    }

    #[test]
    fn mock_adapter_dry_run_requires_approval_without_execution() {
        let tool = allowed_mock_tool();
        let run = approved_run();

        let receipt = mock_dry_run_receipt(&tool, &run, "hello");

        assert_eq!(receipt.state, "approval-required");
        assert!(receipt.requires_approval);
        assert!(receipt.artifact.is_none());
        assert!(receipt.output_summary.contains("without spawning"));
    }

    #[test]
    fn mock_adapter_execute_requires_allowlist_and_explicit_approval() {
        let artifact_path = temp_path("mock-blocked-artifacts");
        let audit_path = temp_path("mock-blocked-audit");
        let run = approved_run();

        let blocked = execute_mock_adapter_with(
            mock_tool_descriptor("blocked"),
            run.clone(),
            "hello".to_string(),
            true,
            &artifact_path,
            &audit_path,
        )
        .unwrap_err();
        let unapproved = execute_mock_adapter_with(
            allowed_mock_tool(),
            run,
            "hello".to_string(),
            false,
            &artifact_path,
            &audit_path,
        )
        .unwrap_err();

        assert!(blocked.to_string().contains("explicitly allowed"));
        assert!(unapproved.to_string().contains("explicit approval"));
        assert!(!artifact_path.exists());
        assert!(!audit_path.exists());
    }

    #[test]
    fn mock_adapter_execute_writes_artifact_and_audit_without_process() {
        let artifact_path = temp_path("mock-execute-artifacts");
        let audit_path = temp_path("mock-execute-audit");

        let receipt = execute_mock_adapter_with(
            allowed_mock_tool(),
            approved_run(),
            "validate this payload".to_string(),
            true,
            &artifact_path,
            &audit_path,
        )
        .unwrap();
        let artifacts =
            store::read_json_records::<store::TaskArtifactRecord>(&artifact_path).unwrap();
        let events = store::read_json_records::<store::AuditEvent>(&audit_path).unwrap();

        assert_eq!(receipt.state, "completed");
        assert_eq!(artifacts.len(), 1);
        assert_eq!(artifacts[0].artifact_type, "mock-adapter-output");
        assert_eq!(events[0].action, "execute-arsenal-adapter");
        assert_eq!(events[0].result_summary["process_spawned"], false);

        let _ = fs::remove_file(artifact_path);
        let _ = fs::remove_file(audit_path);
    }

    fn detected_tool(id: &str) -> ToolDescriptor {
        ToolDescriptor {
            id: id.to_string(),
            label: "Safe script".to_string(),
            registry_source: "built-in".to_string(),
            category: "script".to_string(),
            invocation_mode: "deep".to_string(),
            allow_state: "blocked".to_string(),
            risk_level: "low".to_string(),
            ingestion_policy: "review-before-memory".to_string(),
            capabilities: vec!["script".to_string()],
            discovery_state: "detected".to_string(),
            detected_path: Some("C:/tools/safe-script.cmd".to_string()),
        }
    }

    fn mock_tool_descriptor(allow_state: &str) -> ToolDescriptor {
        ToolDescriptor {
            id: "mock-cli".to_string(),
            label: "Mock CLI adapter".to_string(),
            registry_source: "built-in".to_string(),
            category: "test-adapter".to_string(),
            invocation_mode: "deep".to_string(),
            allow_state: allow_state.to_string(),
            risk_level: "low".to_string(),
            ingestion_policy: "artifact-only".to_string(),
            capabilities: vec!["deterministic-output".to_string()],
            discovery_state: "detected".to_string(),
            detected_path: Some("builtin://mock-cli".to_string()),
        }
    }

    fn allowed_mock_tool() -> ToolDescriptor {
        mock_tool_descriptor("allowed")
    }

    fn approved_run() -> store::TaskRunRecord {
        store::TaskRunRecord {
            id: "run-1".to_string(),
            created_at_ms: 1,
            task_direction_id: "direction-1".to_string(),
            task_direction_title: "Mock adapter".to_string(),
            trigger_kind: "manual-request".to_string(),
            idempotency_key: "manual:direction-1:1:1".to_string(),
            schedule_frequency: "manual".to_string(),
            online_enabled: false,
            output_template: "auto".to_string(),
            push_enabled: false,
            push_channels: Vec::new(),
            lifecycle_state: "approved".to_string(),
            approval_state: "approved".to_string(),
            execution_state: "approved-not-started".to_string(),
            detail: "approved".to_string(),
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

    fn temp_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("synapse-{name}-{}.json", store::now_millis()))
    }

    #[test]
    fn converts_remove_snapshot_to_reversible_create_payload() {
        let payload =
            custom_tool_create_snapshot_payload_from_remove_snapshot(&serde_json::json!({
                "operation": "remove",
                "record": {
                    "id": "local-script",
                    "label": "Local script",
                    "category": "script",
                    "invocation_mode": "deep",
                    "risk_level": "high",
                    "ingestion_policy": "review-before-memory",
                    "capabilities": ["script"],
                    "command_candidates": ["local-script.cmd"]
                }
            }))
            .unwrap();

        assert_eq!(payload["operation"], "create");
        assert_eq!(payload["draft"]["id"], "local-script");
        assert_eq!(
            payload["draft"]["command_candidates"][0],
            "local-script.cmd"
        );
    }

    #[test]
    fn rejects_remove_snapshot_without_record() {
        let error = custom_tool_create_snapshot_payload_from_remove_snapshot(&serde_json::json!({
            "operation": "remove"
        }))
        .unwrap_err();

        assert_eq!(error, "Custom tool remove snapshot is missing record.");
    }

    #[test]
    fn inserts_custom_tool_record_and_rejects_duplicate_id() {
        let record = CustomToolRecord {
            id: "local-script".to_string(),
            label: "Local script".to_string(),
            category: "script".to_string(),
            invocation_mode: "deep".to_string(),
            risk_level: "high".to_string(),
            ingestion_policy: "review-before-memory".to_string(),
            capabilities: Vec::new(),
            command_candidates: vec!["local-script.cmd".to_string()],
        };
        let mut records = Vec::new();

        insert_custom_tool_record(&mut records, record.clone()).unwrap();
        let error = insert_custom_tool_record(&mut records, record).unwrap_err();

        assert_eq!(records.len(), 1);
        assert_eq!(records[0].id, "local-script");
        assert!(error.contains("Existing tools are never overwritten automatically"));
    }
}
