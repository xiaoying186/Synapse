use std::io::{Read, Write};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use reqwest::Url;
use serde::{Deserialize, Serialize};

use crate::{arsenal, config, store};

const MAX_PROCESS_OUTPUT: usize = 128 * 1024;
const BROWSER_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, Deserialize)]
pub struct BrowserInspectionRequest {
    pub run_id: String,
    pub url: String,
    #[serde(default)]
    pub capture_screenshot: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct BrowserInspectionPreview {
    pub run_id: String,
    pub url: String,
    pub host: String,
    pub state: String,
    pub browser_discovery_state: String,
    pub browser_allow_state: String,
    pub python_discovery_state: String,
    pub python_allow_state: String,
    pub task_approval_state: String,
    pub allowed_hosts: Vec<String>,
    pub capture_screenshot: bool,
    pub gates: Vec<String>,
    pub process_started: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserInspectionResult {
    pub final_url: String,
    pub status: Option<u16>,
    pub title: String,
    pub text: String,
    pub screenshot_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BrowserInspectionReceipt {
    pub preview: BrowserInspectionPreview,
    pub result: BrowserInspectionResult,
    pub artifact: store::TaskArtifactRecord,
    pub run: store::TaskRunRecord,
}

pub fn preview(
    request: BrowserInspectionRequest,
) -> Result<BrowserInspectionPreview, store::StoreError> {
    let run_id = required(request.run_id, "task run id")?;
    let (url, host) = validate_url(&request.url)?;
    let run = store::task_run_by_id(run_id)?;
    let registry = arsenal::default_preview();
    let browser = registry
        .tools
        .iter()
        .find(|tool| tool.id == "browser-playwright")
        .ok_or_else(|| {
            store::StoreError::InvalidInput("browser tool is unavailable".to_string())
        })?;
    let python = registry
        .tools
        .iter()
        .find(|tool| tool.id == "python-local")
        .ok_or_else(|| store::StoreError::InvalidInput("Python tool is unavailable".to_string()))?;
    let allowed_hosts = configured_hosts();
    let state = if !allowed_hosts.iter().any(|allowed| allowed == &host) {
        "blocked-host-not-allowlisted"
    } else if browser.discovery_state != "detected" || python.discovery_state != "detected" {
        "blocked-runtime-not-detected"
    } else if browser.allow_state != "allowed" || python.allow_state != "allowed" {
        "blocked-tools-not-allowed"
    } else if run.lifecycle_state != "approved"
        || run.approval_state != "approved"
        || run.execution_state != "approved-not-started"
    {
        "blocked-run-not-approved"
    } else {
        "ready-for-explicit-execution-approval"
    };

    Ok(BrowserInspectionPreview {
        run_id: run.id,
        url: url.to_string(),
        host,
        state: state.to_string(),
        browser_discovery_state: browser.discovery_state.clone(),
        browser_allow_state: browser.allow_state.clone(),
        python_discovery_state: python.discovery_state.clone(),
        python_allow_state: python.allow_state.clone(),
        task_approval_state: run.approval_state,
        allowed_hosts,
        capture_screenshot: request.capture_screenshot,
        gates: vec![
            "exact-host-allowlist".to_string(),
            "http-get-navigation-only".to_string(),
            "no-click-or-form-submit".to_string(),
            "no-upload-or-download".to_string(),
            "no-credentials".to_string(),
            "no-arbitrary-javascript".to_string(),
            "redirect-host-revalidation".to_string(),
            "30-second-timeout".to_string(),
            "output-quarantine".to_string(),
        ],
        process_started: false,
    })
}

pub fn inspect(
    request: BrowserInspectionRequest,
    approved: bool,
) -> Result<BrowserInspectionReceipt, store::StoreError> {
    let preview = preview(request)?;
    if preview.state != "ready-for-explicit-execution-approval" {
        return Err(store::StoreError::InvalidInput(format!(
            "browser inspection is blocked: {}",
            preview.state
        )));
    }
    if !approved {
        return Err(store::StoreError::InvalidInput(
            "browser inspection requires explicit approval".to_string(),
        ));
    }
    let registry = arsenal::default_preview();
    let python_path = registry
        .tools
        .iter()
        .find(|tool| tool.id == "python-local")
        .and_then(|tool| tool.detected_path.clone())
        .ok_or_else(|| {
            store::StoreError::InvalidInput("Python executable path is unavailable".to_string())
        })?;
    let screenshot_path = preview.capture_screenshot.then(|| {
        project_root()
            .join(".synapse")
            .join("browser-artifacts")
            .join(format!("inspection-{}.png", store::now_millis()))
    });
    let payload = serde_json::json!({
        "url": preview.url,
        "allowed_hosts": preview.allowed_hosts,
        "screenshot_path": screenshot_path.as_ref().map(|path| path.display().to_string()),
    });
    let output = run_browser_process(&python_path, &serde_json::to_string(&payload)?)?;
    if output.exit_code != 0 {
        return Err(store::StoreError::InvalidInput(format!(
            "browser inspection exited with code {}: {}",
            output.exit_code,
            store::short_text(&output.stderr, 300)
        )));
    }
    let result = serde_json::from_str::<BrowserInspectionResult>(&output.stdout)?;
    let run = store::task_run_by_id(preview.run_id.clone())?;
    let artifact = store::append_task_artifacts(
        run.id.clone(),
        run.task_direction_id.clone(),
        vec![store::NewTaskArtifact {
            artifact_type: "browser-inspection-quarantine".to_string(),
            reference_id: format!("browser-inspection-{}", store::now_millis()),
            title: if result.title.trim().is_empty() {
                "Browser inspection".to_string()
            } else {
                result.title.clone()
            },
            summary: store::short_text(&result.text, 4_000),
            metadata: serde_json::json!({
                "requested_url": preview.url,
                "final_url": result.final_url,
                "status": result.status,
                "screenshot_path": result.screenshot_path,
                "output_truncated": output.truncated,
                "ingestion_policy": "quarantine-output",
            }),
        }],
    )?
    .remove(0);
    let completed = store::complete_domain_task_run(
        run.id,
        format!(
            "Browser inspection quarantined as artifact {}.",
            artifact.id
        ),
    )?;
    Ok(BrowserInspectionReceipt {
        preview,
        result,
        artifact,
        run: completed,
    })
}

fn validate_url(raw: &str) -> Result<(Url, String), store::StoreError> {
    let url = Url::parse(raw.trim()).map_err(|error| {
        store::StoreError::InvalidInput(format!("invalid browser URL: {error}"))
    })?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err(store::StoreError::InvalidInput(
            "browser URL must use http or https".to_string(),
        ));
    }
    if !url.username().is_empty() || url.password().is_some() || url.fragment().is_some() {
        return Err(store::StoreError::InvalidInput(
            "browser URL cannot contain credentials or fragments".to_string(),
        ));
    }
    let host = url
        .host_str()
        .ok_or_else(|| store::StoreError::InvalidInput("browser URL requires a host".to_string()))?
        .to_ascii_lowercase();
    Ok((url, host))
}

fn configured_hosts() -> Vec<String> {
    config::read_runtime_config()
        .browser_allowed_hosts
        .split(',')
        .map(|host| host.trim().to_ascii_lowercase())
        .filter(|host| !host.is_empty())
        .collect()
}

struct ProcessOutput {
    exit_code: i32,
    stdout: String,
    stderr: String,
    truncated: bool,
}

fn run_browser_process(
    python_path: &str,
    payload: &str,
) -> Result<ProcessOutput, store::StoreError> {
    let script = project_root()
        .join("src-tauri")
        .join("scripts")
        .join("browser_readonly.py");
    let mut child = Command::new(python_path)
        .arg("-I")
        .arg(script)
        .current_dir(project_root())
        .env("PYTHONNOUSERSITE", "1")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    let mut stdin = child.stdin.take().ok_or_else(|| {
        store::StoreError::InvalidInput("browser stdin could not be opened".to_string())
    })?;
    stdin.write_all(payload.as_bytes())?;
    drop(stdin);
    let stdout = child.stdout.take().ok_or_else(|| {
        store::StoreError::InvalidInput("browser stdout could not be opened".to_string())
    })?;
    let stderr = child.stderr.take().ok_or_else(|| {
        store::StoreError::InvalidInput("browser stderr could not be opened".to_string())
    })?;
    let stdout_reader = thread::spawn(move || read_bounded(stdout));
    let stderr_reader = thread::spawn(move || read_bounded(stderr));
    let started = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait()? {
            break status;
        }
        if started.elapsed() >= BROWSER_TIMEOUT {
            child.kill()?;
            let _ = child.wait();
            return Err(store::StoreError::InvalidInput(
                "browser inspection exceeded 30 seconds".to_string(),
            ));
        }
        thread::sleep(Duration::from_millis(50));
    };
    let (stdout, stdout_truncated) = stdout_reader.join().map_err(|_| {
        store::StoreError::InvalidInput("browser stdout reader failed".to_string())
    })??;
    let (stderr, stderr_truncated) = stderr_reader.join().map_err(|_| {
        store::StoreError::InvalidInput("browser stderr reader failed".to_string())
    })??;
    Ok(ProcessOutput {
        exit_code: status.code().unwrap_or(-1),
        stdout,
        stderr,
        truncated: stdout_truncated || stderr_truncated,
    })
}

fn read_bounded<R: Read>(mut reader: R) -> Result<(String, bool), std::io::Error> {
    let mut captured = Vec::new();
    let mut buffer = [0_u8; 8192];
    let mut truncated = false;
    loop {
        let count = reader.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        let remaining = MAX_PROCESS_OUTPUT.saturating_sub(captured.len());
        let keep = remaining.min(count);
        captured.extend_from_slice(&buffer[..keep]);
        truncated |= keep < count;
    }
    Ok((String::from_utf8_lossy(&captured).to_string(), truncated))
}

fn project_root() -> std::path::PathBuf {
    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri must live inside the project root")
        .to_path_buf()
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
    fn rejects_credentials_fragments_and_non_http_urls() {
        assert!(validate_url("file:///C:/secret").is_err());
        assert!(validate_url("https://user:pass@example.com").is_err());
        assert!(validate_url("https://example.com/#secret").is_err());
    }

    #[test]
    fn accepts_plain_https_url_and_normalizes_host() {
        let (_, host) = validate_url("https://EXAMPLE.com/path").unwrap();
        assert_eq!(host, "example.com");
    }
}
