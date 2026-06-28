use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use serde::Serialize;

use crate::config::RuntimeConfig;

enum IterationOutcome {
    Continue(u32),
    LeaseLost,
}

pub struct SchedulerRuntime {
    stop: Arc<AtomicBool>,
    handle: Mutex<Option<JoinHandle<()>>>,
}

impl SchedulerRuntime {
    pub fn start(config: &RuntimeConfig) -> Self {
        let stop = Arc::new(AtomicBool::new(false));
        if !config.scheduler_background_loop_enabled {
            return Self {
                stop,
                handle: Mutex::new(None),
            };
        }

        let owner = config.instance_id.clone();
        let poll_interval = Duration::from_secs(config.scheduler_poll_interval_seconds.max(1));
        let lease_ms =
            u128::from(config.scheduler_poll_interval_seconds.max(1)).saturating_mul(3_000);
        if crate::store::acquire_scheduler_lease(owner.clone(), Some(lease_ms)).is_err() {
            return Self {
                stop,
                handle: Mutex::new(None),
            };
        }
        record_interrupted_run_recovery();

        let thread_stop = Arc::clone(&stop);
        let thread_owner = owner.clone();
        let handle = thread::Builder::new()
            .name("synapse-scheduler".to_string())
            .spawn(move || {
                while !thread_stop.load(Ordering::Acquire) {
                    let failures = match run_scheduler_iteration(&thread_owner, lease_ms) {
                        IterationOutcome::Continue(failures) => failures,
                        IterationOutcome::LeaseLost => break,
                    };
                    if !sleep_with_scheduler_heartbeats(
                        &thread_stop,
                        backoff_duration(poll_interval, failures),
                        poll_interval,
                        &thread_owner,
                        lease_ms,
                    ) {
                        break;
                    }
                }
                let _ = crate::store::release_scheduler_lease(thread_owner);
            })
            .ok();

        if handle.is_none() {
            let _ = crate::store::release_scheduler_lease(owner);
        }

        Self {
            stop,
            handle: Mutex::new(handle),
        }
    }

    pub fn stop(&self) {
        self.stop.store(true, Ordering::Release);
        if let Ok(mut handle) = self.handle.lock() {
            if let Some(handle) = handle.take() {
                let _ = handle.join();
            }
        }
    }
}

impl Drop for SchedulerRuntime {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Release);
        if let Ok(handle) = self.handle.get_mut() {
            if let Some(handle) = handle.take() {
                let _ = handle.join();
            }
        }
    }
}

fn run_scheduler_iteration(owner: &str, lease_ms: u128) -> IterationOutcome {
    if crate::store::heartbeat_scheduler_lease(owner.to_string(), Some(lease_ms)).is_err() {
        return IterationOutcome::LeaseLost;
    }

    match crate::store::task_scheduler_tick() {
        Ok(_) => match crate::store::record_scheduler_tick_result(owner.to_string(), true, None) {
            Ok(state) => IterationOutcome::Continue(state.consecutive_failures),
            Err(_) => IterationOutcome::LeaseLost,
        },
        Err(error) => {
            match crate::store::record_scheduler_tick_result(
                owner.to_string(),
                false,
                Some(error.to_string()),
            ) {
                Ok(state) => IterationOutcome::Continue(state.consecutive_failures),
                Err(_) => IterationOutcome::LeaseLost,
            }
        }
    }
}

fn record_interrupted_run_recovery() {
    let Ok(recovered) = crate::store::recover_interrupted_task_runs() else {
        return;
    };
    for run in recovered {
        let _ = crate::store::append_audit_event(crate::store::NewAuditEvent {
            actor: "scheduler-runtime".to_string(),
            action: "recover-interrupted-task-run".to_string(),
            target_type: "task-run".to_string(),
            target_id: run.id,
            risk_level: "medium".to_string(),
            decision: "failed".to_string(),
            input: serde_json::json!({ "previous_state": "running" }),
            result_summary: serde_json::json!({
                "lifecycle_state": run.lifecycle_state,
                "failed_at_ms": run.failed_at_ms,
                "error_summary": run.error_summary,
            }),
            error: None,
        });
    }
}

fn backoff_duration(base: Duration, consecutive_failures: u32) -> Duration {
    let multiplier = 1_u32 << consecutive_failures.min(4);
    base.saturating_mul(multiplier)
}

fn sleep_until_next_poll(stop: &AtomicBool, poll_interval: Duration) {
    let slice = Duration::from_millis(250);
    let mut elapsed = Duration::ZERO;
    while elapsed < poll_interval && !stop.load(Ordering::Acquire) {
        let remaining = poll_interval.saturating_sub(elapsed);
        let sleep_for = remaining.min(slice);
        thread::sleep(sleep_for);
        elapsed += sleep_for;
    }
}

