use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::store::{now_millis, paths, read_json_records, write_json_records, StoreError};

const MAX_TASK_ARTIFACTS: usize = 500;

#[derive(Debug, Clone)]
pub struct NewTaskArtifact {
    pub artifact_type: String,
    pub reference_id: String,
    pub title: String,
    pub summary: String,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TaskArtifactRecord {
    pub id: String,
    pub run_id: String,
    pub task_direction_id: String,
    pub artifact_type: String,
    pub reference_id: String,
    pub title: String,
    pub summary: String,
    pub metadata: serde_json::Value,
    pub created_at_ms: u128,
}

pub fn append_task_artifacts(
    run_id: String,
    task_direction_id: String,
    artifacts: Vec<NewTaskArtifact>,
) -> Result<Vec<TaskArtifactRecord>, StoreError> {
    append_task_artifacts_at(
        &paths::task_artifact_path(),
        run_id,
        task_direction_id,
        artifacts,
    )
}

pub fn list_task_artifacts(
    run_id: Option<String>,
    limit: usize,
) -> Result<Vec<TaskArtifactRecord>, StoreError> {
    list_task_artifacts_at(&paths::task_artifact_path(), run_id.as_deref(), limit)
}

pub(crate) fn append_task_artifacts_at(
    path: &Path,
    run_id: String,
    task_direction_id: String,
    artifacts: Vec<NewTaskArtifact>,
) -> Result<Vec<TaskArtifactRecord>, StoreError> {
    let run_id = require_value(run_id, "artifact run id")?;
    let task_direction_id = require_value(task_direction_id, "artifact direction id")?;
    let mut records = read_task_artifacts(path)?;
    let now = now_millis();
    let created = artifacts
        .into_iter()
        .enumerate()
        .map(|(index, artifact)| {
            Ok(TaskArtifactRecord {
                id: format!("task-artifact-{now}-{}", records.len() + index + 1),
                run_id: run_id.clone(),
                task_direction_id: task_direction_id.clone(),
                artifact_type: require_value(artifact.artifact_type, "artifact type")?,
                reference_id: require_value(artifact.reference_id, "artifact reference id")?,
                title: require_value(artifact.title, "artifact title")?,
                summary: artifact.summary.trim().to_string(),
                metadata: artifact.metadata,
                created_at_ms: now,
            })
        })
        .collect::<Result<Vec<_>, StoreError>>()?;

    for artifact in created.iter().rev() {
        records.insert(0, artifact.clone());
    }
    records.truncate(MAX_TASK_ARTIFACTS);
    write_json_records(path, &records)?;
    Ok(created)
}

pub(crate) fn list_task_artifacts_at(
    path: &Path,
    run_id: Option<&str>,
    limit: usize,
) -> Result<Vec<TaskArtifactRecord>, StoreError> {
    let run_id = run_id.map(str::trim).filter(|value| !value.is_empty());
    let mut records = read_task_artifacts(path)?
        .into_iter()
        .filter(|record| run_id.is_none_or(|value| record.run_id == value))
        .collect::<Vec<_>>();
    records.truncate(limit.min(200));
    Ok(records)
}

fn read_task_artifacts(path: &Path) -> Result<Vec<TaskArtifactRecord>, StoreError> {
    read_json_records(path)
}

fn require_value(value: String, label: &str) -> Result<String, StoreError> {
    let value = value.trim().to_string();
    if value.is_empty() {
        return Err(StoreError::InvalidInput(format!("{label} cannot be empty")));
    }
    Ok(value)
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;

    use serde_json::json;

    use super::*;

    fn temp_artifact_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("synapse-artifact-{name}-{}.json", now_millis()))
    }

    #[test]
    fn appends_and_filters_task_artifacts() {
        let path = temp_artifact_path("append");
        let created = append_task_artifacts_at(
            &path,
            "run-1".to_string(),
            "direction-1".to_string(),
            vec![NewTaskArtifact {
                artifact_type: "task-candidate".to_string(),
                reference_id: "candidate-1".to_string(),
                title: "Candidate".to_string(),
                summary: "Useful candidate".to_string(),
                metadata: json!({ "score": 0.7 }),
            }],
        )
        .unwrap();

        let records = list_task_artifacts_at(&path, Some("run-1"), 10).unwrap();

        assert_eq!(created.len(), 1);
        assert_eq!(records[0].reference_id, "candidate-1");
        assert_eq!(records[0].metadata["score"], 0.7);

        let _ = fs::remove_file(path);
    }
}
