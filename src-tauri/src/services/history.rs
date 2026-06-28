use crate::store;

pub fn recent_plans() -> Result<Vec<store::PlanRecord>, String> {
    store::recent_plans(5).map_err(|error| format!("Plan history is unavailable: {error}"))
}

pub fn clear() -> Result<(), String> {
    store::clear_history().map_err(|error| format!("Plan history could not be cleared: {error}"))
}