fn sleep_with_scheduler_heartbeats(
    stop: &AtomicBool,
    total_wait: Duration,
    heartbeat_interval: Duration,
    owner: &str,
    lease_ms: u128,
) -> bool {
    let mut elapsed = Duration::ZERO;
    while elapsed < total_wait && !stop.load(Ordering::Acquire) {
        let chunk = total_wait.saturating_sub(elapsed).min(heartbeat_interval);
        sleep_until_next_poll(stop, chunk);
        elapsed += chunk;
        if elapsed < total_wait
            && crate::store::heartbeat_scheduler_lease(owner.to_string(), Some(lease_ms)).is_err()
        {
            return false;
        }
    }
    true
}

#[derive(Debug, Clone, Serialize)]
pub struct SchedulerStatus {
    pub background_loop_state: String,
    pub manual_tick_state: String,
    pub detail: String,
    pub lease_owner: Option<String>,
    pub lease_expires_at_ms: Option<u128>,
    pub last_heartbeat_at_ms: Option<u128>,
    pub last_tick_at_ms: Option<u128>,
    pub last_success_at_ms: Option<u128>,
    pub last_error: Option<String>,
    pub consecutive_failures: u32,
    pub required_gates: Vec<String>,
}

pub fn status(config: &RuntimeConfig) -> SchedulerStatus {
    let persistent = crate::store::read_scheduler_state().unwrap_or_default();
    status_from_persistent(config, persistent)
}

fn status_from_persistent(
    config: &RuntimeConfig,
    persistent: crate::store::SchedulerPersistentState,
) -> SchedulerStatus {
    let background_loop_state = if persistent.state == "leased" {
        "lease-active"
    } else if config.scheduler_background_loop_enabled {
        "configured-idle"
    } else {
        "disabled"
    };

    SchedulerStatus {
        background_loop_state: background_loop_state.to_string(),
        manual_tick_state: "available".to_string(),
        detail: if persistent.state == "leased" {
            "A scheduler lease is active; the background loop is not started by this stage yet."
                .to_string()
        } else if config.scheduler_background_loop_enabled {
            "Config enables background scheduling; persistent lease control is ready, but the loop is idle."
                .to_string()
        } else {
            "Background scheduling is disabled; manual scheduler ticks can record due run requests."
                .to_string()
        },
        lease_owner: persistent.lease_owner,
        lease_expires_at_ms: persistent.lease_expires_at_ms,
        last_heartbeat_at_ms: persistent.last_heartbeat_at_ms,
        last_tick_at_ms: persistent.last_tick_at_ms,
        last_success_at_ms: persistent.last_success_at_ms,
        last_error: persistent.last_error,
        consecutive_failures: persistent.consecutive_failures,
        required_gates: vec![
            "run-request-approval".to_string(),
            "policy-preview".to_string(),
            "executor-readiness".to_string(),
            "no-network-without-source-gates".to_string(),
            "push-delivery-if-enabled".to_string(),
        ],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disabled_scheduler_still_allows_manual_ticks() {
        let config = RuntimeConfig::default();
        let status = status_from_persistent(&config, Default::default());

        assert_eq!(status.background_loop_state, "disabled");
        assert_eq!(status.manual_tick_state, "available");
        assert!(status
            .required_gates
            .contains(&"executor-readiness".to_string()));
        assert!(status
            .required_gates
            .contains(&"push-delivery-if-enabled".to_string()));
    }

    #[test]
    fn enabled_scheduler_reports_idle_without_lease() {
        let config = RuntimeConfig {
            scheduler_background_loop_enabled: true,
            ..RuntimeConfig::default()
        };
        let status = status_from_persistent(&config, Default::default());

        assert_eq!(status.background_loop_state, "configured-idle");
        assert!(status.detail.contains("loop is idle"));
    }

    #[test]
    fn disabled_runtime_does_not_spawn_background_thread() {
        let runtime = SchedulerRuntime::start(&RuntimeConfig::default());

        assert!(runtime.handle.lock().unwrap().is_none());
        runtime.stop();
    }

    #[test]
    fn poll_sleep_returns_when_stop_is_requested() {
        let stop = AtomicBool::new(true);

        sleep_until_next_poll(&stop, Duration::from_secs(30));

        assert!(stop.load(Ordering::Acquire));
    }

    #[test]
    fn failure_backoff_caps_at_sixteen_intervals() {
        let base = Duration::from_secs(10);

        assert_eq!(backoff_duration(base, 0), Duration::from_secs(10));
        assert_eq!(backoff_duration(base, 2), Duration::from_secs(40));
        assert_eq!(backoff_duration(base, 10), Duration::from_secs(160));
    }
}
