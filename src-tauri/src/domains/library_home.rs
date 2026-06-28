use serde::Serialize;

use crate::store::{
    self, AuditEvent, MemoryItem, SagaTransaction, SnapshotRecord, StoreError, TaskArtifactRecord,
};

const MEMORY_LIMIT: usize = 12;
const ARTIFACT_LIMIT: usize = 12;
const SNAPSHOT_LIMIT: usize = 12;
const AUDIT_LIMIT: usize = 20;
const SAGA_LIMIT: usize = 12;

#[derive(Debug, Clone, Serialize)]
pub struct LibraryMetric {
    pub label: String,
    pub value: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct LibraryHomePreview {
    pub generated_at_ms: u128,
    pub state: String,
    pub recent_memory_count: usize,
    pub pending_review_count: usize,
    pub recent_task_artifact_count: usize,
    pub recent_backup_snapshot_count: usize,
    pub recent_audit_event_count: usize,
    pub recycle_candidate_count: usize,
    pub active_saga_count: usize,
    pub recycle_state: String,
    pub backup_library_policy: String,
    pub restore_policy: String,
    pub recycle_policy: String,
    pub memory_by_level: Vec<LibraryMetric>,
    pub memory_by_area: Vec<LibraryMetric>,
    pub recent_memory: Vec<MemoryItem>,
    pub recent_task_artifacts: Vec<TaskArtifactRecord>,
    pub recent_snapshots: Vec<SnapshotRecord>,
    pub recycle_candidates: Vec<SnapshotRecord>,
    pub recent_audit_events: Vec<AuditEvent>,
    pub recent_sagas: Vec<SagaTransaction>,
    pub gates: Vec<String>,
}

pub fn preview() -> Result<LibraryHomePreview, StoreError> {
    let recent_memory = store::recent_memory_items(MEMORY_LIMIT)?;
    let recent_task_artifacts = store::list_task_artifacts(None, ARTIFACT_LIMIT)?;
    let recent_snapshots = store::list_snapshots(None, None, SNAPSHOT_LIMIT)?;
    let recent_audit_events = store::list_audit_events(None, None, AUDIT_LIMIT)?;
    let recent_sagas = store::list_sagas(SAGA_LIMIT)?;
    let pending_review_count = count_pending_review(&recent_memory);
    let recycle_candidates = recycle_candidates_from_snapshots(&recent_snapshots);
    let active_saga_count = count_active_sagas(&recent_sagas);

    Ok(LibraryHomePreview {
        generated_at_ms: store::now_millis(),
        state: "read-only-preview".to_string(),
        recent_memory_count: recent_memory.len(),
        pending_review_count,
        recent_task_artifact_count: recent_task_artifacts.len(),
        recent_backup_snapshot_count: recent_snapshots.len(),
        recent_audit_event_count: recent_audit_events.len(),
        recycle_candidate_count: recycle_candidates.len(),
        active_saga_count,
        recycle_state: if recycle_candidates.is_empty() {
            "empty-metadata-preview".to_string()
        } else {
            "restore-review-required".to_string()
        },
        backup_library_policy:
            "read-only backup index; restore, cleanup, or permanent delete requires permission review"
                .to_string(),
        restore_policy:
            "restore to temporary recovery area first; original-location restore requires explicit confirmation"
                .to_string(),
        recycle_policy:
            "recycle recovery and permanent deletion require permission check and audit record"
                .to_string(),
        memory_by_level: summarize_memory_by(&recent_memory, |item| &item.level),
        memory_by_area: summarize_memory_by(&recent_memory, |item| &item.hub_area),
        recent_memory,
        recent_task_artifacts,
        recent_snapshots,
        recycle_candidates,
        recent_audit_events,
        recent_sagas,
        gates: vec![
            "read-only-library-projection".to_string(),
            "no-delete-without-recycle-review".to_string(),
            "no-restore-without-protected-snapshot".to_string(),
            "restore-to-temporary-recovery-area-first".to_string(),
            "no-backup-cleanup-without-review".to_string(),
            "no-permanent-delete-without-audit".to_string(),
            "no-automatic-l2-write".to_string(),
            "audit-before-cross-domain-change".to_string(),
        ],
    })
}

fn count_pending_review(items: &[MemoryItem]) -> usize {
    items
        .iter()
        .filter(|item| {
            item.admission_state.eq_ignore_ascii_case("pending-review")
                || item.verification.eq_ignore_ascii_case("unverified")
        })
        .count()
}

fn summarize_memory_by<F>(items: &[MemoryItem], key: F) -> Vec<LibraryMetric>
where
    F: Fn(&MemoryItem) -> &str,
{
    let mut metrics = Vec::<LibraryMetric>::new();
    for item in items {
        let label = key(item).trim();
        let label = if label.is_empty() { "unknown" } else { label };
        if let Some(metric) = metrics.iter_mut().find(|metric| metric.label == label) {
            metric.value += 1;
        } else {
            metrics.push(LibraryMetric {
                label: label.to_string(),
                value: 1,
            });
        }
    }
    metrics.sort_by(|left, right| {
        right
            .value
            .cmp(&left.value)
            .then(left.label.cmp(&right.label))
    });
    metrics
}

fn recycle_candidates_from_snapshots(snapshots: &[SnapshotRecord]) -> Vec<SnapshotRecord> {
    snapshots
        .iter()
        .filter(|snapshot| {
            let reason = snapshot.reason.to_ascii_lowercase();
            reason.contains("remove") || reason.contains("removed") || reason.contains("delete")
        })
        .cloned()
        .collect()
}

fn count_active_sagas(sagas: &[SagaTransaction]) -> usize {
    sagas
        .iter()
        .filter(|saga| matches!(saga.state.as_str(), "pending" | "compensating" | "failed"))
        .count()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn memory_item(
        id: &str,
        level: &str,
        area: &str,
        state: &str,
        verification: &str,
    ) -> MemoryItem {
        MemoryItem {
            id: id.to_string(),
            created_at_ms: 1,
            hub_area: area.to_string(),
            scope: "local".to_string(),
            level: level.to_string(),
            item_type: "knowledge".to_string(),
            admission_state: state.to_string(),
            admission_rule: "manual".to_string(),
            source: "test".to_string(),
            provenance: "test".to_string(),
            source_trust: "trusted".to_string(),
            content: "content".to_string(),
            tags: Vec::new(),
            confidence: 0.8,
            verification: verification.to_string(),
            retention_policy: "keep".to_string(),
            authority: "user".to_string(),
            linked_memory_ids: Vec::new(),
            last_reinforced_at_ms: None,
            last_invalidated_at_ms: None,
        }
    }

    #[test]
    fn counts_pending_review_and_summarizes_memory_layers() {
        let items = vec![
            memory_item("a", "L2 Knowledge", "knowledge", "accepted", "verified"),
            memory_item("b", "L1 Working", "memory", "pending-review", "unverified"),
            memory_item("c", "L1 Working", "memory", "accepted", "unverified"),
        ];

        assert_eq!(count_pending_review(&items), 2);
        let by_level = summarize_memory_by(&items, |item| &item.level);
        assert_eq!(by_level[0].label, "L1 Working");
        assert_eq!(by_level[0].value, 2);
    }

    #[test]
    fn derives_recycle_candidates_from_removal_snapshots() {
        let snapshots = vec![
            SnapshotRecord {
                id: "snapshot-1".to_string(),
                object_type: "arsenal-custom-tool".to_string(),
                object_id: "tool-1".to_string(),
                version: 1,
                reason: "before-remove".to_string(),
                created_at_ms: 1,
                payload: serde_json::json!({}),
            },
            SnapshotRecord {
                id: "snapshot-2".to_string(),
                object_type: "zhishu-item".to_string(),
                object_id: "memory-1".to_string(),
                version: 1,
                reason: "before-review".to_string(),
                created_at_ms: 2,
                payload: serde_json::json!({}),
            },
        ];

        let candidates = recycle_candidates_from_snapshots(&snapshots);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].object_id, "tool-1");
    }

    #[test]
    fn counts_active_saga_states_for_recovery_visibility() {
        let sagas = vec![
            SagaTransaction {
                id: "saga-1".to_string(),
                kind: "review".to_string(),
                target_id: "memory-1".to_string(),
                state: "pending".to_string(),
                metadata: serde_json::json!({}),
                created_at_ms: 1,
                updated_at_ms: 1,
            },
            SagaTransaction {
                id: "saga-2".to_string(),
                kind: "review".to_string(),
                target_id: "memory-2".to_string(),
                state: "committed".to_string(),
                metadata: serde_json::json!({}),
                created_at_ms: 2,
                updated_at_ms: 2,
            },
            SagaTransaction {
                id: "saga-3".to_string(),
                kind: "rollback".to_string(),
                target_id: "memory-3".to_string(),
                state: "failed".to_string(),
                metadata: serde_json::json!({}),
                created_at_ms: 3,
                updated_at_ms: 3,
            },
        ];

        assert_eq!(count_active_sagas(&sagas), 2);
    }
}
