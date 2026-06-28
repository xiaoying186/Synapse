use std::{
    env, fs,
    path::{Path, PathBuf},
    time::SystemTime,
};

use serde::{Deserialize, Serialize};

use crate::{config, domains::library_home, store};

#[derive(Debug, Clone, Serialize)]
pub struct ReadinessCheck {
    pub id: String,
    pub label: String,
    pub state: String,
    pub severity: String,
    pub detail: String,
    pub remediation: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProductionReadinessPreview {
    pub generated_at_ms: u128,
    pub state: String,
    pub summary: String,
    pub checks: Vec<ReadinessCheck>,
    pub gates: Vec<String>,
}

pub fn preview() -> Result<ProductionReadinessPreview, store::StoreError> {
    let runtime = config::read_runtime_config();
    let library = library_home::preview()?;
    Ok(preview_from(runtime, library))
}

fn preview_from(
    runtime: config::RuntimeConfig,
    library: library_home::LibraryHomePreview,
) -> ProductionReadinessPreview {
    preview_from_with_release_checks(runtime, library, release_environment_checks())
}

fn preview_from_with_release_checks(
    runtime: config::RuntimeConfig,
    library: library_home::LibraryHomePreview,
    release_checks: Vec<ReadinessCheck>,
) -> ProductionReadinessPreview {
    let mut checks = vec![
        check(
            "config-warnings",
            "Runtime config",
            if runtime.warnings.is_empty() {
                "pass"
            } else {
                "review"
            },
            if runtime.warnings.is_empty() {
                "info"
            } else {
                "warning"
            },
            if runtime.warnings.is_empty() {
                "Runtime config parsed without warnings.".to_string()
            } else {
                runtime.warnings.join(" / ")
            },
        ),
        check(
            "external-delivery",
            "External delivery",
            if runtime.external_delivery_enabled {
                "review-required"
            } else {
                "pass"
            },
            if runtime.external_delivery_enabled {
                "warning"
            } else {
                "info"
            },
            if runtime.external_delivery_enabled {
                "External delivery is enabled; V6.5 local-first production requires explicit channel and Task Run review.".to_string()
            } else {
                "External delivery is disabled by default; Feishu and WeChat remain preview-only."
                    .to_string()
            },
        ),
        check(
            "agent-execution",
            "Agent execution",
            if runtime.agent_execution_enabled {
                "blocked"
            } else {
                "pass"
            },
            if runtime.agent_execution_enabled {
                "critical"
            } else {
                "info"
            },
            if runtime.agent_execution_enabled {
                "Direct Agent process execution is enabled, which is outside the current V6.5 production baseline.".to_string()
            } else {
                "Agent process execution is disabled; team and harness flows remain preview/guarded.".to_string()
            },
        ),
        check(
            "agent-team-blueprint-preview",
            "Agent team blueprint",
            "pass",
            "info",
            "Agent team orchestration is limited to bounded blueprint preview; no Agent process is started."
                .to_string(),
        ),
        check(
            "feishu-wechat-preview-adapters",
            "Feishu/WeChat adapters",
            "pass",
            "info",
            "Feishu and WeChat notification adapters are preview-only in the V6.5 baseline; delivery is not started."
                .to_string(),
        ),
        check(
            "local-app-launch-only",
            "Local app bridge",
            "pass",
            "info",
            "Local App Bridge is limited to built-in or reviewed descriptors, explicit approval, no arguments, and no session or window-content extraction."
                .to_string(),
        ),
        check(
            "browser-readonly-automation",
            "Browser automation",
            "pass",
            "info",
            "Browser automation is limited to allowlisted hosts, read-only navigation, no form submission, no downloads, redirect revalidation, and quarantined output."
                .to_string(),
        ),
        check(
            "web-app-shell-manual-preview",
            "Web App Shell",
            "pass",
            "info",
            "Web App Shell is limited to manual isolated profile preview; no auto-login, submission, publishing, trading, sensitive page read, session export, or process start is implemented."
                .to_string(),
        ),
        check(
            "codebase-memory-structural-preview",
            "Codebase Memory",
            "pass",
            "info",
            "Codebase Memory adapter is limited to read-only CodeGraph structural context preview; no command execution, repository-wide scan, file-content ingest, automatic L2 write, or index rebuild is performed."
                .to_string(),
        ),
        check(
            "permission-memory-candidate-preview",
            "Permission Memory",
            "pass",
            "info",
            "Permission Memory is limited to reusable approval candidates with scope, tool, level, action pattern, expiry, revocation, and audit references; it never auto-grants cross-project, deletion, account, publishing, trading, durable Zhishu write, or Agent execution permissions."
                .to_string(),
        ),
        check(
            "http-source-quarantine",
            "HTTP source adapter",
            "pass",
            "info",
            "HTTP aggregation uses configured JSON sources only, rejects credentials and redirects, bounds response size, and quarantines observations before Zhishu review."
                .to_string(),
        ),
        check(
            "device-sync-local-first",
            "Device sync",
            "pass",
            "info",
            "Device sync uses local packages with SHA-256 integrity, import preview, explicit replace approval, and relay dry-run only in this baseline."
                .to_string(),
        ),
        check(
            "computer-diagnostics-readonly",
            "Computer diagnostics",
            "pass",
            "info",
            "Computer diagnostics are read-only and do not launch processes, delete files, write registry values, or change system settings."
                .to_string(),
        ),
        check(
            "store-schema-migration",
            "Store schema",
            "pass",
            "info",
            "Store supports schema envelopes, legacy array reads, future-schema rejection, atomic file replacement, and one-time legacy import into the Zhishu repository."
                .to_string(),
        ),
        check(
            "relay-upload",
            "Relay upload",
            if runtime.relay_enabled {
                "review-required"
            } else {
                "pass"
            },
            if runtime.relay_enabled {
                "warning"
            } else {
                "info"
            },
            if runtime.relay_enabled {
                "Relay sync is enabled; verify endpoint, token handling, and explicit import/export review before production.".to_string()
            } else {
                "Relay upload is disabled; device sync remains local export/import.".to_string()
            },
        ),
        check(
            "saga-recovery",
            "Saga recovery",
            if library.active_saga_count > 0 {
                "blocked"
            } else {
                "pass"
            },
            if library.active_saga_count > 0 {
                "critical"
            } else {
                "info"
            },
            if library.active_saga_count > 0 {
                format!(
                    "{} active or failed saga transaction(s) require review before production use.",
                    library.active_saga_count
                )
            } else {
                "No active or failed saga transactions found in the recent window.".to_string()
            },
        ),
        check(
            "restore-points",
            "Restore points",
            if library.recent_backup_snapshot_count > 0 {
                "pass"
            } else {
                "review-required"
            },
            if library.recent_backup_snapshot_count > 0 {
                "info"
            } else {
                "warning"
            },
            if library.recent_backup_snapshot_count > 0 {
                format!(
                    "{} recent protected restore point(s) are visible.",
                    library.recent_backup_snapshot_count
                )
            } else {
                "No recent restore points are visible; create a protected snapshot before risky production changes.".to_string()
            },
        ),
        check(
            "pending-memory-review",
            "Memory admission",
            if library.pending_review_count > 0 {
                "review-required"
            } else {
                "pass"
            },
            if library.pending_review_count > 0 {
                "warning"
            } else {
                "info"
            },
            if library.pending_review_count > 0 {
                format!(
                    "{} recent memory item(s) are still pending or unverified.",
                    library.pending_review_count
                )
            } else {
                "Recent memory items do not show pending admission review.".to_string()
            },
        ),
    ];

    checks.push(check(
        "library-home",
        "Library Home",
        "pass",
        "info",
        "Library Home projection is available as a read-only production overview with backup library, recycle, temporary recovery area, permission review, and audit boundaries."
            .to_string(),
    ));
    checks.extend(release_checks);

    let state = readiness_state(&checks).to_string();
    let summary = match state.as_str() {
        "blocked" => "Production baseline is blocked until critical V6.5 gates are resolved.",
        "local-review-required" => "Production baseline is close, but local review gates remain.",
        _ => "Production baseline is ready for local-first guarded use.",
    }
    .to_string();

    ProductionReadinessPreview {
        generated_at_ms: store::now_millis(),
        state,
        summary,
        checks,
        gates: vec![
            "no-direct-agent-execution".to_string(),
            "agent-team-blueprint-preview-only".to_string(),
            "feishu-wechat-preview-only".to_string(),
            "local-app-launch-only-with-explicit-approval".to_string(),
            "browser-readonly-allowlisted-quarantine".to_string(),
            "web-app-shell-manual-isolated-preview".to_string(),
            "codebase-memory-readonly-structural-preview".to_string(),
            "permission-memory-candidate-only-no-auto-grant".to_string(),
            "http-source-json-only-quarantine".to_string(),
            "device-sync-local-package-relay-preview".to_string(),
            "computer-diagnostics-readonly".to_string(),
            "backup-library-readonly-temporary-restore-first".to_string(),
            "store-schema-envelope-and-legacy-migration".to_string(),
            "no-automatic-social-or-webhook-publish".to_string(),
            "no-automatic-l2-write".to_string(),
            "store-snapshot-audit-saga-traceability".to_string(),
            "explicit-review-before-risky-local-changes".to_string(),
        ],
    }
}

fn readiness_state(checks: &[ReadinessCheck]) -> &'static str {
    if checks.iter().any(|check| check.state == "blocked") {
        "blocked"
    } else if checks.iter().any(|check| {
        check.state == "review"
            || check.state == "review-required"
            || check.state == "release-blocked"
    }) {
        "local-review-required"
    } else {
        "ready-local"
    }
}

