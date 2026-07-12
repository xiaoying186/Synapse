use crate::store;

#[derive(Debug, Clone, serde::Serialize)]
pub struct ArtifactPromotionReceipt {
    pub artifact: store::TaskArtifactRecord,
    pub memory_item: store::MemoryItem,
    pub audit_event: store::AuditEvent,
    pub gates: Vec<String>,
}

pub fn save_direction(
    title: String,
    description: String,
    priority: u8,
    keywords: Vec<String>,
    schedule_frequency: String,
    online_enabled: bool,
    push_enabled: bool,
    push_channels: Vec<String>,
    output_template: String,
) -> Result<store::TaskDirection, String> {
    let title = title.trim().to_string();
    let description = description.trim().to_string();

    if title.is_empty() {
        return Err("Task direction title cannot be empty.".to_string());
    }

    if push_enabled
        && push_channels
            .iter()
            .all(|channel| channel.trim().is_empty())
    {
        return Err(
            "Task direction push channel cannot be empty when push is enabled.".to_string(),
        );
    }

    if push_enabled
        && push_channels
            .iter()
            .filter(|channel| !channel.trim().is_empty())
            .any(|channel| !is_supported_push_channel(channel))
    {
        return Err("Task direction push channel is not supported.".to_string());
    }

    store::append_task_direction(
        title,
        description,
        priority,
        keywords,
        schedule_frequency,
        online_enabled,
        push_enabled,
        push_channels,
        output_template,
    )
    .map_err(|error| format!("Task direction could not be saved: {error}"))
}

pub fn directions() -> Result<Vec<store::TaskDirection>, String> {
    store::task_directions(8).map_err(|error| format!("Task directions are unavailable: {error}"))
}

pub fn set_direction_active(
    direction_id: String,
    active: bool,
) -> Result<store::TaskDirection, String> {
    let direction_id = direction_id.trim().to_string();
    if direction_id.is_empty() {
        return Err("Task direction id cannot be empty.".to_string());
    }
    let before = store::task_directions(50)
        .map_err(|error| format!("Task directions are unavailable: {error}"))?
        .into_iter()
        .find(|direction| direction.id == direction_id)
        .ok_or_else(|| format!("Task direction was not found: {direction_id}"))?;
    let saga = begin_service_saga(
        "set-task-direction-active",
        &direction_id,
        serde_json::json!({ "active": active }),
    )?;
    let snapshot = store::create_snapshot(
        "task-direction".to_string(),
        direction_id.clone(),
        "before-active-state-change".to_string(),
        serde_json::to_value(&before).map_err(|error| error.to_string())?,
    )
    .map_err(|error| {
        mark_service_saga_failed(&saga.id);
        format!("Task direction snapshot could not be created: {error}")
    })?;
    let direction =
        store::set_task_direction_active(direction_id.clone(), active).map_err(|error| {
            mark_service_saga_failed(&saga.id);
            format!("Task direction active state could not be updated: {error}")
        })?;
    finalize_direction_state_change(
        || {
            super::audit_event::record_change(
                "set-task-direction-active",
                "task-direction",
                &direction_id,
                "high",
                if active { "active" } else { "inactive" },
                serde_json::json!({
                    "active": active,
                    "snapshot_id": snapshot.id,
                    "saga_id": saga.id,
                }),
                serde_json::json!({
                    "active": direction.active,
                    "updated_at_ms": direction.updated_at_ms,
                    "saga_id": saga.id,
                }),
            )
            .map(|_| ())
        },
        || store::transition_saga(saga.id.clone(), "committed".to_string()).map(|_| ()),
        |error| compensate_direction_state_change(&saga.id, before.clone(), error),
    )?;
    Ok(direction)
}

fn finalize_direction_state_change<FAudit, FCommit, FCompensate>(
    audit: FAudit,
    commit: FCommit,
    compensate: FCompensate,
) -> Result<(), String>
where
    FAudit: FnOnce() -> Result<(), String>,
    FCommit: FnOnce() -> Result<(), store::StoreError>,
    FCompensate: FnOnce(String) -> Result<(), String>,
{
    if let Err(error) = audit() {
        return compensate(error);
    }
    if let Err(error) = commit() {
        return compensate(format!("Task direction saga could not be committed: {error}"));
    }
    Ok(())
}

fn begin_service_saga(
    kind: &str,
    target_id: &str,
    metadata: serde_json::Value,
) -> Result<store::SagaTransaction, String> {
    store::begin_saga(kind.to_string(), target_id.to_string(), metadata)
        .map_err(|error| format!("Saga could not be started: {error}"))
}

fn mark_service_saga_failed(saga_id: &str) {
    let _ = store::transition_saga(saga_id.to_string(), "failed".to_string());
}

