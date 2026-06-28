use serde::Serialize;

use crate::store::{self, MemoryItem, StoreError, TaskCandidate};

#[derive(Debug, Clone, Serialize)]
pub struct SynthesisPreview {
    pub generated_at_ms: u128,
    pub admission_gate: String,
    pub maintenance_jobs: Vec<MaintenanceJobPreview>,
    pub summary_candidates: Vec<SummaryCandidate>,
    pub association_candidates: Vec<AssociationCandidate>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SynthesisPromotionReceipt {
    pub candidate_id: String,
    pub candidate_kind: String,
    pub review_state: String,
    pub admission_gate: String,
    pub promoted_memory_item: MemoryItem,
}

#[derive(Debug, Clone, Serialize)]
pub struct MaintenanceJobPreview {
    pub id: String,
    pub label: String,
    pub cadence: String,
    pub candidate_count: usize,
    pub readiness: String,
    pub gate: String,
    pub admission_gate: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SummaryCandidate {
    pub id: String,
    pub title: String,
    pub summary: String,
    pub source_item_count: usize,
    pub source_memory_ids: Vec<String>,
    pub suggested_level: String,
    pub review_state: String,
    pub admission_gate: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AssociationCandidate {
    pub id: String,
    pub source_memory_id: String,
    pub target_id: String,
    pub target_kind: String,
    pub label: String,
    pub reason: String,
    pub score: f64,
    pub review_state: String,
    pub admission_gate: String,
}

pub fn preview() -> Result<SynthesisPreview, StoreError> {
    let memories = store::recent_memory_items(24)?;
    let candidates = store::task_candidates(24)?;

    Ok(preview_from_records(
        memories,
        candidates,
        store::now_millis(),
    ))
}

pub fn promote_candidate(
    candidate_id: String,
    candidate_kind: String,
) -> Result<SynthesisPromotionReceipt, StoreError> {
    let current = preview()?;
    match candidate_kind.trim().to_ascii_lowercase().as_str() {
        "summary" => {
            let Some(candidate) = current
                .summary_candidates
                .iter()
                .find(|candidate| candidate.id == candidate_id)
            else {
                return Err(StoreError::NotFound(candidate_id));
            };

            let promoted_memory_item = store::append_synthesis_summary(
                promoted_summary_content(candidate),
                vec!["synthesis".to_string(), "summary".to_string()],
            )?;

            Ok(SynthesisPromotionReceipt {
                candidate_id: candidate.id.clone(),
                candidate_kind: "summary".to_string(),
                review_state: candidate.review_state.clone(),
                admission_gate: candidate.admission_gate.clone(),
                promoted_memory_item,
            })
        }
        "association" => {
            let Some(candidate) = current
                .association_candidates
                .iter()
                .find(|candidate| candidate.id == candidate_id)
            else {
                return Err(StoreError::NotFound(candidate_id));
            };

            let promoted_memory_item = store::append_synthesis_association(
                promoted_association_content(candidate),
                vec![
                    "synthesis".to_string(),
                    "association".to_string(),
                    candidate.target_kind.clone(),
                ],
            )?;

            Ok(SynthesisPromotionReceipt {
                candidate_id: candidate.id.clone(),
                candidate_kind: "association".to_string(),
                review_state: candidate.review_state.clone(),
                admission_gate: candidate.admission_gate.clone(),
                promoted_memory_item,
            })
        }
        other => Err(StoreError::InvalidInput(format!(
            "unsupported synthesis candidate kind: {other}"
        ))),
    }
}

fn preview_from_records(
    memories: Vec<MemoryItem>,
    task_candidates: Vec<TaskCandidate>,
    now: u128,
) -> SynthesisPreview {
    let summary_candidates = summary_candidates(&memories);
    let association_candidates = association_candidates(&memories, &task_candidates);
    let maintenance_jobs = maintenance_job_previews(
        summary_candidates.len(),
        association_candidates.len(),
        &task_candidates,
    );

    SynthesisPreview {
        generated_at_ms: now,
        admission_gate:
            "Preview only. Summary and association candidates require review before Zhishu writes."
                .to_string(),
        maintenance_jobs,
        summary_candidates,
        association_candidates,
    }
}

fn promoted_summary_content(candidate: &SummaryCandidate) -> String {
    format!(
        "{}: {} Admission gate: {}.",
        candidate.title, candidate.summary, candidate.admission_gate
    )
}

fn promoted_association_content(candidate: &AssociationCandidate) -> String {
    format!(
        "Association: {}. {}. Source memory {} -> {} {}. Admission gate: {}.",
        candidate.label,
        candidate.reason,
        candidate.source_memory_id,
        candidate.target_kind,
        candidate.target_id,
        candidate.admission_gate
    )
}

fn summary_candidates(memories: &[MemoryItem]) -> Vec<SummaryCandidate> {
    let mut recent = memories
        .iter()
        .filter(|item| item.admission_state != "rejected")
        .take(5)
        .collect::<Vec<_>>();

    if recent.is_empty() {
        return Vec::new();
    }

    recent.sort_by(|left, right| right.created_at_ms.cmp(&left.created_at_ms));
    let tags = top_tags(&recent);
    let title = if tags.is_empty() {
        "Recent memory cluster".to_string()
    } else {
        format!("Recent memory cluster: {}", tags.join(", "))
    };
    let scope_hint = recent
        .iter()
        .find(|item| item.scope == "L1 Working")
        .map(|_| "L1 Working")
        .unwrap_or("L0 Session");

    vec![SummaryCandidate {
        id: "summary-preview-1".to_string(),
        title,
        summary: format!(
            "Condense {} recent item{} into a reviewed working summary before any durable promotion.",
            recent.len(),
            if recent.len() == 1 { "" } else { "s" }
        ),
        source_item_count: recent.len(),
        source_memory_ids: recent.iter().map(|item| item.id.clone()).collect(),
        suggested_level: scope_hint.to_string(),
        review_state: "needs-review".to_string(),
        admission_gate: "summary-review-before-zhishu-write".to_string(),
    }]
}

fn association_candidates(
    memories: &[MemoryItem],
    task_candidates: &[TaskCandidate],
) -> Vec<AssociationCandidate> {
    let mut associations = Vec::new();

    let eligible_memories = memories
        .iter()
        .filter(|memory| memory.admission_state != "rejected")
        .take(12)
        .collect::<Vec<_>>();

    for memory in &eligible_memories {
        for candidate in task_candidates.iter().take(12) {
            let shared = shared_terms(&memory.tags, &candidate.matched_keywords);
            if shared.is_empty() {
                continue;
            }

            associations.push(AssociationCandidate {
                id: format!("association-{}-{}", memory.id, candidate.id),
                source_memory_id: memory.id.clone(),
                target_id: candidate.id.clone(),
                target_kind: "task-candidate".to_string(),
                label: format!("{} -> {}", memory.item_type, candidate.task_direction_title),
                reason: format!("Shared terms: {}", shared.join(", ")),
                score: (shared.len() as f64 * 0.25).min(1.0),
                review_state: "needs-review".to_string(),
                admission_gate: "association-review-before-link-write".to_string(),
            });
        }
    }

    for (left_index, left) in eligible_memories.iter().enumerate() {
        for right in eligible_memories.iter().skip(left_index + 1) {
            let shared = shared_terms(&left.tags, &right.tags);
            if shared.is_empty() {
                continue;
            }

            associations.push(AssociationCandidate {
                id: format!("association-{}-{}", left.id, right.id),
                source_memory_id: left.id.clone(),
                target_id: right.id.clone(),
                target_kind: "memory".to_string(),
                label: format!("{} -> {}", left.item_type, right.item_type),
                reason: format!("Shared tags: {}", shared.join(", ")),
                score: (shared.len() as f64 * 0.2).min(1.0),
                review_state: "needs-review".to_string(),
                admission_gate: "association-review-before-link-write".to_string(),
            });
        }
    }

    associations.sort_by(|left, right| {
        right
            .score
            .partial_cmp(&left.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    associations.truncate(8);
    associations
}

fn maintenance_job_previews(
    summary_count: usize,
    association_count: usize,
    task_candidates: &[TaskCandidate],
) -> Vec<MaintenanceJobPreview> {
    let open_task_candidate_count = task_candidates
        .iter()
        .filter(|candidate| candidate.status == "candidate")
        .count();

    vec![
        maintenance_job_preview(
            "summarize_recent_session",
            "Summarize recent memory",
            "daily-preview",
            summary_count,
            "review-gated",
            "summary-review-before-zhishu-write",
        ),
        maintenance_job_preview(
            "associate_related_items",
            "Associate related items",
            "on-refresh-preview",
            association_count,
            "review-gated",
            "association-review-before-link-write",
        ),
        maintenance_job_preview(
            "mine_task_candidates",
            "Review mined task candidates",
            "direction-frequency-preview",
            open_task_candidate_count,
            "task-review-gated",
            "candidate-review-before-memory-promotion",
        ),
    ]
}

fn maintenance_job_preview(
    id: &str,
    label: &str,
    cadence: &str,
    candidate_count: usize,
    gate: &str,
    admission_gate: &str,
) -> MaintenanceJobPreview {
    MaintenanceJobPreview {
        id: id.to_string(),
        label: label.to_string(),
        cadence: cadence.to_string(),
        candidate_count,
        readiness: if candidate_count > 0 {
            "preview-ready".to_string()
        } else {
            "waiting-for-input".to_string()
        },
        gate: gate.to_string(),
        admission_gate: admission_gate.to_string(),
    }
}

fn top_tags(memories: &[&MemoryItem]) -> Vec<String> {
    let mut tags = memories
        .iter()
        .flat_map(|item| item.tags.iter().cloned())
        .collect::<Vec<_>>();
    tags.sort();
    tags.dedup();
    tags.truncate(4);
    tags
}

fn shared_terms(left: &[String], right: &[String]) -> Vec<String> {
    let mut shared = left
        .iter()
        .filter(|term| right.iter().any(|right_term| right_term == *term))
        .cloned()
        .collect::<Vec<_>>();
    shared.sort();
    shared.dedup();
    shared
}

#[cfg(test)]
mod tests {
    use super::*;

    fn memory(id: &str, content: &str, tags: Vec<&str>) -> MemoryItem {
        MemoryItem {
            id: id.to_string(),
            created_at_ms: 10,
            hub_area: "memory".to_string(),
            scope: "L0 Session".to_string(),
            level: "raw".to_string(),
            item_type: "inspiration".to_string(),
            admission_state: "captured".to_string(),
            admission_rule: "manual-l0-capture".to_string(),
            source: "manual-capture".to_string(),
            provenance: "user-input".to_string(),
            source_trust: "unverified-local".to_string(),
            content: content.to_string(),
            tags: tags.into_iter().map(str::to_string).collect(),
            confidence: 0.5,
            verification: "unverified".to_string(),
            retention_policy: "session-review".to_string(),
            authority: "user-reviewable".to_string(),
            linked_memory_ids: Vec::new(),
            last_reinforced_at_ms: None,
            last_invalidated_at_ms: None,
        }
    }

    fn task_candidate(id: &str, matched_keywords: Vec<&str>) -> TaskCandidate {
        TaskCandidate {
            id: id.to_string(),
            created_at_ms: 10,
            task_direction_id: "direction-1".to_string(),
            task_direction_title: "Template products".to_string(),
            memory_item_id: "memory-1".to_string(),
            summary: "Template products -> paid template idea".to_string(),
            score: 0.8,
            score_components: Default::default(),
            matched_keywords: matched_keywords.into_iter().map(str::to_string).collect(),
            evidence: Vec::new(),
            explanation: "match".to_string(),
            status: "candidate".to_string(),
            reviewed_at_ms: None,
            review_decision: None,
            promoted_memory_id: None,
            source_candidate_id: None,
        }
    }

    #[test]
    fn previews_summary_candidates_without_writing_memory() {
        let preview = preview_from_records(
            vec![memory("memory-1", "paid template idea", vec!["template"])],
            Vec::new(),
            100,
        );

        assert_eq!(preview.summary_candidates.len(), 1);
        assert_eq!(preview.summary_candidates[0].review_state, "needs-review");
        assert_eq!(
            preview.summary_candidates[0].source_memory_ids,
            vec!["memory-1".to_string()]
        );
        assert_eq!(preview.maintenance_jobs.len(), 3);
        assert_eq!(preview.maintenance_jobs[0].id, "summarize_recent_session");
        assert_eq!(preview.maintenance_jobs[0].cadence, "daily-preview");
        assert_eq!(preview.maintenance_jobs[0].candidate_count, 1);
        assert_eq!(
            preview.maintenance_jobs[0].admission_gate,
            "summary-review-before-zhishu-write"
        );
    }

    #[test]
    fn previews_memory_to_task_associations_by_shared_terms() {
        let preview = preview_from_records(
            vec![memory("memory-1", "paid template idea", vec!["template"])],
            vec![task_candidate("candidate-1", vec!["template"])],
            100,
        );

        assert_eq!(preview.association_candidates.len(), 1);
        assert_eq!(
            preview.association_candidates[0].target_kind,
            "task-candidate"
        );
        assert_eq!(
            preview.association_candidates[0].review_state,
            "needs-review"
        );
    }

    #[test]
    fn rejected_memory_is_excluded_from_association_candidates() {
        let mut rejected = memory("memory-1", "paid template idea", vec!["template"]);
        rejected.admission_state = "rejected".to_string();
        let preview = preview_from_records(
            vec![rejected],
            vec![task_candidate("candidate-1", vec!["template"])],
            100,
        );

        assert!(preview.association_candidates.is_empty());
    }

    #[test]
    fn builds_promoted_summary_content() {
        let candidate = SummaryCandidate {
            id: "summary-preview-1".to_string(),
            title: "Recent memory cluster: template".to_string(),
            summary: "Condense 1 recent item into a reviewed working summary.".to_string(),
            source_item_count: 1,
            source_memory_ids: vec!["memory-1".to_string()],
            suggested_level: "L1 Working".to_string(),
            review_state: "needs-review".to_string(),
            admission_gate: "summary-review-before-zhishu-write".to_string(),
        };

        assert!(promoted_summary_content(&candidate).contains("Recent memory cluster"));
        assert!(promoted_summary_content(&candidate).contains("Admission gate"));
    }

    #[test]
    fn builds_promoted_association_content() {
        let candidate = AssociationCandidate {
            id: "association-1".to_string(),
            source_memory_id: "memory-1".to_string(),
            target_id: "candidate-1".to_string(),
            target_kind: "task-candidate".to_string(),
            label: "inspiration -> Template products".to_string(),
            reason: "Shared terms: template".to_string(),
            score: 0.25,
            review_state: "needs-review".to_string(),
            admission_gate: "association-review-before-link-write".to_string(),
        };

        assert!(promoted_association_content(&candidate).contains("Association"));
        assert!(promoted_association_content(&candidate).contains("candidate-1"));
        assert!(promoted_association_content(&candidate).contains("Admission gate"));
    }
}