fn release_environment_checks() -> Vec<ReadinessCheck> {
    release_environment_checks_at(&project_root(), &env::var("PATH").unwrap_or_default())
}

fn release_environment_checks_at(project_root: &Path, path_value: &str) -> Vec<ReadinessCheck> {
    vec![
        release_evidence_check(project_root),
        git_repository_check(project_root),
        windows_msi_tooling_check(path_value),
    ]
}

#[derive(Debug, Deserialize)]
struct ReleaseEvidence {
    schema_version: u64,
    release_review: ReleaseReview,
}

#[derive(Debug, Deserialize)]
struct ReleaseReview {
    ready: bool,
    blockers: Vec<ReleaseBlocker>,
    artifact_readiness: ArtifactReadiness,
}

#[derive(Debug, Deserialize)]
struct ReleaseBlocker {
    id: String,
}

#[derive(Debug, Deserialize)]
struct ArtifactReadiness {
    release_msi_count: u64,
    has_distributable_msi: bool,
}

fn release_evidence_check(project_root: &Path) -> ReadinessCheck {
    let evidence_path = project_root
        .join(".tmp")
        .join("release-evidence")
        .join("release-evidence.json");
    let Ok(contents) = fs::read_to_string(&evidence_path) else {
        return check_with_remediation(
            "release-evidence-status",
            "Release evidence",
            "review-required",
            "warning",
            "Release evidence has not been generated yet.".to_string(),
            "Run npm.cmd run release:evidence before making release or production claims."
                .to_string(),
        );
    };
    let Ok(evidence) = serde_json::from_str::<ReleaseEvidence>(&contents) else {
        return check_with_remediation(
            "release-evidence-status",
            "Release evidence",
            "review-required",
            "warning",
            "Release evidence JSON could not be parsed.".to_string(),
            "Regenerate evidence with npm.cmd run release:evidence, then rerun Production Readiness."
                .to_string(),
        );
    };
    if evidence.schema_version != 1 {
        return check_with_remediation(
            "release-evidence-status",
            "Release evidence",
            "review-required",
            "warning",
            format!(
                "Release evidence schema_version {} is not supported by this build.",
                evidence.schema_version
            ),
            "Regenerate evidence with the current release scripts before publishing.".to_string(),
        );
    }
    let stale_inputs = stale_release_evidence_inputs(project_root, &evidence_path);
    if !stale_inputs.is_empty() {
        return check_with_remediation(
            "release-evidence-status",
            "Release evidence",
            "review-required",
            "warning",
            format!(
                "Release evidence is stale; newer input(s): {}.",
                stale_inputs.join(", ")
            ),
            "Run npm.cmd run release:evidence after release-relevant source, config, or documentation changes."
                .to_string(),
        );
    }
    if evidence.release_review.ready {
        return check(
            "release-evidence-status",
            "Release evidence",
            "pass",
            "info",
            format!(
                "Release evidence is current and marks release ready with {} distributable MSI artifact(s).",
                evidence.release_review.artifact_readiness.release_msi_count
            ),
        );
    }
    let blocker_ids = evidence
        .release_review
        .blockers
        .iter()
        .map(|blocker| blocker.id.as_str())
        .collect::<Vec<_>>();
    let artifact_detail = if evidence
        .release_review
        .artifact_readiness
        .has_distributable_msi
    {
        "a distributable MSI is present"
    } else {
        "no distributable release MSI is present"
    };
    check_with_remediation(
        "release-evidence-status",
        "Release evidence",
        "release-blocked",
        "warning",
        format!(
            "Release evidence is current but not ready: blocker(s) [{}]; {}.",
            blocker_ids.join(", "),
            artifact_detail
        ),
        "Resolve the release blockers, run npm.cmd run release:evidence, then review npm.cmd run release:doctor -- --json."
            .to_string(),
    )
}