fn compensate_direction_state_change<T>(
    saga_id: &str,
    before: store::TaskDirection,
    error: String,
) -> Result<T, String> {
    let _ = store::transition_saga(saga_id.to_string(), "compensating".to_string());
    match store::restore_task_direction(before) {
        Ok(_) => {
            let _ = store::transition_saga(saga_id.to_string(), "compensated".to_string());
            Err(error)
        }
        Err(compensation_error) => {
            mark_service_saga_failed(saga_id);
            Err(format!(
                "{error}; task direction compensation failed: {compensation_error}"
            ))
        }
    }
}

pub fn schedule_previews() -> Result<Vec<store::TaskSchedulePreview>, String> {
    store::task_schedule_previews(8)
        .map_err(|error| format!("Task schedule previews are unavailable: {error}"))
}

pub fn generate_candidates() -> Result<Vec<store::TaskCandidate>, String> {
    store::generate_task_candidates()
        .map_err(|error| format!("Task candidates could not be generated: {error}"))
}

pub fn candidates() -> Result<Vec<store::TaskCandidate>, String> {
    store::task_candidates(8).map_err(|error| format!("Task candidates are unavailable: {error}"))
}

pub fn request_run(direction_id: String) -> Result<store::TaskRunRecord, String> {
    store::request_task_run(direction_id)
        .map_err(|error| format!("Task run request could not be recorded: {error}"))
}

pub fn run_records() -> Result<Vec<store::TaskRunRecord>, String> {
    store::task_run_records(8).map_err(|error| format!("Task run records are unavailable: {error}"))
}

