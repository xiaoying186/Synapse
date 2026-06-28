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
) -> Result<Vec<LocalAppDescriptor>, store::StoreError> {
    let app_id = required(app_id, "local app id")?;
    let allow_state = normalize_allow_state(&allow_state)?;
    let path = store::local_apps_path();
    let mut records = list_apps()?;
    let Some(app) = records.iter_mut().find(|app| app.id == app_id) else {
        return Err(store::StoreError::NotFound(app_id));
    };
    if !PathBuf::from(&app.executable).is_file() {
        return Err(store::StoreError::InvalidInput(
            "local app executable is unavailable".to_string(),
        ));
    }
    app.allow_state = allow_state.to_string();
    store::write_json_records(&path, &records)?;
    Ok(records)
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
    let child = Command::new(&preview.app.executable)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;
    let process_id = child.id();
    let run = store::task_run_by_id(preview.run_id.clone())?;
    let artifact = store::append_task_artifacts(
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
    )?
    .remove(0);

    Ok(LocalAppLaunchReceipt {
        preview,
        state: "launched-app-owned-session".to_string(),
        process_id,
        artifact,
    })
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
    fn canonical_descriptor_exposes_no_arguments_or_session_access() {
        let app = default_notepad();

        assert!(app.capabilities.contains(&"no-arguments".to_string()));
        assert!(app
            .capabilities
            .contains(&"no-session-extraction".to_string()));
        assert_eq!(app.session_policy, "app-owned-session-only");
    }
}