fn stale_release_evidence_inputs(project_root: &Path, evidence_path: &Path) -> Vec<String> {
    let Ok(evidence_mtime) = modified_time(evidence_path) else {
        return vec![".tmp/release-evidence/release-evidence.json".to_string()];
    };
    [
        "package.json",
        "package-lock.json",
        ".gitattributes",
        "src-tauri/Cargo.toml",
        "src-tauri/Cargo.lock",
        "src-tauri/tauri.conf.json",
        "src-tauri/src/domains/agent_harness.rs",
        "src-tauri/src/domains/context_budget.rs",
        "src-tauri/src/domains/library_home.rs",
        "src-tauri/src/domains/computer_diagnostics.rs",
        "src-tauri/src/domains/web_app_shell.rs",
        "src-tauri/src/domains/codebase_memory.rs",
        "src-tauri/src/domains/permission_memory.rs",
        "src-tauri/src/domains/production_readiness.rs",
        "src-tauri/src/services/system.rs",
        "src/components/ContextBudgetPanel.tsx",
        "src/components/LibraryHomePanel.tsx",
        "src/components/ComputerDiagnosticsPanel.tsx",
        "src/components/WebAppShellPanel.tsx",
        "src/components/CodebaseMemoryPanel.tsx",
        "src/components/PermissionMemoryPanel.tsx",
        "synapse.config.toml",
        "README.md",
        "PRODUCTION_RELEASE_CHECKLIST.md",
        "RELEASE_DISTRIBUTION_NOTES.md",
        "PRODUCTION_READINESS_STATUS.md",
        "V65_ALIGNMENT_MATRIX.md",
        ".github/workflows/v65-local-baseline.yml",
        "scripts/production-preflight.mjs",
        "scripts/release-evidence.mjs",
        "scripts/release-status.mjs",
        "scripts/release-doctor.mjs",
        "scripts/git-diagnose.mjs",
        "scripts/wix-diagnose.mjs",
        "scripts/ui-smoke.mjs",
        "src/App.tsx",
        "src/App.css",
        ".tmp/ui-smoke/desktop.png",
        ".tmp/ui-smoke/mobile.png",
    ]
    .into_iter()
    .filter(|relative| {
        modified_time(&project_root.join(relative))
            .map(|mtime| mtime > evidence_mtime)
            .unwrap_or(false)
    })
    .map(str::to_string)
    .collect()
}

