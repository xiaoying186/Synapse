use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

use crate::store::{self, MemoryItem, StoreError};

const DAY_MS: u128 = 24 * 60 * 60 * 1000;

#[derive(Debug, Clone, Default, Deserialize)]
pub struct ZhishuSearchQuery {
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub hub_area: Option<String>,
    #[serde(default)]
    pub item_type: Option<String>,
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default)]
    pub admission_state: Option<String>,
    #[serde(default)]
    pub minimum_confidence: Option<f64>,
    #[serde(default)]
    pub max_age_days: Option<u64>,
    #[serde(default)]
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ZhishuSearchResult {
    pub item: MemoryItem,
    pub score: f64,
    pub matched_fields: Vec<String>,
    pub explanation: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ZhishuSearchResponse {
    pub query: ZhishuSearchQueryView,
    pub total_matches: usize,
    pub results: Vec<ZhishuSearchResult>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ZhishuSearchQueryView {
    pub text: String,
    pub filters: Vec<String>,
    pub limit: usize,
}

pub fn search(query: ZhishuSearchQuery) -> Result<ZhishuSearchResponse, StoreError> {
    search_items(store::recent_memory_items(200)?, query, store::now_millis())
}

pub fn generate_relation_candidates(
    query: ZhishuSearchQuery,
) -> Result<Vec<store::ZhishuRelationRecord>, StoreError> {
    let response = search(query)?;
    let mut candidates = Vec::new();
    for (index, left) in response.results.iter().take(10).enumerate() {
        for right in response.results.iter().take(10).skip(index + 1) {
            let shared = left
                .item
                .tags
                .iter()
                .filter(|tag| right.item.tags.contains(tag))
                .cloned()
                .collect::<Vec<_>>();
            if shared.is_empty() {
                continue;
            }
            candidates.push(store::NewZhishuRelation {
                source_memory_id: left.item.id.clone(),
                target_memory_id: right.item.id.clone(),
                relation_type: "shared-topic".to_string(),
                reason: format!("Shared reviewed retrieval topics: {}", shared.join(", ")),
                evidence: shared.clone(),
                confidence: ((left.score + right.score) / 2.0).clamp(0.0, 1.0),
            });
        }
    }
    store::append_zhishu_relations(candidates)
}

pub fn scan_maintenance(
    stale_days: Option<u64>,
) -> Result<Vec<store::ZhishuMaintenanceFinding>, StoreError> {
    let findings = detect_maintenance_findings(
        store::recent_memory_items(200)?,
        stale_days.unwrap_or(90).clamp(1, 3650),
        store::now_millis(),
    );
    store::append_zhishu_maintenance_findings(findings)
}

fn detect_maintenance_findings(
    items: Vec<MemoryItem>,
    stale_days: u64,
    now: u128,
) -> Vec<store::NewZhishuMaintenanceFinding> {
    let active = items
        .into_iter()
        .filter(|item| item.admission_state != "rejected" && item.level != "rejected")
        .collect::<Vec<_>>();
    let mut findings = Vec::new();

    for (index, left) in active.iter().enumerate() {
        let left_normalized = normalized_content(&left.content);
        for right in active.iter().skip(index + 1) {
            let right_normalized = normalized_content(&right.content);
            if !left_normalized.is_empty() && left_normalized == right_normalized {
                findings.push(store::NewZhishuMaintenanceFinding {
                    finding_kind: "duplicate".to_string(),
                    item_ids: vec![left.id.clone(), right.id.clone()],
                    reason: "Items have identical normalized content.".to_string(),
                    evidence: vec![short_evidence(&left.content)],
                    severity: "medium".to_string(),
                });
                continue;
            }

            let shared_tags = left
                .tags
                .iter()
                .filter(|tag| right.tags.contains(tag))
                .cloned()
                .collect::<Vec<_>>();
            if left.hub_area == right.hub_area
                && left.item_type == right.item_type
                && !shared_tags.is_empty()
                && has_negation(&left.content) != has_negation(&right.content)
            {
                findings.push(store::NewZhishuMaintenanceFinding {
                    finding_kind: "conflict".to_string(),
                    item_ids: vec![left.id.clone(), right.id.clone()],
                    reason: "Similar items have different negation or prohibition signals."
                        .to_string(),
                    evidence: vec![
                        format!("shared tags: {}", shared_tags.join(", ")),
                        short_evidence(&left.content),
                        short_evidence(&right.content),
                    ],
                    severity: "high".to_string(),
                });
            }
        }

        let timestamp = left.last_reinforced_at_ms.unwrap_or(left.created_at_ms);
        let age_limit = u128::from(stale_days).saturating_mul(DAY_MS);
        if left.admission_state == "accepted"
            && (left.scope == "L1 Working" || left.scope == "L2 Knowledge")
            && now.saturating_sub(timestamp) > age_limit
        {
            findings.push(store::NewZhishuMaintenanceFinding {
                finding_kind: "stale".to_string(),
                item_ids: vec![left.id.clone()],
                reason: format!("Accepted item has not been reinforced within {stale_days} days."),
                evidence: vec![
                    format!("last activity: {timestamp}"),
                    short_evidence(&left.content),
                ],
                severity: "low".to_string(),
            });
        }
    }

    findings
}

fn normalized_content(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn has_negation(value: &str) -> bool {
    let lowercase = value.to_lowercase();
    [
        " not ", "never", "avoid", "forbid", "must not", "禁止", "避免", "不得", "不要",
    ]
    .iter()
    .any(|marker| lowercase.contains(marker))
        || lowercase.starts_with("not ")
}

fn short_evidence(value: &str) -> String {
    let mut text = value.trim().chars().take(120).collect::<String>();
    if value.trim().chars().count() > 120 {
        text.push_str("...");
    }
    text
}

fn search_items(
    items: Vec<MemoryItem>,
    query: ZhishuSearchQuery,
    now: u128,
) -> Result<ZhishuSearchResponse, StoreError> {
    let text = query.text.trim().to_ascii_lowercase();
    let terms = text
        .split_whitespace()
        .filter(|term| !term.is_empty())
        .collect::<Vec<_>>();
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let minimum_confidence = query.minimum_confidence.unwrap_or(0.0).clamp(0.0, 1.0);
    let mut results = items
        .into_iter()
        .filter(|item| item.admission_state != "rejected" && item.level != "rejected")
        .filter(|item| optional_eq(&query.hub_area, &item.hub_area))
        .filter(|item| optional_eq(&query.item_type, &item.item_type))
        .filter(|item| optional_eq(&query.scope, &item.scope))
        .filter(|item| optional_eq(&query.admission_state, &item.admission_state))
        .filter(|item| item.confidence >= minimum_confidence)
        .filter(|item| {
            query.max_age_days.is_none_or(|days| {
                let timestamp = item.last_reinforced_at_ms.unwrap_or(item.created_at_ms);
                now.saturating_sub(timestamp) <= u128::from(days).saturating_mul(DAY_MS)
            })
        })
        .filter_map(|item| score_item(item, &terms))
        .collect::<Vec<_>>();
    results.sort_by(|left, right| {
        right
            .score
            .partial_cmp(&left.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| right.item.created_at_ms.cmp(&left.item.created_at_ms))
    });
    let total_matches = results.len();
    results.truncate(limit);

    let filters = [
        query.hub_area.as_ref().map(|value| format!("hub:{value}")),
        query
            .item_type
            .as_ref()
            .map(|value| format!("type:{value}")),
        query.scope.as_ref().map(|value| format!("scope:{value}")),
        query
            .admission_state
            .as_ref()
            .map(|value| format!("admission:{value}")),
        query
            .minimum_confidence
            .map(|value| format!("confidence>={value:.0}%")),
        query.max_age_days.map(|value| format!("age<={value}d")),
    ]
    .into_iter()
    .flatten()
    .collect();

    Ok(ZhishuSearchResponse {
        query: ZhishuSearchQueryView {
            text: query.text.trim().to_string(),
            filters,
            limit,
        },
        total_matches,
        results,
    })
}

fn score_item(item: MemoryItem, terms: &[&str]) -> Option<ZhishuSearchResult> {
    let content = item.content.to_ascii_lowercase();
    let tags = item
        .tags
        .iter()
        .map(|tag| tag.to_ascii_lowercase())
        .collect::<Vec<_>>();
    let mut fields = BTreeSet::new();
    let mut term_score = 0.0;
    for term in terms {
        let mut matched = false;
        if content.contains(term) {
            fields.insert("content".to_string());
            term_score += 0.45;
            matched = true;
        }
        if tags.iter().any(|tag| tag.contains(term)) {
            fields.insert("tags".to_string());
            term_score += 0.35;
            matched = true;
        }
        if item.item_type.to_ascii_lowercase().contains(term) {
            fields.insert("item_type".to_string());
            term_score += 0.15;
            matched = true;
        }
        if item.hub_area.to_ascii_lowercase().contains(term) {
            fields.insert("hub_area".to_string());
            term_score += 0.1;
            matched = true;
        }
        if !matched {
            return None;
        }
    }
    if terms.is_empty() {
        fields.insert("filters".to_string());
    }
    let score = (term_score
        + item.confidence * 0.35
        + if item.admission_state == "accepted" {
            0.15
        } else {
            0.0
        })
    .clamp(0.0, 1.0);
    let matched_fields = fields.into_iter().collect::<Vec<_>>();
    Some(ZhishuSearchResult {
        explanation: format!(
            "Matched {} with {:.0}% item confidence and {} admission.",
            matched_fields.join(", "),
            item.confidence * 100.0,
            item.admission_state
        ),
        item,
        score,
        matched_fields,
    })
}

fn optional_eq(filter: &Option<String>, value: &str) -> bool {
    filter
        .as_ref()
        .is_none_or(|filter| filter.trim().eq_ignore_ascii_case(value))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_explains_content_and_tag_matches_and_excludes_rejected() {
        let accepted = item("memory-1", "accepted", "Template workflow", &["template"]);
        let rejected = item("memory-2", "rejected", "Template rejected", &["template"]);

        let response = search_items(
            vec![accepted, rejected],
            ZhishuSearchQuery {
                text: "template".to_string(),
                ..Default::default()
            },
            10,
        )
        .unwrap();

        assert_eq!(response.total_matches, 1);
        assert!(response.results[0]
            .matched_fields
            .contains(&"content".to_string()));
        assert!(response.results[0].explanation.contains("admission"));
    }

    #[test]
    fn search_applies_metadata_confidence_and_age_filters() {
        let mut recent = item("memory-1", "accepted", "Recent", &["rule"]);
        recent.hub_area = "knowledge".to_string();
        recent.confidence = 0.9;
        recent.created_at_ms = 9 * DAY_MS;
        let response = search_items(
            vec![recent],
            ZhishuSearchQuery {
                hub_area: Some("knowledge".to_string()),
                minimum_confidence: Some(0.8),
                max_age_days: Some(2),
                ..Default::default()
            },
            10 * DAY_MS,
        )
        .unwrap();

        assert_eq!(response.total_matches, 1);
    }

    #[test]
    fn zhishu_retrieval_acceptance_finds_reviewed_l2_memory_after_admission() {
        let mut accepted = item(
            "memory-accepted",
            "accepted",
            "Judicial appraisal template writing workflow",
            &["template", "judicial"],
        );
        accepted.hub_area = "knowledge".to_string();
        accepted.scope = "L2 Knowledge".to_string();
        accepted.level = "reviewed".to_string();
        accepted.item_type = "knowledge".to_string();
        accepted.admission_rule = "knowledge-review-required".to_string();
        accepted.retention_policy = "durable-review".to_string();
        accepted.source_trust = "reviewed-local".to_string();

        let mut captured = accepted.clone();
        captured.id = "memory-captured".to_string();
        captured.admission_state = "captured".to_string();
        captured.content = "Judicial appraisal template captured candidate".to_string();

        let mut rejected = accepted.clone();
        rejected.id = "memory-rejected".to_string();
        rejected.admission_state = "rejected".to_string();
        rejected.level = "rejected".to_string();

        let response = search_items(
            vec![captured, rejected, accepted],
            ZhishuSearchQuery {
                text: "template judicial".to_string(),
                hub_area: Some("knowledge".to_string()),
                scope: Some("L2 Knowledge".to_string()),
                admission_state: Some("accepted".to_string()),
                minimum_confidence: Some(0.7),
                limit: Some(10),
                ..Default::default()
            },
            DAY_MS,
        )
        .unwrap();

        assert_eq!(response.total_matches, 1);
        assert_eq!(response.results[0].item.id, "memory-accepted");
        assert_eq!(response.results[0].item.retention_policy, "durable-review");
        assert!(response.results[0]
            .matched_fields
            .contains(&"content".to_string()));
        assert!(response.results[0]
            .matched_fields
            .contains(&"tags".to_string()));
    }

    #[test]
    fn maintenance_detects_duplicates_stale_items_and_conservative_conflicts() {
        let mut duplicate = item(
            "memory-2",
            "captured",
            "  Template   workflow ",
            &["template"],
        );
        duplicate.scope = "L2 Knowledge".to_string();
        let mut stale = item("memory-3", "accepted", "Old verified rule", &["rule"]);
        stale.scope = "L2 Knowledge".to_string();
        stale.created_at_ms = DAY_MS;
        let mut positive = item("memory-4", "accepted", "Use local cache", &["cache"]);
        positive.hub_area = "development".to_string();
        positive.item_type = "rule".to_string();
        let mut negative = item("memory-5", "accepted", "Do not use local cache", &["cache"]);
        negative.hub_area = "development".to_string();
        negative.item_type = "rule".to_string();

        let findings = detect_maintenance_findings(
            vec![
                item("memory-1", "captured", "Template workflow", &["template"]),
                duplicate,
                stale,
                positive,
                negative,
            ],
            30,
            100 * DAY_MS,
        );

        assert!(findings
            .iter()
            .any(|finding| finding.finding_kind == "duplicate"));
        assert!(findings
            .iter()
            .any(|finding| finding.finding_kind == "stale"));
        assert!(findings
            .iter()
            .any(|finding| finding.finding_kind == "conflict"));
    }

    #[test]
    fn maintenance_excludes_rejected_items() {
        let findings = detect_maintenance_findings(
            vec![
                item("memory-1", "accepted", "Same content", &["same"]),
                item("memory-2", "rejected", "Same content", &["same"]),
            ],
            90,
            DAY_MS,
        );

        assert!(findings.is_empty());
    }

    fn item(id: &str, admission: &str, content: &str, tags: &[&str]) -> MemoryItem {
        MemoryItem {
            id: id.to_string(),
            created_at_ms: 1,
            hub_area: "memory".to_string(),
            scope: "L1 Working".to_string(),
            level: "reviewed".to_string(),
            item_type: "knowledge".to_string(),
            admission_state: admission.to_string(),
            admission_rule: "test".to_string(),
            source: "test".to_string(),
            provenance: "test".to_string(),
            source_trust: "reviewed-local".to_string(),
            content: content.to_string(),
            tags: tags.iter().map(|value| value.to_string()).collect(),
            confidence: 0.8,
            verification: "review-accepted".to_string(),
            retention_policy: "working-review".to_string(),
            authority: "user-reviewable".to_string(),
            linked_memory_ids: Vec::new(),
            last_reinforced_at_ms: None,
            last_invalidated_at_ms: None,
        }
    }
}
