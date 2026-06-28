use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::store;

const DEFAULT_MAX_CONTEXT_CHARS: usize = 12_000;
const MAX_ITEMS: usize = 50;

#[derive(Debug, Clone, Deserialize)]
pub struct ContextBudgetItem {
    pub id: String,
    pub source_type: String,
    pub title: String,
    pub content: String,
    #[serde(default)]
    pub evidence_refs: Vec<String>,
    #[serde(default)]
    pub risk_level: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ContextBudgetRequest {
    pub task_kind: String,
    pub max_context_chars: Option<usize>,
    pub preserve_evidence: bool,
    pub items: Vec<ContextBudgetItem>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ContextBudgetDecision {
    pub item_id: String,
    pub source_type: String,
    pub title: String,
    pub original_chars: usize,
    pub allocated_chars: usize,
    pub decision: String,
    pub reason: String,
    pub evidence_refs: Vec<String>,
    pub evidence_state: String,
    pub source_sha256: String,
    pub sensitive_markers: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ContextBudgetPreview {
    pub task_kind: String,
    pub max_context_chars: usize,
    pub original_chars: usize,
    pub allocated_chars: usize,
    pub decision_state: String,
    pub preserve_evidence: bool,
    pub decisions: Vec<ContextBudgetDecision>,
    pub gates: Vec<String>,
}

pub fn preview(request: ContextBudgetRequest) -> Result<ContextBudgetPreview, store::StoreError> {
    let task_kind = required(request.task_kind, "context budget task kind")?;
    if request.items.len() > MAX_ITEMS {
        return Err(store::StoreError::InvalidInput(format!(
            "context budget accepts at most {MAX_ITEMS} items"
        )));
    }
    let max_context_chars = request
        .max_context_chars
        .unwrap_or(DEFAULT_MAX_CONTEXT_CHARS)
        .clamp(1_000, 80_000);
    let original_chars = request
        .items
        .iter()
        .map(|item| item.content.chars().count())
        .sum();
    let high_value_count = request
        .items
        .iter()
        .filter(|item| is_high_value(item))
        .count()
        .max(1);
    let mut allocated_chars = 0;
    let mut review_required = false;
    let decisions = request
        .items
        .into_iter()
        .map(|item| {
            let original = item.content.chars().count();
            let high_value = is_high_value(&item);
            let sensitive_markers = sensitive_markers(&item.content);
            let evidence_missing =
                request.preserve_evidence && high_value && item.evidence_refs.is_empty();
            if evidence_missing || !sensitive_markers.is_empty() {
                review_required = true;
            }
            let allocation = if high_value {
                (max_context_chars / high_value_count).clamp(400, original.max(400))
            } else {
                original.min(400)
            };
            let allocation = allocation.min(original);
            allocated_chars += allocation;
            let decision = if item.source_type.eq_ignore_ascii_case("web")
                || item.source_type.eq_ignore_ascii_case("agent-output")
            {
                "quarantine-summary"
            } else if allocation < original {
                "compress-preserve-evidence"
            } else {
                "keep"
            };
            let evidence_refs = if request.preserve_evidence {
                item.evidence_refs
            } else {
                Vec::new()
            };
            let evidence_state = if evidence_missing {
                "missing-evidence-review"
            } else if request.preserve_evidence {
                "preserved"
            } else {
                "not-preserved"
            };
            ContextBudgetDecision {
                item_id: item.id,
                source_type: item.source_type,
                title: item.title,
                original_chars: original,
                allocated_chars: allocation,
                decision: decision.to_string(),
                reason: reason_for(decision).to_string(),
                evidence_refs,
                evidence_state: evidence_state.to_string(),
                source_sha256: source_sha256(&item.content),
                sensitive_markers,
            }
        })
        .collect::<Vec<_>>();

    Ok(ContextBudgetPreview {
        task_kind,
        max_context_chars,
        original_chars,
        allocated_chars,
        decision_state: if review_required {
            "evidence-review-required"
        } else if allocated_chars <= max_context_chars {
            "within-budget"
        } else {
            "over-budget-review"
        }
        .to_string(),
        preserve_evidence: request.preserve_evidence,
        decisions,
        gates: vec![
            "no-source-deletion".to_string(),
            "source-sha256-manifest".to_string(),
            "preserve-error-paths-and-evidence-ids".to_string(),
            "missing-evidence-requires-review".to_string(),
            "sensitive-marker-review-before-model-call".to_string(),
            "quarantine-untrusted-web-and-agent-output".to_string(),
            "summary-only-before-model-call".to_string(),
        ],
    })
}

fn is_high_value(item: &ContextBudgetItem) -> bool {
    item.risk_level.eq_ignore_ascii_case("high")
        || !item.evidence_refs.is_empty()
        || matches!(
            item.source_type.to_ascii_lowercase().as_str(),
            "error-log" | "audit" | "code"
        )
}

fn reason_for(decision: &str) -> &'static str {
    match decision {
        "quarantine-summary" => {
            "Untrusted external or agent output stays quarantined before model use."
        }
        "compress-preserve-evidence" => {
            "Content is compressed while retaining evidence references."
        }
        _ => "Content fits the current context budget.",
    }
}

fn source_sha256(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    hex::encode(hasher.finalize())
}

fn sensitive_markers(content: &str) -> Vec<String> {
    let lower = content.to_ascii_lowercase();
    [
        ("api-key", "api_key"),
        ("token", "token"),
        ("password", "password"),
        ("cookie", "cookie"),
        ("private-key", "private key"),
        ("authorization-header", "authorization:"),
    ]
    .into_iter()
    .filter_map(|(label, marker)| lower.contains(marker).then(|| label.to_string()))
    .collect()
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
    fn preserves_evidence_and_quarantines_untrusted_sources() {
        let preview = preview(ContextBudgetRequest {
            task_kind: "debug".to_string(),
            max_context_chars: Some(1_000),
            preserve_evidence: true,
            items: vec![ContextBudgetItem {
                id: "web-1".to_string(),
                source_type: "web".to_string(),
                title: "README".to_string(),
                content: "x".repeat(2_000),
                evidence_refs: vec!["url:https://example.invalid".to_string()],
                risk_level: "medium".to_string(),
            }],
        })
        .unwrap();

        assert_eq!(preview.decision_state, "within-budget");
        assert_eq!(preview.decisions[0].decision, "quarantine-summary");
        assert_eq!(preview.decisions[0].evidence_refs.len(), 1);
        assert_eq!(preview.decisions[0].evidence_state, "preserved");
        assert_eq!(preview.decisions[0].source_sha256.len(), 64);
        assert!(preview
            .gates
            .contains(&"source-sha256-manifest".to_string()));
    }

    #[test]
    fn high_value_items_without_evidence_require_review() {
        let preview = preview(ContextBudgetRequest {
            task_kind: "incident-review".to_string(),
            max_context_chars: Some(2_000),
            preserve_evidence: true,
            items: vec![ContextBudgetItem {
                id: "log-1".to_string(),
                source_type: "error-log".to_string(),
                title: "Build failure".to_string(),
                content: "stack trace line".to_string(),
                evidence_refs: Vec::new(),
                risk_level: "high".to_string(),
            }],
        })
        .unwrap();

        assert_eq!(preview.decision_state, "evidence-review-required");
        assert_eq!(
            preview.decisions[0].evidence_state,
            "missing-evidence-review"
        );
    }

    #[test]
    fn sensitive_markers_are_preserved_as_review_signals() {
        let preview = preview(ContextBudgetRequest {
            task_kind: "summarize".to_string(),
            max_context_chars: Some(2_000),
            preserve_evidence: true,
            items: vec![ContextBudgetItem {
                id: "note-1".to_string(),
                source_type: "note".to_string(),
                title: "Local note".to_string(),
                content: "Authorization: Bearer token".to_string(),
                evidence_refs: vec!["note:1".to_string()],
                risk_level: "low".to_string(),
            }],
        })
        .unwrap();

        assert_eq!(preview.decision_state, "evidence-review-required");
        assert!(preview.decisions[0]
            .sensitive_markers
            .contains(&"token".to_string()));
        assert!(preview.decisions[0]
            .sensitive_markers
            .contains(&"authorization-header".to_string()));
    }
}
