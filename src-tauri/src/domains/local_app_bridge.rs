use std::path::PathBuf;
use std::process::{Command, Stdio};

use serde::{Deserialize, Serialize};

use crate::{arsenal, store};

const LOCAL_APP_TOOL_ID: &str = "local-app-bridge";
const MAX_APPS: usize = 32;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalAppDescriptor {
    pub id: String,
    pub label: String,
    pub executable: String,
    pub allow_state: String,
    pub risk_level: String,
    pub session_policy: String,
    pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LocalAppLaunchRequest {
    pub app_id: String,
    pub run_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct LocalAppLaunchPreview {
    pub app: LocalAppDescriptor,
    pub run_id: String,
    pub state: String,
    pub bridge_discovery_state: String,
    pub bridge_allow_state: String,
    pub task_approval_state: String,
    pub argument_preview: Vec<String>,
    pub gates: Vec<String>,
    pub process_started: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct LocalAppLaunchReceipt {
    pub preview: LocalAppLaunchPreview,
    pub state: String,
    pub process_id: u32,
    pub artifact: store::TaskArtifactRecord,
    pub audit_event: store::AuditEvent,
}

#[derive(Debug, Clone, Serialize)]
pub struct LocalAppAllowStateReceipt {
    pub apps: Vec<LocalAppDescriptor>,
    pub changed_app: LocalAppDescriptor,
    pub snapshot: store::SnapshotRecord,
    pub audit_event: store::AuditEvent,
    pub saga: store::SagaTransaction,
}

#[derive(Debug, Clone, Serialize)]
pub struct LocalAppLaunchPreflight {
    pub generated_at_ms: u128,
    pub state: String,
    pub launch_state: String,
    pub app_id: String,
    pub run_id: String,
    pub process_started: bool,
    pub argument_count: usize,
    pub user_arguments_allowed: bool,
    pub credentials_read: bool,
    pub window_content_read: bool,
    pub requires_bridge_allowlist: bool,
    pub requires_app_allowlist: bool,
    pub requires_task_approval: bool,
    pub requires_explicit_launch_confirmation: bool,
    pub audit_required: bool,
    pub session_blind: bool,
    pub gates: Vec<String>,
    pub blockers: Vec<String>,
    pub denied_actions: Vec<String>,
}

pub fn list_apps() -> Result<Vec<LocalAppDescriptor>, store::StoreError> {
    let path = store::local_apps_path();
    let stored = store::read_json_records::<LocalAppDescriptor>(&path)?;
    let mut canonical = default_notepad();
    if let Some(existing) = stored.iter().find(|app| app.id == canonical.id) {
        canonical.allow_state = normalize_allow_state(&existing.allow_state)?.to_string();
    }
    let mut records = vec![canonical];
    records.truncate(MAX_APPS);
    store::write_json_records(&path, &records)?;
    Ok(records)
}

pub fn set_app_allow_state(
    app_id: String,
    allow_state: String,
) -> Result<LocalAppAllowStateReceipt, store::StoreError> {
    let app_id = required(app_id, "local app id")?;
    let allow_state = normalize_allow_state(&allow_state)?;
    let path = store::local_apps_path();
    let previous = list_apps()?;
    let mut records = previous.clone();
    let Some(app) = records.iter_mut().find(|app| app.id == app_id) else {
        return Err(store::StoreError::NotFound(app_id));
    };
    if !PathBuf::from(&app.executable).is_file() {
        return Err(store::StoreError::InvalidInput(
            "local app executable is unavailable".to_string(),
        ));
    }
    app.allow_state = allow_state.to_string();
    let changed_app = app.clone();
    let saga = store::begin_saga(
        "local-app-allow-state-review".to_string(),
        app_id.clone(),
        serde_json::json!({ "allow_state": allow_state }),
    )?;
    let snapshot = match store::create_snapshot(
        "local-app-allow-state".to_string(),
        app_id.clone(),
        "before-local-app-allow-state-review".to_string(),
        serde_json::json!({ "apps": previous, "saga_id": saga.id }),
    ) {
        Ok(snapshot) => snapshot,
        Err(error) => return fail_allow_state_saga(&saga, error),
    };
    let audit_event = finalize_allow_state_review(
        || store::write_json_records(&path, &records),
        || store::append_audit_event(store::NewAuditEvent {
            actor: "local-user".to_string(),
            action: "set-local-app-allow-state".to_string(),
            target_type: "local-app".to_string(),
            target_id: app_id.clone(),
            risk_level: "high".to_string(),
            decision: allow_state.to_string(),
            input: serde_json::json!({
                "allow_state": allow_state,
                "snapshot_id": snapshot.id,
                "saga_id": saga.id,
            }),
            result_summary: serde_json::json!({
                "configured_apps": records.len(),
                "rollback_snapshot_id": snapshot.id,
            }),
            error: None,
        }),
        || compensate_allow_state_review(&saga, &path, &previous),
    )?;
    let saga = match store::transition_saga(saga.id.clone(), "committed".to_string()) {
        Ok(saga) => saga,
        Err(error) => {
            return finish_allow_state_compensation(
                error,
                compensate_allow_state_review(&saga, &path, &previous),
            )
        }
    };
    Ok(LocalAppAllowStateReceipt { apps: records, changed_app, snapshot, audit_event, saga })
}

fn fail_allow_state_saga<T>(saga: &store::SagaTransaction, error: store::StoreError) -> Result<T, store::StoreError> {
    let _ = store::transition_saga(saga.id.clone(), "failed".to_string());
    Err(error)
}

fn finalize_allow_state_review<T, FWrite, FAudit, FCompensate>(write: FWrite, audit: FAudit, compensate: FCompensate) -> Result<T, store::StoreError>
where FWrite: FnOnce() -> Result<(), store::StoreError>, FAudit: FnOnce() -> Result<T, store::StoreError>, FCompensate: FnOnce() -> Result<(), store::StoreError> {
    if let Err(error) = write() { return finish_allow_state_compensation(error, compensate()); }
    match audit() { Ok(value) => Ok(value), Err(error) => finish_allow_state_compensation(error, compensate()) }
}

fn finish_allow_state_compensation<T>(original: store::StoreError, compensation: Result<(), store::StoreError>) -> Result<T, store::StoreError> {
    match compensation { Ok(()) => Err(original), Err(compensation_error) => Err(store::StoreError::InvalidInput(format!("local app allow-state review failed: {original}; compensation failed: {compensation_error}"))) }
}

fn compensate_allow_state_review(saga: &store::SagaTransaction, path: &std::path::Path, previous: &[LocalAppDescriptor]) -> Result<(), store::StoreError> {
    let _ = store::transition_saga(saga.id.clone(), "compensating".to_string());
    let result = store::write_json_records(path, previous);
    let state = if result.is_ok() { "compensated" } else { "failed" };
    let _ = store::transition_saga(saga.id.clone(), state.to_string());
    result
}

pub fn preview(request: LocalAppLaunchRequest) -> Result<LocalAppLaunchPreview, store::StoreError> {
    let app_id = required(request.app_id, "local app id")?;
    let run_id = required(request.run_id, "task run id")?;
    let app = list_apps()?
        .into_iter()
        .find(|app| app.id == app_id)
        .ok_or_else(|| store::StoreError::NotFound(app_id))?;
    let run = store::task_run_by_id(run_id)?;
    let bridge = arsenal::default_preview()
        .tools
        .into_iter()
        .find(|tool| tool.id == LOCAL_APP_TOOL_ID)
        .ok_or_else(|| {
            store::StoreError::InvalidInput("local app bridge is unavailable".to_string())
        })?;
    let state = readiness_state(&app, &bridge, &run);

    Ok(LocalAppLaunchPreview {
        argument_preview: vec![app.executable.clone()],
        app,
        run_id: run.id,
        state: state.to_string(),
        bridge_discovery_state: bridge.discovery_state,
        bridge_allow_state: bridge.allow_state,
        task_approval_state: run.approval_state,
        gates: vec![
            "built-in-or-reviewed-app-descriptor".to_string(),
            "bridge-tool-allowlisted".to_string(),
            "app-allowlisted".to_string(),
            "task-run-approved".to_string(),
            "explicit-launch-confirmation".to_string(),
            "argument-vector-only".to_string(),
            "no-user-supplied-executable".to_string(),
            "no-credential-or-session-extraction".to_string(),
            "no-window-content-reading".to_string(),
        ],
        process_started: false,
    })
}

pub fn launch(
    request: LocalAppLaunchRequest,
    approved: bool,
) -> Result<LocalAppLaunchReceipt, store::StoreError> {
    let preview = preview(request)?;
    if preview.state != "ready-for-explicit-launch-approval" {
        return Err(store::StoreError::InvalidInput(format!(
            "local app launch is blocked: {}",
            preview.state
        )));
    }
    if !approved {
        return Err(store::StoreError::InvalidInput(
            "local app launch requires explicit approval".to_string(),
        ));
    }
    let mut child = Command::new(&preview.app.executable)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;
    let process_id = child.id();
    let run = store::task_run_by_id(preview.run_id.clone())?;
    let artifact = match store::append_task_artifacts(
        run.id,
        run.task_direction_id,
        vec![store::NewTaskArtifact {
            artifact_type: "local-app-launch-receipt".to_string(),
            reference_id: format!("local-app-launch-{}", store::now_millis()),
            title: format!("Launched {}", preview.app.label),
            summary: format!(
                "Started approved local application process {} without arguments.",
                process_id
            ),
            metadata: serde_json::json!({
                "app_id": preview.app.id,
                "process_id": process_id,
                "session_policy": preview.app.session_policy,
                "credentials_read": false,
                "window_content_read": false,
                "task_run_completed": false,
            }),
        }],
    ) {
        Ok(mut artifacts) => artifacts.remove(0),
        Err(error) => return terminate_after_persistence_failure(&mut child, process_id, error),
    };
    let audit_event = match store::append_audit_event(store::NewAuditEvent {
        actor: "taiheng".to_string(),
        action: "execute-local-app-launch".to_string(),
        target_type: "local-app".to_string(),
        target_id: preview.app.id.clone(),
        risk_level: "high".to_string(),
        decision: "launched-app-owned-session".to_string(),
        input: serde_json::json!({ "run_id": preview.run_id, "approved": approved }),
        result_summary: serde_json::json!({
            "artifact_id": artifact.id,
            "process_id": process_id,
            "task_run_completed": false,
            "credentials_read": false,
            "window_content_read": false,
        }),
        error: None,
    }) {
        Ok(event) => event,
        Err(error) => {
            let rollback = store::remove_task_artifacts(vec![artifact.id.clone()]);
            let persistence_error = match rollback {
                Ok(()) => error,
                Err(rollback_error) => store::StoreError::InvalidInput(format!(
                    "audit failed: {error}; artifact rollback failed: {rollback_error}"
                )),
            };
            return terminate_after_persistence_failure(
                &mut child,
                process_id,
                persistence_error,
            );
        }
    };

    Ok(LocalAppLaunchReceipt {
        preview,
        state: "launched-app-owned-session".to_string(),
        process_id,
        artifact,
        audit_event,
    })
}

fn terminate_after_persistence_failure<T>(
    child: &mut std::process::Child,
    process_id: u32,
    error: store::StoreError,
) -> Result<T, store::StoreError> {
    let terminate_error = child.kill().err();
    let _ = child.wait();
    match terminate_error {
        Some(terminate_error) => Err(store::StoreError::InvalidInput(format!(
            "local app process {process_id} started but persistence failed: {error}; process termination failed: {terminate_error}"
        ))),
        None => Err(store::StoreError::InvalidInput(format!(
            "local app process {process_id} was terminated because persistence failed: {error}"
        ))),
    }
}

pub fn preflight_launch(
    request: LocalAppLaunchRequest,
) -> Result<LocalAppLaunchPreflight, store::StoreError> {
    let preview = preview(request)?;
    Ok(build_launch_preflight(preview))
}

fn build_launch_preflight(preview: LocalAppLaunchPreview) -> LocalAppLaunchPreflight {
    let blockers = match preview.state.as_str() {
        "ready-for-explicit-launch-approval" => {
            vec!["explicit-launch-confirmation-not-granted".to_string()]
        }
        "blocked-not-detected" => vec!["local-app-or-bridge-not-detected".to_string()],
        "blocked-bridge-not-allowed" => vec!["bridge-tool-not-allowlisted".to_string()],
        "blocked-app-not-allowed" => vec!["local-app-not-allowlisted".to_string()],
        "blocked-run-not-approved" => vec!["task-run-not-approved".to_string()],
        other => vec![format!("unhandled-launch-state-{other}")],
    };

    LocalAppLaunchPreflight {
        generated_at_ms: store::now_millis(),
        state: "local-app-launch-preflight-review-required".to_string(),
        launch_state: preview.state.clone(),
        app_id: preview.app.id,
        run_id: preview.run_id,
        process_started: false,
        argument_count: preview.argument_preview.len(),
        user_arguments_allowed: false,
        credentials_read: false,
        window_content_read: false,
        requires_bridge_allowlist: true,
        requires_app_allowlist: true,
        requires_task_approval: true,
        requires_explicit_launch_confirmation: true,
        audit_required: true,
        session_blind: true,
        gates: vec![
            "built-in-or-reviewed-app-descriptor".to_string(),
            "bridge-tool-allowlisted".to_string(),
            "app-allowlisted".to_string(),
            "task-run-approved".to_string(),
            "explicit-launch-confirmation".to_string(),
            "argument-vector-only".to_string(),
            "no-user-supplied-executable".to_string(),
            "no-user-supplied-arguments".to_string(),
            "no-credential-or-session-extraction".to_string(),
            "no-window-content-reading".to_string(),
            "audit-required-before-local-app-launch".to_string(),
        ],
        blockers,
        denied_actions: vec![
            "user-supplied-executable".to_string(),
            "user-supplied-arguments".to_string(),
            "credential-read".to_string(),
            "session-extraction".to_string(),
            "window-content-read".to_string(),
            "background-launch-without-confirmation".to_string(),
        ],
    }
}

fn readiness_state(
    app: &LocalAppDescriptor,
    bridge: &arsenal::ToolDescriptor,
    run: &store::TaskRunRecord,
) -> &'static str {
    if !PathBuf::from(&app.executable).is_file() || bridge.discovery_state != "detected" {
        "blocked-not-detected"
    } else if bridge.allow_state != "allowed" {
        "blocked-bridge-not-allowed"
    } else if app.allow_state != "allowed" {
        "blocked-app-not-allowed"
    } else if run.lifecycle_state != "approved"
        || run.approval_state != "approved"
        || run.execution_state != "approved-not-started"
    {
        "blocked-run-not-approved"
    } else {
        "ready-for-explicit-launch-approval"
    }
}

fn default_notepad() -> LocalAppDescriptor {
    let executable = std::env::var_os("WINDIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\Windows"))
        .join("System32")
        .join("notepad.exe");
    LocalAppDescriptor {
        id: "windows-notepad".to_string(),
        label: "Windows Notepad".to_string(),
        executable: executable.display().to_string(),
        allow_state: "blocked".to_string(),
        risk_level: "low".to_string(),
        session_policy: "app-owned-session-only".to_string(),
        capabilities: vec![
            "launch-only".to_string(),
            "no-arguments".to_string(),
            "no-session-extraction".to_string(),
        ],
    }
}

fn normalize_allow_state(value: &str) -> Result<&'static str, store::StoreError> {
    match value.trim().to_ascii_lowercase().as_str() {
        "allowed" => Ok("allowed"),
        "blocked" => Ok("blocked"),
        other => Err(store::StoreError::InvalidInput(format!(
            "unsupported local app allow state: {other}"
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
    fn default_app_is_blocked_and_has_no_arguments() {
        let app = default_notepad();

        assert_eq!(app.allow_state, "blocked");
        assert!(app.capabilities.contains(&"no-arguments".to_string()));
        assert_eq!(app.session_policy, "app-owned-session-only");
    }

    #[test]
    fn rejects_unknown_allow_state() {
        assert!(normalize_allow_state("maybe").is_err());
    }

    #[test]
    fn allow_state_review_compensates_audit_failure() {
        let mut compensated = false;
        let result: Result<(), store::StoreError> = finalize_allow_state_review(
            || Ok(()),
            || Err(store::StoreError::InvalidInput("audit failed".to_string())),
            || { compensated = true; Ok(()) },
        );
        assert!(result.is_err());
        assert!(compensated);
    }

    #[test]
    fn canonical_descriptor_exposes_no_arguments_or_session_access() {
        let app = default_notepad();

        assert!(app.capabilities.contains(&"no-arguments".to_string()));
        assert!(app
            .capabilities
            .contains(&"no-session-extraction".to_string()));
        assert_eq!(app.session_policy, "app-owned-session-only");
    }

    #[test]
    fn local_app_launch_preflight_never_starts_process_or_reads_session() {
        let app = default_notepad();
        let preview = LocalAppLaunchPreview {
            app,
            run_id: "run-local-app".to_string(),
            state: "blocked-app-not-allowed".to_string(),
            bridge_discovery_state: "detected".to_string(),
            bridge_allow_state: "allowed".to_string(),
            task_approval_state: "approved".to_string(),
            argument_preview: vec![r"C:\Windows\System32\notepad.exe".to_string()],
            gates: vec![],
            process_started: false,
        };
        let preflight = build_launch_preflight(preview);

        assert_eq!(
            preflight.state,
            "local-app-launch-preflight-review-required"
        );
        assert_eq!(preflight.launch_state, "blocked-app-not-allowed");
        assert!(!preflight.process_started);
        assert!(!preflight.user_arguments_allowed);
        assert!(!preflight.credentials_read);
        assert!(!preflight.window_content_read);
        assert!(preflight.requires_bridge_allowlist);
        assert!(preflight.requires_app_allowlist);
        assert!(preflight.requires_task_approval);
        assert!(preflight.requires_explicit_launch_confirmation);
        assert!(preflight.audit_required);
        assert!(preflight.session_blind);
        assert!(preflight
            .gates
            .contains(&"no-user-supplied-arguments".to_string()));
        assert!(preflight
            .blockers
            .contains(&"local-app-not-allowlisted".to_string()));
        assert!(preflight
            .denied_actions
            .contains(&"session-extraction".to_string()));
    }
}
