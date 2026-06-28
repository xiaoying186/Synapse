use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::store::{now_millis, paths, read_json_records, write_json_records, StoreError};

pub const DEFAULT_SCHEDULER_LEASE_MS: u128 = 30_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchedulerPersistentState {
    pub state: String,
    pub lease_owner: Option<String>,
    pub lease_expires_at_ms: Option<u128>,
    pub last_heartbeat_at_ms: Option<u128>,
    pub last_tick_at_ms: Option<u128>,
    pub last_success_at_ms: Option<u128>,
    pub last_error: Option<String>,
    pub consecutive_failures: u32,
}

impl Default for SchedulerPersistentState {
    fn default() -> Self {
        Self {
            state: "stopped".to_string(),
            lease_owner: None,
            lease_expires_at_ms: None,
            last_heartbeat_at_ms: None,
            last_tick_at_ms: None,
            last_success_at_ms: None,
            last_error: None,
            consecutive_failures: 0,
        }
    }
}

pub fn read_scheduler_state() -> Result<SchedulerPersistentState, StoreError> {
    read_scheduler_state_at(&paths::scheduler_state_path())
}

pub fn acquire_scheduler_lease(
    owner: String,
    lease_ms: Option<u128>,
) -> Result<SchedulerPersistentState, StoreError> {
    acquire_scheduler_lease_at(
        &paths::scheduler_state_path(),
        owner,
        lease_ms.unwrap_or(DEFAULT_SCHEDULER_LEASE_MS),
        now_millis(),
    )
}

pub fn heartbeat_scheduler_lease(
    owner: String,
    lease_ms: Option<u128>,
) -> Result<SchedulerPersistentState, StoreError> {
    heartbeat_scheduler_lease_at(
        &paths::scheduler_state_path(),
        owner,
        lease_ms.unwrap_or(DEFAULT_SCHEDULER_LEASE_MS),
        now_millis(),
    )
}

pub fn release_scheduler_lease(owner: String) -> Result<SchedulerPersistentState, StoreError> {
    release_scheduler_lease_at(&paths::scheduler_state_path(), owner)
}

pub fn record_scheduler_tick_result(
    owner: String,
    success: bool,
    error: Option<String>,
) -> Result<SchedulerPersistentState, StoreError> {
    record_scheduler_tick_result_at(
        &paths::scheduler_state_path(),
        owner,
        success,
        error,
        now_millis(),
    )
}

fn read_scheduler_state_at(path: &Path) -> Result<SchedulerPersistentState, StoreError> {
    Ok(read_json_records::<SchedulerPersistentState>(path)?
        .into_iter()
        .next()
        .unwrap_or_default())
}

fn acquire_scheduler_lease_at(
    path: &Path,
    owner: String,
    lease_ms: u128,
    now: u128,
) -> Result<SchedulerPersistentState, StoreError> {
    let owner = require_owner(owner)?;
    let mut state = read_scheduler_state_at(path)?;
    let active_other_owner = state
        .lease_expires_at_ms
        .is_some_and(|expires| expires > now)
        && state
            .lease_owner
            .as_deref()
            .is_some_and(|value| value != owner);
    if active_other_owner {
        return Err(StoreError::InvalidInput(format!(
            "scheduler lease is held by {}",
            state.lease_owner.as_deref().unwrap_or("another instance")
        )));
    }

    state.state = "leased".to_string();
    state.lease_owner = Some(owner);
    state.last_heartbeat_at_ms = Some(now);
    state.lease_expires_at_ms = Some(now.saturating_add(lease_ms.max(1)));
    write_state(path, &state)?;
    Ok(state)
}

fn heartbeat_scheduler_lease_at(
    path: &Path,
    owner: String,
    lease_ms: u128,
    now: u128,
) -> Result<SchedulerPersistentState, StoreError> {
    let owner = require_owner(owner)?;
    let mut state = read_scheduler_state_at(path)?;
    validate_active_owner(&state, &owner, now)?;
    state.last_heartbeat_at_ms = Some(now);
    state.lease_expires_at_ms = Some(now.saturating_add(lease_ms.max(1)));
    write_state(path, &state)?;
    Ok(state)
}

