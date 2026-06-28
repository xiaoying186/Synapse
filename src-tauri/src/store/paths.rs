use std::path::PathBuf;

fn data_file(file_name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri must live inside the project root")
        .join(".synapse")
        .join(file_name)
}

pub(crate) fn history_path() -> PathBuf {
    data_file("plan-history.json")
}

pub(crate) fn review_path() -> PathBuf {
    data_file("review-history.json")
}

pub(crate) fn execution_path() -> PathBuf {
    data_file("execution-queue.json")
}

pub(crate) fn memory_path() -> PathBuf {
    data_file("memory-items.json")
}

pub(crate) fn task_direction_path() -> PathBuf {
    data_file("task-center-directions.json")
}

pub(crate) fn task_candidate_path() -> PathBuf {
    data_file("task-center-candidates.json")
}

pub(crate) fn task_run_path() -> PathBuf {
    data_file("task-center-runs.json")
}

pub(crate) fn task_artifact_path() -> PathBuf {
    data_file("task-center-artifacts.json")
}

pub(crate) fn arsenal_allowlist_path() -> PathBuf {
    data_file("arsenal-allowlist.json")
}

pub(crate) fn arsenal_tools_path() -> PathBuf {
    data_file("arsenal-tools.json")
}

pub(crate) fn local_apps_path() -> PathBuf {
    data_file("local-apps.json")
}

pub(crate) fn device_sync_state_path() -> PathBuf {
    data_file("device-sync-state.json")
}

pub(crate) fn snapshot_path() -> PathBuf {
    data_file("snapshots.json")
}

pub(crate) fn audit_event_path() -> PathBuf {
    data_file("audit-events.json")
}

pub(crate) fn scheduler_state_path() -> PathBuf {
    data_file("scheduler-state.json")
}

pub(crate) fn source_observation_path() -> PathBuf {
    data_file("source-observations.json")
}

pub(crate) fn zhishu_relation_path() -> PathBuf {
    data_file("zhishu-relations.json")
}

pub(crate) fn zhishu_maintenance_finding_path() -> PathBuf {
    data_file("zhishu-maintenance-findings.json")
}
