use serde::{Deserialize, Serialize};

use crate::{aggregation, store};

#[derive(Debug, Clone, Deserialize)]
pub struct DailyBriefingTemplate {
    pub title: String,
    pub query: String,
    #[serde(default)]
    pub sections: Vec<String>,
    #[serde(default)]
    pub online_enabled: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct DailyBriefingPreview {
    pub title: String,
    pub rendered_markdown: String,
    pub sections: Vec<String>,
    pub aggregation: aggregation::AggregationPreview,
    pub archive_gate: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DailyBriefingArchiveReceipt {
    pub preview: DailyBriefingPreview,
    pub artifact: store::TaskArtifactRecord,
    pub run: store::TaskRunRecord,
}

pub fn preview(template: DailyBriefingTemplate) -> Result<DailyBriefingPreview, store::StoreError> {
    let template = normalize_template(template)?;
    let aggregation =
        aggregation::preview_for_query(template.query.clone(), template.online_enabled);
    let archive_gate = if aggregation.confidence.admission_state == "blocked" {
        "blocked-by-source-confidence"
    } else {
        "reviewable"
    };
    let rendered_markdown = render_markdown(&template, &aggregation);

    Ok(DailyBriefingPreview {
        title: template.title,
        rendered_markdown,
        sections: template.sections,
        aggregation,
        archive_gate: archive_gate.to_string(),
    })
}

pub fn archive(
    run_id: String,
    template: DailyBriefingTemplate,
) -> Result<DailyBriefingArchiveReceipt, store::StoreError> {
    let run_id = required(run_id, "task run id")?;
    let run = store::task_run_by_id(run_id.clone())?;
    if run.lifecycle_state != "approved"
        || run.approval_state != "approved"
        || run.execution_state != "approved-not-started"
    {
        return Err(store::StoreError::InvalidInput(
            "daily briefing requires an approved, not-started Task Run".to_string(),
        ));
    }

    let preview = preview(template)?;
    if preview.archive_gate != "reviewable" {
        return Err(store::StoreError::InvalidInput(
            "daily briefing source confidence blocks archival".to_string(),
        ));
    }
    store::append_source_observations(
        preview
            .aggregation
            .observations
            .iter()
            .map(|observation| store::NewSourceObservationRecord {
                query: preview.aggregation.query.clone(),
                source_id: observation.source_id.clone(),
                source_uri: observation.source_uri.clone(),
                observed_at_ms: observation.captured_at_ms,
                freshness: observation.freshness.clone(),
                field_coverage: observation.field_coverage,
                normalized_claim: observation.normalized_claim.clone(),
                quarantine_state: observation.quarantine_state.clone(),
                fallback_used: observation.fallback_used,
                confidence_score: preview.aggregation.confidence.score,
                conflict_level: preview.aggregation.confidence.conflict_level.clone(),
                admission_state: preview.aggregation.confidence.admission_state.clone(),
            })
            .collect(),
    )?;

    let artifact = store::append_task_artifacts(
        run.id.clone(),
        run.task_direction_id.clone(),
        vec![store::NewTaskArtifact {
            artifact_type: "daily-briefing".to_string(),
            reference_id: format!("daily-briefing-{}", store::now_millis()),
            title: preview.title.clone(),
            summary: preview.rendered_markdown.clone(),
            metadata: serde_json::json!({
                "domain": "daily-briefing",
                "sections": preview.sections,
                "query": preview.aggregation.query,
                "confidence_score": preview.aggregation.confidence.score,
                "conflict_level": preview.aggregation.confidence.conflict_level,
                "admission_state": preview.aggregation.confidence.admission_state,
                "retrieval_state": preview.aggregation.retrieval_state,
            }),
        }],
    )?
    .remove(0);
    let completed = store::complete_domain_task_run(
        run.id.clone(),
        format!("Daily briefing archived as artifact {}.", artifact.id),
    )?;

    Ok(DailyBriefingArchiveReceipt {
        preview,
        artifact,
        run: completed,
    })
}

fn normalize_template(
    mut template: DailyBriefingTemplate,
) -> Result<DailyBriefingTemplate, store::StoreError> {
    template.title = required(template.title, "briefing title")?;
    template.query = required(template.query, "briefing query")?;
    template.sections = template
        .sections
        .into_iter()
        .map(|section| section.trim().to_string())
        .filter(|section| !section.is_empty())
        .take(8)
        .collect();
    if template.sections.is_empty() {
        template.sections = vec![
            "Key developments".to_string(),
            "Risks and uncertainty".to_string(),
            "Suggested follow-ups".to_string(),
        ];
    }
    Ok(template)
}

fn render_markdown(
    template: &DailyBriefingTemplate,
    aggregation: &aggregation::AggregationPreview,
) -> String {
    let evidence = aggregation
        .observations
        .iter()
        .map(|observation| format!("- {}", observation.normalized_claim))
        .collect::<Vec<_>>()
        .join("\n");
    let sections = template
        .sections
        .iter()
        .map(|section| format!("## {section}\nPending reviewed synthesis."))
        .collect::<Vec<_>>()
        .join("\n\n");

    format!(
        "# {}\n\nQuery: {}\n\n{}\n\n## Evidence preview\n{}\n\nConfidence: {:.0}% / {}",
        template.title,
        template.query,
        sections,
        evidence,
        aggregation.confidence.score * 100.0,
        aggregation.confidence.conflict_level,
    )
}

fn required(value: String, label: &str) -> Result<String, store::StoreError> {
    let value = value.trim().to_string();
    if value.is_empty() {
        return Err(store::StoreError::InvalidInput(format!(
            "{label} cannot be empty"
        )));
    }
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preview_applies_default_sections_and_renders_evidence() {
        let preview = preview(DailyBriefingTemplate {
            title: "Morning brief".to_string(),
            query: "AI project maintenance".to_string(),
            sections: Vec::new(),
            online_enabled: false,
        })
        .unwrap();

        assert_eq!(preview.sections.len(), 3);
        assert!(preview.rendered_markdown.contains("Evidence preview"));
    }

    #[test]
    fn preview_rejects_empty_query() {
        let error = preview(DailyBriefingTemplate {
            title: "Morning brief".to_string(),
            query: " ".to_string(),
            sections: Vec::new(),
            online_enabled: false,
        })
        .unwrap_err();

        assert!(error.to_string().contains("briefing query cannot be empty"));
    }
}
