use std::collections::BTreeSet;
use std::path::PathBuf;

use serde::Serialize;

use crate::{arsenal, config, store};

#[derive(Debug, Clone, Serialize)]
pub struct DiagnosticCheck {
    pub id: String,
    pub label: String,
    pub state: String,
    pub evidence: String,
    pub recommendation: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ComputerDiagnosticReport {
    pub generated_at_ms: u128,
    pub overall_state: String,
    pub system_profile: SystemProfileSnapshot,
    pub checks: Vec<DiagnosticCheck>,
    pub detected_tools: Vec<String>,
    pub safety_boundary: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SystemProfileSnapshot {
    pub snapshot_kind: String,
    pub os_family: String,
    pub os: String,
    pub architecture: String,
    pub runtime_executable_available: bool,
    pub temp_dir_available: bool,
    pub path_entry_count: usize,
    pub unique_path_entry_count: usize,
    pub detected_tool_count: usize,
    pub context_policy: String,
    pub persistence_policy: String,
    pub allowed_fields: Vec<String>,
    pub denied_fields: Vec<String>,
    pub safety_boundary: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ComputerDiagnosticArchiveReceipt {
    pub report: ComputerDiagnosticReport,
    pub artifact: store::TaskArtifactRecord,
    pub run: store::TaskRunRecord,
}

#[derive(Debug, Clone, Serialize)]
pub struct CleanupCandidate {
    pub id: String,
    pub label: String,
    pub location_kind: String,
    pub path_preview: String,
    pub estimated_reclaimable_bytes: u64,
    pub confidence: String,
    pub action_policy: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CleanupDryRunPreview {
    pub generated_at_ms: u128,
    pub state: String,
    pub candidate_count: usize,
    pub estimated_reclaimable_bytes: u64,
    pub deleted_bytes: u64,
    pub mutation_started: bool,
    pub requires_restore_point: bool,
    pub requires_explicit_approval: bool,
    pub candidates: Vec<CleanupCandidate>,
    pub denied_actions: Vec<String>,
    pub safety_boundary: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CleanupMutationPreflight {
    pub generated_at_ms: u128,
    pub state: String,
    pub cleanup_state: String,
    pub candidate_count: usize,
    pub restore_point_required: bool,
    pub restore_point_available: bool,
    pub explicit_approval_required: bool,
    pub audit_required: bool,
    pub rollback_plan_required: bool,
    pub requires_admin: bool,
    pub system_mutation_started: bool,
    pub file_deletion_started: bool,
    pub registry_write_started: bool,
    pub process_kill_started: bool,
    pub candidates: Vec<CleanupCandidate>,
    pub gates: Vec<String>,
    pub blockers: Vec<String>,
    pub denied_actions: Vec<String>,
}

pub fn preview() -> ComputerDiagnosticReport {
    let runtime = config::read_runtime_config();
    let arsenal = arsenal::default_preview();
    let path = std::env::var_os("PATH").unwrap_or_default();
    let path_entries = std::env::split_paths(&path).collect::<Vec<_>>();
    let unique_entries = path_entries
        .iter()
        .map(|entry| entry.to_string_lossy().to_ascii_lowercase())
        .collect::<BTreeSet<_>>();
    let temp_dir = std::env::temp_dir();
    let current_exe = std::env::current_exe().ok();
    let detected_tools = arsenal
        .tools
        .iter()
        .filter(|tool| tool.discovery_state == "detected")
        .map(|tool| tool.label.clone())
        .collect::<Vec<_>>();
    let system_profile = system_profile_snapshot(
        current_exe.is_some(),
        temp_dir.is_dir(),
        path_entries.len(),
        unique_entries.len(),
        detected_tools.len(),
    );
    let mut checks = vec![
        DiagnosticCheck {
            id: "runtime".to_string(),
            label: "Runtime executable".to_string(),
            state: if current_exe.is_some() {
                "ok"
            } else {
                "unavailable"
            }
            .to_string(),
            evidence: current_exe
                .map(|path| path.display().to_string())
                .unwrap_or_else(|| "Executable path could not be resolved.".to_string()),
            recommendation: "Keep the application directory readable.".to_string(),
        },
        DiagnosticCheck {
            id: "temp-directory".to_string(),
            label: "Temporary directory".to_string(),
            state: if temp_dir.is_dir() { "ok" } else { "warning" }.to_string(),
            evidence: temp_dir.display().to_string(),
            recommendation: "Verify the user TEMP directory exists and is writable.".to_string(),
        },
        DiagnosticCheck {
            id: "path-health".to_string(),
            label: "PATH structure".to_string(),
            state: if unique_entries.len() == path_entries.len() {
                "ok"
            } else {
                "warning"
            }
            .to_string(),
            evidence: format!(
                "{} entries, {} unique",
                path_entries.len(),
                unique_entries.len()
            ),
            recommendation: "Remove duplicate PATH entries only after manual review.".to_string(),
        },
        DiagnosticCheck {
            id: "agent-discovery".to_string(),
            label: "Agent CLI discovery".to_string(),
            state: if detected_tools.is_empty() {
                "warning"
            } else {
                "ok"
            }
            .to_string(),
            evidence: if detected_tools.is_empty() {
                "No registered agent CLI was detected on PATH.".to_string()
            } else {
                detected_tools.join(", ")
            },
            recommendation: "Use Arsenal setup guidance before changing installations.".to_string(),
        },
    ];
    if !runtime.warnings.is_empty() {
        checks.push(DiagnosticCheck {
            id: "runtime-config".to_string(),
            label: "Runtime configuration".to_string(),
            state: "warning".to_string(),
            evidence: runtime.warnings.join(" | "),
            recommendation: "Review configuration warnings without applying automatic edits."
                .to_string(),
        });
    }
    let overall_state = if checks.iter().any(|check| check.state == "unavailable") {
        "attention-required"
    } else if checks.iter().any(|check| check.state == "warning") {
        "review-recommended"
    } else {
        "healthy"
    };

    ComputerDiagnosticReport {
        generated_at_ms: store::now_millis(),
        overall_state: overall_state.to_string(),
        system_profile,
        checks,
        detected_tools,
        safety_boundary: vec![
            "no-process-launch".to_string(),
            "no-file-deletion".to_string(),
            "no-registry-write".to_string(),
            "no-system-setting-change".to_string(),
        ],
    }
}

pub fn cleanup_dry_run() -> CleanupDryRunPreview {
    let candidates = cleanup_candidates();
    let estimated_reclaimable_bytes = candidates
        .iter()
        .map(|candidate| candidate.estimated_reclaimable_bytes)
        .sum();

    CleanupDryRunPreview {
        generated_at_ms: store::now_millis(),
        state: "cleanup-dry-run-review-required".to_string(),
        candidate_count: candidates.len(),
        estimated_reclaimable_bytes,
        deleted_bytes: 0,
        mutation_started: false,
        requires_restore_point: true,
        requires_explicit_approval: true,
        candidates,
        denied_actions: vec![
            "delete-files".to_string(),
            "empty-recycle-bin".to_string(),
            "registry-cleanup".to_string(),
            "service-stop".to_string(),
            "process-kill".to_string(),
            "browser-cache-read".to_string(),
            "installed-app-uninstall".to_string(),
        ],
        safety_boundary: vec![
            "dry-run-only".to_string(),
            "no-file-deletion".to_string(),
            "no-file-content-read".to_string(),
            "no-registry-write".to_string(),
            "no-process-launch".to_string(),
            "restore-point-required-before-real-cleanup".to_string(),
            "explicit-approval-required-before-real-cleanup".to_string(),
            "audit-required-before-real-cleanup".to_string(),
        ],
    }
}

pub fn cleanup_mutation_preflight() -> CleanupMutationPreflight {
    let preview = cleanup_dry_run();

    CleanupMutationPreflight {
        generated_at_ms: store::now_millis(),
        state: "cleanup-mutation-blocked-by-default".to_string(),
        cleanup_state: preview.state,
        candidate_count: preview.candidate_count,
        restore_point_required: true,
        restore_point_available: false,
        explicit_approval_required: true,
        audit_required: true,
        rollback_plan_required: true,
        requires_admin: true,
        system_mutation_started: false,
        file_deletion_started: false,
        registry_write_started: false,
        process_kill_started: false,
        candidates: preview.candidates,
        gates: vec![
            "restore-point-required-before-real-cleanup".to_string(),
            "explicit-approval-required-before-real-cleanup".to_string(),
            "audit-required-before-real-cleanup".to_string(),
            "rollback-plan-required-before-real-cleanup".to_string(),
            "admin-session-required-before-real-cleanup".to_string(),
            "candidate-review-required-before-real-cleanup".to_string(),
        ],
        blockers: vec![
            "restore-point-not-created".to_string(),
            "cleanup-approval-not-granted".to_string(),
            "cleanup-audit-record-not-opened".to_string(),
            "rollback-plan-not-attached".to_string(),
            "real-cleanup-executor-disabled".to_string(),
        ],
        denied_actions: vec![
            "delete-files".to_string(),
            "empty-recycle-bin".to_string(),
            "registry-cleanup".to_string(),
            "service-stop".to_string(),
            "process-kill".to_string(),
            "installed-app-uninstall".to_string(),
            "system-setting-change".to_string(),
        ],
    }
}

fn cleanup_candidates() -> Vec<CleanupCandidate> {
    let mut candidates = Vec::new();
    let temp_dir = std::env::temp_dir();
    candidates.push(cleanup_candidate(
        "user-temp-directory",
        "User temporary directory",
        "directory",
        temp_dir,
        "manual-review-required",
    ));

    if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
        let local_app_data = PathBuf::from(local_app_data);
        candidates.push(cleanup_candidate(
            "windows-temp-cache",
            "Windows temporary cache",
            "directory",
            local_app_data.join("Temp"),
            "manual-review-required",
        ));
    }

    candidates
}

fn cleanup_candidate(
    id: &str,
    label: &str,
    location_kind: &str,
    path: PathBuf,
    confidence: &str,
) -> CleanupCandidate {
    CleanupCandidate {
        id: id.to_string(),
        label: label.to_string(),
        location_kind: location_kind.to_string(),
        path_preview: redacted_path_preview(path),
        estimated_reclaimable_bytes: 0,
        confidence: confidence.to_string(),
        action_policy: "preview-only-no-delete".to_string(),
    }
}

fn redacted_path_preview(path: PathBuf) -> String {
    let components = path
        .components()
        .map(|component| component.as_os_str().to_string_lossy().to_string())
        .collect::<Vec<_>>();
    if components.len() <= 3 {
        return path.display().to_string();
    }
    let suffix = components
        .iter()
        .rev()
        .take(2)
        .cloned()
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<Vec<_>>()
        .join(std::path::MAIN_SEPARATOR_STR);
    format!("<local-user-path>{}{}", std::path::MAIN_SEPARATOR, suffix)
}

fn system_profile_snapshot(
    runtime_executable_available: bool,
    temp_dir_available: bool,
    path_entry_count: usize,
    unique_path_entry_count: usize,
    detected_tool_count: usize,
) -> SystemProfileSnapshot {
    SystemProfileSnapshot {
        snapshot_kind: "context-snapshot-only".to_string(),
        os_family: std::env::consts::FAMILY.to_string(),
        os: std::env::consts::OS.to_string(),
        architecture: std::env::consts::ARCH.to_string(),
        runtime_executable_available,
        temp_dir_available,
        path_entry_count,
        unique_path_entry_count,
        detected_tool_count,
        context_policy: "current-task-context-only".to_string(),
        persistence_policy: "review-before-working-or-durable-memory".to_string(),
        allowed_fields: vec![
            "os-family".to_string(),
            "os".to_string(),
            "architecture".to_string(),
            "runtime-executable-availability".to_string(),
            "temp-directory-availability".to_string(),
            "path-entry-counts".to_string(),
            "registered-tool-detection-count".to_string(),
        ],
        denied_fields: vec![
            "account-name".to_string(),
            "file-content".to_string(),
            "browser-history".to_string(),
            "network-identity".to_string(),
            "serial-number".to_string(),
            "token".to_string(),
            "cookie".to_string(),
            "api-key".to_string(),
        ],
        safety_boundary: vec![
            "non-sensitive-local-environment-only".to_string(),
            "no-file-content-read".to_string(),
            "no-account-or-browser-data".to_string(),
            "no-token-cookie-or-api-key-read".to_string(),
            "not-automatically-written-to-l2".to_string(),
        ],
    }
}

pub fn archive(run_id: String) -> Result<ComputerDiagnosticArchiveReceipt, store::StoreError> {
    let run = store::task_run_by_id(run_id.trim().to_string())?;
    if run.lifecycle_state != "approved"
        || run.approval_state != "approved"
        || run.execution_state != "approved-not-started"
    {
        return Err(store::StoreError::InvalidInput(
            "computer diagnostics require an approved, not-started Task Run".to_string(),
        ));
    }
    let report = preview();
    let artifact = store::append_task_artifacts(
        run.id.clone(),
        run.task_direction_id.clone(),
        vec![store::NewTaskArtifact {
            artifact_type: "computer-diagnostic".to_string(),
            reference_id: format!("computer-diagnostic-{}", report.generated_at_ms),
            title: "Read-only computer diagnostic".to_string(),
            summary: format!(
                "{} checks completed; overall state: {}.",
                report.checks.len(),
                report.overall_state
            ),
            metadata: serde_json::to_value(&report)?,
        }],
    )?
    .remove(0);
    let completed = store::complete_domain_task_run(
        run.id.clone(),
        format!("Read-only diagnostic archived as artifact {}.", artifact.id),
    )?;

    Ok(ComputerDiagnosticArchiveReceipt {
        report,
        artifact,
        run: completed,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preview_declares_read_only_boundaries_and_core_checks() {
        let report = preview();

        assert!(report.checks.iter().any(|check| check.id == "path-health"));
        assert!(report
            .safety_boundary
            .contains(&"no-file-deletion".to_string()));
        assert_eq!(report.system_profile.snapshot_kind, "context-snapshot-only");
        assert!(report
            .system_profile
            .denied_fields
            .contains(&"token".to_string()));
        assert!(report
            .system_profile
            .safety_boundary
            .contains(&"not-automatically-written-to-l2".to_string()));
    }

    #[test]
    fn cleanup_dry_run_never_deletes_or_starts_mutation() {
        let preview = cleanup_dry_run();

        assert_eq!(preview.state, "cleanup-dry-run-review-required");
        assert_eq!(preview.deleted_bytes, 0);
        assert!(!preview.mutation_started);
        assert!(preview.requires_restore_point);
        assert!(preview.requires_explicit_approval);
        assert!(preview
            .safety_boundary
            .contains(&"dry-run-only".to_string()));
        assert!(preview
            .safety_boundary
            .contains(&"no-file-content-read".to_string()));
        assert!(preview.denied_actions.contains(&"delete-files".to_string()));
        assert!(preview
            .candidates
            .iter()
            .all(|candidate| candidate.action_policy == "preview-only-no-delete"));
    }

    #[test]
    fn cleanup_mutation_preflight_requires_restore_point_and_never_mutates() {
        let preflight = cleanup_mutation_preflight();

        assert_eq!(preflight.state, "cleanup-mutation-blocked-by-default");
        assert_eq!(preflight.cleanup_state, "cleanup-dry-run-review-required");
        assert!(preflight.restore_point_required);
        assert!(!preflight.restore_point_available);
        assert!(preflight.explicit_approval_required);
        assert!(preflight.audit_required);
        assert!(preflight.rollback_plan_required);
        assert!(preflight.requires_admin);
        assert!(!preflight.system_mutation_started);
        assert!(!preflight.file_deletion_started);
        assert!(!preflight.registry_write_started);
        assert!(!preflight.process_kill_started);
        assert!(preflight
            .gates
            .contains(&"rollback-plan-required-before-real-cleanup".to_string()));
        assert!(preflight
            .blockers
            .contains(&"real-cleanup-executor-disabled".to_string()));
        assert!(preflight
            .denied_actions
            .contains(&"delete-files".to_string()));
        assert!(preflight
            .candidates
            .iter()
            .all(|candidate| candidate.action_policy == "preview-only-no-delete"));
    }
}
