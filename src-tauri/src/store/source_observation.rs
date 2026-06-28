use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::store::{now_millis, paths, read_json_records, write_json_records, StoreError};

const MAX_SOURCE_OBSERVATIONS: usize = 1_000;

#[derive(Debug, Clone)]
pub struct NewSourceObservationRecord {
    pub query: String,
    pub source_id: String,
    pub source_uri: String,
    pub observed_at_ms: u128,
    pub freshness: String,
    pub field_coverage: f64,
    pub normalized_claim: String,
    pub quarantine_state: String,
    pub fallback_used: bool,
    pub confidence_score: f64,
    pub conflict_level: String,
    pub admission_state: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SourceObservationRecord {
    pub id: String,
    pub query: String,
    pub source_id: String,
    pub source_uri: String,
    pub observed_at_ms: u128,
    pub freshness: String,
    pub field_coverage: f64,
    pub normalized_claim: String,
    pub quarantine_state: String,
    pub fallback_used: bool,
    pub confidence_score: f64,
    pub conflict_level: String,
    pub admission_state: String,
    pub recorded_at_ms: u128,
}

pub fn append_source_observations(
    observations: Vec<NewSourceObservationRecord>,
) -> Result<Vec<SourceObservationRecord>, StoreError> {
    append_source_observations_at(&paths::source_observation_path(), observations)
}

pub fn list_source_observations(
    source_id: Option<String>,
    limit: usize,
) -> Result<Vec<SourceObservationRecord>, StoreError> {
    list_source_observations_at(
        &paths::source_observation_path(),
        source_id.as_deref(),
        limit,
    )
}

fn append_source_observations_at(
    path: &Path,
    observations: Vec<NewSourceObservationRecord>,
) -> Result<Vec<SourceObservationRecord>, StoreError> {
    let mut records = read_json_records::<SourceObservationRecord>(path)?;
    let now = now_millis();
    let created = observations
        .into_iter()
        .enumerate()
        .map(|(index, observation)| {
            Ok(SourceObservationRecord {
                id: format!("source-observation-{now}-{}", records.len() + index + 1),
                query: require_value(observation.query, "observation query")?,
                source_id: require_value(observation.source_id, "observation source id")?,
                source_uri: require_value(observation.source_uri, "observation source uri")?,
                observed_at_ms: observation.observed_at_ms,
                freshness: require_value(observation.freshness, "observation freshness")?,
                field_coverage: observation.field_coverage.clamp(0.0, 1.0),
                normalized_claim: require_value(
                    observation.normalized_claim,
                    "observation normalized claim",
                )?,
                quarantine_state: require_value(
                    observation.quarantine_state,
                    "observation quarantine state",
                )?,
                fallback_used: observation.fallback_used,
                confidence_score: observation.confidence_score.clamp(0.0, 1.0),
                conflict_level: require_value(
                    observation.conflict_level,
                    "observation conflict level",
                )?,
                admission_state: require_value(
                    observation.admission_state,
                    "observation admission state",
                )?,
                recorded_at_ms: now,
            })
        })
        .collect::<Result<Vec<_>, StoreError>>()?;

    for record in created.iter().rev() {
        records.insert(0, record.clone());
    }
    records.truncate(MAX_SOURCE_OBSERVATIONS);
    write_json_records(path, &records)?;
    Ok(created)
}

fn list_source_observations_at(
    path: &Path,
    source_id: Option<&str>,
    limit: usize,
) -> Result<Vec<SourceObservationRecord>, StoreError> {
    let source_id = source_id.map(str::trim).filter(|value| !value.is_empty());
    let mut records = read_json_records::<SourceObservationRecord>(path)?
        .into_iter()
        .filter(|record| source_id.is_none_or(|value| record.source_id == value))
        .collect::<Vec<_>>();
    records.truncate(limit.min(200));
    Ok(records)
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

    use super::*;

    fn temp_observation_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("synapse-observation-{name}-{}.json", now_millis()))
    }

    #[test]
    fn appends_and_filters_source_observation_history() {
        let path = temp_observation_path("history");
        append_source_observations_at(
            &path,
            vec![
                observation("fixture-primary", 1.2),
                observation("fixture-secondary", -0.2),
            ],
        )
        .unwrap();

        let records = list_source_observations_at(&path, Some("fixture-primary"), 10).unwrap();

        assert_eq!(records.len(), 1);
        assert_eq!(records[0].field_coverage, 1.0);
        assert_eq!(records[0].source_id, "fixture-primary");

        let _ = fs::remove_file(path);
    }

    fn observation(source_id: &str, coverage: f64) -> NewSourceObservationRecord {
        NewSourceObservationRecord {
            query: "test".to_string(),
            source_id: source_id.to_string(),
            source_uri: format!("fixture://{source_id}"),
            observed_at_ms: 1,
            freshness: "fixture-stable".to_string(),
            field_coverage: coverage,
            normalized_claim: "claim".to_string(),
            quarantine_state: "quarantined".to_string(),
            fallback_used: true,
            confidence_score: 0.8,
            conflict_level: "none".to_string(),
            admission_state: "quarantined-review-ready".to_string(),
        }
    }
}
