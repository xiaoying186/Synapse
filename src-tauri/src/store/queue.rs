use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::store::{
    now_millis, paths, read_json_records, value_string, write_json_records, StoreError,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionRecord {
    pub id: String,
    pub plan_id: String,
    pub created_at_ms: u128,
    pub state: String,
    pub route: String,
    pub driver_mode: String,
    pub accepted_steps: usize,
    pub review_receipt: serde_json::Value,
}

pub fn append_execution(
    plan_id: String,
    preview: &serde_json::Value,
    review_receipt: &serde_json::Value,
) -> Result<ExecutionRecord, StoreError> {
    append_execution_at(&paths::execution_path(), plan_id, preview, review_receipt)
}

pub(crate) fn append_execution_at(
    path: &Path,
    plan_id: String,
    preview: &serde_json::Value,
    review_receipt: &serde_json::Value,
) -> Result<ExecutionRecord, StoreError> {
    let mut records = read_execution_records(path)?;
    let now = now_millis();
    let record = ExecutionRecord {
        id: format!("execution-{now}-{}", records.len() + 1),
        plan_id,
        created_at_ms: now,
        state: value_string(review_receipt, "execution_state", "queued"),
        route: value_string(preview, "route", "unrouted"),
        driver_mode: preview
            .get("driver_receipt")
            .and_then(|value| value.get("mode"))
            .and_then(|value| value.as_str())
            .unwrap_or("unknown")
            .to_string(),
        accepted_steps: preview
            .get("driver_receipt")
            .and_then(|value| value.get("accepted_steps"))
            .and_then(|value| value.as_u64())
            .unwrap_or_default() as usize,
        review_receipt: review_receipt.clone(),
    };

    records.insert(0, record.clone());
    records.truncate(100);
    write_json_records(path, &records)?;

    Ok(record)
}

pub(crate) fn read_execution_records(path: &Path) -> Result<Vec<ExecutionRecord>, StoreError> {
    read_json_records(path)
}
