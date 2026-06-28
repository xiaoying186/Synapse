use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::store::queue::{read_execution_records, ExecutionRecord};
use crate::store::{
    now_millis, paths, read_json_records, remove_file_if_exists, write_json_records, StoreError,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanRecord {
    pub id: String,
    pub created_at_ms: u128,
    pub preview: serde_json::Value,
    #[serde(default)]
    pub review_receipt: Option<serde_json::Value>,
    #[serde(default)]
    pub execution_record: Option<ExecutionRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewRecord {
    pub id: String,
    pub plan_id: String,
    pub created_at_ms: u128,
    pub receipt: serde_json::Value,
}

pub fn append_preview(preview: serde_json::Value) -> Result<PlanRecord, StoreError> {
    append_preview_at(&paths::history_path(), preview)
}

pub fn recent_plans(limit: usize) -> Result<Vec<PlanRecord>, StoreError> {
    recent_plans_at(
        &paths::history_path(),
        &paths::review_path(),
        &paths::execution_path(),
        limit,
    )
}

pub fn append_review(
    plan_id: String,
    receipt: serde_json::Value,
) -> Result<ReviewRecord, StoreError> {
    append_review_at(&paths::review_path(), plan_id, receipt)
}

pub fn clear_history() -> Result<(), StoreError> {
    remove_file_if_exists(&paths::history_path())?;
    remove_file_if_exists(&paths::review_path())?;
    remove_file_if_exists(&paths::execution_path())
}

pub(crate) fn append_preview_at(
    path: &Path,
    preview: serde_json::Value,
) -> Result<PlanRecord, StoreError> {
    let mut records = read_plan_records(path)?;
    let now = now_millis();
    let record = PlanRecord {
        id: format!("plan-{now}-{}", records.len() + 1),
        created_at_ms: now,
        preview,
        review_receipt: None,
        execution_record: None,
    };

    records.insert(0, record.clone());
    records.truncate(50);
    write_json_records(path, &records)?;

    Ok(record)
}

pub(crate) fn recent_plans_at(
    plan_path: &Path,
    review_path: &Path,
    execution_path: &Path,
    limit: usize,
) -> Result<Vec<PlanRecord>, StoreError> {
    let reviews = read_review_records(review_path)?;
    let executions = read_execution_records(execution_path)?;
    let mut records = read_plan_records(plan_path)?
        .into_iter()
        .map(|mut record| {
            record.review_receipt = reviews
                .iter()
                .find(|review| review.plan_id == record.id)
                .map(|review| review.receipt.clone());
            record.execution_record = executions
                .iter()
                .find(|execution| execution.plan_id == record.id)
                .cloned();
            record
        })
        .collect::<Vec<_>>();

    records.truncate(limit);
    Ok(records)
}

pub(crate) fn append_review_at(
    path: &Path,
    plan_id: String,
    receipt: serde_json::Value,
) -> Result<ReviewRecord, StoreError> {
    let mut records = read_review_records(path)?;
    let now = now_millis();
    let record = ReviewRecord {
        id: format!("review-{now}-{}", records.len() + 1),
        plan_id,
        created_at_ms: now,
        receipt,
    };

    records.insert(0, record.clone());
    records.truncate(100);
    write_json_records(path, &records)?;

    Ok(record)
}

fn read_plan_records(path: &Path) -> Result<Vec<PlanRecord>, StoreError> {
    read_json_records(path)
}

pub(crate) fn read_review_records(path: &Path) -> Result<Vec<ReviewRecord>, StoreError> {
    read_json_records(path)
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;

    use serde_json::json;

    use super::*;
    use crate::store::queue::append_execution_at;

    fn temp_history_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("synapse-{name}-{}.json", now_millis()))
    }

    #[test]
    fn appends_newest_plan_first() {
        let path = temp_history_path("append");

        append_preview_at(&path, json!({ "intent": "first" })).unwrap();
        append_preview_at(&path, json!({ "intent": "second" })).unwrap();

        let review_path = temp_history_path("append-review");
        let execution_path = temp_history_path("append-execution");
        let records = recent_plans_at(&path, &review_path, &execution_path, 10).unwrap();
        assert_eq!(records.len(), 2);
        assert_eq!(records[0].preview["intent"], "second");
        assert_eq!(records[1].preview["intent"], "first");

        let _ = fs::remove_file(path);
    }

    #[test]
    fn caps_history_to_recent_records() {
        let path = temp_history_path("cap");

        for index in 0..55 {
            append_preview_at(&path, json!({ "intent": index })).unwrap();
        }

        let review_path = temp_history_path("cap-review");
        let execution_path = temp_history_path("cap-execution");
        let records = recent_plans_at(&path, &review_path, &execution_path, 100).unwrap();
        assert_eq!(records.len(), 50);
        assert_eq!(records[0].preview["intent"], 54);
        assert_eq!(records[49].preview["intent"], 5);

        let _ = fs::remove_file(path);
    }

    #[test]
    fn missing_history_is_empty() {
        let path = temp_history_path("missing");

        let review_path = temp_history_path("missing-review");
        let execution_path = temp_history_path("missing-execution");
        let records = recent_plans_at(&path, &review_path, &execution_path, 5).unwrap();

        assert!(records.is_empty());
    }

    #[test]
    fn clears_existing_history_file() {
        let path = temp_history_path("clear");
        append_preview_at(&path, json!({ "intent": "first" })).unwrap();

        remove_file_if_exists(&path).unwrap();
        let review_path = temp_history_path("clear-review");
        let execution_path = temp_history_path("clear-execution");
        let records = recent_plans_at(&path, &review_path, &execution_path, 5).unwrap();

        assert!(records.is_empty());
    }

    #[test]
    fn attaches_latest_review_to_plan_record() {
        let plan_path = temp_history_path("review-plan");
        let review_path = temp_history_path("review-record");
        let execution_path = temp_history_path("review-execution");
        let plan = append_preview_at(&plan_path, json!({ "intent": "review me" })).unwrap();

        append_review_at(
            &review_path,
            plan.id.clone(),
            json!({ "status": "approved" }),
        )
        .unwrap();

        let records = recent_plans_at(&plan_path, &review_path, &execution_path, 5).unwrap();

        assert_eq!(
            records[0].review_receipt.as_ref().unwrap()["status"],
            "approved"
        );

        let _ = fs::remove_file(plan_path);
        let _ = fs::remove_file(review_path);
    }

    #[test]
    fn attaches_execution_record_to_plan_record() {
        let plan_path = temp_history_path("execution-plan");
        let review_path = temp_history_path("execution-review");
        let execution_path = temp_history_path("execution-record");
        let plan = append_preview_at(
            &plan_path,
            json!({
                "route": "L1_REVIEW with reviewable changes",
                "driver_receipt": {
                    "mode": "Pro",
                    "accepted_steps": 2
                }
            }),
        )
        .unwrap();

        append_execution_at(
            &execution_path,
            plan.id.clone(),
            &plan.preview,
            &json!({ "execution_state": "reviewable-execution-ready" }),
        )
        .unwrap();

        let records = recent_plans_at(&plan_path, &review_path, &execution_path, 5).unwrap();
        let execution = records[0].execution_record.as_ref().unwrap();

        assert_eq!(execution.state, "reviewable-execution-ready");
        assert_eq!(execution.route, "L1_REVIEW with reviewable changes");
        assert_eq!(execution.driver_mode, "Pro");
        assert_eq!(execution.accepted_steps, 2);

        let _ = fs::remove_file(plan_path);
        let _ = fs::remove_file(execution_path);
    }
}
