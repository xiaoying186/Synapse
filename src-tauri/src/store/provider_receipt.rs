use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::http_source::{
    self, ProviderAdapterExecutionReceipt, ProviderReceiptAdmissionQueuePreview,
};
use crate::store::{
    append_audit_event_at, append_provider_artifact_zhishu_candidate_at, append_task_artifacts_at,
    begin_saga, create_snapshot_at, get_saga, now_millis, paths, read_json_records,
    review_memory_item_with_protection_at, transition_saga, write_json_records, AuditEvent,
    MemoryItem, NewAuditEvent, NewTaskArtifact, SagaTransaction, SnapshotRecord, StoreError,
    TaskArtifactRecord,
};

const MAX_PROVIDER_RECEIPT_REVIEW_CANDIDATES: usize = 100;
const MAX_PROVIDER_ARTIFACT_ADMISSION_REVIEWS: usize = 100;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProviderReceiptReviewCandidate {
    pub id: String,
    pub created_at_ms: u128,
    pub provider_id: String,
    pub receipt_id: String,
    pub candidate_kind: String,
    pub source_sha256: String,
    pub review_state: String,
    pub queue_state: String,
    pub task_artifact_write_started: bool,
    pub durable_zhishu_write_started: bool,
    pub requires_human_review: bool,
    pub gates: Vec<String>,
    pub blockers: Vec<String>,
    pub denied_actions: Vec<String>,
    #[serde(default)]
    pub reviewed_at_ms: Option<u128>,
    #[serde(default)]
    pub review_decision: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderReceiptReviewQueueReceipt {
    pub state: String,
    pub candidate: ProviderReceiptReviewCandidate,
    pub queue_preview: ProviderReceiptAdmissionQueuePreview,
    pub snapshot: SnapshotRecord,
    pub audit_event: AuditEvent,
    pub saga: SagaTransaction,
    pub task_artifact_write_started: bool,
    pub durable_zhishu_write_started: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderReceiptReviewDecisionReceipt {
    pub state: String,
    pub candidate: ProviderReceiptReviewCandidate,
    pub snapshot: SnapshotRecord,
    pub audit_event: AuditEvent,
    pub task_artifact_write_started: bool,
    pub durable_zhishu_write_started: bool,
    pub gates: Vec<String>,
    pub denied_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderReceiptTaskArtifactPreflight {
    pub generated_at_ms: u128,
    pub state: String,
    pub candidate_id: String,
    pub review_state: String,
    pub provider_id: String,
    pub receipt_id: String,
    pub source_sha256: String,
    pub task_artifact_write_started: bool,
    pub durable_zhishu_write_started: bool,
    pub requires_approved_provider_review: bool,
    pub requires_task_artifact_review: bool,
    pub requires_zhishu_admission_review: bool,
    pub gates: Vec<String>,
    pub blockers: Vec<String>,
    pub denied_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderReceiptTaskArtifactReceipt {
    pub state: String,
    pub candidate: ProviderReceiptReviewCandidate,
    pub artifact: TaskArtifactRecord,
    pub snapshot: SnapshotRecord,
    pub audit_event: AuditEvent,
    pub saga: SagaTransaction,
    pub task_artifact_write_started: bool,
    pub durable_zhishu_write_started: bool,
    pub gates: Vec<String>,
    pub denied_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderArtifactZhishuAdmissionPreflight {
    pub generated_at_ms: u128,
    pub state: String,
    pub artifact_id: String,
    pub artifact_type: String,
    pub reference_id: String,
    pub source_sha256: String,
    pub quarantine_state: String,
    pub task_artifact_write_started: bool,
    pub durable_zhishu_write_started: bool,
    pub requires_artifact_review: bool,
    pub requires_source_trust_review: bool,
    pub requires_zhishu_admission_review: bool,
    pub gates: Vec<String>,
    pub blockers: Vec<String>,
    pub denied_actions: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProviderArtifactAdmissionReview {
    pub id: String,
    pub created_at_ms: u128,
    pub artifact_id: String,
    pub artifact_type: String,
    pub reference_id: String,
    pub source_sha256: String,
    pub review_state: String,
    pub review_decision: String,
    pub reviewed_at_ms: u128,
    pub durable_zhishu_candidate_write_started: bool,
    pub confirmed_knowledge_write_started: bool,
    pub gates: Vec<String>,
    pub blockers: Vec<String>,
    pub denied_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderArtifactAdmissionReviewReceipt {
    pub state: String,
    pub review: ProviderArtifactAdmissionReview,
    pub snapshot: SnapshotRecord,
    pub audit_event: AuditEvent,
    pub durable_zhishu_candidate_write_started: bool,
    pub confirmed_knowledge_write_started: bool,
    pub gates: Vec<String>,
    pub denied_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderArtifactZhishuCandidateReceipt {
    pub state: String,
    pub review: ProviderArtifactAdmissionReview,
    pub artifact: TaskArtifactRecord,
    pub memory_item: MemoryItem,
    pub snapshot: SnapshotRecord,
    pub audit_event: AuditEvent,
    pub saga: SagaTransaction,
    pub durable_zhishu_candidate_write_started: bool,
    pub confirmed_knowledge_write_started: bool,
    pub gates: Vec<String>,
    pub denied_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderArtifactZhishuFinalReviewReceipt {
    pub state: String,
    pub memory_item: MemoryItem,
    pub decision: String,
    pub confirmed_knowledge_write_started: bool,
    pub gates: Vec<String>,
    pub denied_actions: Vec<String>,
}

pub fn stage_provider_receipt_review_candidate(
    receipt: ProviderAdapterExecutionReceipt,
) -> Result<ProviderReceiptReviewQueueReceipt, StoreError> {
    let queue_preview = http_source::preview_provider_receipt_admission_queue(receipt);
    let candidate_id = queue_preview
        .candidates
        .first()
        .map(|candidate| candidate.candidate_id.clone())
        .ok_or_else(|| {
            StoreError::InvalidInput("provider receipt candidate missing".to_string())
        })?;
    let saga = begin_saga(
        "provider-receipt-review-candidate".to_string(),
        candidate_id,
        json!({
            "queue_id": queue_preview.queue_id,
            "provider_id": queue_preview.provider_id,
            "receipt_id": queue_preview.receipt_id,
            "operation": "stage-review-candidate",
        }),
    )?;
    let previous_records = finalize_provider_saga(
        &saga,
        read_provider_receipt_review_candidates(&paths::provider_receipt_review_candidate_path()),
    )?;
    let receipt = finalize_provider_saga(
        &saga,
        stage_provider_receipt_review_candidate_at(
        &paths::provider_receipt_review_candidate_path(),
        &paths::snapshot_path(),
        &paths::audit_event_path(),
        queue_preview,
        saga.clone(),
    ),
    )?;
    let committed_saga = commit_provider_saga_with_compensation(
        &saga,
        transition_saga(receipt.saga.id.clone(), "committed".to_string()),
        || {
            write_json_records(
                &paths::provider_receipt_review_candidate_path(),
                &previous_records,
            )
        },
    )?;

    Ok(ProviderReceiptReviewQueueReceipt {
        saga: committed_saga,
        ..receipt
    })
}

fn stage_provider_receipt_review_candidate_at(
    candidate_path: &Path,
    snapshot_path: &Path,
    audit_path: &Path,
    queue_preview: ProviderReceiptAdmissionQueuePreview,
    saga: SagaTransaction,
) -> Result<ProviderReceiptReviewQueueReceipt, StoreError> {
    let admission = queue_preview.candidates.first().ok_or_else(|| {
        StoreError::InvalidInput("provider receipt candidate missing".to_string())
    })?;
    let candidate = ProviderReceiptReviewCandidate {
        id: admission.candidate_id.clone(),
        created_at_ms: now_millis(),
        provider_id: admission.provider_id.clone(),
        receipt_id: admission.receipt_id.clone(),
        candidate_kind: admission.candidate_kind.clone(),
        source_sha256: admission.source_sha256.clone(),
        review_state: "pending-human-review".to_string(),
        queue_state: queue_preview.state.clone(),
        task_artifact_write_started: false,
        durable_zhishu_write_started: false,
        requires_human_review: true,
        gates: queue_preview.gates.clone(),
        blockers: queue_preview.blockers.clone(),
        denied_actions: queue_preview.denied_actions.clone(),
        reviewed_at_ms: None,
        review_decision: None,
    };

    let snapshot = create_snapshot_at(
        snapshot_path,
        "provider-receipt-review-candidate".to_string(),
        candidate.id.clone(),
        "before-provider-receipt-review".to_string(),
        json!({
            "candidate": candidate,
            "queue_preview": queue_preview,
            "saga_id": saga.id,
        }),
    )?;
    let mut records = read_provider_receipt_review_candidates(candidate_path)?;
    let previous_records = records.clone();
    records.retain(|record| record.id != candidate.id);
    records.insert(0, candidate.clone());
    records.truncate(MAX_PROVIDER_RECEIPT_REVIEW_CANDIDATES);
    write_json_records(candidate_path, &records)?;
    let audit_event = match append_audit_event_at(
        audit_path,
        NewAuditEvent {
            actor: "taiheng".to_string(),
            action: "stage-provider-receipt-review-candidate".to_string(),
            target_type: "provider-receipt-review-candidate".to_string(),
            target_id: candidate.id.clone(),
            risk_level: "medium".to_string(),
            decision: "quarantined-review-required".to_string(),
            input: json!({
                "candidate_id": candidate.id,
                "receipt_id": candidate.receipt_id,
                "source_sha256": candidate.source_sha256,
                "saga_id": saga.id,
            }),
            result_summary: json!({
                "task_artifact_write_started": false,
                "durable_zhishu_write_started": false,
                "review_state": candidate.review_state,
                "snapshot_id": snapshot.id,
            }),
            error: None,
        },
    ) {
        Ok(value) => value,
        Err(error) => {
            return finish_provider_candidate_queue_compensation(
                error,
                write_json_records(candidate_path, &previous_records),
            )
        }
    };

    Ok(ProviderReceiptReviewQueueReceipt {
        state: "provider-receipt-review-candidate-staged".to_string(),
        candidate,
        queue_preview,
        snapshot,
        audit_event,
        saga,
        task_artifact_write_started: false,
        durable_zhishu_write_started: false,
    })
}

fn finish_provider_candidate_queue_compensation<T>(
    original_error: StoreError,
    compensation: Result<(), StoreError>,
) -> Result<T, StoreError> {
    match compensation {
        Ok(()) => Err(original_error),
        Err(compensation_error) => Err(StoreError::InvalidInput(format!(
            "provider receipt review queue write failed: {original_error}; compensation failed: {compensation_error}"
        ))),
    }
}

pub fn provider_receipt_review_candidates(
    limit: usize,
) -> Result<Vec<ProviderReceiptReviewCandidate>, StoreError> {
    let mut records =
        read_provider_receipt_review_candidates(&paths::provider_receipt_review_candidate_path())?;
    records.truncate(limit.clamp(1, 100));
    Ok(records)
}

pub fn review_provider_receipt_review_candidate(
    candidate_id: String,
    decision: String,
) -> Result<ProviderReceiptReviewDecisionReceipt, StoreError> {
    review_provider_receipt_review_candidate_at(
        &paths::provider_receipt_review_candidate_path(),
        &paths::snapshot_path(),
        &paths::audit_event_path(),
        candidate_id,
        decision,
    )
}

pub fn preflight_provider_receipt_task_artifact(
    candidate_id: String,
) -> Result<ProviderReceiptTaskArtifactPreflight, StoreError> {
    preflight_provider_receipt_task_artifact_at(
        &paths::provider_receipt_review_candidate_path(),
        candidate_id,
    )
}

pub fn create_provider_receipt_task_artifact(
    candidate_id: String,
) -> Result<ProviderReceiptTaskArtifactReceipt, StoreError> {
    let saga = begin_saga(
        "provider-receipt-task-artifact".to_string(),
        candidate_id.clone(),
        json!({
            "candidate_id": candidate_id,
            "operation": "create-isolated-task-artifact",
        }),
    )?;
    let candidate_path = paths::provider_receipt_review_candidate_path();
    let artifact_path = paths::task_artifact_path();
    let previous_candidates = finalize_provider_saga(
        &saga,
        read_provider_receipt_review_candidates(&candidate_path),
    )?;
    let previous_artifacts = finalize_provider_saga(
        &saga,
        read_json_records::<TaskArtifactRecord>(&artifact_path),
    )?;
    let receipt = finalize_provider_saga(
        &saga,
        create_provider_receipt_task_artifact_at(
        &candidate_path,
        &artifact_path,
        &paths::snapshot_path(),
        &paths::audit_event_path(),
        candidate_id,
        saga.clone(),
    ),
    )?;
    let committed_saga = commit_provider_saga_with_compensation(
        &saga,
        transition_saga(receipt.saga.id.clone(), "committed".to_string()),
        || {
            compensate_provider_task_artifact(
                &saga,
                &candidate_path,
                &previous_candidates,
                &artifact_path,
                &previous_artifacts,
            )
        },
    )?;

    Ok(ProviderReceiptTaskArtifactReceipt {
        saga: committed_saga,
        ..receipt
    })
}

pub fn preflight_provider_artifact_zhishu_admission(
    artifact_id: String,
) -> Result<ProviderArtifactZhishuAdmissionPreflight, StoreError> {
    preflight_provider_artifact_zhishu_admission_at(&paths::task_artifact_path(), artifact_id)
}

pub fn review_provider_artifact_zhishu_admission(
    artifact_id: String,
    decision: String,
) -> Result<ProviderArtifactAdmissionReviewReceipt, StoreError> {
    review_provider_artifact_zhishu_admission_at(
        &paths::task_artifact_path(),
        &paths::provider_artifact_admission_review_path(),
        &paths::snapshot_path(),
        &paths::audit_event_path(),
        artifact_id,
        decision,
    )
}

pub fn create_provider_artifact_zhishu_candidate(
    artifact_id: String,
) -> Result<ProviderArtifactZhishuCandidateReceipt, StoreError> {
    let saga = begin_saga(
        "provider-artifact-zhishu-candidate".to_string(),
        artifact_id.clone(),
        json!({
            "artifact_id": artifact_id,
            "operation": "create-zhishu-candidate-from-provider-artifact",
        }),
    )?;
    let memory_path = paths::memory_path();
    let previous_memories =
        finalize_provider_saga(&saga, read_json_records::<MemoryItem>(&memory_path))?;
    let receipt = finalize_provider_saga(
        &saga,
        create_provider_artifact_zhishu_candidate_at(
        &paths::task_artifact_path(),
        &paths::provider_artifact_admission_review_path(),
        &memory_path,
        &paths::snapshot_path(),
        &paths::audit_event_path(),
        artifact_id,
        saga.clone(),
    ),
    )?;
    let committed_saga = commit_provider_saga_with_compensation(
        &saga,
        transition_saga(receipt.saga.id.clone(), "committed".to_string()),
        || write_json_records(&memory_path, &previous_memories),
    )?;

    Ok(ProviderArtifactZhishuCandidateReceipt {
        saga: committed_saga,
        ..receipt
    })
}

fn finalize_provider_saga<T>(
    saga: &SagaTransaction,
    result: Result<T, StoreError>,
) -> Result<T, StoreError> {
    match result {
        Ok(value) => Ok(value),
        Err(error) => {
            if saga.state == "pending" {
                let _ = transition_saga(saga.id.clone(), "failed".to_string());
            }
            Err(error)
        }
    }
}

fn commit_provider_saga_with_compensation<F>(
    saga: &SagaTransaction,
    commit_result: Result<SagaTransaction, StoreError>,
    compensate: F,
) -> Result<SagaTransaction, StoreError>
where
    F: FnOnce() -> Result<(), StoreError>,
{
    match commit_result {
        Ok(committed_saga) => Ok(committed_saga),
        Err(commit_error) => {
            if matches!(get_saga(saga.id.clone()), Ok(current) if current.state == "committed") {
                return get_saga(saga.id.clone());
            }

            let _ = transition_saga(saga.id.clone(), "compensating".to_string());
            match compensate() {
                Ok(()) => {
                    let _ = transition_saga(saga.id.clone(), "compensated".to_string());
                    Err(commit_error)
                }
                Err(compensation_error) => {
                    let _ = transition_saga(saga.id.clone(), "failed".to_string());
                    Err(StoreError::InvalidInput(format!(
                        "provider receipt saga commit failed: {commit_error}; compensation failed: {compensation_error}"
                    )))
                }
            }
        }
    }
}

pub fn review_provider_artifact_zhishu_candidate(
    memory_id: String,
    decision: String,
) -> Result<ProviderArtifactZhishuFinalReviewReceipt, StoreError> {
    review_provider_artifact_zhishu_candidate_at(
        &paths::memory_path(),
        &paths::snapshot_path(),
        &paths::audit_event_path(),
        memory_id,
        decision,
    )
}

fn review_provider_artifact_zhishu_candidate_at(
    memory_path: &Path,
    snapshot_path: &Path,
    audit_path: &Path,
    memory_id: String,
    decision: String,
) -> Result<ProviderArtifactZhishuFinalReviewReceipt, StoreError> {
    let memory_id = memory_id.trim().to_string();
    if memory_id.is_empty() {
        return Err(StoreError::InvalidInput(
            "provider artifact Zhishu candidate id cannot be empty".to_string(),
        ));
    }
    let before = read_json_records::<MemoryItem>(memory_path)?
        .into_iter()
        .find(|item| item.id == memory_id)
        .ok_or_else(|| StoreError::NotFound(memory_id.clone()))?;
    if before.source != "provider-artifact-review" {
        return Err(StoreError::InvalidInput(
            "memory item is not a provider artifact Zhishu candidate".to_string(),
        ));
    }
    if before.level != "candidate" || before.admission_state != "candidate" {
        return Err(StoreError::InvalidInput(format!(
            "provider artifact Zhishu candidate is not reviewable: {}/{}",
            before.level, before.admission_state
        )));
    }
    let decision = decision.trim().to_ascii_lowercase();
    if !matches!(decision.as_str(), "accepted" | "rejected") {
        return Err(StoreError::InvalidInput(format!(
            "unsupported provider artifact Zhishu candidate decision: {decision}"
        )));
    }
    let memory_item = review_memory_item_with_protection_at(
        memory_path,
        snapshot_path,
        audit_path,
        before.id,
        decision.clone(),
    )?;

    Ok(ProviderArtifactZhishuFinalReviewReceipt {
        state: if decision == "accepted" {
            "provider-artifact-zhishu-candidate-accepted".to_string()
        } else {
            "provider-artifact-zhishu-candidate-rejected".to_string()
        },
        memory_item,
        decision,
        confirmed_knowledge_write_started: false,
        gates: vec![
            "final-zhishu-candidate-review-complete".to_string(),
            "provider-artifact-source-trace-retained".to_string(),
            "no-automatic-provider-knowledge-confirmation".to_string(),
        ],
        denied_actions: vec![
            "auto-confirm-provider-artifact-knowledge".to_string(),
            "bypass-provider-candidate-final-review".to_string(),
        ],
    })
}

fn read_provider_receipt_review_candidates(
    path: &Path,
) -> Result<Vec<ProviderReceiptReviewCandidate>, StoreError> {
    read_json_records(path)
}

fn read_provider_artifact_admission_reviews(
    path: &Path,
) -> Result<Vec<ProviderArtifactAdmissionReview>, StoreError> {
    read_json_records(path)
}

fn provider_artifact_by_id(
    artifact_path: &Path,
    artifact_id: &str,
) -> Result<TaskArtifactRecord, StoreError> {
    read_json_records::<TaskArtifactRecord>(artifact_path)?
        .into_iter()
        .find(|artifact| artifact.id == artifact_id)
        .ok_or_else(|| StoreError::NotFound(artifact_id.to_string()))
}

fn preflight_provider_artifact_zhishu_admission_at(
    artifact_path: &Path,
    artifact_id: String,
) -> Result<ProviderArtifactZhishuAdmissionPreflight, StoreError> {
    let artifact_id = artifact_id.trim().to_string();
    if artifact_id.is_empty() {
        return Err(StoreError::InvalidInput(
            "provider artifact id cannot be empty".to_string(),
        ));
    }
    let artifacts = read_json_records::<TaskArtifactRecord>(artifact_path)?;
    let artifact = artifacts
        .into_iter()
        .find(|artifact| artifact.id == artifact_id)
        .ok_or_else(|| StoreError::NotFound(artifact_id.clone()))?;
    let source_sha256 = artifact
        .metadata
        .get("source_sha256")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .to_string();
    let quarantine_state = artifact
        .metadata
        .get("quarantine_state")
        .and_then(|value| value.as_str())
        .unwrap_or("missing")
        .to_string();
    let provider_artifact = provider_artifact_admission_required(&artifact);
    let has_hash = source_sha256.len() == 64;
    let quarantined = quarantine_state == "task-artifact-review-required";
    let mut blockers = Vec::new();
    if !provider_artifact {
        blockers.push("provider-artifact-type-mismatch".to_string());
    }
    if !has_hash {
        blockers.push("provider-artifact-sha256-missing".to_string());
    }
    if !quarantined {
        blockers.push("provider-artifact-not-quarantined".to_string());
    }
    blockers.extend([
        "artifact-review-not-approved".to_string(),
        "provider-source-trust-not-reviewed".to_string(),
        "zhishu-admission-not-approved".to_string(),
    ]);

    Ok(ProviderArtifactZhishuAdmissionPreflight {
        generated_at_ms: now_millis(),
        state: if provider_artifact && has_hash && quarantined {
            "provider-artifact-zhishu-admission-review-required".to_string()
        } else {
            "provider-artifact-zhishu-admission-blocked".to_string()
        },
        artifact_id: artifact.id,
        artifact_type: artifact.artifact_type,
        reference_id: artifact.reference_id,
        source_sha256,
        quarantine_state,
        task_artifact_write_started: false,
        durable_zhishu_write_started: false,
        requires_artifact_review: true,
        requires_source_trust_review: true,
        requires_zhishu_admission_review: true,
        gates: vec![
            "provider-artifact-admission-marker-required".to_string(),
            "source-sha256-required-before-admission".to_string(),
            "artifact-review-required-before-zhishu".to_string(),
            "source-trust-review-before-provider-admission".to_string(),
            "review-before-zhishu-admission".to_string(),
            "no-automatic-l2-write".to_string(),
        ],
        blockers,
        denied_actions: vec![
            "promote-provider-artifact-to-zhishu-without-review".to_string(),
            "skip-provider-source-trust-review".to_string(),
            "write-provider-artifact-to-l2-from-preflight".to_string(),
        ],
    })
}

fn provider_artifact_admission_required(artifact: &TaskArtifactRecord) -> bool {
    artifact.artifact_type == "provider-receipt-evidence"
        || artifact
            .metadata
            .get("provider_artifact_admission_required")
            .and_then(|value| value.as_bool())
            .unwrap_or(false)
}

fn review_provider_artifact_zhishu_admission_at(
    artifact_path: &Path,
    review_path: &Path,
    snapshot_path: &Path,
    audit_path: &Path,
    artifact_id: String,
    decision: String,
) -> Result<ProviderArtifactAdmissionReviewReceipt, StoreError> {
    let decision = decision.trim().to_ascii_lowercase();
    if !matches!(decision.as_str(), "approved" | "rejected") {
        return Err(StoreError::InvalidInput(format!(
            "unsupported provider artifact admission decision: {decision}"
        )));
    }
    let preflight = preflight_provider_artifact_zhishu_admission_at(artifact_path, artifact_id)?;
    if preflight.state != "provider-artifact-zhishu-admission-review-required" {
        return Err(StoreError::InvalidInput(format!(
            "provider artifact admission is not reviewable: {}",
            preflight.state
        )));
    }
    let artifact = provider_artifact_by_id(artifact_path, &preflight.artifact_id)?;
    let snapshot = create_snapshot_at(
        snapshot_path,
        "provider-artifact-admission-review".to_string(),
        artifact.id.clone(),
        "before-provider-artifact-admission-review".to_string(),
        json!({
            "artifact": artifact,
            "preflight": preflight,
        }),
    )?;
    let reviewed_at_ms = now_millis();
    let review = ProviderArtifactAdmissionReview {
        id: format!("provider-artifact-admission-review-{reviewed_at_ms}"),
        created_at_ms: reviewed_at_ms,
        artifact_id: preflight.artifact_id.clone(),
        artifact_type: preflight.artifact_type.clone(),
        reference_id: preflight.reference_id.clone(),
        source_sha256: preflight.source_sha256.clone(),
        review_state: if decision == "approved" {
            "approved-for-zhishu-candidate".to_string()
        } else {
            "rejected".to_string()
        },
        review_decision: decision.clone(),
        reviewed_at_ms,
        durable_zhishu_candidate_write_started: false,
        confirmed_knowledge_write_started: false,
        gates: vec![
            "artifact-review-complete".to_string(),
            "source-trust-review-complete".to_string(),
            "candidate-only-zhishu-admission".to_string(),
            "confirmed-knowledge-review-still-required".to_string(),
        ],
        blockers: if decision == "approved" {
            vec!["confirmed-knowledge-review-not-complete".to_string()]
        } else {
            vec!["provider-artifact-admission-rejected".to_string()]
        },
        denied_actions: vec![
            "auto-confirm-provider-artifact-knowledge".to_string(),
            "skip-candidate-zhishu-review".to_string(),
        ],
    };
    let mut records = read_provider_artifact_admission_reviews(review_path)?;
    records.retain(|record| record.artifact_id != review.artifact_id);
    records.insert(0, review.clone());
    records.truncate(MAX_PROVIDER_ARTIFACT_ADMISSION_REVIEWS);
    write_json_records(review_path, &records)?;
    let audit_event = append_audit_event_at(
        audit_path,
        NewAuditEvent {
            actor: "taiheng".to_string(),
            action: "review-provider-artifact-zhishu-admission".to_string(),
            target_type: "provider-artifact-admission-review".to_string(),
            target_id: review.id.clone(),
            risk_level: "high".to_string(),
            decision: decision.clone(),
            input: json!({
                "artifact_id": review.artifact_id,
                "review_decision": decision,
                "source_sha256": review.source_sha256,
            }),
            result_summary: json!({
                "review_state": review.review_state,
                "durable_zhishu_candidate_write_started": false,
                "confirmed_knowledge_write_started": false,
                "snapshot_id": snapshot.id,
            }),
            error: None,
        },
    )?;

    Ok(ProviderArtifactAdmissionReviewReceipt {
        state: "provider-artifact-zhishu-admission-reviewed".to_string(),
        review,
        snapshot,
        audit_event,
        durable_zhishu_candidate_write_started: false,
        confirmed_knowledge_write_started: false,
        gates: vec![
            "provider-artifact-admission-reviewed".to_string(),
            "candidate-write-requires-explicit-next-step".to_string(),
            "confirmed-knowledge-review-still-required".to_string(),
        ],
        denied_actions: vec![
            "auto-write-provider-artifact-to-zhishu-after-review".to_string(),
            "auto-confirm-provider-artifact-knowledge".to_string(),
        ],
    })
}

fn create_provider_artifact_zhishu_candidate_at(
    artifact_path: &Path,
    review_path: &Path,
    memory_path: &Path,
    snapshot_path: &Path,
    audit_path: &Path,
    artifact_id: String,
    saga: SagaTransaction,
) -> Result<ProviderArtifactZhishuCandidateReceipt, StoreError> {
    let artifact_id = artifact_id.trim().to_string();
    if artifact_id.is_empty() {
        return Err(StoreError::InvalidInput(
            "provider artifact id cannot be empty".to_string(),
        ));
    }
    let artifact = provider_artifact_by_id(artifact_path, &artifact_id)?;
    let review = read_provider_artifact_admission_reviews(review_path)?
        .into_iter()
        .find(|review| review.artifact_id == artifact_id)
        .ok_or_else(|| {
            StoreError::InvalidInput(
                "provider artifact Zhishu admission review is required".to_string(),
            )
        })?;
    if review.review_state != "approved-for-zhishu-candidate" {
        return Err(StoreError::InvalidInput(format!(
            "provider artifact Zhishu admission review is not approved: {}",
            review.review_state
        )));
    }
    let snapshot = create_snapshot_at(
        snapshot_path,
        "provider-artifact-zhishu-candidate".to_string(),
        artifact.id.clone(),
        "before-provider-artifact-zhishu-candidate-create".to_string(),
        json!({
            "artifact": artifact,
            "review": review,
            "saga_id": saga.id,
        }),
    )?;
    let provider_id = artifact
        .metadata
        .get("provider_id")
        .and_then(|value| value.as_str())
        .unwrap_or("unknown-provider");
    let receipt_id = artifact
        .metadata
        .get("receipt_id")
        .and_then(|value| value.as_str())
        .unwrap_or("unknown-receipt");
    let content = format!(
        "Provider artifact candidate from {provider_id} / {receipt_id}: {} Source SHA-256: {}. This is candidate knowledge and still requires final Zhishu confirmation.",
        artifact.summary, review.source_sha256
    );
    let previous_memories = read_json_records::<MemoryItem>(memory_path)?;
    let memory_item = append_provider_artifact_zhishu_candidate_at(
        memory_path,
        content,
        vec![
            "provider-artifact".to_string(),
            "zhishu-candidate".to_string(),
            provider_id.to_string(),
            artifact.id.clone(),
        ],
    )?;
    let audit_event = match append_audit_event_at(
        audit_path,
        NewAuditEvent {
            actor: "taiheng".to_string(),
            action: "create-provider-artifact-zhishu-candidate".to_string(),
            target_type: "memory-item".to_string(),
            target_id: memory_item.id.clone(),
            risk_level: "high".to_string(),
            decision: "candidate-created-review-required".to_string(),
            input: json!({
                "artifact_id": artifact.id,
                "review_id": review.id,
                "saga_id": saga.id,
            }),
            result_summary: json!({
                "memory_id": memory_item.id,
                "admission_state": memory_item.admission_state,
                "level": memory_item.level,
                "durable_zhishu_candidate_write_started": true,
                "confirmed_knowledge_write_started": false,
                "snapshot_id": snapshot.id,
            }),
            error: None,
        },
    ) {
        Ok(value) => value,
        Err(error) => {
            return finish_provider_candidate_compensation(
                error,
                write_json_records(memory_path, &previous_memories),
            )
        }
    };

    Ok(ProviderArtifactZhishuCandidateReceipt {
        state: "provider-artifact-zhishu-candidate-created".to_string(),
        review,
        artifact,
        memory_item,
        snapshot,
        audit_event,
        saga,
        durable_zhishu_candidate_write_started: true,
        confirmed_knowledge_write_started: false,
        gates: vec![
            "approved-provider-artifact-admission-review".to_string(),
            "zhishu-candidate-created".to_string(),
            "confirmed-knowledge-review-still-required".to_string(),
        ],
        denied_actions: vec![
            "auto-confirm-provider-artifact-knowledge".to_string(),
            "skip-final-zhishu-candidate-review".to_string(),
        ],
    })
}

fn finish_provider_candidate_compensation<T>(
    original_error: StoreError,
    compensation: Result<(), StoreError>,
) -> Result<T, StoreError> {
    match compensation {
        Ok(()) => Err(original_error),
        Err(compensation_error) => Err(StoreError::InvalidInput(format!(
            "provider artifact Zhishu candidate write failed: {original_error}; memory compensation failed: {compensation_error}"
        ))),
    }
}

fn preflight_provider_receipt_task_artifact_at(
    candidate_path: &Path,
    candidate_id: String,
) -> Result<ProviderReceiptTaskArtifactPreflight, StoreError> {
    let candidate_id = candidate_id.trim().to_string();
    if candidate_id.is_empty() {
        return Err(StoreError::InvalidInput(
            "provider receipt candidate id cannot be empty".to_string(),
        ));
    }
    let candidates = read_provider_receipt_review_candidates(candidate_path)?;
    let candidate = candidates
        .into_iter()
        .find(|candidate| candidate.id == candidate_id)
        .ok_or_else(|| StoreError::NotFound(candidate_id.clone()))?;
    let approved = candidate.review_state == "approved-for-task-artifact-review";
    let mut blockers = Vec::new();
    if !approved {
        blockers.push("provider-receipt-candidate-not-approved".to_string());
    }
    blockers.extend([
        "task-artifact-review-not-complete".to_string(),
        "zhishu-admission-not-approved".to_string(),
    ]);

    Ok(ProviderReceiptTaskArtifactPreflight {
        generated_at_ms: now_millis(),
        state: if approved {
            "provider-task-artifact-preflight-ready-for-review".to_string()
        } else {
            "provider-task-artifact-preflight-blocked".to_string()
        },
        candidate_id: candidate.id,
        review_state: candidate.review_state,
        provider_id: candidate.provider_id,
        receipt_id: candidate.receipt_id,
        source_sha256: candidate.source_sha256,
        task_artifact_write_started: false,
        durable_zhishu_write_started: false,
        requires_approved_provider_review: true,
        requires_task_artifact_review: true,
        requires_zhishu_admission_review: true,
        gates: vec![
            "approved-provider-review-required".to_string(),
            "task-artifact-review-required-before-write".to_string(),
            "zhishu-admission-still-requires-separate-review".to_string(),
            "no-automatic-task-artifact-write".to_string(),
            "no-automatic-l2-write".to_string(),
        ],
        blockers,
        denied_actions: vec![
            "write-task-artifact-from-provider-preflight".to_string(),
            "promote-provider-artifact-to-zhishu-without-review".to_string(),
        ],
    })
}

fn create_provider_receipt_task_artifact_at(
    candidate_path: &Path,
    artifact_path: &Path,
    snapshot_path: &Path,
    audit_path: &Path,
    candidate_id: String,
    saga: SagaTransaction,
) -> Result<ProviderReceiptTaskArtifactReceipt, StoreError> {
    let preflight =
        preflight_provider_receipt_task_artifact_at(candidate_path, candidate_id.clone())?;
    if preflight.state != "provider-task-artifact-preflight-ready-for-review" {
        return Err(StoreError::InvalidInput(format!(
            "provider receipt task artifact is not ready: {}",
            preflight.state
        )));
    }
    let mut candidates = read_provider_receipt_review_candidates(candidate_path)?;
    let Some(index) = candidates
        .iter()
        .position(|candidate| candidate.id == candidate_id)
    else {
        return Err(StoreError::NotFound(candidate_id));
    };
    let before = candidates[index].clone();
    let previous_candidates = candidates.clone();
    let previous_artifacts = read_json_records::<TaskArtifactRecord>(artifact_path)?;
    let snapshot = create_snapshot_at(
        snapshot_path,
        "provider-receipt-review-candidate".to_string(),
        before.id.clone(),
        "before-provider-task-artifact-create".to_string(),
        json!({
            "candidate": before,
            "saga_id": saga.id,
        }),
    )?;
    let artifacts = append_task_artifacts_at(
        artifact_path,
        format!("provider-receipt-run-{}", candidates[index].receipt_id),
        "baigong-provider-receipt".to_string(),
        vec![NewTaskArtifact {
            artifact_type: "provider-receipt-evidence".to_string(),
            reference_id: candidates[index].id.clone(),
            title: format!("Provider evidence {}", candidates[index].provider_id),
            summary: format!(
                "Quarantined provider receipt evidence {} with sha256 {}.",
                candidates[index].receipt_id, candidates[index].source_sha256
            ),
            metadata: json!({
                "source": "provider-receipt-review-candidate",
                "candidate_id": candidates[index].id,
                "provider_id": candidates[index].provider_id,
                "receipt_id": candidates[index].receipt_id,
                "source_sha256": candidates[index].source_sha256,
                "quarantine_state": "task-artifact-review-required",
                "zhishu_admission_state": "not-started",
                "durable_zhishu_write_started": false,
                "saga_id": saga.id,
                "snapshot_id": snapshot.id,
            }),
        }],
    )?;
    let artifact = artifacts
        .into_iter()
        .next()
        .ok_or_else(|| StoreError::InvalidInput("provider task artifact missing".to_string()))?;
    let candidate = &mut candidates[index];
    candidate.review_state = "task-artifact-staged".to_string();
    candidate.task_artifact_write_started = true;
    candidate.durable_zhishu_write_started = false;
    candidate.blockers.retain(|blocker| {
        !matches!(
            blocker.as_str(),
            "task-artifact-review-not-complete" | "provider-receipt-candidate-not-approved"
        )
    });
    if !candidate
        .blockers
        .contains(&"zhishu-admission-not-approved".to_string())
    {
        candidate
            .blockers
            .push("zhishu-admission-not-approved".to_string());
    }
    let candidate = candidate.clone();
    if let Err(error) = write_json_records(candidate_path, &candidates) {
        return finish_provider_task_artifact_compensation(
            error,
            compensate_provider_task_artifact(
                &saga,
                candidate_path,
                &previous_candidates,
                artifact_path,
                &previous_artifacts,
            ),
        );
    }
    let audit_event = match append_audit_event_at(
        audit_path,
        NewAuditEvent {
            actor: "taiheng".to_string(),
            action: "create-provider-receipt-task-artifact".to_string(),
            target_type: "task-artifact".to_string(),
            target_id: artifact.id.clone(),
            risk_level: "medium".to_string(),
            decision: "isolated-artifact-created".to_string(),
            input: json!({
                "candidate_id": candidate.id,
                "artifact_id": artifact.id,
                "saga_id": saga.id,
            }),
            result_summary: json!({
                "candidate_review_state": candidate.review_state,
                "task_artifact_write_started": true,
                "durable_zhishu_write_started": false,
                "snapshot_id": snapshot.id,
            }),
            error: None,
        },
    ) {
        Ok(value) => value,
        Err(error) => {
            return finish_provider_task_artifact_compensation(
                error,
                compensate_provider_task_artifact(
                    &saga,
                    candidate_path,
                    &previous_candidates,
                    artifact_path,
                    &previous_artifacts,
                ),
            )
        }
    };

    Ok(ProviderReceiptTaskArtifactReceipt {
        state: "provider-task-artifact-staged".to_string(),
        candidate,
        artifact,
        snapshot,
        audit_event,
        saga,
        task_artifact_write_started: true,
        durable_zhishu_write_started: false,
        gates: vec![
            "isolated-task-artifact-created".to_string(),
            "artifact-review-required-before-zhishu".to_string(),
            "zhishu-admission-still-requires-separate-review".to_string(),
            "no-automatic-l2-write".to_string(),
        ],
        denied_actions: vec![
            "auto-promote-provider-artifact-to-zhishu".to_string(),
            "skip-artifact-review-after-provider-staging".to_string(),
        ],
    })
}

fn finish_provider_task_artifact_compensation<T>(
    original_error: StoreError,
    compensation: Result<(), StoreError>,
) -> Result<T, StoreError> {
    match compensation {
        Ok(()) => Err(original_error),
        Err(compensation_error) => Err(StoreError::InvalidInput(format!(
            "provider task artifact write failed: {original_error}; compensation failed: {compensation_error}"
        ))),
    }
}

fn compensate_provider_task_artifact(
    saga: &SagaTransaction,
    candidate_path: &Path,
    previous_candidates: &[ProviderReceiptReviewCandidate],
    artifact_path: &Path,
    previous_artifacts: &[TaskArtifactRecord],
) -> Result<(), StoreError> {
    let _ = transition_saga(saga.id.clone(), "compensating".to_string());
    let candidates_result = write_json_records(candidate_path, previous_candidates);
    let artifacts_result = write_json_records(artifact_path, previous_artifacts);
    if candidates_result.is_ok() && artifacts_result.is_ok() {
        let _ = transition_saga(saga.id.clone(), "compensated".to_string());
        return Ok(());
    }
    let _ = transition_saga(saga.id.clone(), "failed".to_string());
    Err(StoreError::InvalidInput(
        "provider task artifact compensation failed".to_string(),
    ))
}

fn review_provider_receipt_review_candidate_at(
    candidate_path: &Path,
    snapshot_path: &Path,
    audit_path: &Path,
    candidate_id: String,
    decision: String,
) -> Result<ProviderReceiptReviewDecisionReceipt, StoreError> {
    let decision = decision.trim().to_ascii_lowercase();
    if !matches!(decision.as_str(), "approved" | "rejected") {
        return Err(StoreError::InvalidInput(format!(
            "unsupported provider receipt review decision: {decision}"
        )));
    }
    let mut records = read_provider_receipt_review_candidates(candidate_path)?;
    let Some(index) = records.iter().position(|record| record.id == candidate_id) else {
        return Err(StoreError::NotFound(candidate_id));
    };
    let before = records[index].clone();
    let snapshot = create_snapshot_at(
        snapshot_path,
        "provider-receipt-review-candidate".to_string(),
        before.id.clone(),
        "before-provider-receipt-review-decision".to_string(),
        json!({ "candidate": before }),
    )?;

    let reviewed_at_ms = now_millis();
    let candidate = &mut records[index];
    candidate.review_decision = Some(decision.clone());
    candidate.reviewed_at_ms = Some(reviewed_at_ms);
    candidate.review_state = if decision == "approved" {
        "approved-for-task-artifact-review".to_string()
    } else {
        "rejected".to_string()
    };
    candidate.task_artifact_write_started = false;
    candidate.durable_zhishu_write_started = false;
    let candidate = candidate.clone();
    write_json_records(candidate_path, &records)?;
    let audit_event = append_audit_event_at(
        audit_path,
        NewAuditEvent {
            actor: "taiheng".to_string(),
            action: "review-provider-receipt-review-candidate".to_string(),
            target_type: "provider-receipt-review-candidate".to_string(),
            target_id: candidate.id.clone(),
            risk_level: "medium".to_string(),
            decision: decision.clone(),
            input: json!({
                "candidate_id": candidate.id,
                "decision": decision,
                "source_sha256": candidate.source_sha256,
            }),
            result_summary: json!({
                "review_state": candidate.review_state,
                "task_artifact_write_started": false,
                "durable_zhishu_write_started": false,
                "snapshot_id": snapshot.id,
            }),
            error: None,
        },
    )?;

    Ok(ProviderReceiptReviewDecisionReceipt {
        state: "provider-receipt-review-decision-recorded".to_string(),
        candidate,
        snapshot,
        audit_event,
        task_artifact_write_started: false,
        durable_zhishu_write_started: false,
        gates: vec![
            "approved-candidate-still-needs-task-artifact-review".to_string(),
            "zhishu-admission-still-requires-separate-review".to_string(),
            "no-automatic-task-artifact-write".to_string(),
            "no-automatic-l2-write".to_string(),
        ],
        denied_actions: vec![
            "auto-create-task-artifact-after-provider-review".to_string(),
            "auto-promote-provider-candidate-to-zhishu".to_string(),
        ],
    })
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;

    use super::*;
    use crate::store::list_sagas;

    fn temp_store_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "synapse-provider-receipt-{name}-{}.json",
            now_millis()
        ))
    }

    fn fake_saga(target_id: &str) -> SagaTransaction {
        SagaTransaction {
            id: format!("saga-test-{}", now_millis()),
            kind: "provider-receipt-review-candidate".to_string(),
            target_id: target_id.to_string(),
            state: "pending".to_string(),
            metadata: json!({}),
            created_at_ms: now_millis(),
            updated_at_ms: now_millis(),
        }
    }

    #[test]
    fn stages_provider_receipt_candidate_without_task_or_l2_write() {
        let candidate_path = temp_store_path("candidates");
        let snapshot_path = temp_store_path("snapshots");
        let audit_path = temp_store_path("audit");
        let receipt = http_source::loopback_provider_fixture_receipt();
        let queue_preview = http_source::preview_provider_receipt_admission_queue(receipt);
        let saga = fake_saga(&queue_preview.candidates[0].candidate_id);

        let staged = stage_provider_receipt_review_candidate_at(
            &candidate_path,
            &snapshot_path,
            &audit_path,
            queue_preview,
            saga,
        )
        .unwrap();

        assert_eq!(staged.state, "provider-receipt-review-candidate-staged");
        assert_eq!(staged.candidate.review_state, "pending-human-review");
        assert!(!staged.task_artifact_write_started);
        assert!(!staged.durable_zhishu_write_started);
        assert_eq!(
            staged.snapshot.object_type,
            "provider-receipt-review-candidate"
        );
        assert_eq!(
            staged.audit_event.action,
            "stage-provider-receipt-review-candidate"
        );
        assert_eq!(
            read_provider_receipt_review_candidates(&candidate_path)
                .unwrap()
                .len(),
            1
        );

        let failed_audit_path = temp_store_path("candidate-queue-audit-failure");
        fs::create_dir(&failed_audit_path).unwrap();
        let failed = stage_provider_receipt_review_candidate_at(
            &candidate_path,
            &snapshot_path,
            &failed_audit_path,
            http_source::preview_provider_receipt_admission_queue(
                http_source::loopback_provider_fixture_receipt(),
            ),
            fake_saga("candidate-queue-audit-failure"),
        );
        assert!(failed.is_err());
        assert_eq!(read_provider_receipt_review_candidates(&candidate_path).unwrap().len(), 1);

        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(snapshot_path);
        let _ = fs::remove_file(audit_path);
        let _ = fs::remove_dir(failed_audit_path);
    }

    #[test]
    fn failed_provider_artifact_stage_marks_saga_failed_for_recovery() {
        let missing_candidate_id = format!("missing-provider-candidate-{}", now_millis());

        let error = create_provider_receipt_task_artifact(missing_candidate_id.clone())
            .unwrap_err()
            .to_string();
        assert!(error.contains("not found"));

        let saga = list_sagas(100)
            .unwrap()
            .into_iter()
            .find(|saga| {
                saga.kind == "provider-receipt-task-artifact"
                    && saga.target_id == missing_candidate_id
            })
            .expect("failed provider artifact stage must retain a recoverable saga record");
        assert_eq!(saga.state, "failed");
    }

    #[test]
    fn final_provider_saga_commit_failure_runs_compensation_before_returning_error() {
        let state_path = temp_store_path("final-saga-commit-compensation");
        let previous_state = vec!["reviewed-before-commit".to_string()];
        write_json_records(&state_path, &previous_state).unwrap();
        write_json_records(&state_path, &["provisional-write".to_string()]).unwrap();

        let error = commit_provider_saga_with_compensation(
            &fake_saga("final-saga-commit-compensation"),
            Err(StoreError::InvalidInput(
                "injected final saga commit failure".to_string(),
            )),
            || write_json_records(&state_path, &previous_state),
        )
        .unwrap_err()
        .to_string();

        assert!(error.contains("injected final saga commit failure"));
        assert_eq!(
            read_json_records::<String>(&state_path).unwrap(),
            previous_state
        );

        let _ = fs::remove_file(state_path);
    }

    #[test]
    fn reviews_provider_receipt_candidate_without_promotion() {
        let candidate_path = temp_store_path("review-candidates");
        let snapshot_path = temp_store_path("review-snapshots");
        let audit_path = temp_store_path("review-audit");
        let receipt = http_source::loopback_provider_fixture_receipt();
        let queue_preview = http_source::preview_provider_receipt_admission_queue(receipt);
        let saga = fake_saga(&queue_preview.candidates[0].candidate_id);
        let staged = stage_provider_receipt_review_candidate_at(
            &candidate_path,
            &snapshot_path,
            &audit_path,
            queue_preview,
            saga,
        )
        .unwrap();

        let reviewed = review_provider_receipt_review_candidate_at(
            &candidate_path,
            &snapshot_path,
            &audit_path,
            staged.candidate.id,
            "approved".to_string(),
        )
        .unwrap();

        assert_eq!(reviewed.state, "provider-receipt-review-decision-recorded");
        assert_eq!(
            reviewed.candidate.review_state,
            "approved-for-task-artifact-review"
        );
        assert!(!reviewed.task_artifact_write_started);
        assert!(!reviewed.durable_zhishu_write_started);
        assert!(reviewed
            .denied_actions
            .contains(&"auto-promote-provider-candidate-to-zhishu".to_string()));

        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(snapshot_path);
        let _ = fs::remove_file(audit_path);
    }

    #[test]
    fn task_artifact_preflight_requires_approved_provider_review_without_writing() {
        let candidate_path = temp_store_path("artifact-preflight-candidates");
        let snapshot_path = temp_store_path("artifact-preflight-snapshots");
        let audit_path = temp_store_path("artifact-preflight-audit");
        let receipt = http_source::loopback_provider_fixture_receipt();
        let queue_preview = http_source::preview_provider_receipt_admission_queue(receipt);
        let saga = fake_saga(&queue_preview.candidates[0].candidate_id);
        let staged = stage_provider_receipt_review_candidate_at(
            &candidate_path,
            &snapshot_path,
            &audit_path,
            queue_preview,
            saga,
        )
        .unwrap();
        let blocked = preflight_provider_receipt_task_artifact_at(
            &candidate_path,
            staged.candidate.id.clone(),
        )
        .unwrap();
        assert_eq!(blocked.state, "provider-task-artifact-preflight-blocked");
        assert!(blocked
            .blockers
            .contains(&"provider-receipt-candidate-not-approved".to_string()));

        let reviewed = review_provider_receipt_review_candidate_at(
            &candidate_path,
            &snapshot_path,
            &audit_path,
            staged.candidate.id,
            "approved".to_string(),
        )
        .unwrap();
        let ready =
            preflight_provider_receipt_task_artifact_at(&candidate_path, reviewed.candidate.id)
                .unwrap();

        assert_eq!(
            ready.state,
            "provider-task-artifact-preflight-ready-for-review"
        );
        assert!(!ready.task_artifact_write_started);
        assert!(!ready.durable_zhishu_write_started);
        assert!(ready
            .denied_actions
            .contains(&"write-task-artifact-from-provider-preflight".to_string()));

        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(snapshot_path);
        let _ = fs::remove_file(audit_path);
    }

    #[test]
    fn creates_isolated_task_artifact_after_provider_review_without_zhishu_write() {
        let candidate_path = temp_store_path("artifact-create-candidates");
        let artifact_path = temp_store_path("artifact-create-artifacts");
        let snapshot_path = temp_store_path("artifact-create-snapshots");
        let audit_path = temp_store_path("artifact-create-audit");
        let receipt = http_source::loopback_provider_fixture_receipt();
        let queue_preview = http_source::preview_provider_receipt_admission_queue(receipt);
        let saga = fake_saga(&queue_preview.candidates[0].candidate_id);
        let staged = stage_provider_receipt_review_candidate_at(
            &candidate_path,
            &snapshot_path,
            &audit_path,
            queue_preview,
            saga,
        )
        .unwrap();
        let blocked = create_provider_receipt_task_artifact_at(
            &candidate_path,
            &artifact_path,
            &snapshot_path,
            &audit_path,
            staged.candidate.id.clone(),
            fake_saga(&staged.candidate.id),
        );
        assert!(blocked.is_err());

        let reviewed = review_provider_receipt_review_candidate_at(
            &candidate_path,
            &snapshot_path,
            &audit_path,
            staged.candidate.id,
            "approved".to_string(),
        )
        .unwrap();
        let approved_candidate = reviewed.candidate.clone();
        let receipt = create_provider_receipt_task_artifact_at(
            &candidate_path,
            &artifact_path,
            &snapshot_path,
            &audit_path,
            reviewed.candidate.id.clone(),
            fake_saga(&reviewed.candidate.source_sha256),
        )
        .unwrap();

        assert_eq!(receipt.state, "provider-task-artifact-staged");
        assert_eq!(receipt.candidate.review_state, "task-artifact-staged");
        assert_eq!(receipt.artifact.artifact_type, "provider-receipt-evidence");
        assert_eq!(
            receipt.artifact.metadata["quarantine_state"],
            "task-artifact-review-required"
        );
        assert!(receipt.task_artifact_write_started);
        assert!(!receipt.durable_zhishu_write_started);
        assert_eq!(
            receipt.audit_event.action,
            "create-provider-receipt-task-artifact"
        );

        write_json_records(&candidate_path, std::slice::from_ref(&approved_candidate)).unwrap();
        write_json_records::<TaskArtifactRecord>(&artifact_path, &[]).unwrap();
        let failed_audit_path = temp_store_path("artifact-create-audit-failure");
        fs::create_dir(&failed_audit_path).unwrap();
        let failed = create_provider_receipt_task_artifact_at(
            &candidate_path,
            &artifact_path,
            &snapshot_path,
            &failed_audit_path,
            approved_candidate.id,
            fake_saga("artifact-audit-failure"),
        );
        assert!(failed.is_err());
        assert!(read_json_records::<TaskArtifactRecord>(&artifact_path).unwrap().is_empty());
        assert_eq!(
            read_provider_receipt_review_candidates(&candidate_path).unwrap()[0].review_state,
            "approved-for-task-artifact-review"
        );

        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(artifact_path);
        let _ = fs::remove_file(snapshot_path);
        let _ = fs::remove_file(audit_path);
        let _ = fs::remove_dir(failed_audit_path);
    }

    #[test]
    fn provider_artifact_zhishu_admission_preflight_blocks_l2_write() {
        let candidate_path = temp_store_path("zhishu-preflight-candidates");
        let artifact_path = temp_store_path("zhishu-preflight-artifacts");
        let snapshot_path = temp_store_path("zhishu-preflight-snapshots");
        let audit_path = temp_store_path("zhishu-preflight-audit");
        let receipt = http_source::loopback_provider_fixture_receipt();
        let queue_preview = http_source::preview_provider_receipt_admission_queue(receipt);
        let saga = fake_saga(&queue_preview.candidates[0].candidate_id);
        let staged = stage_provider_receipt_review_candidate_at(
            &candidate_path,
            &snapshot_path,
            &audit_path,
            queue_preview,
            saga,
        )
        .unwrap();
        let reviewed = review_provider_receipt_review_candidate_at(
            &candidate_path,
            &snapshot_path,
            &audit_path,
            staged.candidate.id,
            "approved".to_string(),
        )
        .unwrap();
        let receipt = create_provider_receipt_task_artifact_at(
            &candidate_path,
            &artifact_path,
            &snapshot_path,
            &audit_path,
            reviewed.candidate.id,
            fake_saga(&reviewed.candidate.source_sha256),
        )
        .unwrap();

        let preflight =
            preflight_provider_artifact_zhishu_admission_at(&artifact_path, receipt.artifact.id)
                .unwrap();

        assert_eq!(
            preflight.state,
            "provider-artifact-zhishu-admission-review-required"
        );
        assert!(!preflight.durable_zhishu_write_started);
        assert!(preflight
            .blockers
            .contains(&"zhishu-admission-not-approved".to_string()));
        assert!(preflight
            .denied_actions
            .contains(&"write-provider-artifact-to-l2-from-preflight".to_string()));

        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(artifact_path);
        let _ = fs::remove_file(snapshot_path);
        let _ = fs::remove_file(audit_path);
    }

    #[test]
    fn briefing_provider_artifact_preflight_accepts_admission_marker() {
        let artifact_path = temp_store_path("briefing-artifact-admission");
        let artifact = TaskArtifactRecord {
            id: "artifact-daily-briefing".to_string(),
            run_id: "run-daily-briefing".to_string(),
            task_direction_id: "direction-daily-briefing".to_string(),
            artifact_type: "daily-briefing".to_string(),
            reference_id: "daily-briefing-evidence-1".to_string(),
            title: "Daily briefing evidence".to_string(),
            summary: "Quarantined Daily Briefing evidence.".to_string(),
            metadata: json!({
                "provider_artifact_admission_required": true,
                "source": "daily-briefing-provider-evidence",
                "provider_id": "daily-briefing-evidence",
                "receipt_id": "provider-receipt-daily-briefing",
                "source_sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                "quarantine_state": "task-artifact-review-required",
                "zhishu_admission_state": "not-started",
                "durable_zhishu_write_started": false,
            }),
            created_at_ms: 1,
        };
        write_json_records(&artifact_path, std::slice::from_ref(&artifact)).unwrap();

        let preflight =
            preflight_provider_artifact_zhishu_admission_at(&artifact_path, artifact.id).unwrap();

        assert_eq!(
            preflight.state,
            "provider-artifact-zhishu-admission-review-required"
        );
        assert_eq!(preflight.artifact_type, "daily-briefing");
        assert_eq!(
            preflight.source_sha256,
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        );
        assert!(preflight
            .gates
            .contains(&"provider-artifact-admission-marker-required".to_string()));
        assert!(!preflight.durable_zhishu_write_started);

        let _ = fs::remove_file(artifact_path);
    }

    #[test]
    fn provider_artifact_review_does_not_write_zhishu_candidate() {
        let candidate_path = temp_store_path("artifact-review-candidates");
        let artifact_path = temp_store_path("artifact-review-artifacts");
        let review_path = temp_store_path("artifact-review-reviews");
        let memory_path = temp_store_path("artifact-review-memory");
        let snapshot_path = temp_store_path("artifact-review-snapshots");
        let audit_path = temp_store_path("artifact-review-audit");
        let receipt = http_source::loopback_provider_fixture_receipt();
        let queue_preview = http_source::preview_provider_receipt_admission_queue(receipt);
        let saga = fake_saga(&queue_preview.candidates[0].candidate_id);
        let staged = stage_provider_receipt_review_candidate_at(
            &candidate_path,
            &snapshot_path,
            &audit_path,
            queue_preview,
            saga,
        )
        .unwrap();
        let reviewed = review_provider_receipt_review_candidate_at(
            &candidate_path,
            &snapshot_path,
            &audit_path,
            staged.candidate.id,
            "approved".to_string(),
        )
        .unwrap();
        let artifact_receipt = create_provider_receipt_task_artifact_at(
            &candidate_path,
            &artifact_path,
            &snapshot_path,
            &audit_path,
            reviewed.candidate.id,
            fake_saga(&reviewed.candidate.source_sha256),
        )
        .unwrap();

        let admission_review = review_provider_artifact_zhishu_admission_at(
            &artifact_path,
            &review_path,
            &snapshot_path,
            &audit_path,
            artifact_receipt.artifact.id.clone(),
            "approved".to_string(),
        )
        .unwrap();

        assert_eq!(
            admission_review.state,
            "provider-artifact-zhishu-admission-reviewed"
        );
        assert_eq!(
            admission_review.review.review_state,
            "approved-for-zhishu-candidate"
        );
        assert!(!admission_review.durable_zhishu_candidate_write_started);
        assert!(!admission_review.confirmed_knowledge_write_started);
        assert_eq!(
            read_provider_artifact_admission_reviews(&review_path)
                .unwrap()
                .len(),
            1
        );
        assert!(read_json_records::<MemoryItem>(&memory_path)
            .unwrap()
            .is_empty());

        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(artifact_path);
        let _ = fs::remove_file(review_path);
        let _ = fs::remove_file(memory_path);
        let _ = fs::remove_file(snapshot_path);
        let _ = fs::remove_file(audit_path);
    }

    #[test]
    fn approved_provider_artifact_review_creates_only_zhishu_candidate() {
        let candidate_path = temp_store_path("candidate-create-candidates");
        let artifact_path = temp_store_path("candidate-create-artifacts");
        let review_path = temp_store_path("candidate-create-reviews");
        let memory_path = temp_store_path("candidate-create-memory");
        let snapshot_path = temp_store_path("candidate-create-snapshots");
        let audit_path = temp_store_path("candidate-create-audit");
        let receipt = http_source::loopback_provider_fixture_receipt();
        let queue_preview = http_source::preview_provider_receipt_admission_queue(receipt);
        let saga = fake_saga(&queue_preview.candidates[0].candidate_id);
        let staged = stage_provider_receipt_review_candidate_at(
            &candidate_path,
            &snapshot_path,
            &audit_path,
            queue_preview,
            saga,
        )
        .unwrap();
        let reviewed = review_provider_receipt_review_candidate_at(
            &candidate_path,
            &snapshot_path,
            &audit_path,
            staged.candidate.id,
            "approved".to_string(),
        )
        .unwrap();
        let artifact_receipt = create_provider_receipt_task_artifact_at(
            &candidate_path,
            &artifact_path,
            &snapshot_path,
            &audit_path,
            reviewed.candidate.id,
            fake_saga(&reviewed.candidate.source_sha256),
        )
        .unwrap();
        let blocked = create_provider_artifact_zhishu_candidate_at(
            &artifact_path,
            &review_path,
            &memory_path,
            &snapshot_path,
            &audit_path,
            artifact_receipt.artifact.id.clone(),
            fake_saga(&artifact_receipt.artifact.id),
        );
        assert!(blocked.is_err());
        review_provider_artifact_zhishu_admission_at(
            &artifact_path,
            &review_path,
            &snapshot_path,
            &audit_path,
            artifact_receipt.artifact.id.clone(),
            "approved".to_string(),
        )
        .unwrap();

        let candidate_receipt = create_provider_artifact_zhishu_candidate_at(
            &artifact_path,
            &review_path,
            &memory_path,
            &snapshot_path,
            &audit_path,
            artifact_receipt.artifact.id.clone(),
            fake_saga(&artifact_receipt.candidate.id),
        )
        .unwrap();

        assert_eq!(
            candidate_receipt.state,
            "provider-artifact-zhishu-candidate-created"
        );
        assert!(candidate_receipt.durable_zhishu_candidate_write_started);
        assert!(!candidate_receipt.confirmed_knowledge_write_started);
        assert_eq!(candidate_receipt.memory_item.scope, "L2 Knowledge");
        assert_eq!(candidate_receipt.memory_item.level, "candidate");
        assert_eq!(candidate_receipt.memory_item.admission_state, "candidate");
        assert_eq!(
            candidate_receipt.memory_item.source,
            "provider-artifact-review"
        );
        assert_eq!(
            candidate_receipt.audit_event.action,
            "create-provider-artifact-zhishu-candidate"
        );
        let memory_items = read_json_records::<MemoryItem>(&memory_path).unwrap();
        assert_eq!(memory_items.len(), 1);
        assert_eq!(memory_items[0].level, "candidate");

        let failed_audit_path = temp_store_path("candidate-create-audit-failure");
        fs::create_dir(&failed_audit_path).unwrap();
        let failed = create_provider_artifact_zhishu_candidate_at(
            &artifact_path,
            &review_path,
            &memory_path,
            &snapshot_path,
            &failed_audit_path,
            artifact_receipt.artifact.id,
            fake_saga("candidate-audit-failure"),
        );
        assert!(failed.is_err());
        assert_eq!(read_json_records::<MemoryItem>(&memory_path).unwrap().len(), 1);

        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(artifact_path);
        let _ = fs::remove_file(review_path);
        let _ = fs::remove_file(memory_path);
        let _ = fs::remove_file(snapshot_path);
        let _ = fs::remove_file(audit_path);
        let _ = fs::remove_dir(failed_audit_path);
    }

    #[test]
    fn provider_artifact_zhishu_candidate_final_review_accepts_candidate_only() {
        let candidate_path = temp_store_path("final-review-candidates");
        let artifact_path = temp_store_path("final-review-artifacts");
        let review_path = temp_store_path("final-review-reviews");
        let memory_path = temp_store_path("final-review-memory");
        let snapshot_path = temp_store_path("final-review-snapshots");
        let audit_path = temp_store_path("final-review-audit");
        let receipt = http_source::loopback_provider_fixture_receipt();
        let queue_preview = http_source::preview_provider_receipt_admission_queue(receipt);
        let saga = fake_saga(&queue_preview.candidates[0].candidate_id);
        let staged = stage_provider_receipt_review_candidate_at(
            &candidate_path,
            &snapshot_path,
            &audit_path,
            queue_preview,
            saga,
        )
        .unwrap();
        let reviewed = review_provider_receipt_review_candidate_at(
            &candidate_path,
            &snapshot_path,
            &audit_path,
            staged.candidate.id,
            "approved".to_string(),
        )
        .unwrap();
        let artifact_receipt = create_provider_receipt_task_artifact_at(
            &candidate_path,
            &artifact_path,
            &snapshot_path,
            &audit_path,
            reviewed.candidate.id,
            fake_saga(&reviewed.candidate.source_sha256),
        )
        .unwrap();
        review_provider_artifact_zhishu_admission_at(
            &artifact_path,
            &review_path,
            &snapshot_path,
            &audit_path,
            artifact_receipt.artifact.id.clone(),
            "approved".to_string(),
        )
        .unwrap();
        let candidate_receipt = create_provider_artifact_zhishu_candidate_at(
            &artifact_path,
            &review_path,
            &memory_path,
            &snapshot_path,
            &audit_path,
            artifact_receipt.artifact.id,
            fake_saga(&artifact_receipt.candidate.id),
        )
        .unwrap();

        let final_review = review_provider_artifact_zhishu_candidate_at(
            &memory_path,
            &snapshot_path,
            &audit_path,
            candidate_receipt.memory_item.id,
            "accepted".to_string(),
        )
        .unwrap();

        assert_eq!(
            final_review.state,
            "provider-artifact-zhishu-candidate-accepted"
        );
        assert_eq!(final_review.memory_item.admission_state, "accepted");
        assert_eq!(final_review.memory_item.level, "reviewed");
        assert_eq!(final_review.memory_item.source, "provider-artifact-review");
        assert!(!final_review.confirmed_knowledge_write_started);
        assert!(final_review
            .gates
            .contains(&"final-zhishu-candidate-review-complete".to_string()));
        let memory_items = read_json_records::<MemoryItem>(&memory_path).unwrap();
        assert_eq!(memory_items[0].admission_state, "accepted");

        let _ = fs::remove_file(candidate_path);
        let _ = fs::remove_file(artifact_path);
        let _ = fs::remove_file(review_path);
        let _ = fs::remove_file(memory_path);
        let _ = fs::remove_file(snapshot_path);
        let _ = fs::remove_file(audit_path);
    }

    #[test]
    fn provider_artifact_zhishu_candidate_final_review_rejects_non_provider_memory() {
        let memory_path = temp_store_path("final-review-non-provider-memory");
        let snapshot_path = temp_store_path("final-review-non-provider-snapshots");
        let audit_path = temp_store_path("final-review-non-provider-audit");
        let memory = MemoryItem {
            id: "memory-manual-candidate".to_string(),
            created_at_ms: now_millis(),
            hub_area: "knowledge".to_string(),
            scope: "L2 Knowledge".to_string(),
            level: "candidate".to_string(),
            item_type: "knowledge".to_string(),
            admission_state: "candidate".to_string(),
            admission_rule: "knowledge-review-required".to_string(),
            source: "manual-zhishu".to_string(),
            provenance: "local-user-input".to_string(),
            source_trust: "unverified-local".to_string(),
            content: "Manual candidate".to_string(),
            tags: vec!["manual".to_string()],
            confidence: 0.6,
            verification: "unverified".to_string(),
            retention_policy: "durable-review".to_string(),
            authority: "user-reviewable".to_string(),
            linked_memory_ids: Vec::new(),
            last_reinforced_at_ms: None,
            last_invalidated_at_ms: None,
        };
        write_json_records(&memory_path, std::slice::from_ref(&memory)).unwrap();

        let error = review_provider_artifact_zhishu_candidate_at(
            &memory_path,
            &snapshot_path,
            &audit_path,
            memory.id,
            "accepted".to_string(),
        )
        .unwrap_err();

        assert!(error
            .to_string()
            .contains("not a provider artifact Zhishu candidate"));

        let _ = fs::remove_file(memory_path);
        let _ = fs::remove_file(snapshot_path);
        let _ = fs::remove_file(audit_path);
    }
}
