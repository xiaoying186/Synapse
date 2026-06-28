//! Synapse v5.0 kernel module root.

use serde::Serialize;
use serde_json::json;

pub mod aggregation;
pub mod arsenal;
pub mod audit;
pub mod config;
pub mod context;
pub mod domains;
pub mod drivers;
pub mod execution;
pub mod executor_contract;
pub mod http_source;
pub mod kernel;
pub mod policy;
pub mod rules;
pub mod scheduler;
pub mod services;
pub mod store;
pub mod synthesis;
pub mod traits;
pub mod zhishu;

#[derive(Debug, Serialize)]
pub(crate) struct SystemStatus {
    app_name: String,
    instance_id: String,
    mode: String,
    execution_level: String,
    failure_strategy: String,
    memory_scopes: [&'static str; 3],
    sandbox: String,
    max_steps: usize,
    step_timeout_seconds: u64,
    mode_lock_auto: bool,
    config_warnings: Vec<String>,
    capabilities: Vec<CapabilityStatus>,
    scheduler_status: scheduler::SchedulerStatus,
}

#[derive(Debug, Serialize)]
pub(crate) struct CapabilityStatus {
    name: String,
    state: String,
    detail: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct PlanPreview {
    intent: String,
    risk: String,
    steps: Vec<String>,
    constraints: serde_json::Value,
    context_refs: Vec<String>,
    audit_required: bool,
    route: String,
    audit_report: audit::AuditReport,
    execution_preview: execution::ExecutionPreview,
    policy_preview: policy::PolicyPreview,
    driver_receipt: traits::DriverReceipt,
}

#[derive(Debug, Serialize)]
pub(crate) struct ReviewReceipt {
    status: String,
    decision: String,
    execution_state: String,
    detail: String,
    execution_queue_id: Option<String>,
}

#[tauri::command]
fn preview_information_aggregation(
    query: String,
    online_enabled: bool,
) -> Result<aggregation::AggregationPreview, String> {
    services::aggregation::preview_information(query, online_enabled)
}

#[tauri::command]
fn preview_context_budget(
    request: domains::context_budget::ContextBudgetRequest,
) -> Result<domains::context_budget::ContextBudgetPreview, String> {
    domains::context_budget::preview(request)
        .map_err(|error| format!("Context budget preview failed: {error}"))
}

#[tauri::command]
fn preview_library_home() -> Result<domains::library_home::LibraryHomePreview, String> {
    domains::library_home::preview()
        .map_err(|error| format!("Library home preview failed: {error}"))
}

#[tauri::command]
fn preview_production_readiness(
) -> Result<domains::production_readiness::ProductionReadinessPreview, String> {
    domains::production_readiness::preview()
        .map_err(|error| format!("Production readiness preview failed: {error}"))
}

#[tauri::command]
fn preview_saga_recovery() -> Result<domains::saga_recovery::SagaRecoveryPreview, String> {
    domains::saga_recovery::preview()
        .map_err(|error| format!("Saga recovery preview failed: {error}"))
}

#[tauri::command]
fn record_saga_recovery_review(
    request: domains::saga_recovery::SagaRecoveryReviewRequest,
) -> Result<domains::saga_recovery::SagaRecoveryReviewReceipt, String> {
    domains::saga_recovery::record_review(request)
        .map_err(|error| format!("Saga recovery review could not be recorded: {error}"))
}

#[tauri::command]
fn get_source_observation_history(
    source_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<store::SourceObservationRecord>, String> {
    services::aggregation::observation_history(source_id, limit)
}

#[tauri::command]
fn get_source_health_report(
    limit: Option<usize>,
) -> Result<services::aggregation::SourceHealthReport, String> {
    services::aggregation::source_health_report(limit)
}

#[tauri::command]
fn import_source_observations(
    format: String,
    content: String,
) -> Result<aggregation::SourceImportReceipt, String> {
    services::aggregation::import_observations(format, content)
}

#[tauri::command]
fn fetch_configured_http_source() -> Result<http_source::HttpSourceReceipt, String> {
    services::aggregation::fetch_http_source()
}

#[tauri::command]
fn preview_arsenal_registry() -> arsenal::ArsenalPreview {
    services::arsenal::preview_registry()
}

#[tauri::command]
fn preview_custom_arsenal_tool(
    draft: arsenal::CustomToolDraft,
) -> Result<arsenal::ToolDescriptor, String> {
    services::arsenal::preview_custom_tool_draft(draft)
}

#[tauri::command]
fn save_custom_arsenal_tool(
    draft: arsenal::CustomToolDraft,
) -> Result<arsenal::ToolDescriptor, String> {
    services::arsenal::save_custom_tool_draft(draft)
}

#[tauri::command]
fn remove_custom_arsenal_tool(tool_id: String) -> Result<arsenal::ToolDescriptor, String> {
    services::arsenal::remove_custom_tool(tool_id)
}

#[tauri::command]
fn preview_executor_contract() -> Result<executor_contract::ExecutorContractPreview, String> {
    services::executor_contract::preview()
}

#[tauri::command]
fn set_arsenal_tool_allow_state(
    tool_id: String,
    allow_state: String,
) -> Result<arsenal::ArsenalPreview, String> {
    services::arsenal::set_tool_allow_state(tool_id, allow_state)
}

#[tauri::command]
fn dry_run_mock_adapter(
    run_id: String,
    input: String,
) -> Result<arsenal::AdapterExecutionReceipt, String> {
    services::arsenal::dry_run_mock(run_id, input)
}

#[tauri::command]
fn execute_mock_adapter(
    run_id: String,
    input: String,
    approved: bool,
) -> Result<arsenal::AdapterExecutionReceipt, String> {
    services::arsenal::execute_mock(run_id, input, approved)
}

#[tauri::command]
fn preview_synthesis() -> Result<synthesis::SynthesisPreview, String> {
    services::synthesis::preview()
}

#[tauri::command]
fn promote_synthesis_candidate(
    candidate_id: String,
    candidate_kind: String,
) -> Result<synthesis::SynthesisPromotionReceipt, String> {
    services::synthesis::promote_candidate(candidate_id, candidate_kind)
}

#[tauri::command]
fn get_system_status() -> SystemStatus {
    services::system::status()
}

#[tauri::command]
fn get_scheduler_state() -> Result<store::SchedulerPersistentState, String> {
    services::scheduler::state()
}

#[tauri::command]
fn acquire_scheduler_lease() -> Result<store::SchedulerPersistentState, String> {
    services::scheduler::acquire()
}

#[tauri::command]
fn heartbeat_scheduler_lease() -> Result<store::SchedulerPersistentState, String> {
    services::scheduler::heartbeat()
}

#[tauri::command]
fn release_scheduler_lease() -> Result<store::SchedulerPersistentState, String> {
    services::scheduler::release()
}

#[tauri::command]
fn submit_intent(intent: String) -> Result<PlanPreview, String> {
    services::planning::submit_intent(intent)
}

#[tauri::command]
fn get_recent_plans() -> Result<Vec<store::PlanRecord>, String> {
    services::history::recent_plans()
}

#[tauri::command]
fn get_audit_events(
    target_type: Option<String>,
    target_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<store::AuditEvent>, String> {
    services::audit_event::list(target_type, target_id, limit)
}

#[tauri::command]
fn create_object_snapshot(
    object_type: String,
    object_id: String,
    reason: String,
    payload: serde_json::Value,
) -> Result<store::SnapshotRecord, String> {
    services::snapshot::create(object_type, object_id, reason, payload)
}

#[tauri::command]
fn get_object_snapshots(
    object_type: Option<String>,
    object_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<store::SnapshotRecord>, String> {
    services::snapshot::list(object_type, object_id, limit)
}

#[tauri::command]
fn rollback_protected_snapshot(
    snapshot_id: String,
) -> Result<services::snapshot::ProtectedSnapshotRollbackReceipt, String> {
    services::snapshot::rollback_protected(snapshot_id)
}

#[tauri::command]
fn capture_inspiration(content: String, tags: Vec<String>) -> Result<store::MemoryItem, String> {
    services::memory::capture_inspiration(content, tags)
}

#[tauri::command]
fn capture_experience(
    content: String,
    tags: Vec<String>,
    experience_type: String,
) -> Result<store::MemoryItem, String> {
    services::memory::capture_experience(content, tags, experience_type)
}

#[tauri::command]
fn capture_zhishu_item(
    content: String,
    tags: Vec<String>,
    item_kind: String,
) -> Result<store::MemoryItem, String> {
    services::memory::capture_zhishu_item(content, tags, item_kind)
}

#[tauri::command]
fn get_recent_memory_items() -> Result<Vec<store::MemoryItem>, String> {
    services::memory::recent_items()
}

#[tauri::command]
fn search_zhishu(query: zhishu::ZhishuSearchQuery) -> Result<zhishu::ZhishuSearchResponse, String> {
    services::zhishu::search(query)
}

#[tauri::command]
fn generate_zhishu_relations(
    query: zhishu::ZhishuSearchQuery,
) -> Result<Vec<store::ZhishuRelationRecord>, String> {
    services::zhishu::generate_relations(query)
}

#[tauri::command]
fn get_zhishu_relations() -> Result<Vec<store::ZhishuRelationRecord>, String> {
    services::zhishu::relations()
}

#[tauri::command]
fn review_zhishu_relation(
    relation_id: String,
    decision: String,
) -> Result<store::ZhishuRelationRecord, String> {
    services::zhishu::review_relation(relation_id, decision)
}

#[tauri::command]
fn scan_zhishu_maintenance(
    stale_days: Option<u64>,
) -> Result<Vec<store::ZhishuMaintenanceFinding>, String> {
    services::zhishu::scan_maintenance(stale_days)
}

#[tauri::command]
fn get_zhishu_maintenance_findings() -> Result<Vec<store::ZhishuMaintenanceFinding>, String> {
    services::zhishu::maintenance_findings()
}

#[tauri::command]
fn review_zhishu_maintenance_finding(
    finding_id: String,
    decision: String,
) -> Result<store::ZhishuMaintenanceFinding, String> {
    services::zhishu::review_maintenance_finding(finding_id, decision)
}

#[tauri::command]
fn export_zhishu_repository() -> Result<store::ZhishuRepositoryBundle, String> {
    services::zhishu::export_repository()
}

#[tauri::command]
fn import_zhishu_repository(raw: String) -> Result<store::ZhishuRepositoryImportReceipt, String> {
    services::zhishu::import_repository(raw)
}

#[tauri::command]
fn preview_daily_briefing(
    template: domains::daily_briefing::DailyBriefingTemplate,
) -> Result<domains::daily_briefing::DailyBriefingPreview, String> {
    domains::daily_briefing::preview(template)
        .map_err(|error| format!("Daily briefing preview failed: {error}"))
}

#[tauri::command]
fn archive_daily_briefing(
    run_id: String,
    template: domains::daily_briefing::DailyBriefingTemplate,
) -> Result<domains::daily_briefing::DailyBriefingArchiveReceipt, String> {
    let receipt = domains::daily_briefing::archive(run_id.clone(), template)
        .map_err(|error| format!("Daily briefing archival failed: {error}"))?;
    services::audit_event::record_change(
        "archive-daily-briefing",
        "task-run",
        &run_id,
        "medium",
        &receipt.run.lifecycle_state,
        serde_json::json!({ "artifact_type": "daily-briefing" }),
        serde_json::json!({
            "artifact_id": receipt.artifact.id,
            "confidence_score": receipt.preview.aggregation.confidence.score,
            "lifecycle_state": receipt.run.lifecycle_state,
        }),
    )?;
    Ok(receipt)
}

#[tauri::command]
fn preview_computer_diagnostics() -> domains::computer_diagnostics::ComputerDiagnosticReport {
    domains::computer_diagnostics::preview()
}

#[tauri::command]
fn preview_web_app_shell() -> domains::web_app_shell::WebAppShellPreview {
    domains::web_app_shell::preview()
}

#[tauri::command]
fn preview_codebase_memory_adapter() -> domains::codebase_memory::CodebaseMemoryPreview {
    domains::codebase_memory::preview()
}

#[tauri::command]
fn preview_permission_memory() -> domains::permission_memory::PermissionMemoryPreview {
    domains::permission_memory::preview()
}

#[tauri::command]
fn archive_computer_diagnostics(
    run_id: String,
) -> Result<domains::computer_diagnostics::ComputerDiagnosticArchiveReceipt, String> {
    let receipt = domains::computer_diagnostics::archive(run_id.clone())
        .map_err(|error| format!("Computer diagnostic archival failed: {error}"))?;
    services::audit_event::record_change(
        "archive-computer-diagnostic",
        "task-run",
        &run_id,
        "low",
        &receipt.run.lifecycle_state,
        serde_json::json!({ "mode": "read-only" }),
        serde_json::json!({
            "artifact_id": receipt.artifact.id,
            "overall_state": receipt.report.overall_state,
            "lifecycle_state": receipt.run.lifecycle_state,
        }),
    )?;
    Ok(receipt)
}

#[tauri::command]
fn preview_quant_research(
    csv: String,
    config: domains::quant_lab::StrategyConfig,
) -> Result<domains::quant_lab::QuantResearchReport, String> {
    domains::quant_lab::research(csv, config)
        .map_err(|error| format!("Quant research failed: {error}"))
}

#[tauri::command]
fn archive_quant_research(
    run_id: String,
    csv: String,
    config: domains::quant_lab::StrategyConfig,
) -> Result<domains::quant_lab::QuantArchiveReceipt, String> {
    let receipt = domains::quant_lab::archive(run_id.clone(), csv, config)
        .map_err(|error| format!("Quant research archival failed: {error}"))?;
    services::audit_event::record_change(
        "archive-quant-research",
        "task-run",
        &run_id,
        "medium",
        &receipt.run.lifecycle_state,
        serde_json::json!({ "mode": "research-simulation" }),
        serde_json::json!({
            "artifact_id": receipt.artifact.id,
            "strategy_version": receipt.report.strategy_version,
            "sample_count": receipt.report.sample_count,
            "lifecycle_state": receipt.run.lifecycle_state,
        }),
    )?;
    Ok(receipt)
}

#[tauri::command]
fn dry_run_agent_harness(
    request: domains::agent_harness::AgentDryRunRequest,
) -> Result<domains::agent_harness::AgentDryRunReceipt, String> {
    domains::agent_harness::dry_run(request)
        .map_err(|error| format!("Agent Harness dry-run failed: {error}"))
}

#[tauri::command]
fn execute_codex_agent(
    request: domains::agent_harness::AgentDryRunRequest,
    approved: bool,
) -> Result<domains::agent_harness::AgentExecutionReceipt, String> {
    let run_id = request.run_id.clone();
    let mode = request.mode.clone();
    let receipt = match domains::agent_harness::execute_codex(request, approved) {
        Ok(receipt) => receipt,
        Err(error) => {
            services::audit_event::record_change(
                "execute-codex-agent",
                "task-run",
                &run_id,
                "high",
                "failed",
                serde_json::json!({
                    "approved": approved,
                    "mode": mode,
                    "sandbox": "read-only",
                }),
                serde_json::json!({
                    "error": store::short_text(&error.to_string(), 300),
                    "artifact_created": false,
                }),
            )?;
            return Err(format!("Codex Agent execution failed: {error}"));
        }
    };
    services::audit_event::record_change(
        "execute-codex-agent",
        "task-run",
        &run_id,
        "high",
        &receipt.state,
        serde_json::json!({
            "approved": approved,
            "mode": receipt.dry_run.mode,
            "sandbox": "read-only",
        }),
        serde_json::json!({
            "artifact_id": receipt.artifact.id,
            "exit_code": receipt.exit_code,
            "output_truncated": receipt.output_truncated,
            "lifecycle_state": receipt.run.lifecycle_state,
        }),
    )?;
    Ok(receipt)
}

#[tauri::command]
fn preview_browser_inspection(
    request: domains::browser_automation::BrowserInspectionRequest,
) -> Result<domains::browser_automation::BrowserInspectionPreview, String> {
    let preview = domains::browser_automation::preview(request)
        .map_err(|error| format!("Browser inspection preview failed: {error}"))?;
    services::audit_event::record_change(
        "preview-browser-inspection",
        "task-run",
        &preview.run_id,
        "high",
        &preview.state,
        serde_json::json!({
            "host": preview.host,
            "capture_screenshot": preview.capture_screenshot,
        }),
        serde_json::json!({
            "browser_discovery_state": preview.browser_discovery_state,
            "browser_allow_state": preview.browser_allow_state,
            "python_discovery_state": preview.python_discovery_state,
            "python_allow_state": preview.python_allow_state,
            "process_started": false,
        }),
    )?;
    Ok(preview)
}

#[tauri::command]
fn execute_browser_inspection(
    request: domains::browser_automation::BrowserInspectionRequest,
    approved: bool,
) -> Result<domains::browser_automation::BrowserInspectionReceipt, String> {
    let run_id = request.run_id.clone();
    let receipt = match domains::browser_automation::inspect(request, approved) {
        Ok(receipt) => receipt,
        Err(error) => {
            services::audit_event::record_change(
                "execute-browser-inspection",
                "task-run",
                &run_id,
                "high",
                "failed",
                serde_json::json!({ "approved": approved }),
                serde_json::json!({
                    "error": store::short_text(&error.to_string(), 300),
                    "artifact_created": false,
                }),
            )?;
            return Err(format!("Browser inspection failed: {error}"));
        }
    };
    services::audit_event::record_change(
        "execute-browser-inspection",
        "task-run",
        &run_id,
        "high",
        "completed-output-quarantined",
        serde_json::json!({ "approved": approved }),
        serde_json::json!({
            "artifact_id": receipt.artifact.id,
            "final_url": receipt.result.final_url,
            "status": receipt.result.status,
            "lifecycle_state": receipt.run.lifecycle_state,
        }),
    )?;
    Ok(receipt)
}

#[tauri::command]
fn preview_agent_team(
    request: domains::agent_team::AgentTeamRequest,
) -> Result<domains::agent_team::AgentTeamPreview, String> {
    let preview = domains::agent_team::preview(request)
        .map_err(|error| format!("Agent team preview failed: {error}"))?;
    services::audit_event::record_change(
        "preview-agent-team",
        "task-run",
        &preview.run_id,
        "high",
        &preview.state,
        serde_json::json!({
            "team_mode": preview.team_mode,
            "context_mode": preview.context_mode,
            "max_rounds": preview.max_rounds,
        }),
        serde_json::json!({
            "participant_count": preview.participants.len(),
            "estimated_agent_calls": preview.estimated_agent_calls,
            "process_started": false,
        }),
    )?;
    Ok(preview)
}

#[tauri::command]
fn get_local_apps() -> Result<Vec<domains::local_app_bridge::LocalAppDescriptor>, String> {
    domains::local_app_bridge::list_apps()
        .map_err(|error| format!("Local apps are unavailable: {error}"))
}

#[tauri::command]
fn set_local_app_allow_state(
    app_id: String,
    allow_state: String,
) -> Result<Vec<domains::local_app_bridge::LocalAppDescriptor>, String> {
    let records =
        domains::local_app_bridge::set_app_allow_state(app_id.clone(), allow_state.clone())
            .map_err(|error| format!("Local app allow state could not be updated: {error}"))?;
    services::audit_event::record_change(
        "set-local-app-allow-state",
        "local-app",
        &app_id,
        "high",
        &allow_state,
        serde_json::json!({ "allow_state": allow_state }),
        serde_json::json!({ "configured_apps": records.len() }),
    )?;
    Ok(records)
}

#[tauri::command]
fn preview_local_app_launch(
    request: domains::local_app_bridge::LocalAppLaunchRequest,
) -> Result<domains::local_app_bridge::LocalAppLaunchPreview, String> {
    let preview = domains::local_app_bridge::preview(request)
        .map_err(|error| format!("Local app launch preview failed: {error}"))?;
    services::audit_event::record_change(
        "preview-local-app-launch",
        "local-app",
        &preview.app.id,
        "high",
        &preview.state,
        serde_json::json!({ "run_id": preview.run_id }),
        serde_json::json!({
            "bridge_discovery_state": preview.bridge_discovery_state,
            "bridge_allow_state": preview.bridge_allow_state,
            "app_allow_state": preview.app.allow_state,
            "process_started": false,
        }),
    )?;
    Ok(preview)
}

#[tauri::command]
fn execute_local_app_launch(
    request: domains::local_app_bridge::LocalAppLaunchRequest,
    approved: bool,
) -> Result<domains::local_app_bridge::LocalAppLaunchReceipt, String> {
    let app_id = request.app_id.clone();
    let run_id = request.run_id.clone();
    let receipt = match domains::local_app_bridge::launch(request, approved) {
        Ok(receipt) => receipt,
        Err(error) => {
            services::audit_event::record_change(
                "execute-local-app-launch",
                "local-app",
                &app_id,
                "high",
                "failed",
                serde_json::json!({ "run_id": run_id, "approved": approved }),
                serde_json::json!({
                    "error": store::short_text(&error.to_string(), 300),
                    "process_started": false,
                }),
            )?;
            return Err(format!("Local app launch failed: {error}"));
        }
    };
    services::audit_event::record_change(
        "execute-local-app-launch",
        "local-app",
        &app_id,
        "high",
        &receipt.state,
        serde_json::json!({ "run_id": run_id, "approved": approved }),
        serde_json::json!({
            "artifact_id": receipt.artifact.id,
            "process_id": receipt.process_id,
            "task_run_completed": false,
        }),
    )?;
    Ok(receipt)
}

#[tauri::command]
fn preview_notification(
    request: domains::notification_gateway::NotificationRequest,
) -> Result<domains::notification_gateway::NotificationPreview, String> {
    let preview = domains::notification_gateway::preview(request)
        .map_err(|error| format!("Notification preview failed: {error}"))?;
    services::audit_event::record_change(
        "preview-notification",
        "task-run",
        &preview.run_id,
        "high",
        &preview.state,
        serde_json::json!({
            "channel": preview.channel,
            "subject": preview.subject,
            "body_chars": preview.body_chars,
        }),
        serde_json::json!({
            "endpoint_configured": preview.endpoint_configured,
            "credentials_present": preview.credentials_present,
            "delivery_started": false,
        }),
    )?;
    Ok(preview)
}

#[tauri::command]
fn execute_email_notification(
    request: domains::notification_gateway::NotificationRequest,
    approved: bool,
) -> Result<domains::notification_gateway::NotificationReceipt, String> {
    let run_id = request.run_id.clone();
    let receipt = match domains::notification_gateway::deliver_email(request, approved) {
        Ok(receipt) => receipt,
        Err(error) => {
            services::audit_event::record_change(
                "execute-email-notification",
                "task-run",
                &run_id,
                "high",
                "failed",
                serde_json::json!({ "approved": approved, "channel": "email" }),
                serde_json::json!({
                    "error": store::short_text(&error.to_string(), 300),
                    "credentials_persisted": false,
                    "artifact_created": false,
                }),
            )?;
            return Err(format!("Email notification failed: {error}"));
        }
    };
    services::audit_event::record_change(
        "execute-email-notification",
        "task-run",
        &run_id,
        "high",
        &receipt.state,
        serde_json::json!({ "approved": approved, "channel": "email" }),
        serde_json::json!({
            "artifact_id": receipt.artifact.id,
            "server_response": receipt.server_response,
            "credentials_persisted": false,
            "task_run_completed": false,
        }),
    )?;
    Ok(receipt)
}

#[tauri::command]
fn get_device_sync_state() -> Result<domains::device_sync::DeviceSyncState, String> {
    domains::device_sync::state()
        .map_err(|error| format!("Device sync state is unavailable: {error}"))
}

#[tauri::command]
fn export_device_sync_package() -> Result<domains::device_sync::DeviceSyncPackage, String> {
    let package = domains::device_sync::export_package()
        .map_err(|error| format!("Device sync export failed: {error}"))?;
    services::audit_event::record_change(
        "export-device-sync-package",
        "device-sync",
        &package.source_device_id,
        "medium",
        "exported",
        serde_json::json!({
            "package_id": package.package_id,
            "base_hash": package.base_hash,
        }),
        serde_json::json!({
            "content_hash": package.content_hash,
            "memory_items": package.zhishu.memory_items.len(),
            "relations": package.zhishu.relations.len(),
            "maintenance_findings": package.zhishu.maintenance_findings.len(),
        }),
    )?;
    Ok(package)
}

#[tauri::command]
fn preview_device_sync_import(
    raw: String,
) -> Result<domains::device_sync::DeviceSyncImportPreview, String> {
    let preview = domains::device_sync::preview_import(raw)
        .map_err(|error| format!("Device sync import preview failed: {error}"))?;
    services::audit_event::record_change(
        "preview-device-sync-import",
        "device-sync",
        &preview.local_device_id,
        "medium",
        &preview.state,
        serde_json::json!({
            "package_id": preview.package_id,
            "source_device_id": preview.source_device_id,
        }),
        serde_json::json!({
            "can_import": preview.can_import,
            "requires_explicit_replace": preview.requires_explicit_replace,
            "incoming_hash": preview.incoming_hash,
        }),
    )?;
    Ok(preview)
}

#[tauri::command]
fn import_device_sync_package(
    raw: String,
    allow_replace: bool,
) -> Result<domains::device_sync::DeviceSyncImportReceipt, String> {
    let receipt = match domains::device_sync::import_package(raw, allow_replace) {
        Ok(receipt) => receipt,
        Err(error) => {
            services::audit_event::record_change(
                "import-device-sync-package",
                "device-sync",
                "local",
                "medium",
                "failed",
                serde_json::json!({ "allow_replace": allow_replace }),
                serde_json::json!({
                    "error": store::short_text(&error.to_string(), 300),
                    "imported": false,
                }),
            )?;
            return Err(format!("Device sync import failed: {error}"));
        }
    };
    services::audit_event::record_change(
        "import-device-sync-package",
        "device-sync",
        &receipt.state.device_id,
        "medium",
        &receipt.preview.state,
        serde_json::json!({
            "allow_replace": allow_replace,
            "package_id": receipt.preview.package_id,
        }),
        serde_json::json!({
            "memory_items": receipt.imported.memory_items,
            "relations": receipt.imported.relations,
            "maintenance_findings": receipt.imported.maintenance_findings,
            "last_synced_hash": receipt.state.last_synced_hash,
        }),
    )?;
    Ok(receipt)
}

#[tauri::command]
fn preview_sync_relay() -> domains::device_sync::RelayPreview {
    domains::device_sync::relay_preview()
}

#[tauri::command]
fn review_memory_item(memory_id: String, decision: String) -> Result<store::MemoryItem, String> {
    services::memory::review_item(memory_id, decision)
}

#[tauri::command]
fn rollback_zhishu_snapshot(snapshot_id: String) -> Result<store::MemoryRollbackReceipt, String> {
    services::memory::rollback_snapshot(snapshot_id)
}

#[tauri::command]
fn save_task_direction(
    title: String,
    description: String,
    priority: u8,
    keywords: Vec<String>,
    schedule_frequency: String,
    online_enabled: bool,
    push_enabled: bool,
    push_channels: Vec<String>,
    output_template: String,
) -> Result<store::TaskDirection, String> {
    services::task_center::save_direction(
        title,
        description,
        priority,
        keywords,
        schedule_frequency,
        online_enabled,
        push_enabled,
        push_channels,
        output_template,
    )
}

#[tauri::command]
fn get_task_directions() -> Result<Vec<store::TaskDirection>, String> {
    services::task_center::directions()
}

#[tauri::command]
fn set_task_direction_active(
    direction_id: String,
    active: bool,
) -> Result<store::TaskDirection, String> {
    services::task_center::set_direction_active(direction_id, active)
}

#[tauri::command]
fn get_task_schedule_previews() -> Result<Vec<store::TaskSchedulePreview>, String> {
    services::task_center::schedule_previews()
}

#[tauri::command]
fn generate_task_candidates() -> Result<Vec<store::TaskCandidate>, String> {
    services::task_center::generate_candidates()
}

#[tauri::command]
fn get_task_candidates() -> Result<Vec<store::TaskCandidate>, String> {
    services::task_center::candidates()
}

#[tauri::command]
fn request_task_run(direction_id: String) -> Result<store::TaskRunRecord, String> {
    services::task_center::request_run(direction_id)
}

#[tauri::command]
fn get_task_run_records() -> Result<Vec<store::TaskRunRecord>, String> {
    services::task_center::run_records()
}

#[tauri::command]
fn get_task_artifacts(
    run_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<store::TaskArtifactRecord>, String> {
    services::task_center::artifacts(run_id, limit)
}

#[tauri::command]
fn promote_task_artifact_to_zhishu(
    artifact_id: String,
    item_kind: String,
) -> Result<services::task_center::ArtifactPromotionReceipt, String> {
    services::task_center::promote_artifact_to_zhishu(artifact_id, item_kind)
}

#[tauri::command]
fn review_task_run(run_id: String, approved: bool) -> Result<store::TaskRunRecord, String> {
    services::task_center::review_run(run_id, approved)
}

#[tauri::command]
fn cancel_task_run(run_id: String) -> Result<store::TaskRunRecord, String> {
    services::task_center::cancel_run(run_id)
}

#[tauri::command]
fn archive_task_run(run_id: String) -> Result<store::TaskRunRecord, String> {
    services::task_center::archive_run(run_id)
}

#[tauri::command]
fn task_scheduler_tick() -> Result<store::TaskSchedulerTick, String> {
    services::task_center::scheduler_tick()
}

#[tauri::command]
fn execute_task_run(run_id: String) -> Result<store::TaskRunExecutionReceipt, String> {
    services::task_center::execute_run(run_id)
}

#[tauri::command]
fn review_task_candidate(
    candidate_id: String,
    decision: String,
) -> Result<store::TaskCandidateReview, String> {
    services::task_center::review_candidate(candidate_id, decision)
}

#[tauri::command]
fn clear_plan_history() -> Result<(), String> {
    services::history::clear()
}

#[tauri::command]
fn review_plan(
    preview: serde_json::Value,
    approved: bool,
    plan_id: Option<String>,
) -> Result<ReviewReceipt, String> {
    services::review::review_plan(preview, approved, plan_id)
}

pub(crate) fn review_plan_preview(
    preview: &serde_json::Value,
    approved: bool,
) -> Result<ReviewReceipt, String> {
    let risk = preview
        .get("risk")
        .and_then(|value| value.as_str())
        .ok_or_else(|| "Plan preview is missing risk.".to_string())?;

    if !approved {
        return Ok(ReviewReceipt {
            status: "rejected".to_string(),
            decision: "audit rejected".to_string(),
            execution_state: "blocked".to_string(),
            detail: "The current plan remains blocked and no execution receipt is promoted."
                .to_string(),
            execution_queue_id: None,
        });
    }

    let policy_requires_review = preview_bool(preview, &["policy_preview", "requires_review"]);
    let policy_requires_explicit_approval =
        preview_bool(preview, &["policy_preview", "requires_explicit_approval"]);

    let (decision, execution_state, detail) = match risk {
        "destructive" => (
            "manual approval recorded",
            "guarded-execution-ready",
            "Destructive spans still require guarded execution, but the audit gate is cleared.",
        ),
        _ if policy_requires_explicit_approval => (
            "policy approval recorded",
            "policy-gated-execution-ready",
            "Policy-gated actions still require a future approved executor, but the review gate is cleared.",
        ),
        _ if policy_requires_review => (
            "policy review accepted",
            "reviewable-execution-ready",
            "Policy-gated read or planning actions can proceed through the selected driver route.",
        ),
        "medium" | "high" => (
            "audit accepted",
            "reviewable-execution-ready",
            "Reviewable spans can proceed through the selected driver route.",
        ),
        _ => (
            "audit not required",
            "direct-execution-ready",
            "Low-risk plans can proceed through the direct route.",
        ),
    };

    Ok(ReviewReceipt {
        status: "approved".to_string(),
        decision: decision.to_string(),
        execution_state: execution_state.to_string(),
        detail: detail.to_string(),
        execution_queue_id: None,
    })
}

fn preview_bool(preview: &serde_json::Value, path: &[&str]) -> bool {
    path.iter()
        .try_fold(preview, |value, key| value.get(*key))
        .and_then(|value| value.as_bool())
        .unwrap_or(false)
}

pub(crate) fn plan_preview_from_intent(
    config: config::RuntimeConfig,
    intent: String,
) -> Result<PlanPreview, String> {
    let trimmed = intent.trim().to_string();

    if trimmed.is_empty() {
        return Err("Intent cannot be empty.".to_string());
    }

    let risk = classify_risk(&trimmed);
    let mode = traits::Mode::from_config(&config.mode);
    let display_mode = config::display_mode(&config.mode);

    let ir = kernel::PlanIr {
        intent: trimmed.clone(),
        risk: risk.to_string(),
        proposed_steps: vec![
            "Capture user intent into Plan IR".to_string(),
            format!("Apply {display_mode} mode constraints"),
            format!("Route execution through {}", config.execution_level),
            "Hold raw context in L0 until audit promotion".to_string(),
        ],
        soft_constraints: json!({
            "failure_strategy": config.failure_strategy.clone(),
            "sandbox": config.sandbox.clone(),
            "source": "workbench"
        }),
    };

    let policy = rules::RulePolicy {
        mode: display_mode,
        execution_level: config.execution_level,
        failure_strategy: config.failure_strategy,
        sandbox: config.sandbox,
        max_steps: config.max_steps,
        step_timeout_seconds: config.step_timeout_seconds,
        mode_lock_auto: config.mode_lock_auto,
    };

    let mut plan = kernel::materialize(ir, policy);
    let policy_preview = policy::preview_for_plan(&plan);
    if policy_preview.requires_review {
        plan.audit_required = true;
    }

    let audit_report = audit::preview_for_plan(&plan);
    let execution_preview = execution::preview_for_plan(&plan);
    let driver_receipt = drivers::preview_for_mode(mode, &plan);
    let mut context_refs = plan
        .context_refs
        .iter()
        .map(|item| item.label())
        .collect::<Vec<_>>();
    context_refs.extend(matched_experience_refs(&trimmed));

    Ok(PlanPreview {
        intent: plan.intent,
        risk: plan.risk,
        steps: plan.steps,
        constraints: plan.constraints,
        context_refs,
        audit_required: plan.audit_required,
        route: plan.route,
        audit_report,
        execution_preview,
        policy_preview,
        driver_receipt,
    })
}

fn matched_experience_refs(intent: &str) -> Vec<String> {
    let Ok(items) = store::recent_memory_items(32) else {
        return Vec::new();
    };

    matched_experience_refs_from_items(intent, &items)
}

fn matched_experience_refs_from_items(intent: &str, items: &[store::MemoryItem]) -> Vec<String> {
    let intent = intent.trim().to_ascii_lowercase();
    if intent.is_empty() {
        return Vec::new();
    }

    let intent_terms = intent
        .split(|character: char| !character.is_alphanumeric())
        .filter(|term| term.len() >= 3)
        .collect::<Vec<_>>();

    items
        .iter()
        .filter(|item| is_experience_item(item))
        .filter(|item| experience_matches_intent(item, &intent, &intent_terms))
        .take(3)
        .map(|item| {
            format!(
                "{} {}: {}",
                experience_ref_label(&item.item_type),
                item.item_type,
                short_context_ref(&item.content, 72)
            )
        })
        .collect()
}

fn experience_ref_label(item_type: &str) -> &'static str {
    match item_type {
        "experience-failure" | "rule-deny" => "Avoidance",
        "experience-success" | "rule-allow" => "Success",
        _ => "Experience",
    }
}

fn is_experience_item(item: &store::MemoryItem) -> bool {
    if item.admission_state != "accepted" || item.source_trust != "reviewed-local" {
        return false;
    }

    matches!(
        item.item_type.as_str(),
        "experience-success" | "experience-failure" | "rule-allow" | "rule-deny"
    )
}

fn experience_matches_intent(
    item: &store::MemoryItem,
    intent: &str,
    intent_terms: &[&str],
) -> bool {
    item.tags
        .iter()
        .map(|tag| tag.to_ascii_lowercase())
        .filter(|tag| !tag.is_empty())
        .any(|tag| intent.contains(&tag))
        || intent_terms
            .iter()
            .any(|term| item.content.to_ascii_lowercase().contains(*term))
}

fn short_context_ref(value: &str, max_chars: usize) -> String {
    let mut shortened = value.trim().chars().take(max_chars).collect::<String>();
    if value.trim().chars().count() > max_chars {
        shortened.push_str("...");
    }
    shortened
}

fn classify_risk(intent: &str) -> &'static str {
    let lower = intent.to_ascii_lowercase();

    if [
        "delete",
        "remove",
        "destroy",
        "drop",
        "format",
        "\u{5220}\u{9664}",
        "\u{79fb}\u{9664}",
        "\u{9500}\u{6bc1}",
        "\u{6e05}\u{7a7a}",
        "\u{683c}\u{5f0f}\u{5316}",
    ]
    .iter()
    .any(|needle| lower.contains(needle))
    {
        "destructive"
    } else if [
        "write",
        "edit",
        "change",
        "move",
        "rename",
        "create",
        "update",
        "save",
        "\u{5199}\u{5165}",
        "\u{7f16}\u{8f91}",
        "\u{4fee}\u{6539}",
        "\u{79fb}\u{52a8}",
        "\u{91cd}\u{547d}\u{540d}",
        "\u{521b}\u{5efa}",
        "\u{66f4}\u{65b0}",
        "\u{4fdd}\u{5b58}",
    ]
    .iter()
    .any(|needle| lower.contains(needle))
    {
        "medium"
    } else {
        "low"
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::Manager;

    let config = config::read_runtime_config();
    let app = tauri::Builder::default()
        .manage(scheduler::SchedulerRuntime::start(&config))
        .invoke_handler(tauri::generate_handler![
            get_system_status,
            get_scheduler_state,
            acquire_scheduler_lease,
            heartbeat_scheduler_lease,
            release_scheduler_lease,
            preview_information_aggregation,
            preview_context_budget,
            preview_library_home,
            preview_production_readiness,
            preview_saga_recovery,
            record_saga_recovery_review,
            get_source_observation_history,
            get_source_health_report,
            import_source_observations,
            fetch_configured_http_source,
            preview_arsenal_registry,
            preview_custom_arsenal_tool,
            save_custom_arsenal_tool,
            remove_custom_arsenal_tool,
            preview_executor_contract,
            set_arsenal_tool_allow_state,
            dry_run_mock_adapter,
            execute_mock_adapter,
            preview_synthesis,
            promote_synthesis_candidate,
            submit_intent,
            get_recent_plans,
            get_audit_events,
            create_object_snapshot,
            get_object_snapshots,
            rollback_protected_snapshot,
            capture_inspiration,
            capture_experience,
            capture_zhishu_item,
            get_recent_memory_items,
            search_zhishu,
            generate_zhishu_relations,
            get_zhishu_relations,
            review_zhishu_relation,
            scan_zhishu_maintenance,
            get_zhishu_maintenance_findings,
            review_zhishu_maintenance_finding,
            export_zhishu_repository,
            import_zhishu_repository,
            preview_daily_briefing,
            archive_daily_briefing,
            preview_computer_diagnostics,
            preview_web_app_shell,
            preview_codebase_memory_adapter,
            preview_permission_memory,
            archive_computer_diagnostics,
            preview_quant_research,
            archive_quant_research,
            dry_run_agent_harness,
            execute_codex_agent,
            preview_browser_inspection,
            execute_browser_inspection,
            preview_agent_team,
            get_local_apps,
            set_local_app_allow_state,
            preview_local_app_launch,
            execute_local_app_launch,
            preview_notification,
            execute_email_notification,
            get_device_sync_state,
            export_device_sync_package,
            preview_device_sync_import,
            import_device_sync_package,
            preview_sync_relay,
            review_memory_item,
            rollback_zhishu_snapshot,
            save_task_direction,
            get_task_directions,
            set_task_direction_active,
            get_task_schedule_previews,
            generate_task_candidates,
            get_task_candidates,
            request_task_run,
            get_task_run_records,
            get_task_artifacts,
            promote_task_artifact_to_zhishu,
            review_task_run,
            cancel_task_run,
            archive_task_run,
            task_scheduler_tick,
            execute_task_run,
            review_task_candidate,
            clear_plan_history,
            review_plan
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if matches!(
            event,
            tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. }
        ) {
            app_handle.state::<scheduler::SchedulerRuntime>().stop();
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> config::RuntimeConfig {
        config::RuntimeConfig {
            app_name: "Synapse Test".to_string(),
            instance_id: "test-instance".to_string(),
            mode: "pro".to_string(),
            execution_level: "L1_REVIEW".to_string(),
            failure_strategy: "saga".to_string(),
            sandbox: "wasi".to_string(),
            max_steps: 2,
            step_timeout_seconds: 30,
            mode_lock_auto: false,
            scheduler_background_loop_enabled: false,
            scheduler_poll_interval_seconds: 30,
            aggregation_http_source_url: String::new(),
            browser_allowed_hosts: String::new(),
            smtp_host: String::new(),
            smtp_port: 587,
            smtp_from: String::new(),
            smtp_to: String::new(),
            feishu_webhook_url: String::new(),
            wechat_webhook_url: String::new(),
            external_delivery_enabled: false,
            agent_execution_enabled: false,
            relay_enabled: false,
            relay_endpoint: String::new(),
            warnings: Vec::new(),
        }
    }

    #[test]
    fn system_status_maps_runtime_config_for_ui() {
        let status = services::system::status_from_config(config());

        assert_eq!(status.app_name, "Synapse Test");
        assert_eq!(status.mode, "Pro");
        assert_eq!(status.execution_level, "L1_REVIEW");
        assert_eq!(
            status.memory_scopes,
            ["L0 Session", "L1 Working", "L2 Knowledge"]
        );
        assert_eq!(status.sandbox, "WASI");
        assert!(!status.mode_lock_auto);
        assert!(status.capabilities.iter().any(
            |capability| capability.name == "tool-execution" && capability.state == "disabled"
        ));
        assert!(status
            .capabilities
            .iter()
            .any(|capability| capability.name == "experience-reuse"
                && capability.state == "preview-only"));
        assert_eq!(status.scheduler_status.manual_tick_state, "available");
    }

    #[test]
    fn empty_intent_is_rejected_at_command_boundary() {
        let result = plan_preview_from_intent(config(), "   ".to_string());

        assert_eq!(result.unwrap_err(), "Intent cannot be empty.");
    }

    #[test]
    fn english_and_chinese_edit_intents_are_medium_risk() {
        let english = plan_preview_from_intent(config(), "edit config".to_string()).unwrap();
        let chinese =
            plan_preview_from_intent(config(), "\u{4fee}\u{6539}\u{914d}\u{7f6e}".to_string())
                .unwrap();

        assert_eq!(english.risk, "medium");
        assert_eq!(chinese.risk, "medium");
        assert!(chinese.audit_required);
    }

    #[test]
    fn destructive_chinese_intent_requires_manual_review() {
        let preview =
            plan_preview_from_intent(config(), "\u{5220}\u{9664}\u{7f13}\u{5b58}".to_string())
                .unwrap();

        assert_eq!(preview.risk, "destructive");
        assert_eq!(preview.audit_report.decision, "manual approval required");
        assert_eq!(
            preview.policy_preview.decision,
            "explicit-approval-required"
        );
        assert_eq!(preview.execution_preview.spans[1].status, "blocked");
        assert_eq!(preview.driver_receipt.status, "approval-required");
    }

    #[test]
    fn browser_agent_intent_is_policy_gated() {
        let preview =
            plan_preview_from_intent(config(), "browse web with codex agent".to_string()).unwrap();

        assert_eq!(preview.risk, "low");
        assert_eq!(preview.policy_preview.permission_level, "tool-review");
        assert!(preview.policy_preview.requires_explicit_approval);
        assert!(preview.audit_required);
        assert_eq!(preview.audit_report.decision, "policy review required");
    }

    #[test]
    fn review_accepts_policy_gated_plan() {
        let preview = serde_json::json!({
            "risk": "low",
            "policy_preview": {
                "requires_review": true,
                "requires_explicit_approval": true
            }
        });
        let receipt = review_plan_preview(&preview, true).unwrap();

        assert_eq!(receipt.status, "approved");
        assert_eq!(receipt.decision, "policy approval recorded");
        assert_eq!(receipt.execution_state, "policy-gated-execution-ready");
    }

    #[test]
    fn command_preview_applies_step_budget() {
        let preview = plan_preview_from_intent(config(), "update plan".to_string()).unwrap();

        assert_eq!(preview.steps.len(), 2);
        assert_eq!(preview.execution_preview.strategy, "saga");
        assert_eq!(preview.driver_receipt.mode, "Pro");
    }

    #[test]
    fn matches_experience_records_as_context_refs() {
        let items = vec![
            memory_item(
                "experience-success",
                "Use dry-run preview before cleanup.",
                vec!["cleanup"],
            ),
            memory_item(
                "rule-deny",
                "Do not delete caches without review.",
                vec!["cache"],
            ),
            rejected_memory_item("experience-failure", "Bad cleanup run.", vec!["cleanup"]),
        ];

        let refs = matched_experience_refs_from_items("cleanup cache safely", &items);

        assert_eq!(refs.len(), 2);
        assert!(refs[0].starts_with("Success"));
        assert!(refs[0].contains("experience-success"));
        assert!(refs[1].starts_with("Avoidance"));
        assert!(refs[1].contains("rule-deny"));
    }

    #[test]
    fn review_accepts_medium_risk_plan() {
        let preview = serde_json::json!({ "risk": "medium" });
        let receipt = review_plan_preview(&preview, true).unwrap();

        assert_eq!(receipt.status, "approved");
        assert_eq!(receipt.execution_state, "reviewable-execution-ready");
    }

    #[test]
    fn review_rejects_plan() {
        let preview = serde_json::json!({ "risk": "medium" });
        let receipt = review_plan_preview(&preview, false).unwrap();

        assert_eq!(receipt.status, "rejected");
        assert_eq!(receipt.execution_state, "blocked");
    }

    #[test]
    fn review_requires_risk_field() {
        let error = review_plan_preview(&serde_json::json!({}), true).unwrap_err();

        assert_eq!(error, "Plan preview is missing risk.");
    }

    #[test]
    fn rejects_empty_inspiration() {
        let error = capture_inspiration("  ".to_string(), Vec::new()).unwrap_err();

        assert_eq!(error, "Inspiration cannot be empty.");
    }

    #[test]
    fn rejects_empty_experience() {
        let error =
            capture_experience("  ".to_string(), Vec::new(), "success".to_string()).unwrap_err();

        assert_eq!(error, "Experience record cannot be empty.");
    }

    #[test]
    fn rejects_empty_zhishu_item() {
        let error =
            capture_zhishu_item("  ".to_string(), Vec::new(), "knowledge".to_string()).unwrap_err();

        assert_eq!(error, "Zhishu item cannot be empty.");
    }

    #[test]
    fn rejects_empty_memory_review_id() {
        let error = review_memory_item("  ".to_string(), "accepted".to_string()).unwrap_err();

        assert_eq!(error, "Memory item id cannot be empty.");
    }

    #[test]
    fn rejects_empty_task_direction_title() {
        let error = save_task_direction(
            "  ".to_string(),
            "desc".to_string(),
            3,
            Vec::new(),
            "manual".to_string(),
            false,
            false,
            Vec::new(),
            "auto".to_string(),
        )
        .unwrap_err();

        assert_eq!(error, "Task direction title cannot be empty.");
    }

    fn memory_item(item_type: &str, content: &str, tags: Vec<&str>) -> store::MemoryItem {
        store::MemoryItem {
            id: format!("memory-{item_type}"),
            created_at_ms: 1,
            hub_area: "memory".to_string(),
            scope: "L1 Working".to_string(),
            level: "reviewed-pattern".to_string(),
            item_type: item_type.to_string(),
            admission_state: "accepted".to_string(),
            admission_rule: "test".to_string(),
            source: "manual-experience".to_string(),
            provenance: "local-user-experience".to_string(),
            source_trust: "reviewed-local".to_string(),
            content: content.to_string(),
            tags: tags.into_iter().map(str::to_string).collect(),
            confidence: 0.7,
            verification: "review-accepted".to_string(),
            retention_policy: "working-review".to_string(),
            authority: "user-reviewable".to_string(),
            linked_memory_ids: Vec::new(),
            last_reinforced_at_ms: None,
            last_invalidated_at_ms: None,
        }
    }

    fn rejected_memory_item(item_type: &str, content: &str, tags: Vec<&str>) -> store::MemoryItem {
        store::MemoryItem {
            admission_state: "rejected".to_string(),
            source_trust: "unverified-local".to_string(),
            ..memory_item(item_type, content, tags)
        }
    }
}
