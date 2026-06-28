use crate::{arsenal, store};

pub fn preview_registry() -> arsenal::ArsenalPreview {
    arsenal::default_preview()
}

pub fn preview_custom_tool_draft(
    draft: arsenal::CustomToolDraft,
) -> Result<arsenal::ToolDescriptor, String> {
    arsenal::preview_custom_tool_draft(draft)
}

pub fn save_custom_tool_draft(
    draft: arsenal::CustomToolDraft,
) -> Result<arsenal::ToolDescriptor, String> {
    let preview = arsenal::preview_custom_tool_draft(draft.clone())?;
    let saga = begin_service_saga(
        "save-custom-arsenal-tool",
        &preview.id,
        serde_json::json!({ "registry_source": preview.registry_source }),
    )?;
    store::create_snapshot(
        "arsenal-custom-tool".to_string(),
        preview.id.clone(),
        "before-custom-tool-save".to_string(),
        serde_json::json!({
            "operation": "create",
            "draft": draft.clone(),
        }),
    )
    .map_err(|error| {
        mark_service_saga_failed(&saga.id);
        format!("Custom Arsenal tool snapshot could not be created: {error}")
    })?;
    let tool = arsenal::save_custom_tool_draft(draft)?;
    super::audit_event::record_change(
        "save-custom-arsenal-tool",
        "arsenal-tool",
        &tool.id,
        "high",
        "blocked-by-default",
        serde_json::json!({
            "registry_source": tool.registry_source,
            "category": tool.category,
            "invocation_mode": tool.invocation_mode,
            "command_discovery": tool.discovery_state,
            "saga_id": saga.id,
        }),
        serde_json::json!({
            "allow_state": tool.allow_state,
            "ingestion_policy": tool.ingestion_policy,
            "saga_id": saga.id,
        }),
    )
    .map_err(|error| {
        mark_service_saga_failed(&saga.id);
        error
    })?;
    store::transition_saga(saga.id, "committed".to_string())
        .map_err(|error| format!("Saga could not be committed: {error}"))?;
    Ok(tool)
}

pub fn remove_custom_tool(tool_id: String) -> Result<arsenal::ToolDescriptor, String> {
    let tool_id = tool_id.trim().to_string();
    let saga = begin_service_saga(
        "remove-custom-arsenal-tool",
        &tool_id,
        serde_json::json!({ "requested_operation": "remove" }),
    )?;
    let snapshot_payload =
        arsenal::custom_tool_remove_snapshot_payload(&tool_id).map_err(|error| {
            mark_service_saga_failed(&saga.id);
            error
        })?;
    store::create_snapshot(
        "arsenal-custom-tool".to_string(),
        tool_id.clone(),
        "before-custom-tool-remove".to_string(),
        snapshot_payload,
    )
    .map_err(|error| {
        mark_service_saga_failed(&saga.id);
        format!("Custom Arsenal tool snapshot could not be created: {error}")
    })?;
    let tool = arsenal::remove_custom_tool(tool_id)?;
    super::audit_event::record_change(
        "remove-custom-arsenal-tool",
        "arsenal-tool",
        &tool.id,
        "high",
        "removed-from-registry",
        serde_json::json!({ "registry_source": tool.registry_source, "saga_id": saga.id }),
        serde_json::json!({ "allow_state": tool.allow_state, "saga_id": saga.id }),
    )
    .map_err(|error| {
        mark_service_saga_failed(&saga.id);
        error
    })?;
    store::transition_saga(saga.id, "committed".to_string())
        .map_err(|error| format!("Saga could not be committed: {error}"))?;
    Ok(tool)
}

