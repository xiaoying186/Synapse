use std::path::PathBuf;
use std::sync::{OnceLock, RwLock};

use crate::config;

#[cfg(test)]
use std::cell::RefCell;

#[cfg(test)]
thread_local! {
    static TEST_DATA_ROOT: RefCell<Option<PathBuf>> = const { RefCell::new(None) };
}

static RUNTIME_DATA_ROOT: OnceLock<RwLock<Option<PathBuf>>> = OnceLock::new();

fn data_file(file_name: &str) -> PathBuf {
    #[cfg(test)]
    if let Some(root) = TEST_DATA_ROOT.with(|value| value.borrow().clone()) {
        return root.join(file_name);
    }

    active_data_root().join(file_name)
}

pub(crate) fn active_data_root() -> PathBuf {
    runtime_data_root().unwrap_or_else(config::storage_data_root)
}

pub(crate) fn configure_runtime_data_root(root: PathBuf) -> Result<(), crate::store::StoreError> {
    if root.as_os_str().is_empty() {
        return Err(crate::store::StoreError::InvalidInput(
            "runtime storage root cannot be empty".to_string(),
        ));
    }
    std::fs::create_dir_all(&root)?;
    let lock = RUNTIME_DATA_ROOT.get_or_init(|| RwLock::new(None));
    let mut current = lock
        .write()
        .map_err(|_| crate::store::StoreError::InvalidInput("runtime storage lock poisoned".to_string()))?;
    if let Some(existing) = current.as_ref() {
        if existing != &root {
            return Err(crate::store::StoreError::InvalidInput(format!(
                "runtime storage root is already configured: {}",
                existing.display()
            )));
        }
        return Ok(());
    }
    *current = Some(root);
    Ok(())
}

fn runtime_data_root() -> Option<PathBuf> {
    RUNTIME_DATA_ROOT
        .get()
        .and_then(|lock| lock.read().ok().and_then(|value| value.clone()))
}

#[cfg(test)]
pub(crate) fn with_test_data_root<T>(root: PathBuf, operation: impl FnOnce() -> T) -> T {
    struct RestoreTestDataRoot(Option<PathBuf>);

    impl Drop for RestoreTestDataRoot {
        fn drop(&mut self) {
            TEST_DATA_ROOT.with(|value| {
                *value.borrow_mut() = self.0.take();
            });
        }
    }

    let previous = TEST_DATA_ROOT.with(|value| value.replace(Some(root)));
    let _restore = RestoreTestDataRoot(previous);
    operation()
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

pub(crate) fn provider_receipt_review_candidate_path() -> PathBuf {
    data_file("provider-receipt-review-candidates.json")
}

pub(crate) fn provider_artifact_admission_review_path() -> PathBuf {
    data_file("provider-artifact-admission-reviews.json")
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

pub(crate) fn notification_delivery_attempt_path() -> PathBuf {
    data_file("notification-delivery-attempts.json")
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

pub(crate) fn source_registry_approval_path() -> PathBuf {
    data_file("source-registry-approvals.json")
}

pub(crate) fn zhishu_relation_path() -> PathBuf {
    data_file("zhishu-relations.json")
}

pub(crate) fn zhishu_maintenance_finding_path() -> PathBuf {
    data_file("zhishu-maintenance-findings.json")
}