fn release_scheduler_lease_at(
    path: &Path,
    owner: String,
) -> Result<SchedulerPersistentState, StoreError> {
    let owner = require_owner(owner)?;
    let mut state = read_scheduler_state_at(path)?;
    if state.lease_owner.as_deref() != Some(owner.as_str()) {
        return Err(StoreError::InvalidInput(
            "scheduler lease can only be released by its owner".to_string(),
        ));
    }
    state.state = "stopped".to_string();
    state.lease_owner = None;
    state.lease_expires_at_ms = None;
    write_state(path, &state)?;
    Ok(state)
}

fn record_scheduler_tick_result_at(
    path: &Path,
    owner: String,
    success: bool,
    error: Option<String>,
    now: u128,
) -> Result<SchedulerPersistentState, StoreError> {
    let owner = require_owner(owner)?;
    let mut state = read_scheduler_state_at(path)?;
    validate_active_owner(&state, &owner, now)?;
    state.last_tick_at_ms = Some(now);
    if success {
        state.last_success_at_ms = Some(now);
        state.last_error = None;
        state.consecutive_failures = 0;
    } else {
        state.last_error = error
            .map(|value| value.trim().chars().take(240).collect::<String>())
            .filter(|value| !value.is_empty());
        state.consecutive_failures = state.consecutive_failures.saturating_add(1);
    }
    write_state(path, &state)?;
    Ok(state)
}

fn validate_active_owner(
    state: &SchedulerPersistentState,
    owner: &str,
    now: u128,
) -> Result<(), StoreError> {
    if state.lease_owner.as_deref() != Some(owner) {
        return Err(StoreError::InvalidInput(
            "scheduler lease is not owned by this instance".to_string(),
        ));
    }
    if !state
        .lease_expires_at_ms
        .is_some_and(|expires| expires > now)
    {
        return Err(StoreError::InvalidInput(
            "scheduler lease has expired".to_string(),
        ));
    }
    Ok(())
}

fn write_state(path: &Path, state: &SchedulerPersistentState) -> Result<(), StoreError> {
    write_json_records(path, std::slice::from_ref(state))
}

fn require_owner(owner: String) -> Result<String, StoreError> {
    let owner = owner.trim().to_string();
    if owner.is_empty() {
        return Err(StoreError::InvalidInput(
            "scheduler lease owner cannot be empty".to_string(),
        ));
    }
    Ok(owner)
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;

    use super::*;

    fn temp_state_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("synapse-scheduler-{name}-{}.json", now_millis()))
    }

    #[test]
    fn active_lease_blocks_other_owner_and_allows_heartbeat() {
        let path = temp_state_path("lease");
        acquire_scheduler_lease_at(&path, "instance-a".to_string(), 100, 1_000).unwrap();

        let error =
            acquire_scheduler_lease_at(&path, "instance-b".to_string(), 100, 1_050).unwrap_err();
        let heartbeat =
            heartbeat_scheduler_lease_at(&path, "instance-a".to_string(), 100, 1_050).unwrap();

        assert!(error.to_string().contains("held by instance-a"));
        assert_eq!(heartbeat.lease_expires_at_ms, Some(1_150));

        let _ = fs::remove_file(path);
    }

    #[test]
    fn expired_lease_can_be_taken_over() {
        let path = temp_state_path("takeover");
        acquire_scheduler_lease_at(&path, "instance-a".to_string(), 100, 1_000).unwrap();

        let state =
            acquire_scheduler_lease_at(&path, "instance-b".to_string(), 100, 1_101).unwrap();

        assert_eq!(state.lease_owner.as_deref(), Some("instance-b"));

        let _ = fs::remove_file(path);
    }

    #[test]
    fn tick_results_reset_or_increment_failure_count() {
        let path = temp_state_path("ticks");
        acquire_scheduler_lease_at(&path, "instance-a".to_string(), 1_000, 1_000).unwrap();

        let failed = record_scheduler_tick_result_at(
            &path,
            "instance-a".to_string(),
            false,
            Some("temporary failure".to_string()),
            1_100,
        )
        .unwrap();
        let succeeded =
            record_scheduler_tick_result_at(&path, "instance-a".to_string(), true, None, 1_200)
                .unwrap();

        assert_eq!(failed.consecutive_failures, 1);
        assert_eq!(succeeded.consecutive_failures, 0);
        assert_eq!(succeeded.last_success_at_ms, Some(1_200));

        let _ = fs::remove_file(path);
    }
}
