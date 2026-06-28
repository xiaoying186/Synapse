use crate::{config, store};

pub fn state() -> Result<store::SchedulerPersistentState, String> {
    store::read_scheduler_state()
        .map_err(|error| format!("Scheduler state is unavailable: {error}"))
}

pub fn acquire() -> Result<store::SchedulerPersistentState, String> {
    let config = config::read_runtime_config();
    if !config.scheduler_background_loop_enabled {
        return Err("Background scheduler is disabled by configuration.".to_string());
    }
    store::acquire_scheduler_lease(config.instance_id, None)
        .map_err(|error| format!("Scheduler lease could not be acquired: {error}"))
}

pub fn heartbeat() -> Result<store::SchedulerPersistentState, String> {
    let config = config::read_runtime_config();
    store::heartbeat_scheduler_lease(config.instance_id, None)
        .map_err(|error| format!("Scheduler heartbeat failed: {error}"))
}

pub fn release() -> Result<store::SchedulerPersistentState, String> {
    let config = config::read_runtime_config();
    store::release_scheduler_lease(config.instance_id)
        .map_err(|error| format!("Scheduler lease could not be released: {error}"))
}