fn modified_time(path: &Path) -> std::io::Result<SystemTime> {
    fs::metadata(path)?.modified()
}

fn git_repository_check(project_root: &Path) -> ReadinessCheck {
    let git_path = project_root.join(".git");
    let Ok(metadata) = fs::metadata(&git_path) else {
        return check_with_remediation(
            "release-git-repository",
            "Release Git repository",
            "release-blocked",
            "warning",
            ".git does not exist; initialize Git before publishing to GitHub.".to_string(),
            "Run git init from the project root after confirming no previous history needs to be preserved.".to_string(),
        );
    };
    if !metadata.is_dir() {
        return check_with_remediation(
            "release-git-repository",
            "Release Git repository",
            "release-blocked",
            "warning",
            ".git exists but is not a directory; inspect repository metadata before publishing."
                .to_string(),
            "Inspect .git manually; only repair it after confirming whether it is a worktree pointer or corrupted metadata.".to_string(),
        );
    }
    let names = fs::read_dir(&git_path)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .filter_map(|entry| entry.file_name().into_string().ok())
        .collect::<Vec<_>>();
    if names.is_empty() {
        return check_with_remediation(
            "release-git-repository",
            "Release Git repository",
            "release-blocked",
            "warning",
            ".git is an empty directory; remove it intentionally, then run git init before publishing."
                .to_string(),
            "If no history must be preserved, remove only the empty .git directory, run git init, then rerun release preflight.".to_string(),
        );
    }
    let missing = ["HEAD", "objects", "refs"]
        .into_iter()
        .filter(|name| !names.iter().any(|entry| entry == name))
        .collect::<Vec<_>>();
    if !missing.is_empty() {
        return check_with_remediation(
            "release-git-repository",
            "Release Git repository",
            "release-blocked",
            "warning",
            format!(
                ".git is missing expected item(s): {}; repair Git before publishing.",
                missing.join(", ")
            ),
            "Repair or reinitialize the repository before publishing to GitHub.".to_string(),
        );
    }
    check(
        "release-git-repository",
        "Release Git repository",
        "pass",
        "info",
        ".git has the basic repository shape required before GitHub publishing.".to_string(),
    )
}

