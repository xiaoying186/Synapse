use serde::Serialize;

use crate::store;

#[derive(Debug, Clone, Serialize)]
pub struct CodebaseMemorySource {
    pub id: String,
    pub label: String,
    pub path: String,
    pub state: String,
    pub scope: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CodebaseMemoryPreview {
    pub generated_at_ms: u128,
    pub state: String,
    pub adapter_mode: String,
    pub index_root: String,
    pub index_present: bool,
    pub process_started: bool,
    pub repository_scanned: bool,
    pub file_content_ingested: bool,
    pub sources: Vec<CodebaseMemorySource>,
    pub gates: Vec<String>,
    pub denied_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CodebaseMemoryAdmissionPreflight {
    pub generated_at_ms: u128,
    pub state: String,
    pub adapter_state: String,
    pub source_id: String,
    pub process_started: bool,
    pub repository_scanned: bool,
    pub file_content_ingested: bool,
    pub l2_write_started: bool,
    pub requires_index_freshness_check: bool,
    pub requires_source_scope_review: bool,
    pub requires_human_summary_review: bool,
    pub requires_zhishu_admission_review: bool,
    pub gates: Vec<String>,
    pub blockers: Vec<String>,
    pub denied_actions: Vec<String>,
}

pub fn preview() -> CodebaseMemoryPreview {
    let project_root = project_root();
    let index_root = project_root.join(".codegraph");
    let index_present = index_root.exists();
    let sources = vec![
        source(
            "codegraph-index",
            "CodeGraph structural index",
            ".codegraph",
            if index_present {
                "available"
            } else {
                "not-initialized"
            },
            "structural-symbols-only",
        ),
        source(
            "project-agent-rules",
            "Project AGENTS instructions",
            "AGENTS.md",
            if project_root.join("AGENTS.md").exists() {
                "available"
            } else {
                "missing"
            },
            "operator-reviewable-rules",
        ),
    ];

    CodebaseMemoryPreview {
        generated_at_ms: store::now_millis(),
        state: if index_present {
            "readonly-structural-preview"
        } else {
            "index-not-initialized"
        }
        .to_string(),
        adapter_mode: "codegraph-mcp-preview".to_string(),
        index_root: index_root.display().to_string(),
        index_present,
        process_started: false,
        repository_scanned: false,
        file_content_ingested: false,
        sources,
        gates: vec![
            "codegraph-readonly-structural-context".to_string(),
            "no-repository-wide-scan".to_string(),
            "no-file-content-ingest".to_string(),
            "no-command-execution".to_string(),
            "no-automatic-l2-write".to_string(),
            "review-before-zhishu-admission".to_string(),
            "index-staleness-visible-before-use".to_string(),
            "operator-approval-before-index-rebuild".to_string(),
        ],
        denied_actions: vec![
            "run-codegraph-init".to_string(),
            "rebuild-index-without-approval".to_string(),
            "ingest-raw-source-files".to_string(),
            "write-durable-memory".to_string(),
            "read-secrets-or-env".to_string(),
            "apply-code-changes".to_string(),
        ],
    }
}

pub fn preflight_admission(source_id: String) -> CodebaseMemoryAdmissionPreflight {
    let preview = preview();
    let source_id = source_id.trim();
    let source = preview
        .sources
        .iter()
        .find(|source| source.id == source_id)
        .or_else(|| preview.sources.first());

    CodebaseMemoryAdmissionPreflight {
        generated_at_ms: store::now_millis(),
        state: "codebase-memory-admission-review-required".to_string(),
        adapter_state: preview.state,
        source_id: source
            .map(|source| source.id.clone())
            .unwrap_or_else(|| "codebase-memory-source-missing".to_string()),
        process_started: false,
        repository_scanned: false,
        file_content_ingested: false,
        l2_write_started: false,
        requires_index_freshness_check: true,
        requires_source_scope_review: true,
        requires_human_summary_review: true,
        requires_zhishu_admission_review: true,
        gates: vec![
            "codegraph-readonly-structural-context".to_string(),
            "index-freshness-visible-before-use".to_string(),
            "source-scope-review-before-admission".to_string(),
            "human-summary-review-before-l2-write".to_string(),
            "review-before-zhishu-admission".to_string(),
            "no-repository-wide-scan".to_string(),
            "no-file-content-ingest".to_string(),
            "no-command-execution".to_string(),
            "no-automatic-l2-write".to_string(),
        ],
        blockers: vec![
            "index-freshness-not-confirmed".to_string(),
            "source-scope-not-reviewed".to_string(),
            "human-summary-not-approved".to_string(),
            "zhishu-admission-not-approved".to_string(),
        ],
        denied_actions: vec![
            "run-codegraph-init".to_string(),
            "rebuild-index-without-approval".to_string(),
            "repository-wide-scan".to_string(),
            "ingest-raw-source-files".to_string(),
            "write-durable-memory".to_string(),
            "read-secrets-or-env".to_string(),
            "apply-code-changes".to_string(),
        ],
    }
}

fn source(id: &str, label: &str, path: &str, state: &str, scope: &str) -> CodebaseMemorySource {
    CodebaseMemorySource {
        id: id.to_string(),
        label: label.to_string(),
        path: path.to_string(),
        state: state.to_string(),
        scope: scope.to_string(),
    }
}

fn project_root() -> std::path::PathBuf {
    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri must live inside the project root")
        .to_path_buf()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preview_does_not_start_processes_or_ingest_files() {
        let preview = preview();

        assert!(!preview.process_started);
        assert!(!preview.repository_scanned);
        assert!(!preview.file_content_ingested);
        assert!(preview.gates.contains(&"no-command-execution".to_string()));
        assert!(preview.gates.contains(&"no-automatic-l2-write".to_string()));
    }

    #[test]
    fn preview_surfaces_index_state_and_admission_guard() {
        let preview = preview();

        assert_eq!(preview.adapter_mode, "codegraph-mcp-preview");
        assert!(
            preview.state == "readonly-structural-preview"
                || preview.state == "index-not-initialized"
        );
        assert!(preview
            .gates
            .contains(&"review-before-zhishu-admission".to_string()));
        assert!(preview
            .denied_actions
            .contains(&"rebuild-index-without-approval".to_string()));
    }

    #[test]
    fn admission_preflight_never_scans_ingests_or_writes_l2() {
        let preflight = preflight_admission("codegraph-index".to_string());

        assert_eq!(preflight.state, "codebase-memory-admission-review-required");
        assert_eq!(preflight.source_id, "codegraph-index");
        assert!(!preflight.process_started);
        assert!(!preflight.repository_scanned);
        assert!(!preflight.file_content_ingested);
        assert!(!preflight.l2_write_started);
        assert!(preflight.requires_index_freshness_check);
        assert!(preflight.requires_source_scope_review);
        assert!(preflight.requires_human_summary_review);
        assert!(preflight.requires_zhishu_admission_review);
        assert!(preflight
            .gates
            .contains(&"human-summary-review-before-l2-write".to_string()));
        assert!(preflight
            .blockers
            .contains(&"zhishu-admission-not-approved".to_string()));
        assert!(preflight
            .denied_actions
            .contains(&"write-durable-memory".to_string()));
    }
}