pub fn set_tool_allow_state(
    tool_id: String,
    allow_state: String,
) -> Result<arsenal::ArsenalPreview, String> {
    let tool_id = tool_id.trim().to_string();
    let allow_state = allow_state.trim().to_ascii_lowercase();
    if tool_id.is_empty() {
        return Err("Arsenal tool id cannot be empty.".to_string());
    }
    if !matches!(allow_state.as_str(), "allowed" | "blocked") {
        return Err("Arsenal allow state must be allowed or blocked.".to_string());
    }
    let before = arsenal::default_preview()
        .tools
        .into_iter()
        .find(|tool| tool.id == tool_id)
        .ok_or_else(|| format!("Arsenal tool was not found: {tool_id}"))?;
    let saga = begin_service_saga(
        "set-arsenal-allow-state",
        &tool_id,
        serde_json::json!({ "allow_state": allow_state }),
    )?;
    store::create_snapshot(
        "arsenal-allow-state".to_string(),
        tool_id.clone(),
        "before-allow-state-change".to_string(),
        serde_json::json!({
            "tool": before,
            "requested_allow_state": allow_state,
        }),
    )
    .map_err(|error| {
        mark_service_saga_failed(&saga.id);
        format!("Arsenal allow-state snapshot could not be created: {error}")
    })?;
    let preview =
        arsenal::set_tool_allow_state(tool_id.clone(), allow_state.clone()).map_err(|error| {
            mark_service_saga_failed(&saga.id);
            format!("Arsenal allowlist could not be updated: {error}")
        })?;
    let audit_result = super::audit_event::record_change(
        "set-arsenal-allow-state",
        "arsenal-allow-state",
        &tool_id,
        "high",
        &allow_state,
        serde_json::json!({ "allow_state": allow_state }),
        serde_json::json!({
            "allowed_tools": preview.allowed_tools,
            "blocked_tools": preview.blocked_tools,
            "saga_id": saga.id,
        }),
    );
    if let Err(error) = audit_result {
        mark_service_saga_failed(&saga.id);
        return Err(error);
    }
    store::transition_saga(saga.id, "committed".to_string())
        .map_err(|error| format!("Saga could not be committed: {error}"))?;
    Ok(preview)
}

fn begin_service_saga(
    kind: &str,
    target_id: &str,
    metadata: serde_json::Value,
) -> Result<store::SagaTransaction, String> {
    store::begin_saga(kind.to_string(), target_id.to_string(), metadata)
        .map_err(|error| format!("Saga could not be started: {error}"))
}

fn mark_service_saga_failed(saga_id: &str) {
    let _ = store::transition_saga(saga_id.to_string(), "failed".to_string());
}

pub fn dry_run_mock(
    run_id: String,
    input: String,
) -> Result<arsenal::AdapterExecutionReceipt, String> {
    arsenal::dry_run_mock_adapter(run_id, input)
        .map_err(|error| format!("Mock adapter dry-run failed: {error}"))
}

pub fn execute_mock(
    run_id: String,
    input: String,
    approved: bool,
) -> Result<arsenal::AdapterExecutionReceipt, String> {
    arsenal::execute_mock_adapter(run_id, input, approved)
        .map_err(|error| format!("Mock adapter execution failed: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_tool_id_before_snapshot() {
        let error = set_tool_allow_state("  ".to_string(), "blocked".to_string()).unwrap_err();

        assert_eq!(error, "Arsenal tool id cannot be empty.");
    }

    #[test]
    fn rejects_unknown_allow_state_before_snapshot() {
        let error = set_tool_allow_state("mock-cli".to_string(), "maybe".to_string()).unwrap_err();

        assert_eq!(error, "Arsenal allow state must be allowed or blocked.");
    }

    #[test]
    fn rejects_custom_tool_draft_without_command_candidate() {
        let error = preview_custom_tool_draft(arsenal::CustomToolDraft {
            id: "local-script".to_string(),
            label: "Local script".to_string(),
            category: "script".to_string(),
            invocation_mode: "deep".to_string(),
            risk_level: "high".to_string(),
            ingestion_policy: "review-before-memory".to_string(),
            capabilities: Vec::new(),
            command_candidates: Vec::new(),
        })
        .unwrap_err();

        assert_eq!(error, "Custom tool needs at least one command candidate.");
    }
}
