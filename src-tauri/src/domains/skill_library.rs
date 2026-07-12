use std::io::Read;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};

use crate::{config, domains::agent_harness, store};

const SYSTEM_INVENTORY_SKILL_ID: &str = "script.safe-system-inventory";
const SYSTEM_INVENTORY_SHA256: &str = "d18be7479b9514e4959251d06101694dbf9aefe0b8f15568847d00d003ac95c2";
const SCRIPT_TIMEOUT: Duration = Duration::from_secs(30);
const SYSTEM_INVENTORY_SCRIPT: &str = include_str!("../../scripts/safe-system-inventory.ps1");

#[derive(Debug, Clone, Deserialize)]
pub struct SkillScriptExecutionRequest {
    pub skill_id: String,
    pub run_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SkillManifest {
    pub skill_id: String,
    pub name: String,
    pub owner_center: String,
    pub governed_by: String,
    pub version: String,
    pub manifest_state: String,
    pub execution_mode: String,
    pub script_adapter: String,
    pub permission_level: String,
    pub admission_policy: String,
    pub rollback_policy: String,
    pub tests_required: Vec<String>,
    pub safety_gates: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SkillExecutionContract {
    pub skill_id: String,
    pub state: String,
    pub process_started: bool,
    pub script_content_read: bool,
    pub durable_zhishu_write: bool,
    pub requires_explicit_approval: bool,
    pub requires_test_receipt: bool,
    pub output_policy: String,
    pub denied_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SkillLibraryPreview {
    pub generated_at_ms: u128,
    pub state: String,
    pub registry_scope: String,
    pub manifests: Vec<SkillManifest>,
    pub execution_contracts: Vec<SkillExecutionContract>,
    pub gates: Vec<String>,
    pub denied_actions: Vec<String>,
    pub process_started: bool,
    pub script_content_read: bool,
    pub durable_zhishu_write: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct SkillScriptExecutionPreflight {
    pub generated_at_ms: u128,
    pub state: String,
    pub skill_id: String,
    pub script_adapter: String,
    pub manifest_state: String,
    pub process_started: bool,
    pub script_content_read: bool,
    pub durable_zhishu_write: bool,
    pub filesystem_mutation_started: bool,
    pub network_call_started: bool,
    pub requires_allowlisted_script_path: bool,
    pub requires_script_hash: bool,
    pub requires_explicit_approval: bool,
    pub requires_test_receipt: bool,
    pub requires_quarantine_output: bool,
    pub requires_rollback_plan: bool,
    pub gates: Vec<String>,
    pub blockers: Vec<String>,
    pub denied_actions: Vec<String>,
    pub run_id: String,
    pub task_approval_state: String,
    pub executor_enabled: bool,
    pub script_path_allowlisted: bool,
    pub script_hash_verified: bool,
    pub expected_sha256: String,
    pub actual_sha256: String,
    pub powershell_available: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct SkillScriptExecutionReceipt {
    pub preflight: SkillScriptExecutionPreflight,
    pub state: String,
    pub exit_code: i32,
    pub output_sha256: String,
    pub output_truncated: bool,
    pub artifact: store::TaskArtifactRecord,
    pub rollback_snapshot: store::SnapshotRecord,
    pub audit_event: store::AuditEvent,
    pub saga: store::SagaTransaction,
}

struct ScriptProcessOutput {
    stdout: String,
    stderr: String,
    exit_code: i32,
    truncated: bool,
}

pub fn preview() -> SkillLibraryPreview {
    let manifests = vec![
        SkillManifest {
            skill_id: "skill.safe-release-review".to_string(),
            name: "Safe release review".to_string(),
            owner_center: "Zhishu".to_string(),
            governed_by: "Taiheng".to_string(),
            version: "0.0.0-preview".to_string(),
            manifest_state: "review-required".to_string(),
            execution_mode: "manual-procedure-preview".to_string(),
            script_adapter: "none".to_string(),
            permission_level: "read-only-guidance".to_string(),
            admission_policy: "zhishu-review-before-reuse".to_string(),
            rollback_policy: "supersede-manifest-version".to_string(),
            tests_required: vec![
                "i18n-check".to_string(),
                "ui-smoke".to_string(),
                "release-acceptance".to_string(),
            ],
            safety_gates: vec![
                "no-credential-in-manifest".to_string(),
                "versioned-skill-manifest".to_string(),
                "review-before-zhishu-admission".to_string(),
                "taiheng-permission-review".to_string(),
            ],
        },
        SkillManifest {
            skill_id: SYSTEM_INVENTORY_SKILL_ID.to_string(),
            name: "Safe system inventory script adapter".to_string(),
            owner_center: "Baigong".to_string(),
            governed_by: "Taiheng".to_string(),
            version: "1.0.0".to_string(),
            manifest_state: "built-in-hash-locked".to_string(),
            execution_mode: "guarded-read-only-script".to_string(),
            script_adapter: "powershell-safe-system-inventory".to_string(),
            permission_level: "no-system-mutation".to_string(),
            admission_policy: "quarantine-output-before-zhishu-review".to_string(),
            rollback_policy: "no-mutation-snapshot-and-saga".to_string(),
            tests_required: vec![
                "script-adapter-contract-test".to_string(),
                "no-mutation-smoke".to_string(),
                "audit-receipt-check".to_string(),
            ],
            safety_gates: vec![
                "allowlisted-script-path-required".to_string(),
                "script-hash-required".to_string(),
                "explicit-approval-required".to_string(),
                "taiheng-permission-review".to_string(),
                "no-delete-registry-process-or-network".to_string(),
            ],
        },
    ];

    let execution_contracts = manifests
        .iter()
        .map(|manifest| SkillExecutionContract {
            skill_id: manifest.skill_id.clone(),
            state: "execution-blocked-preview-only".to_string(),
            process_started: false,
            script_content_read: false,
            durable_zhishu_write: false,
            requires_explicit_approval: true,
            requires_test_receipt: true,
            output_policy: "quarantine-before-review".to_string(),
            denied_actions: vec![
                "spawn-process".to_string(),
                "read-script-content".to_string(),
                "write-durable-memory".to_string(),
                "modify-filesystem".to_string(),
                "network-call".to_string(),
                "bypass-taiheng-review".to_string(),
            ],
        })
        .collect();

    SkillLibraryPreview {
        generated_at_ms: store::now_millis(),
        state: "guarded-skill-library-preview".to_string(),
        registry_scope: "local-public-baseline-manifests".to_string(),
        manifests,
        execution_contracts,
        gates: vec![
            "versioned-skill-manifest-required".to_string(),
            "no-credentials-or-local-private-paths".to_string(),
            "script-adapter-hash-required-before-execution".to_string(),
            "taiheng-approval-before-process-start".to_string(),
            "test-receipt-before-reuse".to_string(),
            "zhishu-admission-review-required".to_string(),
        ],
        denied_actions: vec![
            "run-unreviewed-script".to_string(),
            "spawn-process".to_string(),
            "read-script-content".to_string(),
            "write-l2-without-review".to_string(),
            "reuse-skill-without-version".to_string(),
        ],
        process_started: false,
        script_content_read: false,
        durable_zhishu_write: false,
    }
}

pub fn preflight_script_execution(request: SkillScriptExecutionRequest) -> SkillScriptExecutionPreflight {
    let preview = preview();
    let requested_skill_id = request.skill_id.trim();
    let manifest = preview
        .manifests
        .iter()
        .find(|manifest| manifest.skill_id == requested_skill_id)
        .or_else(|| {
            preview
                .manifests
                .iter()
                .find(|manifest| manifest.script_adapter != "none")
        });
    let skill_id = manifest
        .map(|manifest| manifest.skill_id.clone())
        .unwrap_or_else(|| "script.unregistered".to_string());
    let script_adapter = manifest
        .map(|manifest| manifest.script_adapter.clone())
        .unwrap_or_else(|| "unregistered".to_string());
    let manifest_state = manifest
        .map(|manifest| manifest.manifest_state.clone())
        .unwrap_or_else(|| "missing-manifest".to_string());

    let requested_run_id = request.run_id.trim().to_string();
    let run = store::task_run_by_id(requested_run_id.clone()).ok();
    let powershell_available = powershell_path().is_file();
    let script_path_allowlisted = true;
    let actual_sha256 = embedded_script_hash();
    let script_hash_verified = actual_sha256 == SYSTEM_INVENTORY_SHA256;
    let executor_enabled = config::read_runtime_config().script_execution_enabled;
    let task_ready = run.as_ref().is_some_and(|run| run.lifecycle_state == "approved"
        && run.approval_state == "approved"
        && run.execution_state == "approved-not-started");
    let mut blockers = Vec::new();
    if skill_id != SYSTEM_INVENTORY_SKILL_ID { blockers.push("script-manifest-not-executable".to_string()); }
    if !script_path_allowlisted { blockers.push("script-path-not-allowlisted".to_string()); }
    if !script_hash_verified { blockers.push("script-hash-not-verified".to_string()); }
    if !powershell_available { blockers.push("powershell-not-available".to_string()); }
    if !task_ready { blockers.push("task-run-not-approved".to_string()); }
    if !executor_enabled { blockers.push("script-execution-gate-disabled".to_string()); }
    let state = if blockers.is_empty() {
        "ready-for-explicit-script-execution-approval"
    } else {
        "script-execution-blocked-by-default"
    };

    SkillScriptExecutionPreflight {
        generated_at_ms: store::now_millis(),
        state: state.to_string(),
        skill_id,
        script_adapter,
        manifest_state,
        process_started: false,
        script_content_read: false,
        durable_zhishu_write: false,
        filesystem_mutation_started: false,
        network_call_started: false,
        requires_allowlisted_script_path: true,
        requires_script_hash: true,
        requires_explicit_approval: true,
        requires_test_receipt: true,
        requires_quarantine_output: true,
        requires_rollback_plan: true,
        gates: vec![
            "allowlisted-script-path-required".to_string(),
            "script-hash-required-before-execution".to_string(),
            "taiheng-approval-before-process-start".to_string(),
            "test-receipt-before-reuse".to_string(),
            "quarantine-output-before-zhishu-review".to_string(),
            "rollback-plan-required-before-script-execution".to_string(),
            "least-privilege-sandbox-required".to_string(),
        ],
        blockers,
        denied_actions: vec![
            "execute-unregistered-script".to_string(),
            "pass-user-script-arguments".to_string(),
            "modify-filesystem".to_string(),
            "network-call".to_string(),
            "write-durable-memory".to_string(),
            "bypass-taiheng-review".to_string(),
        ],
        run_id: run.as_ref().map(|run| run.id.clone()).unwrap_or(requested_run_id),
        task_approval_state: run.as_ref().map(|run| run.approval_state.clone()).unwrap_or_else(|| "missing".to_string()),
        executor_enabled,
        script_path_allowlisted,
        script_hash_verified,
        expected_sha256: SYSTEM_INVENTORY_SHA256.to_string(),
        actual_sha256,
        powershell_available,
    }
}

pub fn execute_script(request: SkillScriptExecutionRequest, approved: bool) -> Result<SkillScriptExecutionReceipt, store::StoreError> {
    let preflight = preflight_script_execution(request);
    if !approved { return Err(store::StoreError::InvalidInput("skill script execution requires explicit approval".to_string())); }
    if preflight.state != "ready-for-explicit-script-execution-approval" {
        return Err(store::StoreError::InvalidInput(format!("skill script execution is blocked: {} ({})", preflight.state, preflight.blockers.join(", "))));
    }
    let saga = store::begin_saga("skill-script-execution".to_string(), preflight.run_id.clone(), serde_json::json!({ "skill_id": preflight.skill_id, "script_sha256": preflight.actual_sha256 }))?;
    let rollback_snapshot = match store::create_snapshot("task-run".to_string(), preflight.run_id.clone(), "before-skill-script-execution".to_string(), serde_json::json!({ "saga_id": saga.id, "skill_id": preflight.skill_id, "process_started": false })) {
        Ok(snapshot) => snapshot,
        Err(error) => return fail_script_saga(&saga, error),
    };
    let process = match run_system_inventory_script() {
        Ok(process) => process,
        Err(error) => return fail_script_saga(&saga, error),
    };
    let stdout = process.stdout;
    let stderr = process.stderr;
    let exit_code = process.exit_code;
    let output_truncated = process.truncated;
    if exit_code != 0 { return fail_script_saga(&saga, store::StoreError::InvalidInput(format!("skill script exited with code {exit_code}: {}", store::short_text(&stderr, 300)))); }
    let output: serde_json::Value = serde_json::from_str(stdout.trim()).map_err(|error| store::StoreError::InvalidInput(format!("skill script output is not valid JSON: {error}")))?;
    if output["mutation_started"] != false || output["network_started"] != false {
        return fail_script_saga(&saga, store::StoreError::InvalidInput("skill script violated the no-mutation/no-network contract".to_string()));
    }
    let output_sha256 = hex::encode(Sha256::digest(stdout.as_bytes()));
    let run = store::task_run_by_id(preflight.run_id.clone())?;
    let artifact = match store::append_task_artifacts(run.id, run.task_direction_id, vec![store::NewTaskArtifact {
        artifact_type: "skill-script-quarantine-receipt".to_string(),
        reference_id: format!("skill-script-{}", store::now_millis()),
        title: "Safe system inventory output".to_string(),
        summary: stdout.trim().to_string(),
        metadata: serde_json::json!({ "skill_id": preflight.skill_id, "script_sha256": preflight.actual_sha256, "output_sha256": output_sha256, "exit_code": exit_code, "stderr": store::short_text(&stderr, 300), "output_truncated": output_truncated, "mutation_started": false, "network_started": false, "admission_state": "quarantined-review-required", "snapshot_id": rollback_snapshot.id, "saga_id": saga.id }),
    }]) { Ok(mut records) => records.remove(0), Err(error) => return fail_script_saga(&saga, error) };
    let audit_event = match store::append_audit_event(store::NewAuditEvent { actor: "taiheng".to_string(), action: "execute-skill-script".to_string(), target_type: "task-run".to_string(), target_id: preflight.run_id.clone(), risk_level: "high".to_string(), decision: "skill-script-output-quarantined".to_string(), input: serde_json::json!({ "approved": approved, "skill_id": preflight.skill_id, "script_sha256": preflight.actual_sha256, "snapshot_id": rollback_snapshot.id, "saga_id": saga.id }), result_summary: serde_json::json!({ "artifact_id": artifact.id, "output_sha256": output_sha256, "exit_code": exit_code, "mutation_started": false, "network_started": false, "durable_zhishu_write": false }), error: None }) { Ok(event) => event, Err(error) => return fail_script_saga(&saga, error) };
    let saga = match store::transition_saga(saga.id.clone(), "committed".to_string()) { Ok(saga) => saga, Err(error) => return fail_script_saga(&saga, error) };
    Ok(SkillScriptExecutionReceipt { preflight, state: "skill-script-output-quarantined".to_string(), exit_code, output_sha256, output_truncated, artifact, rollback_snapshot, audit_event, saga })
}

fn run_system_inventory_script() -> Result<ScriptProcessOutput, store::StoreError> {
    let mut child = Command::new(powershell_path())
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand"])
        .arg(encoded_system_inventory_script())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env_clear()
        .env("SystemRoot", std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".to_string()))
        .env("WINDIR", std::env::var("WINDIR").unwrap_or_else(|_| r"C:\Windows".to_string()))
        .spawn()
        .map_err(|error| store::StoreError::InvalidInput(format!("skill script process could not start: {error}")))?;
    let stdout = child.stdout.take().ok_or_else(|| store::StoreError::InvalidInput("skill script stdout unavailable".to_string()))?;
    let stderr = child.stderr.take().ok_or_else(|| store::StoreError::InvalidInput("skill script stderr unavailable".to_string()))?;
    let stdout_reader = thread::spawn(move || read_bounded(stdout));
    let stderr_reader = thread::spawn(move || read_bounded(stderr));
    let status = agent_harness::wait_for_process(&mut child, SCRIPT_TIMEOUT, None)?;
    let (stdout, stdout_truncated) = stdout_reader.join().map_err(|_| store::StoreError::InvalidInput("skill stdout reader failed".to_string()))??;
    let (stderr, stderr_truncated) = stderr_reader.join().map_err(|_| store::StoreError::InvalidInput("skill stderr reader failed".to_string()))??;
    let exit_code = status.code().unwrap_or(-1);
    Ok(ScriptProcessOutput { stdout, stderr, exit_code, truncated: stdout_truncated || stderr_truncated })
}

#[cfg(test)]
fn system_inventory_script_path() -> PathBuf { PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("scripts").join("safe-system-inventory.ps1") }
fn powershell_path() -> PathBuf { PathBuf::from(std::env::var("WINDIR").unwrap_or_else(|_| r"C:\Windows".to_string())).join("System32").join("WindowsPowerShell").join("v1.0").join("powershell.exe") }
#[cfg(test)]
fn hash_file(path: &std::path::Path) -> Result<String, store::StoreError> { let bytes = std::fs::read(path)?; Ok(hex::encode(Sha256::digest(bytes))) }
fn embedded_script_hash() -> String { hex::encode(Sha256::digest(SYSTEM_INVENTORY_SCRIPT.as_bytes())) }
fn encoded_system_inventory_script() -> String {
    let bytes = SYSTEM_INVENTORY_SCRIPT.encode_utf16().flat_map(u16::to_le_bytes).collect::<Vec<_>>();
    BASE64_STANDARD.encode(bytes)
}
fn read_bounded<R: Read>(reader: R) -> Result<(String, bool), std::io::Error> { let mut bytes = Vec::new(); reader.take(64 * 1024 + 1).read_to_end(&mut bytes)?; let truncated = bytes.len() > 64 * 1024; bytes.truncate(64 * 1024); Ok((String::from_utf8_lossy(&bytes).to_string(), truncated)) }
fn fail_script_saga<T>(saga: &store::SagaTransaction, error: store::StoreError) -> Result<T, store::StoreError> { let _ = store::transition_saga(saga.id.clone(), "failed".to_string()); Err(error) }

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(windows)]
    #[test]
    fn built_in_system_inventory_script_executes_readonly_and_returns_json() {
        assert_eq!(hash_file(&system_inventory_script_path()).unwrap(), SYSTEM_INVENTORY_SHA256);
        assert_eq!(embedded_script_hash(), SYSTEM_INVENTORY_SHA256);
        let output = run_system_inventory_script().unwrap();
        assert_eq!(output.exit_code, 0);
        assert!(!output.truncated);
        let value: serde_json::Value = serde_json::from_str(output.stdout.trim()).unwrap();
        assert_eq!(value["schema"], "synapse.skill.safe-system-inventory.v1");
        assert_eq!(value["mutation_started"], false);
        assert_eq!(value["network_started"], false);
    }

    #[test]
    fn skill_library_preview_never_executes_or_writes_memory() {
        let preview = preview();

        assert_eq!(preview.state, "guarded-skill-library-preview");
        assert!(!preview.process_started);
        assert!(!preview.script_content_read);
        assert!(!preview.durable_zhishu_write);
        assert!(preview
            .denied_actions
            .contains(&"run-unreviewed-script".to_string()));
        assert!(preview
            .gates
            .contains(&"zhishu-admission-review-required".to_string()));
        assert!(preview.execution_contracts.iter().all(|contract| {
            !contract.process_started
                && !contract.script_content_read
                && !contract.durable_zhishu_write
                && contract.requires_explicit_approval
                && contract.requires_test_receipt
        }));
    }

    #[test]
    fn skill_manifests_are_versioned_and_governed() {
        let preview = preview();

        assert!(preview.manifests.iter().all(|manifest| {
            !manifest.skill_id.is_empty()
                && !manifest.version.is_empty()
                && manifest.governed_by == "Taiheng"
                && !manifest.tests_required.is_empty()
                && manifest
                    .safety_gates
                    .contains(&"taiheng-permission-review".to_string())
        }));
    }

    #[test]
    fn script_execution_preflight_blocks_process_and_memory_writes() {
        let preflight = preflight_script_execution(SkillScriptExecutionRequest {
            skill_id: SYSTEM_INVENTORY_SKILL_ID.to_string(),
            run_id: "missing-run".to_string(),
        });

        assert_eq!(preflight.state, "script-execution-blocked-by-default");
        assert_eq!(preflight.skill_id, SYSTEM_INVENTORY_SKILL_ID);
        assert!(!preflight.process_started);
        assert!(!preflight.script_content_read);
        assert!(!preflight.durable_zhishu_write);
        assert!(!preflight.filesystem_mutation_started);
        assert!(!preflight.network_call_started);
        assert!(preflight.requires_allowlisted_script_path);
        assert!(preflight.requires_script_hash);
        assert!(preflight.requires_explicit_approval);
        assert!(preflight.requires_test_receipt);
        assert!(preflight.requires_quarantine_output);
        assert!(preflight.requires_rollback_plan);
        assert!(preflight
            .gates
            .contains(&"least-privilege-sandbox-required".to_string()));
        assert!(preflight
            .blockers
            .contains(&"script-execution-gate-disabled".to_string()));
        assert!(preflight
            .denied_actions
            .contains(&"execute-unregistered-script".to_string()));
        assert!(preflight.script_path_allowlisted);
        assert!(preflight.script_hash_verified);
        assert_eq!(preflight.actual_sha256, SYSTEM_INVENTORY_SHA256);
    }
}