fn windows_msi_tooling_check(path_value: &str) -> ReadinessCheck {
    if !cfg!(windows) {
        return check(
            "release-msi-tooling",
            "Windows MSI tooling",
            "pass",
            "info",
            "MSI tooling check is skipped on non-Windows hosts.".to_string(),
        );
    }
    if command_exists(path_value, "wix.exe")
        || (command_exists(path_value, "candle.exe") && command_exists(path_value, "light.exe"))
    {
        return check(
            "release-msi-tooling",
            "Windows MSI tooling",
            "pass",
            "info",
            "WiX tooling is available on PATH for MSI bundling.".to_string(),
        );
    }
    check_with_remediation(
        "release-msi-tooling",
        "Windows MSI tooling",
        "release-blocked",
        "warning",
        "MSI packaging needs WiX installed on PATH or pre-cached for Tauri bundling.".to_string(),
        "Install WiX v3/v4 on PATH, or allow Tauri to download/cache wix314-binaries.zip in a network-enabled release environment.".to_string(),
    )
}

fn command_exists(path_value: &str, command: &str) -> bool {
    env::split_paths(path_value).any(|directory| directory.join(command).exists())
}

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri must live inside the project root")
        .to_path_buf()
}

fn check(id: &str, label: &str, state: &str, severity: &str, detail: String) -> ReadinessCheck {
    check_with_optional_remediation(id, label, state, severity, detail, None)
}

fn check_with_remediation(
    id: &str,
    label: &str,
    state: &str,
    severity: &str,
    detail: String,
    remediation: String,
) -> ReadinessCheck {
    check_with_optional_remediation(id, label, state, severity, detail, Some(remediation))
}

