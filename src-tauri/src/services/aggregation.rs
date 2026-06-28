use serde::Serialize;

use crate::{aggregation, store};
use crate::{config, http_source};

#[derive(Debug, Clone, Serialize)]
pub struct SourceHealthReport {
    pub generated_at_ms: u128,
    pub observation_count: usize,
    pub source_count: usize,
    pub query_count: usize,
    pub overall_state: String,
    pub source_health: Vec<SourceHealthSummary>,
    pub query_cross_checks: Vec<QueryCrossCheckSummary>,
    pub gates: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SourceHealthSummary {
    pub source_id: String,
    pub observation_count: usize,
    pub average_confidence: f64,
    pub average_field_coverage: f64,
    pub fallback_ratio: f64,
    pub conflict_count: usize,
    pub last_observed_at_ms: u128,
    pub state: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct QueryCrossCheckSummary {
    pub query: String,
    pub observation_count: usize,
    pub source_count: usize,
    pub distinct_claim_count: usize,
    pub average_confidence: f64,
    pub state: String,
}

pub fn preview_information(
    query: String,
    online_enabled: bool,
) -> Result<aggregation::AggregationPreview, String> {
    let preview = aggregation::preview_for_query(query, online_enabled);
    store::append_source_observations(
        preview
            .observations
            .iter()
            .map(|observation| store::NewSourceObservationRecord {
                query: preview.query.clone(),
                source_id: observation.source_id.clone(),
                source_uri: observation.source_uri.clone(),
                observed_at_ms: observation.captured_at_ms,
                freshness: observation.freshness.clone(),
                field_coverage: observation.field_coverage,
                normalized_claim: observation.normalized_claim.clone(),
                quarantine_state: observation.quarantine_state.clone(),
                fallback_used: observation.fallback_used,
                confidence_score: preview.confidence.score,
                conflict_level: preview.confidence.conflict_level.clone(),
                admission_state: preview.confidence.admission_state.clone(),
            })
            .collect(),
    )
    .map_err(|error| format!("Source observations could not be recorded: {error}"))?;
    Ok(preview)
}

pub fn observation_history(
    source_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<store::SourceObservationRecord>, String> {
    store::list_source_observations(source_id, limit.unwrap_or(50))
        .map_err(|error| format!("Source observation history is unavailable: {error}"))
}

pub fn source_health_report(limit: Option<usize>) -> Result<SourceHealthReport, String> {
    let observations = store::list_source_observations(None, limit.unwrap_or(200))
        .map_err(|error| format!("Source health report is unavailable: {error}"))?;
    Ok(build_source_health_report(observations))
}

pub fn import_observations(
    format: String,
    content: String,
) -> Result<aggregation::SourceImportReceipt, String> {
    let receipt = aggregation::import_source_observations(format, content)?;
    store::append_source_observations(
        receipt
            .observations
            .iter()
            .map(|observation| store::NewSourceObservationRecord {
                query: format!("manual-import:{}", receipt.format),
                source_id: observation.source_id.clone(),
                source_uri: observation.source_uri.clone(),
                observed_at_ms: observation.captured_at_ms,
                freshness: observation.freshness.clone(),
                field_coverage: observation.field_coverage,
                normalized_claim: observation.normalized_claim.clone(),
                quarantine_state: observation.quarantine_state.clone(),
                fallback_used: observation.fallback_used,
                confidence_score: receipt.confidence.score,
                conflict_level: receipt.confidence.conflict_level.clone(),
                admission_state: receipt.confidence.admission_state.clone(),
            })
            .collect(),
    )
    .map_err(|error| format!("Imported source observations could not be recorded: {error}"))?;
    Ok(receipt)
}

pub fn fetch_http_source() -> Result<http_source::HttpSourceReceipt, String> {
    let config = config::read_runtime_config();
    let receipt = http_source::fetch_configured_source(config.aggregation_http_source_url)?;
    store::append_source_observations(vec![store::NewSourceObservationRecord {
        query: "configured-http-source".to_string(),
        source_id: receipt.observation.source_id.clone(),
        source_uri: receipt.observation.source_uri.clone(),
        observed_at_ms: receipt.observation.captured_at_ms,
        freshness: receipt.observation.freshness.clone(),
        field_coverage: receipt.observation.field_coverage,
        normalized_claim: receipt.observation.normalized_claim.clone(),
        quarantine_state: receipt.observation.quarantine_state.clone(),
        fallback_used: receipt.observation.fallback_used,
        confidence_score: receipt.confidence.score,
        conflict_level: receipt.confidence.conflict_level.clone(),
        admission_state: receipt.confidence.admission_state.clone(),
    }])
    .map_err(|error| format!("HTTP source observation could not be recorded: {error}"))?;
    store::append_audit_event(store::NewAuditEvent {
        actor: "local-user".to_string(),
        action: "fetch-configured-http-source".to_string(),
        target_type: "information-source".to_string(),
        target_id: receipt.observation.source_id.clone(),
        risk_level: "read-only-network".to_string(),
        decision: "quarantined".to_string(),
        input: serde_json::json!({ "configured_url": receipt.source_url }),
        result_summary: serde_json::json!({
            "status_code": receipt.status_code,
            "response_bytes": receipt.response_bytes,
            "confidence_score": receipt.confidence.score,
            "admission_state": receipt.confidence.admission_state,
        }),
        error: None,
    })
    .map_err(|error| format!("HTTP source audit event could not be recorded: {error}"))?;
    Ok(receipt)
}

fn build_source_health_report(
    observations: Vec<store::SourceObservationRecord>,
) -> SourceHealthReport {
    let mut source_groups =
        std::collections::BTreeMap::<String, Vec<&store::SourceObservationRecord>>::new();
    let mut query_groups =
        std::collections::BTreeMap::<String, Vec<&store::SourceObservationRecord>>::new();
    for observation in &observations {
        source_groups
            .entry(observation.source_id.clone())
            .or_default()
            .push(observation);
        query_groups
            .entry(observation.query.clone())
            .or_default()
            .push(observation);
    }

    let mut source_health = source_groups
        .iter()
        .map(|(source_id, records)| {
            let observation_count = records.len();
            let average_confidence = average(records.iter().map(|record| record.confidence_score));
            let average_field_coverage =
                average(records.iter().map(|record| record.field_coverage));
            let fallback_ratio =
                average(
                    records
                        .iter()
                        .map(|record| if record.fallback_used { 1.0 } else { 0.0 }),
                );
            let conflict_count = records
                .iter()
                .filter(|record| record.conflict_level != "none")
                .count();
            let last_observed_at_ms = records
                .iter()
                .map(|record| record.observed_at_ms)
                .max()
                .unwrap_or_default();
            let state = if conflict_count > 0 {
                "conflict-review"
            } else if average_confidence >= 0.75 && average_field_coverage >= 0.75 {
                "stable"
            } else if fallback_ratio >= 0.5 {
                "fallback-review"
            } else {
                "needs-more-evidence"
            };

            SourceHealthSummary {
                source_id: source_id.clone(),
                observation_count,
                average_confidence,
                average_field_coverage,
                fallback_ratio,
                conflict_count,
                last_observed_at_ms,
                state: state.to_string(),
            }
        })
        .collect::<Vec<_>>();
    source_health.sort_by(|left, right| {
        right
            .conflict_count
            .cmp(&left.conflict_count)
            .then_with(|| right.observation_count.cmp(&left.observation_count))
            .then_with(|| left.source_id.cmp(&right.source_id))
    });

    let mut query_cross_checks = query_groups
        .iter()
        .map(|(query, records)| {
            let source_count = records
                .iter()
                .map(|record| record.source_id.as_str())
                .collect::<std::collections::BTreeSet<_>>()
                .len();
            let distinct_claim_count = records
                .iter()
                .map(|record| record.normalized_claim.as_str())
                .collect::<std::collections::BTreeSet<_>>()
                .len();
            let average_confidence = average(records.iter().map(|record| record.confidence_score));
            let state = if distinct_claim_count > 1 {
                "claim-conflict"
            } else if source_count >= 2 && average_confidence >= 0.7 {
                "cross-check-ready"
            } else if source_count >= 2 {
                "weak-cross-check"
            } else {
                "single-source"
            };

            QueryCrossCheckSummary {
                query: query.clone(),
                observation_count: records.len(),
                source_count,
                distinct_claim_count,
                average_confidence,
                state: state.to_string(),
            }
        })
        .collect::<Vec<_>>();
    query_cross_checks.sort_by(|left, right| {
        right
            .distinct_claim_count
            .cmp(&left.distinct_claim_count)
            .then_with(|| right.source_count.cmp(&left.source_count))
            .then_with(|| left.query.cmp(&right.query))
    });

    let conflict_sources = source_health
        .iter()
        .filter(|source| source.conflict_count > 0)
        .count();
    let overall_state = if observations.is_empty() {
        "empty"
    } else if conflict_sources > 0
        || query_cross_checks
            .iter()
            .any(|query| query.state == "claim-conflict")
    {
        "conflict-review"
    } else if query_cross_checks
        .iter()
        .any(|query| query.state == "cross-check-ready")
    {
        "cross-check-ready"
    } else {
        "collecting-evidence"
    };

    SourceHealthReport {
        generated_at_ms: store::now_millis(),
        observation_count: observations.len(),
        source_count: source_health.len(),
        query_count: query_cross_checks.len(),
        overall_state: overall_state.to_string(),
        source_health,
        query_cross_checks,
        gates: vec![
            "history-only-no-network".to_string(),
            "quarantine-state-preserved".to_string(),
            "conflicts-require-manual-review".to_string(),
            "no-automatic-zhishu-admission".to_string(),
        ],
    }
}

fn average(values: impl Iterator<Item = f64>) -> f64 {
    let (sum, count) = values.fold((0.0, 0_usize), |(sum, count), value| {
        (sum + value, count + 1)
    });
    if count == 0 {
        0.0
    } else {
        sum / count as f64
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn record(
        query: &str,
        source_id: &str,
        claim: &str,
        confidence_score: f64,
        conflict_level: &str,
        fallback_used: bool,
    ) -> store::SourceObservationRecord {
        store::SourceObservationRecord {
            id: format!("{query}-{source_id}"),
            query: query.to_string(),
            source_id: source_id.to_string(),
            source_uri: format!("fixture://{source_id}"),
            observed_at_ms: 100,
            freshness: "stable".to_string(),
            field_coverage: 0.8,
            normalized_claim: claim.to_string(),
            quarantine_state: "quarantined".to_string(),
            fallback_used,
            confidence_score,
            conflict_level: conflict_level.to_string(),
            admission_state: "manual-review-required".to_string(),
            recorded_at_ms: 100,
        }
    }

    #[test]
    fn source_health_report_detects_conflicts_and_cross_checks() {
        let report = build_source_health_report(vec![
            record("q1", "official", "same", 0.9, "none", false),
            record("q1", "secondary", "same", 0.8, "none", true),
            record("q2", "official", "one", 0.4, "material", false),
            record("q2", "secondary", "two", 0.4, "material", true),
        ]);

        assert_eq!(report.observation_count, 4);
        assert_eq!(report.source_count, 2);
        assert_eq!(report.overall_state, "conflict-review");
        assert!(report
            .query_cross_checks
            .iter()
            .any(|query| query.query == "q1" && query.state == "cross-check-ready"));
        assert!(report
            .query_cross_checks
            .iter()
            .any(|query| query.query == "q2" && query.state == "claim-conflict"));
    }
}