pub fn artifacts(
    run_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<store::TaskArtifactRecord>, String> {
    store::list_task_artifacts(run_id, limit.unwrap_or(50))
        .map_err(|error| format!("Task artifacts are unavailable: {error}"))
}

pub fn promote_artifact_to_zhishu(
    artifact_id: String,
    item_kind: String,
) -> Result<ArtifactPromotionReceipt, String> {
    let artifact_id = artifact_id.trim().to_string();
    if artifact_id.is_empty() {
        return Err("Task artifact id cannot be empty.".to_string());
    }
    let item_kind = item_kind.trim().to_string();
    let artifacts = store::list_task_artifacts(None, 200)
        .map_err(|error| format!("Task artifacts are unavailable: {error}"))?;
    let artifact = artifacts
        .into_iter()
        .find(|artifact| artifact.id == artifact_id)
        .ok_or_else(|| format!("Task artifact was not found: {artifact_id}"))?;
    if requires_provider_artifact_admission_flow(&artifact) {
        return Err(
            "Provider-governed evidence requires provider artifact Zhishu admission preflight before promotion."
                .to_string(),
        );
    }
    let memory_items = store::recent_memory_items(200)
        .map_err(|error| format!("Zhishu items are unavailable: {error}"))?;
    if memory_items
        .iter()
        .any(|item| has_artifact_promotion_tag(&item.tags, &artifact.id))
    {
        return Err("Task artifact has already been promoted to Zhishu.".to_string());
    }
    let content = artifact_candidate_content(&artifact);
    let tags = artifact_candidate_tags(&artifact);
    let memory_item = store::append_zhishu_item(content, tags, item_kind)
        .map_err(|error| format!("Task artifact could not be promoted to Zhishu: {error}"))?;
    let audit_event = super::audit_event::record_change(
        "promote-task-artifact",
        "task-artifact",
        &artifact.id,
        "durable-zhishu-write",
        "zhishu-candidate-created",
        serde_json::json!({
            "artifact_id": artifact.id,
            "artifact_type": artifact.artifact_type,
            "reference_id": artifact.reference_id,
            "item_kind": memory_item.item_type,
        }),
        serde_json::json!({
            "memory_id": memory_item.id,
            "admission_state": memory_item.admission_state,
            "admission_rule": memory_item.admission_rule,
        }),
    )?;

    Ok(ArtifactPromotionReceipt {
        artifact,
        memory_item,
        audit_event,
        gates: vec![
            "manual-artifact-selection".to_string(),
            "l2-candidate-only".to_string(),
            "review-before-accepted-knowledge".to_string(),
            "durable-audit-event".to_string(),
        ],
    })
}

pub fn review_run(run_id: String, approved: bool) -> Result<store::TaskRunRecord, String> {
    let run = store::review_task_run(run_id.clone(), approved)
        .map_err(|error| format!("Task run review could not be saved: {error}"))?;
    super::audit_event::record_change(
        "review-task-run",
        "task-run",
        &run_id,
        "medium",
        &run.approval_state,
        serde_json::json!({ "approved": approved }),
        serde_json::json!({
            "approval_state": run.approval_state,
            "execution_state": run.execution_state,
        }),
    )?;
    Ok(run)
}

pub fn cancel_run(run_id: String) -> Result<store::TaskRunRecord, String> {
    let run_id = run_id.trim().to_string();
    if run_id.is_empty() {
        return Err("Task run id cannot be empty.".to_string());
    }
    let run = store::cancel_task_run(run_id.clone())
        .map_err(|error| format!("Task run could not be cancelled: {error}"))?;
    super::audit_event::record_change(
        "cancel-task-run",
        "task-run",
        &run_id,
        "medium",
        &run.lifecycle_state,
        serde_json::json!({ "requested": "cancel" }),
        serde_json::json!({
            "lifecycle_state": run.lifecycle_state,
            "cancelled_at_ms": run.cancelled_at_ms,
        }),
    )?;
    Ok(run)
}

pub fn archive_run(run_id: String) -> Result<store::TaskRunRecord, String> {
    let run_id = run_id.trim().to_string();
    if run_id.is_empty() {
        return Err("Task run id cannot be empty.".to_string());
    }
    let run = store::archive_task_run(run_id.clone())
        .map_err(|error| format!("Task run could not be archived: {error}"))?;
    super::audit_event::record_change(
        "archive-task-run",
        "task-run",
        &run_id,
        "low",
        &run.lifecycle_state,
        serde_json::json!({ "requested": "archive" }),
        serde_json::json!({
            "lifecycle_state": run.lifecycle_state,
            "archived_at_ms": run.archived_at_ms,
        }),
    )?;
    Ok(run)
}

pub fn scheduler_tick() -> Result<store::TaskSchedulerTick, String> {
    store::task_scheduler_tick()
        .map_err(|error| format!("Task scheduler tick could not be recorded: {error}"))
}

pub fn execute_run(run_id: String) -> Result<store::TaskRunExecutionReceipt, String> {
    store::execute_task_run(run_id)
        .map_err(|error| format!("Task run could not be executed locally: {error}"))
}

pub fn review_candidate(
    candidate_id: String,
    decision: String,
) -> Result<store::TaskCandidateReview, String> {
    let decision = decision.trim().to_ascii_lowercase();
    let review = store::review_task_candidate(candidate_id.clone(), decision.clone())
        .map_err(|error| format!("Task candidate review failed: {error}"))?;
    super::audit_event::record_change(
        "review-task-candidate",
        "task-candidate",
        &candidate_id,
        "durable-zhishu-write",
        &review.candidate.status,
        serde_json::json!({ "decision": decision }),
        serde_json::json!({
            "status": review.candidate.status,
            "promoted_memory_id": review.candidate.promoted_memory_id,
            "follow_up_run_id": review.follow_up_run.as_ref().map(|run| &run.id),
        }),
    )?;
    Ok(review)
}

fn is_supported_push_channel(channel: &str) -> bool {
    matches!(
        channel.trim().to_ascii_lowercase().as_str(),
        "email" | "feishu" | "wechat"
    )
}

fn artifact_candidate_content(artifact: &store::TaskArtifactRecord) -> String {
    let summary = if artifact.summary.trim().is_empty() {
        "No summary captured.".to_string()
    } else {
        artifact.summary.trim().to_string()
    };
    format!(
        "Task artifact candidate: {}\nType: {}\nReference: {}\nRun: {}\nDirection: {}\n\n{}",
        artifact.title.trim(),
        artifact.artifact_type,
        artifact.reference_id,
        artifact.run_id,
        artifact.task_direction_id,
        summary
    )
}

fn artifact_candidate_tags(artifact: &store::TaskArtifactRecord) -> Vec<String> {
    vec![
        "task-artifact".to_string(),
        format!("artifact:{}", artifact.id),
        artifact.artifact_type.clone(),
        format!("run:{}", artifact.run_id),
        format!("direction:{}", artifact.task_direction_id),
    ]
}

fn has_artifact_promotion_tag(tags: &[String], artifact_id: &str) -> bool {
    tags.iter()
        .any(|tag| tag == &format!("artifact:{artifact_id}"))
}

fn requires_provider_artifact_admission_flow(artifact: &store::TaskArtifactRecord) -> bool {
    artifact.artifact_type == "provider-receipt-evidence"
        || artifact
            .metadata
            .get("provider_artifact_admission_required")
            .and_then(|value| value.as_bool())
            .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_direction_title_before_store_write() {
        let error = save_direction(
            "   ".to_string(),
            "description".to_string(),
            3,
            Vec::new(),
            "manual".to_string(),
            false,
            false,
            Vec::new(),
            "auto".to_string(),
        )
        .unwrap_err();

        assert_eq!(error, "Task direction title cannot be empty.");
    }

    #[test]
    fn artifact_candidate_content_preserves_lineage() {
        let artifact = store::TaskArtifactRecord {
            id: "artifact-1".to_string(),
            run_id: "run-1".to_string(),
            task_direction_id: "direction-1".to_string(),
            artifact_type: "daily-briefing".to_string(),
            reference_id: "brief-1".to_string(),
            title: "Morning brief".to_string(),
            summary: "Useful summary".to_string(),
            metadata: serde_json::json!({}),
            created_at_ms: 1,
        };

        let content = artifact_candidate_content(&artifact);
        let tags = artifact_candidate_tags(&artifact);

        assert!(content.contains("Morning brief"));
        assert!(content.contains("Run: run-1"));
        assert!(tags.contains(&"task-artifact".to_string()));
        assert!(tags.contains(&"artifact:artifact-1".to_string()));
        assert!(tags.contains(&"run:run-1".to_string()));
    }

    #[test]
    fn artifact_promotion_tag_only_matches_its_source_artifact() {
        let tags = vec![
            "task-artifact".to_string(),
            "artifact:artifact-1".to_string(),
        ];

        assert!(has_artifact_promotion_tag(&tags, "artifact-1"));
        assert!(!has_artifact_promotion_tag(&tags, "artifact-2"));
    }

    #[test]
    fn provider_receipt_artifact_uses_dedicated_admission_flow() {
        let provider_artifact = store::TaskArtifactRecord {
            id: "artifact-provider".to_string(),
            run_id: "run-provider".to_string(),
            task_direction_id: "baigong-provider-receipt".to_string(),
            artifact_type: "provider-receipt-evidence".to_string(),
            reference_id: "provider-candidate-1".to_string(),
            title: "Provider evidence".to_string(),
            summary: "Quarantined provider evidence".to_string(),
            metadata: serde_json::json!({}),
            created_at_ms: 1,
        };
        let regular_artifact = store::TaskArtifactRecord {
            artifact_type: "daily-briefing".to_string(),
            ..provider_artifact.clone()
        };
        let briefing_provider_artifact = store::TaskArtifactRecord {
            artifact_type: "daily-briefing".to_string(),
            metadata: serde_json::json!({
                "provider_artifact_admission_required": true,
                "source": "daily-briefing-provider-evidence",
            }),
            ..provider_artifact.clone()
        };

        assert!(requires_provider_artifact_admission_flow(
            &provider_artifact
        ));
        assert!(requires_provider_artifact_admission_flow(
            &briefing_provider_artifact
        ));
        assert!(!requires_provider_artifact_admission_flow(
            &regular_artifact
        ));
    }

    #[test]
    fn empty_direction_id_is_rejected_before_snapshot() {
        let error = set_direction_active("  ".to_string(), true).unwrap_err();

        assert_eq!(error, "Task direction id cannot be empty.");
    }

    #[test]
    fn rejects_empty_push_channels_when_push_enabled() {
        let error = save_direction(
            "Daily push".to_string(),
            "description".to_string(),
            3,
            Vec::new(),
            "manual".to_string(),
            false,
            true,
            vec!["  ".to_string()],
            "auto".to_string(),
        )
        .unwrap_err();

        assert_eq!(
            error,
            "Task direction push channel cannot be empty when push is enabled."
        );
    }

    #[test]
    fn rejects_unsupported_push_channel_when_push_enabled() {
        let error = save_direction(
            "Daily push".to_string(),
            "description".to_string(),
            3,
            Vec::new(),
            "manual".to_string(),
            false,
            true,
            vec!["slack".to_string()],
            "auto".to_string(),
        )
        .unwrap_err();

        assert_eq!(error, "Task direction push channel is not supported.");
    }

    #[test]
    fn direction_activation_compensates_when_audit_write_fails() {
        let events = std::cell::RefCell::new(Vec::new());
        let result = finalize_direction_state_change(
            || {
                events.borrow_mut().push("audit");
                Err("audit unavailable".to_string())
            },
            || {
                events.borrow_mut().push("commit");
                Ok(())
            },
            |error| {
                events.borrow_mut().push("compensate");
                Err(error)
            },
        );

        assert_eq!(result.unwrap_err(), "audit unavailable");
        assert_eq!(events.into_inner(), vec!["audit", "compensate"]);
    }

    #[test]
    fn direction_activation_compensates_when_saga_commit_fails() {
        let events = std::cell::RefCell::new(Vec::new());
        let result = finalize_direction_state_change(
            || {
                events.borrow_mut().push("audit");
                Ok(())
            },
            || {
                events.borrow_mut().push("commit");
                Err(store::StoreError::InvalidInput("commit unavailable".to_string()))
            },
            |error| {
                events.borrow_mut().push("compensate");
                Err(error)
            },
        );

        assert!(result.unwrap_err().contains("Task direction saga could not be committed"));
        assert_eq!(events.into_inner(), vec!["audit", "commit", "compensate"]);
    }
}