fn check_with_optional_remediation(
    id: &str,
    label: &str,
    state: &str,
    severity: &str,
    detail: String,
    remediation: Option<String>,
) -> ReadinessCheck {
    ReadinessCheck {
        id: id.to_string(),
        label: label.to_string(),
        state: state.to_string(),
        severity: severity.to_string(),
        detail,
        remediation,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn runtime() -> config::RuntimeConfig {
        config::RuntimeConfig::default()
    }

    fn library(
        active_saga_count: usize,
        snapshots: usize,
        pending: usize,
    ) -> library_home::LibraryHomePreview {
        library_home::LibraryHomePreview {
            generated_at_ms: 1,
            state: "read-only-preview".to_string(),
            recent_memory_count: 0,
            pending_review_count: pending,
            recent_task_artifact_count: 0,
            recent_backup_snapshot_count: snapshots,
            recent_audit_event_count: 0,
            recycle_candidate_count: 0,
            active_saga_count,
            recycle_state: "empty-metadata-preview".to_string(),
            memory_by_level: Vec::new(),
            memory_by_area: Vec::new(),
            recent_memory: Vec::new(),
            recent_task_artifacts: Vec::new(),
            recent_snapshots: Vec::new(),
            recycle_candidates: Vec::new(),
            recent_audit_events: Vec::new(),
            recent_sagas: Vec::new(),
            gates: Vec::new(),
        }
    }

    fn clean_release_checks() -> Vec<ReadinessCheck> {
        vec![
            check(
                "release-git-repository",
                "Release Git repository",
                "pass",
                "info",
                "test git pass".to_string(),
            ),
            check(
                "release-msi-tooling",
                "Windows MSI tooling",
                "pass",
                "info",
                "test msi pass".to_string(),
            ),
        ]
    }

    #[test]
    fn blocks_when_agent_execution_is_enabled() {
        let mut runtime = runtime();
        runtime.agent_execution_enabled = true;
        let preview =
            preview_from_with_release_checks(runtime, library(0, 1, 0), clean_release_checks());

        assert_eq!(preview.state, "blocked");
        assert!(preview
            .checks
            .iter()
            .any(|check| check.id == "agent-execution" && check.state == "blocked"));
    }

    #[test]
    fn requests_review_without_restore_points() {
        let preview =
            preview_from_with_release_checks(runtime(), library(0, 0, 0), clean_release_checks());

        assert_eq!(preview.state, "local-review-required");
        assert!(preview
            .checks
            .iter()
            .any(|check| check.id == "restore-points" && check.state == "review-required"));
    }

    #[test]
    fn passes_local_when_v65_gates_are_clean() {
        let preview =
            preview_from_with_release_checks(runtime(), library(0, 1, 0), clean_release_checks());

        assert_eq!(preview.state, "ready-local");
    }

    #[test]
    fn release_blocked_checks_request_local_review() {
        let preview = preview_from_with_release_checks(
            runtime(),
            library(0, 1, 0),
            vec![check(
                "release-git-repository",
                "Release Git repository",
                "release-blocked",
                "warning",
                "test release blocker".to_string(),
            )],
        );

        assert_eq!(preview.state, "local-review-required");
        assert!(preview
            .checks
            .iter()
            .any(|check| check.id == "release-git-repository"));
    }

    #[test]
    fn empty_git_directory_blocks_release_readiness() {
        let root = env::temp_dir().join(format!(
            "synapse-production-readiness-test-{}",
            store::now_millis()
        ));
        let git = root.join(".git");
        fs::create_dir_all(&git).unwrap();

        let check = git_repository_check(&root);

        fs::remove_dir_all(&root).unwrap();
        assert_eq!(check.state, "release-blocked");
        assert!(check.detail.contains("empty directory"));
        assert!(check.remediation.unwrap().contains("git init"));
    }

    #[test]
    fn missing_release_evidence_requests_review() {
        let root = env::temp_dir().join(format!(
            "synapse-production-readiness-evidence-missing-test-{}",
            store::now_millis()
        ));
        fs::create_dir_all(&root).unwrap();

        let check = release_evidence_check(&root);

        fs::remove_dir_all(&root).unwrap();
        assert_eq!(check.state, "review-required");
        assert!(check.detail.contains("not been generated"));
        assert!(check.remediation.unwrap().contains("release:evidence"));
    }

    #[test]
    fn release_evidence_blockers_surface_in_readiness() {
        let root = env::temp_dir().join(format!(
            "synapse-production-readiness-evidence-blocked-test-{}",
            store::now_millis()
        ));
        let evidence_dir = root.join(".tmp").join("release-evidence");
        fs::create_dir_all(&evidence_dir).unwrap();
        fs::write(
            evidence_dir.join("release-evidence.json"),
            r#"{
              "schema_version": 1,
              "release_review": {
                "ready": false,
                "blockers": [{ "id": "git-repository" }, { "id": "windows-msi-tooling" }],
                "artifact_readiness": {
                  "release_msi_count": 0,
                  "has_distributable_msi": false
                }
              }
            }"#,
        )
        .unwrap();

        let check = release_evidence_check(&root);

        fs::remove_dir_all(&root).unwrap();
        assert_eq!(check.state, "release-blocked");
        assert!(check.detail.contains("git-repository"));
        assert!(check.detail.contains("no distributable release MSI"));
        assert!(check
            .remediation
            .unwrap()
            .contains("release:doctor -- --json"));
    }
}
