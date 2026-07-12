use serde::{Deserialize, Serialize};

use crate::{
    aggregation, config,
    domains::{notification_gateway, source_registry},
    http_source, store,
};

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
    pub evidence_contract: DailyBriefingEvidenceContract,
    pub archive_gate: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DailyBriefingEvidenceContract {
    pub source_count: usize,
    pub quarantined_source_count: usize,
    pub required_cross_checks: usize,
    pub confidence_score: f64,
    pub conflict_level: String,
    pub freshness_state: String,
    pub admission_state: String,
    pub archive_state: String,
    pub external_delivery_started: bool,
    pub durable_zhishu_write: bool,
    pub evidence_validation: aggregation::EvidenceValidationContract,
    pub provider_receipt: http_source::ProviderAdapterExecutionReceipt,
    pub provider_admission_preflight: http_source::ProviderReceiptAdmissionPreflight,
    pub provider_review_queue_preview: http_source::ProviderReceiptAdmissionQueuePreview,
    pub gates: Vec<String>,
    pub denied_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LiveSourceProviderGate {
    pub provider_id: String,
    pub provider_kind: String,
    pub allow_state: String,
    pub credential_policy: String,
    pub network_policy: String,
    pub rate_limit_policy: String,
    pub audit_policy: String,
    pub quarantine_policy: String,
    pub rollback_policy: String,
    pub required_approval: String,
    pub external_network_started: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct DailyBriefingLiveSourceStagingPreflight {
    pub state: String,
    pub query: String,
    pub requested_live_sources: bool,
    pub external_network_started: bool,
    pub durable_zhishu_write: bool,
    pub automatic_delivery_started: bool,
    pub required_cross_checks: usize,
    pub source_quarantine_required: bool,
    pub gate_enabled: bool,
    pub configured_source_url_present: bool,
    pub configured_source_count: usize,
    pub provider_gates: Vec<LiveSourceProviderGate>,
    pub gates: Vec<String>,
    pub blockers: Vec<String>,
    pub denied_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DailyBriefingArchiveReceipt {
    pub preview: DailyBriefingPreview,
    pub observations: Vec<store::SourceObservationRecord>,
    pub artifact: store::TaskArtifactRecord,
    pub run: store::TaskRunRecord,
    pub snapshot: store::SnapshotRecord,
    pub audit_event: store::AuditEvent,
    pub saga: store::SagaTransaction,
}

#[derive(Debug, Clone, Serialize)]
pub struct DailyBriefingScheduledArchiveReview {
    pub generated_at_ms: u128,
    pub state: String,
    pub eligible_run_ids: Vec<String>,
    pub pending_approval_run_ids: Vec<String>,
    pub blocked_run_ids: Vec<String>,
    pub automatic_archive_started: bool,
    pub external_network_started: bool,
    pub durable_zhishu_write: bool,
    pub gates: Vec<String>,
    pub denied_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DailyBriefingDeliveryReview {
    pub artifact_id: String,
    pub run_id: String,
    pub state: String,
    pub notification_previews: Vec<notification_gateway::NotificationPreview>,
    pub delivery_started: bool,
    pub external_network_started: bool,
    pub durable_zhishu_write: bool,
    pub gates: Vec<String>,
    pub denied_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DailyBriefingLiveSourceReceipt {
    pub preflight: DailyBriefingLiveSourceStagingPreflight,
    pub http_receipts: Vec<http_source::HttpSourceReceipt>,
    pub evidence_validation: aggregation::EvidenceValidationContract,
    pub artifact: store::TaskArtifactRecord,
    pub snapshot: store::SnapshotRecord,
    pub audit_event: store::AuditEvent,
    pub saga: store::SagaTransaction,
    pub external_network_started: bool,
    pub durable_zhishu_write: bool,
    pub automatic_delivery_started: bool,
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
    let evidence_contract = build_evidence_contract(&aggregation, archive_gate);
    let rendered_markdown = render_markdown(&template, &aggregation);

    Ok(DailyBriefingPreview {
        title: template.title,
        rendered_markdown,
        sections: template.sections,
        aggregation,
        evidence_contract,
        archive_gate: archive_gate.to_string(),
    })
}

pub fn preflight_live_source_staging(
    template: DailyBriefingTemplate,
) -> Result<DailyBriefingLiveSourceStagingPreflight, store::StoreError> {
    let template = normalize_template(template)?;
    let runtime = config::read_runtime_config();
    let requested_live_sources = template.online_enabled;
    let configured_source_urls = runtime.aggregation_source_urls();
    let configured_source_ids = runtime.aggregation_source_ids();
    let configured_source_url_present = !configured_source_urls.is_empty();
    let configured_source_count = configured_source_urls.len();
    let approved_source_ids = source_registry::approvals()
        .into_iter()
        .filter(|approval| approval.enabled)
        .map(|approval| approval.source_id)
        .collect::<Vec<_>>();
    let registry_approved = configured_source_ids.len() == configured_source_count
        && configured_source_ids.iter().all(|id| approved_source_ids.contains(id));
    let gate_enabled = runtime.external_delivery_enabled && configured_source_count >= 2 && registry_approved;
    let state = if requested_live_sources && gate_enabled {
        "live-source-staging-ready"
    } else if requested_live_sources {
        "live-source-staging-blocked-by-default"
    } else {
        "live-source-staging-not-requested"
    };
    let blockers = if requested_live_sources && !gate_enabled {
        let mut blockers = Vec::new();
        if !runtime.external_delivery_enabled {
            blockers.push("external-source-network-gate-disabled".to_string());
        }
        if !configured_source_url_present {
            blockers.push("configured-http-source-url-required".to_string());
        }
        if configured_source_count < 2 {
            blockers.push("configured-http-source-cross-check-required".to_string());
        }
        if !registry_approved {
            blockers.push("source-registry-approval-required".to_string());
        }
        blockers.extend([
            "provider-allowlist-required".to_string(),
            "source-cross-check-plan-required".to_string(),
            "zhishu-admission-review-required".to_string(),
        ]);
        blockers
    } else if !requested_live_sources {
        vec!["online-evidence-not-requested".to_string()]
    } else {
        Vec::new()
    };

    Ok(DailyBriefingLiveSourceStagingPreflight {
        state: state.to_string(),
        query: template.query,
        requested_live_sources,
        external_network_started: false,
        durable_zhishu_write: false,
        automatic_delivery_started: false,
        required_cross_checks: 2,
        source_quarantine_required: true,
        gate_enabled,
        configured_source_url_present,
        configured_source_count,
        provider_gates: live_source_provider_gates(),
        gates: vec![
            "explicit-live-source-approval-required".to_string(),
            "provider-allowlist-before-network".to_string(),
            "provider-specific-gate-before-network".to_string(),
            "credential-policy-before-provider-use".to_string(),
            "provider-audit-before-network".to_string(),
            "configured-independent-sources-before-network".to_string(),
            "source-registry-approval-before-network".to_string(),
            "cross-check-before-summary".to_string(),
            "quarantine-before-briefing-render".to_string(),
            "human-review-before-zhishu-admission".to_string(),
            "no-automatic-external-delivery".to_string(),
        ],
        blockers,
        denied_actions: vec![
            "fetch-live-source-without-approval".to_string(),
            "fetch-provider-without-allowlist".to_string(),
            "read-provider-credential-before-approval".to_string(),
            "summarize-unverified-live-source".to_string(),
            "write-l2-without-review".to_string(),
            "send-briefing-without-approval".to_string(),
        ],
    })
}

pub fn fetch_live_source(
    run_id: String,
    template: DailyBriefingTemplate,
    approved: bool,
) -> Result<DailyBriefingLiveSourceReceipt, store::StoreError> {
    let run_id = required(run_id, "task run id")?;
    if !approved {
        return Err(store::StoreError::InvalidInput(
            "daily briefing live source fetch requires explicit approval".to_string(),
        ));
    }
    let run = store::task_run_by_id(run_id.clone())?;
    if run.lifecycle_state != "approved"
        || run.approval_state != "approved"
        || run.execution_state != "approved-not-started"
    {
        return Err(store::StoreError::InvalidInput(
            "daily briefing live source fetch requires an approved, not-started Task Run"
                .to_string(),
        ));
    }
    let preflight = preflight_live_source_staging(template.clone())?;
    if preflight.state != "live-source-staging-ready" {
        return Err(store::StoreError::InvalidInput(format!(
            "daily briefing live source fetch is blocked: {} ({})",
            preflight.state,
            preflight.blockers.join(", ")
        )));
    }
    let saga = store::begin_saga(
        "daily-briefing-live-source-fetch".to_string(),
        run.id.clone(),
        serde_json::json!({
            "task_direction_id": run.task_direction_id,
            "query": preflight.query,
            "network_intent": "configured-readonly-http-cross-check",
        }),
    )?;
    let snapshot = match store::create_snapshot(
        "daily-briefing-live-source-fetch".to_string(),
        run.id.clone(),
        "before-daily-briefing-live-source-fetch".to_string(),
        serde_json::json!({ "run": run, "saga_id": saga.id }),
    ) {
        Ok(value) => value,
        Err(error) => return fail_saga(&saga, error),
    };
    if let Err(error) = store::append_audit_event(store::NewAuditEvent {
        actor: "taiheng".to_string(),
        action: "prepare-daily-briefing-live-source-fetch".to_string(),
        target_type: "task-run".to_string(),
        target_id: run_id.clone(),
        risk_level: "high".to_string(),
        decision: "network-intent-audited".to_string(),
        input: serde_json::json!({ "snapshot_id": snapshot.id, "saga_id": saga.id }),
        result_summary: serde_json::json!({
            "external_network_started": false,
            "credential_read_started": false,
            "durable_write_started": false,
        }),
        error: None,
    }) {
        return fail_saga(&saga, error);
    }
    let runtime = config::read_runtime_config();
    let http_receipts = match runtime
        .aggregation_source_ids()
        .into_iter()
        .zip(runtime.aggregation_source_urls())
        .map(|(source_id, url)| http_source::fetch_configured_source_as(url, source_id))
        .collect::<Result<Vec<_>, _>>()
    {
        Ok(value) => value,
        Err(error) => {
            let _ = store::append_audit_event(store::NewAuditEvent {
                actor: "taiheng".to_string(),
                action: "execute-daily-briefing-live-source-fetch".to_string(),
                target_type: "task-run".to_string(),
                target_id: run_id.clone(),
                risk_level: "high".to_string(),
                decision: "network-fetch-failed".to_string(),
                input: serde_json::json!({ "snapshot_id": snapshot.id, "saga_id": saga.id }),
                result_summary: serde_json::json!({ "external_network_started": true, "durable_write_started": false }),
                error: Some(error.clone()),
            });
            return fail_saga(&saga, store::StoreError::InvalidInput(error));
        }
    };
    let observations = http_receipts
        .iter()
        .map(|receipt| receipt.observation.clone())
        .collect::<Vec<_>>();
    let confidence = aggregation::assess_confidence(&observations, preflight.required_cross_checks);
    let evidence_validation = aggregation::validate_evidence_contract(
        &observations,
        &confidence,
        preflight.required_cross_checks,
    );
    let observations = match store::append_source_observations(http_receipts.iter().map(|receipt| {
        store::NewSourceObservationRecord {
            query: preflight.query.clone(),
            source_id: receipt.observation.source_id.clone(),
            source_uri: receipt.observation.source_uri.clone(),
            observed_at_ms: receipt.observation.captured_at_ms,
            freshness: receipt.observation.freshness.clone(),
            field_coverage: receipt.observation.field_coverage,
            normalized_claim: receipt.observation.normalized_claim.clone(),
            quarantine_state: receipt.observation.quarantine_state.clone(),
            fallback_used: receipt.observation.fallback_used,
            confidence_score: confidence.score,
            conflict_level: confidence.conflict_level.clone(),
            admission_state: confidence.admission_state.clone(),
        }
    }).collect()) {
        Ok(value) => value,
        Err(error) => return fail_saga(&saga, error),
    };
    let artifact = match store::append_task_artifacts(
        run.id,
        run.task_direction_id,
        vec![store::NewTaskArtifact {
            artifact_type: "daily-briefing-live-source-receipt".to_string(),
            reference_id: format!("daily-briefing-live-source-{}", store::now_millis()),
            title: format!("Daily briefing live source: {}", template.title),
            summary: format!(
                "{} configured sources; {}",
                http_receipts.len(),
                evidence_validation.cross_check_state
            ),
            metadata: serde_json::json!({
                "domain": "daily-briefing",
                "source": "configured-http-json-live-source-bundle",
                "query": preflight.query,
                "source_count": http_receipts.len(),
                "sources": http_receipts.iter().map(|receipt| serde_json::json!({
                    "provider_id": receipt.provider_receipt.provider_id,
                    "receipt_id": receipt.provider_receipt.receipt_id,
                    "source_sha256": receipt.provider_receipt.source_sha256,
                    "status_code": receipt.status_code,
                    "content_type": receipt.content_type,
                    "response_bytes": receipt.response_bytes,
                    "source_id": receipt.observation.source_id,
                })).collect::<Vec<_>>(),
                "external_network_started": true,
                "credential_read_started": false,
                "process_started": false,
                "automatic_delivery_started": false,
                "durable_zhishu_write_started": false,
                "quarantine_state": "provider-live-source-review-required",
                "provider_artifact_admission_required": true,
                "evidence_validation": evidence_validation,
                "provider_receipts": http_receipts.iter().map(|receipt| &receipt.provider_receipt).collect::<Vec<_>>(),
                "gates": [
                    "configured-independent-sources-before-network",
                    "cross-check-before-summary",
                    "quarantine-before-briefing-render",
                    "no-automatic-zhishu-admission",
                    "no-automatic-external-delivery",
                ],
            }),
        }],
    ) {
        Ok(mut values) => values.remove(0),
        Err(error) => return finish_live_source_compensation(error, compensate_live_source(&saga, &observations, &[])),
    };
    let audit_event = match store::append_audit_event(store::NewAuditEvent {
        actor: "taiheng".to_string(),
        action: "execute-daily-briefing-live-source-fetch".to_string(),
        target_type: "task-run".to_string(),
        target_id: run_id,
        risk_level: "high".to_string(),
        decision: "live-source-receipt-recorded".to_string(),
        input: serde_json::json!({ "snapshot_id": snapshot.id, "saga_id": saga.id }),
        result_summary: serde_json::json!({
            "external_network_started": true,
            "artifact_id": artifact.id,
            "observation_ids": observations.iter().map(|item| item.id.clone()).collect::<Vec<_>>(),
            "cross_check_state": evidence_validation.cross_check_state,
        }),
        error: None,
    }) {
        Ok(value) => value,
        Err(error) => return finish_live_source_compensation(error, compensate_live_source(&saga, &observations, std::slice::from_ref(&artifact))),
    };
    let saga = match store::transition_saga(saga.id.clone(), "committed".to_string()) {
        Ok(value) => value,
        Err(error) => return finish_live_source_compensation(error, compensate_live_source(&saga, &observations, std::slice::from_ref(&artifact))),
    };

    Ok(DailyBriefingLiveSourceReceipt {
        preflight,
        http_receipts,
        evidence_validation,
        artifact,
        snapshot,
        audit_event,
        saga,
        external_network_started: true,
        durable_zhishu_write: false,
        automatic_delivery_started: false,
    })
}

fn finish_live_source_compensation<T>(
    original_error: store::StoreError,
    compensation: Result<(), store::StoreError>,
) -> Result<T, store::StoreError> {
    match compensation {
        Ok(()) => Err(original_error),
        Err(compensation_error) => Err(store::StoreError::InvalidInput(format!(
            "daily briefing live source fetch failed: {original_error}; compensation failed: {compensation_error}"
        ))),
    }
}

fn compensate_live_source(
    saga: &store::SagaTransaction,
    observations: &[store::SourceObservationRecord],
    artifacts: &[store::TaskArtifactRecord],
) -> Result<(), store::StoreError> {
    let _ = store::transition_saga(saga.id.clone(), "compensating".to_string());
    let artifact_result = store::remove_task_artifacts(
        artifacts.iter().map(|artifact| artifact.id.clone()).collect(),
    );
    let observation_result = store::remove_source_observations(
        observations.iter().map(|observation| observation.id.clone()).collect(),
    );
    if artifact_result.is_ok() && observation_result.is_ok() {
        let _ = store::transition_saga(saga.id.clone(), "compensated".to_string());
        return Ok(());
    }
    let _ = store::transition_saga(saga.id.clone(), "failed".to_string());
    Err(store::StoreError::InvalidInput(
        "daily briefing live source compensation failed".to_string(),
    ))
}

fn live_source_provider_gates() -> Vec<LiveSourceProviderGate> {
    vec![
        LiveSourceProviderGate {
            provider_id: "public-web-json".to_string(),
            provider_kind: "configured-http-json".to_string(),
            allow_state: "blocked-until-provider-review".to_string(),
            credential_policy: "no-credentials".to_string(),
            network_policy: "https-get-only-no-redirect".to_string(),
            rate_limit_policy: "manual-or-low-frequency".to_string(),
            audit_policy: "audit-before-and-after-provider-fetch".to_string(),
            quarantine_policy: "quarantine-before-summary".to_string(),
            rollback_policy: "no-durable-write-to-rollback".to_string(),
            required_approval: "taiheng-live-source-approval".to_string(),
            external_network_started: false,
        },
        LiveSourceProviderGate {
            provider_id: "official-primary-source".to_string(),
            provider_kind: "official-document-or-standard".to_string(),
            allow_state: "allowlist-required".to_string(),
            credential_policy: "credential-guard-required-if-authenticated".to_string(),
            network_policy: "provider-profile-required".to_string(),
            rate_limit_policy: "provider-rate-limit-required".to_string(),
            audit_policy: "source-provenance-and-capture-time-required".to_string(),
            quarantine_policy: "quarantine-before-briefing-render".to_string(),
            rollback_policy: "artifact-only-before-human-review".to_string(),
            required_approval: "source-owner-and-taiheng-review".to_string(),
            external_network_started: false,
        },
        LiveSourceProviderGate {
            provider_id: "general-web-source".to_string(),
            provider_kind: "untrusted-web".to_string(),
            allow_state: "quarantine-only-blocked-by-default".to_string(),
            credential_policy: "no-cookies-no-session-reuse".to_string(),
            network_policy: "anti-injection-review-required".to_string(),
            rate_limit_policy: "bounded-manual-fetch-only".to_string(),
            audit_policy: "prompt-injection-and-claim-audit-required".to_string(),
            quarantine_policy: "quarantine-and-cross-check-before-use".to_string(),
            rollback_policy: "discardable-observation-only".to_string(),
            required_approval: "manual-security-review".to_string(),
            external_network_started: false,
        },
    ]
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

    let online_enabled = template.online_enabled;
    let preview = preview(template)?;
    if preview.archive_gate != "reviewable" {
        return Err(store::StoreError::InvalidInput(
            "daily briefing source confidence blocks archival".to_string(),
        ));
    }
    let saga = store::begin_saga(
        "daily-briefing-archive".to_string(),
        run.id.clone(),
        serde_json::json!({
            "task_direction_id": run.task_direction_id.clone(),
            "online_enabled": online_enabled,
        }),
    )?;
    let snapshot = match store::create_snapshot(
        "daily-briefing-archive".to_string(),
        run.id.clone(),
        "before-daily-briefing-archive".to_string(),
        serde_json::json!({
            "run": run.clone(),
            "saga_id": saga.id,
        }),
    ) {
        Ok(snapshot) => snapshot,
        Err(error) => return fail_saga(&saga, error),
    };
    let observations = match store::append_source_observations(
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
    ) {
        Ok(observations) => observations,
        Err(error) => return fail_saga(&saga, error),
    };
    let artifact = match store::append_task_artifacts(
        run.id.clone(),
        run.task_direction_id.clone(),
        vec![store::NewTaskArtifact {
            artifact_type: "daily-briefing".to_string(),
            reference_id: format!("daily-briefing-{}", store::now_millis()),
            title: preview.title.clone(),
            summary: preview.rendered_markdown.clone(),
            metadata: daily_briefing_artifact_metadata(&preview),
        }],
    ) {
        Ok(mut artifacts) => artifacts.remove(0),
        Err(error) => {
            return finish_compensation(
                error,
                compensate_archive(&saga, &run, &observations, &[]),
            )
        }
    };
    let completed = match store::complete_domain_task_run(
        run.id.clone(),
        format!("Daily briefing archived as artifact {}.", artifact.id),
    ) {
        Ok(completed) => completed,
        Err(error) => {
            return finish_compensation(
                error,
                compensate_archive(&saga, &run, &observations, std::slice::from_ref(&artifact)),
            )
        }
    };
    let audit_event = match store::append_audit_event(store::NewAuditEvent {
        actor: "taiheng".to_string(),
        action: "archive-daily-briefing".to_string(),
        target_type: "task-run".to_string(),
        target_id: run.id.clone(),
        risk_level: "medium".to_string(),
        decision: completed.lifecycle_state.clone(),
        input: serde_json::json!({
            "artifact_type": "daily-briefing",
            "snapshot_id": snapshot.id,
            "saga_id": saga.id,
        }),
        result_summary: serde_json::json!({
            "artifact_id": artifact.id,
            "source_observation_count": observations.len(),
            "confidence_score": preview.aggregation.confidence.score,
            "lifecycle_state": completed.lifecycle_state,
            "rollback_snapshot_id": snapshot.id,
        }),
        error: None,
    }) {
        Ok(event) => event,
        Err(error) => {
            return finish_compensation(
                error,
                compensate_archive(&saga, &run, &observations, std::slice::from_ref(&artifact)),
            )
        }
    };
    let saga = match store::transition_saga(saga.id.clone(), "committed".to_string()) {
        Ok(saga) => saga,
        Err(error) => {
            return finish_compensation(
                error,
                compensate_archive(&saga, &run, &observations, std::slice::from_ref(&artifact)),
            )
        }
    };

    Ok(DailyBriefingArchiveReceipt {
        preview,
        observations,
        artifact,
        run: completed,
        snapshot,
        audit_event,
        saga,
    })
}

pub fn review_scheduled_archive() -> Result<DailyBriefingScheduledArchiveReview, store::StoreError> {
    let runs = store::task_run_records(100)?;
    Ok(review_scheduled_archive_for_runs(&runs))
}

pub fn review_delivery(artifact_id: String) -> Result<DailyBriefingDeliveryReview, store::StoreError> {
    let artifact_id = required(artifact_id, "daily briefing artifact id")?;
    let artifact = store::list_task_artifacts(None, 100)?
        .into_iter()
        .find(|artifact| artifact.id == artifact_id)
        .ok_or_else(|| store::StoreError::NotFound(artifact_id.clone()))?;
    if artifact.artifact_type != "daily-briefing" {
        return Err(store::StoreError::InvalidInput(
            "daily briefing delivery review requires a daily-briefing artifact".to_string(),
        ));
    }
    let run = store::task_run_by_id(artifact.run_id.clone())?;
    validate_delivery_review_eligibility(&artifact, &run)?;
    let body = daily_briefing_delivery_body(&artifact);
    let notification_previews = run
        .push_channels
        .iter()
        .map(|channel| {
            notification_gateway::preview(notification_gateway::NotificationRequest {
                run_id: run.id.clone(),
                channel: channel.clone(),
                subject: artifact.title.clone(),
                body: body.clone(),
            })
        })
        .collect::<Result<Vec<_>, _>>()?;

    Ok(build_delivery_review(artifact.id, run.id, notification_previews))
}

fn validate_delivery_review_eligibility(
    artifact: &store::TaskArtifactRecord,
    run: &store::TaskRunRecord,
) -> Result<(), store::StoreError> {
    let archived_briefing = artifact
        .metadata
        .get("domain")
        .and_then(|value| value.as_str())
        .is_some_and(|value| value == "daily-briefing")
        && artifact
            .metadata
            .get("evidence_contract")
            .and_then(|value| value.get("archive_state"))
            .and_then(|value| value.as_str())
            .is_some_and(|value| value == "reviewable");
    if !archived_briefing {
        return Err(store::StoreError::InvalidInput(
            "daily briefing delivery review requires an archived reviewable briefing artifact"
                .to_string(),
        ));
    }
    if artifact.task_direction_id != run.task_direction_id
        || run.lifecycle_state != "succeeded"
        || run.approval_state != "approved"
        || run.execution_state != "completed"
    {
        return Err(store::StoreError::InvalidInput(
            "daily briefing delivery review requires a successfully completed approved Task Run"
                .to_string(),
        ));
    }
    Ok(())
}

fn build_delivery_review(
    artifact_id: String,
    run_id: String,
    notification_previews: Vec<notification_gateway::NotificationPreview>,
) -> DailyBriefingDeliveryReview {
    DailyBriefingDeliveryReview {
        artifact_id,
        run_id,
        state: if notification_previews.is_empty() {
            "daily-briefing-delivery-review-no-enabled-channel".to_string()
        } else {
            "daily-briefing-delivery-review-recorded".to_string()
        },
        notification_previews,
        delivery_started: false,
        external_network_started: false,
        durable_zhishu_write: false,
        gates: vec![
            "archived-briefing-artifact-required".to_string(),
            "approved-completed-task-run-required".to_string(),
            "notification-gateway-preview-only".to_string(),
            "explicit-delivery-confirmation-required".to_string(),
        ],
        denied_actions: vec![
            "auto-deliver-daily-briefing".to_string(),
            "auto-retry-daily-briefing-delivery".to_string(),
            "auto-admit-delivery-result-to-zhishu".to_string(),
        ],
    }
}

fn review_scheduled_archive_for_runs(
    runs: &[store::TaskRunRecord],
) -> DailyBriefingScheduledArchiveReview {
    let mut eligible_run_ids = Vec::new();
    let mut pending_approval_run_ids = Vec::new();
    let mut blocked_run_ids = Vec::new();

    for run in runs.iter().filter(|run| run.trigger_kind == "schedule-tick") {
        if run.lifecycle_state == "approved"
            && run.approval_state == "approved"
            && run.execution_state == "approved-not-started"
        {
            eligible_run_ids.push(run.id.clone());
        } else if run.lifecycle_state == "awaiting-approval"
            && run.approval_state == "waiting-approval"
        {
            pending_approval_run_ids.push(run.id.clone());
        } else {
            blocked_run_ids.push(run.id.clone());
        }
    }

    DailyBriefingScheduledArchiveReview {
        generated_at_ms: store::now_millis(),
        state: if eligible_run_ids.is_empty() {
            "scheduled-briefing-archive-review-waiting-approval".to_string()
        } else {
            "scheduled-briefing-archive-review-ready".to_string()
        },
        eligible_run_ids,
        pending_approval_run_ids,
        blocked_run_ids,
        automatic_archive_started: false,
        external_network_started: false,
        durable_zhishu_write: false,
        gates: vec![
            "schedule-tick-requires-human-approval".to_string(),
            "briefing-preview-required-before-archive".to_string(),
            "manual-archive-selection-required".to_string(),
        ],
        denied_actions: vec![
            "auto-archive-scheduled-briefing".to_string(),
            "auto-fetch-live-sources-for-scheduled-briefing".to_string(),
            "auto-deliver-scheduled-briefing".to_string(),
            "auto-admit-scheduled-briefing-to-zhishu".to_string(),
        ],
    }
}

fn fail_saga<T>(
    saga: &store::SagaTransaction,
    error: store::StoreError,
) -> Result<T, store::StoreError> {
    let _ = store::transition_saga(saga.id.clone(), "failed".to_string());
    Err(error)
}

fn finish_compensation<T>(
    original_error: store::StoreError,
    compensation: Result<(), store::StoreError>,
) -> Result<T, store::StoreError> {
    match compensation {
        Ok(()) => Err(original_error),
        Err(compensation_error) => Err(store::StoreError::InvalidInput(format!(
            "daily briefing archive failed: {original_error}; compensation failed: {compensation_error}"
        ))),
    }
}

fn compensate_archive(
    saga: &store::SagaTransaction,
    previous_run: &store::TaskRunRecord,
    observations: &[store::SourceObservationRecord],
    artifacts: &[store::TaskArtifactRecord],
) -> Result<(), store::StoreError> {
    let _ = store::transition_saga(saga.id.clone(), "compensating".to_string());
    let artifact_result = store::remove_task_artifacts(
        artifacts.iter().map(|artifact| artifact.id.clone()).collect(),
    );
    let observation_result = store::remove_source_observations(
        observations
            .iter()
            .map(|observation| observation.id.clone())
            .collect(),
    );
    let run_result = store::restore_task_run(previous_run.clone());
    if artifact_result.is_ok() && observation_result.is_ok() && run_result.is_ok() {
        let _ = store::transition_saga(saga.id.clone(), "compensated".to_string());
        return Ok(());
    }
    let _ = store::transition_saga(saga.id.clone(), "failed".to_string());
    Err(store::StoreError::InvalidInput(
        "daily briefing archive compensation failed".to_string(),
    ))
}

fn daily_briefing_artifact_metadata(preview: &DailyBriefingPreview) -> serde_json::Value {
    serde_json::json!({
        "domain": "daily-briefing",
        "source": "daily-briefing-provider-evidence",
        "rendered_markdown": preview.rendered_markdown,
        "sections": preview.sections,
        "query": preview.aggregation.query,
        "confidence_score": preview.aggregation.confidence.score,
        "conflict_level": preview.aggregation.confidence.conflict_level,
        "admission_state": preview.aggregation.confidence.admission_state,
        "retrieval_state": preview.aggregation.retrieval_state,
        "provider_artifact_admission_required": true,
        "provider_id": preview.evidence_contract.provider_receipt.provider_id,
        "receipt_id": preview.evidence_contract.provider_receipt.receipt_id,
        "source_sha256": preview.evidence_contract.provider_receipt.source_sha256,
        "quarantine_state": "task-artifact-review-required",
        "zhishu_admission_state": "not-started",
        "durable_zhishu_write_started": false,
        "provider_admission_state": preview.evidence_contract.provider_admission_preflight.state,
        "provider_review_queue_state": preview.evidence_contract.provider_review_queue_preview.state,
        "evidence_contract": {
            "source_count": preview.evidence_contract.source_count,
            "quarantined_source_count": preview.evidence_contract.quarantined_source_count,
            "archive_state": preview.evidence_contract.archive_state,
            "external_delivery_started": preview.evidence_contract.external_delivery_started,
            "durable_zhishu_write": preview.evidence_contract.durable_zhishu_write,
            "provider_receipt_id": preview.evidence_contract.provider_receipt.receipt_id,
            "provider_receipt_sha256": preview.evidence_contract.provider_receipt.source_sha256,
        },
    })
}

fn daily_briefing_delivery_body(artifact: &store::TaskArtifactRecord) -> String {
    artifact
        .metadata
        .get("rendered_markdown")
        .and_then(|value| value.as_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(&artifact.summary)
        .to_string()
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
        .map(|section| {
            format!("## {section}\nEvidence-backed draft requires human review before reuse.")
        })
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

fn build_evidence_contract(
    aggregation: &aggregation::AggregationPreview,
    archive_gate: &str,
) -> DailyBriefingEvidenceContract {
    let quarantined_source_count = aggregation
        .observations
        .iter()
        .filter(|observation| observation.quarantine_state == "quarantined")
        .count();
    let provider_receipt = daily_briefing_provider_receipt(aggregation);
    let provider_admission_preflight =
        http_source::preflight_provider_receipt_admission(provider_receipt.clone());
    let provider_review_queue_preview =
        http_source::preview_provider_receipt_admission_queue(provider_receipt.clone());

    DailyBriefingEvidenceContract {
        source_count: aggregation.observations.len(),
        quarantined_source_count,
        required_cross_checks: aggregation.required_cross_checks,
        confidence_score: aggregation.confidence.score,
        conflict_level: aggregation.confidence.conflict_level.clone(),
        freshness_state: aggregation.confidence.freshness_state.clone(),
        admission_state: aggregation.confidence.admission_state.clone(),
        archive_state: archive_gate.to_string(),
        external_delivery_started: false,
        durable_zhishu_write: false,
        evidence_validation: aggregation.evidence_validation.clone(),
        provider_receipt,
        provider_admission_preflight,
        provider_review_queue_preview,
        gates: vec![
            "source-observations-recorded-before-archive".to_string(),
            "quarantine-before-summary".to_string(),
            "provider-receipt-before-briefing-admission".to_string(),
            "provider-review-queue-before-briefing-zhishu".to_string(),
            "human-review-before-reuse".to_string(),
            "no-automatic-zhishu-admission".to_string(),
            "no-automatic-external-delivery".to_string(),
        ],
        denied_actions: vec![
            "send-briefing-without-approval".to_string(),
            "write-l2-without-review".to_string(),
            "treat-fixture-as-current-fact".to_string(),
            "skip-source-cross-check".to_string(),
        ],
    }
}

fn daily_briefing_provider_receipt(
    aggregation: &aggregation::AggregationPreview,
) -> http_source::ProviderAdapterExecutionReceipt {
    let evidence_payload = format!(
        "daily-briefing-evidence:{}:{:?}",
        aggregation.query, aggregation.observations
    );
    http_source::provider_adapter_receipt(
        "daily-briefing-evidence",
        "daily-briefing-fixture-evidence",
        "local-fixture-evidence-preview",
        "fixture://daily-briefing/evidence",
        evidence_payload.as_bytes(),
        false,
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

    fn fake_live_source_saga(target_id: &str) -> store::SagaTransaction {
        let now = store::now_millis();
        store::SagaTransaction {
            id: format!("daily-briefing-test-saga-{now}"),
            kind: "daily-briefing-live-source-fetch".to_string(),
            target_id: target_id.to_string(),
            state: "pending".to_string(),
            metadata: serde_json::json!({}),
            created_at_ms: now,
            updated_at_ms: now,
        }
    }

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
        assert_eq!(preview.evidence_contract.source_count, 2);
        assert_eq!(preview.evidence_contract.quarantined_source_count, 2);
        assert!(!preview.evidence_contract.external_delivery_started);
        assert!(!preview.evidence_contract.durable_zhishu_write);
        assert_eq!(
            preview
                .evidence_contract
                .evidence_validation
                .cross_check_state,
            "cross-check-passed"
        );
        assert!(
            !preview
                .evidence_contract
                .evidence_validation
                .durable_write_allowed
        );
        assert!(preview
            .evidence_contract
            .gates
            .contains(&"no-automatic-zhishu-admission".to_string()));
        assert_eq!(
            preview.evidence_contract.provider_receipt.provider_id,
            "daily-briefing-evidence"
        );
        assert_eq!(
            preview.evidence_contract.provider_admission_preflight.state,
            "provider-receipt-admission-review-required"
        );
        assert_eq!(
            preview
                .evidence_contract
                .provider_review_queue_preview
                .state,
            "provider-receipt-review-queue-preview"
        );
        assert!(
            !preview
                .evidence_contract
                .provider_admission_preflight
                .durable_zhishu_write_started
        );
    }

    #[test]
    fn briefing_archive_metadata_requires_provider_artifact_admission() {
        let preview = preview(DailyBriefingTemplate {
            title: "Morning brief".to_string(),
            query: "AI project maintenance".to_string(),
            sections: Vec::new(),
            online_enabled: false,
        })
        .unwrap();

        let metadata = daily_briefing_artifact_metadata(&preview);

        assert_eq!(metadata["domain"], "daily-briefing");
        assert_eq!(metadata["source"], "daily-briefing-provider-evidence");
        assert_eq!(metadata["provider_artifact_admission_required"], true);
        assert_eq!(
            metadata["provider_id"],
            preview.evidence_contract.provider_receipt.provider_id
        );
        assert_eq!(
            metadata["receipt_id"],
            preview.evidence_contract.provider_receipt.receipt_id
        );
        assert_eq!(
            metadata["source_sha256"],
            preview.evidence_contract.provider_receipt.source_sha256
        );
        assert_eq!(
            metadata["quarantine_state"],
            "task-artifact-review-required"
        );
        assert_eq!(metadata["zhishu_admission_state"], "not-started");
        assert_eq!(metadata["durable_zhishu_write_started"], false);
        assert!(metadata["rendered_markdown"]
            .as_str()
            .unwrap()
            .contains("Morning brief"));
    }

    #[test]
    fn delivery_review_prefers_archived_briefing_body_and_falls_back_to_summary() {
        let artifact = store::TaskArtifactRecord {
            id: "briefing-artifact".to_string(),
            run_id: "run-briefing".to_string(),
            task_direction_id: "direction-briefing".to_string(),
            artifact_type: "daily-briefing".to_string(),
            reference_id: "briefing-reference".to_string(),
            title: "Daily briefing".to_string(),
            summary: "Fallback summary".to_string(),
            metadata: serde_json::json!({ "rendered_markdown": "# Archived briefing" }),
            created_at_ms: 1,
        };
        assert_eq!(daily_briefing_delivery_body(&artifact), "# Archived briefing");

        let legacy = store::TaskArtifactRecord {
            metadata: serde_json::json!({}),
            ..artifact
        };
        assert_eq!(daily_briefing_delivery_body(&legacy), "Fallback summary");
    }

    #[test]
    fn delivery_review_requires_archived_briefing_and_completed_approved_run() {
        let artifact = archived_briefing_artifact();
        let run = completed_briefing_run();
        assert!(validate_delivery_review_eligibility(&artifact, &run).is_ok());

        let missing_archive_evidence = store::TaskArtifactRecord {
            metadata: serde_json::json!({ "domain": "daily-briefing" }),
            ..artifact.clone()
        };
        assert!(validate_delivery_review_eligibility(&missing_archive_evidence, &run)
            .unwrap_err()
            .to_string()
            .contains("archived reviewable"));

        let unfinished = store::TaskRunRecord {
            lifecycle_state: "approved".to_string(),
            execution_state: "approved-not-started".to_string(),
            ..run
        };
        assert!(validate_delivery_review_eligibility(&artifact, &unfinished)
            .unwrap_err()
            .to_string()
            .contains("successfully completed approved"));
    }

    #[test]
    fn delivery_review_is_preview_only_even_when_eligible() {
        let review = build_delivery_review(
            "briefing-artifact".to_string(),
            "run-briefing".to_string(),
            Vec::new(),
        );

        assert_eq!(review.state, "daily-briefing-delivery-review-no-enabled-channel");
        assert!(!review.delivery_started);
        assert!(!review.external_network_started);
        assert!(!review.durable_zhishu_write);
        assert!(review
            .gates
            .contains(&"approved-completed-task-run-required".to_string()));
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

    #[test]
    fn live_source_staging_preflight_blocks_network_by_default() {
        let preflight = preflight_live_source_staging(DailyBriefingTemplate {
            title: "Morning brief".to_string(),
            query: "AI project maintenance".to_string(),
            sections: Vec::new(),
            online_enabled: true,
        })
        .unwrap();

        assert_eq!(preflight.state, "live-source-staging-blocked-by-default");
        assert!(preflight.requested_live_sources);
        assert!(!preflight.gate_enabled);
        assert!(!preflight.configured_source_url_present);
        assert_eq!(preflight.configured_source_count, 0);
        assert!(!preflight.external_network_started);
        assert!(!preflight.durable_zhishu_write);
        assert!(!preflight.automatic_delivery_started);
        assert!(preflight.source_quarantine_required);
        assert_eq!(preflight.required_cross_checks, 2);
        assert_eq!(preflight.provider_gates.len(), 3);
        assert!(preflight
            .provider_gates
            .iter()
            .all(|gate| !gate.external_network_started));
        assert!(preflight
            .provider_gates
            .iter()
            .any(|gate| gate.allow_state == "allowlist-required"));
        assert!(preflight
            .blockers
            .contains(&"external-source-network-gate-disabled".to_string()));
        assert!(preflight
            .blockers
            .contains(&"configured-http-source-url-required".to_string()));
        assert!(preflight
            .blockers
            .contains(&"configured-http-source-cross-check-required".to_string()));
        assert!(preflight
            .gates
            .contains(&"provider-allowlist-before-network".to_string()));
        assert!(preflight
            .gates
            .contains(&"provider-specific-gate-before-network".to_string()));
        assert!(preflight
            .denied_actions
            .contains(&"fetch-provider-without-allowlist".to_string()));
    }

    #[test]
    fn live_source_fetch_requires_approval_and_gate_before_network() {
        let template = DailyBriefingTemplate {
            title: "Morning brief".to_string(),
            query: "AI project maintenance".to_string(),
            sections: Vec::new(),
            online_enabled: true,
        };

        let unapproved = fetch_live_source("run-1".to_string(), template.clone(), false)
            .unwrap_err()
            .to_string();
        assert!(unapproved.contains("explicit approval"));

        let gated = fetch_live_source("run-1".to_string(), template, true)
            .unwrap_err()
            .to_string();
        assert!(
            gated.contains("not found")
                || gated.contains("blocked")
                || gated.contains("approved, not-started")
        );
    }

    #[test]
    fn live_source_artifact_persistence_failure_removes_post_fetch_observations() {
        let marker = format!("daily-briefing-post-fetch-failure-{}", store::now_millis());
        let source_id = format!("{marker}-source");
        let observations = store::append_source_observations(vec![
            store::NewSourceObservationRecord {
                query: marker.clone(),
                source_id: source_id.clone(),
                source_uri: format!("loopback://{marker}"),
                observed_at_ms: store::now_millis(),
                freshness: "fresh".to_string(),
                field_coverage: 1.0,
                normalized_claim: "controlled post-fetch observation".to_string(),
                quarantine_state: "quarantined".to_string(),
                fallback_used: false,
                confidence_score: 0.8,
                conflict_level: "low".to_string(),
                admission_state: "review-required".to_string(),
            },
        ])
        .unwrap();

        let error = finish_live_source_compensation::<()>(
            store::StoreError::InvalidInput(
                "injected live-source artifact persistence failure".to_string(),
            ),
            compensate_live_source(&fake_live_source_saga(&marker), &observations, &[]),
        )
        .unwrap_err()
        .to_string();

        assert!(error.contains("injected live-source artifact persistence failure"));
        assert!(store::list_source_observations(Some(source_id), 100)
            .unwrap()
            .iter()
            .all(|observation| observation.id != observations[0].id));
    }

    #[test]
    fn scheduled_archive_review_only_exposes_approved_schedule_tick_runs() {
        let scheduled = |id: &str, lifecycle: &str, approval: &str, execution: &str| {
            store::TaskRunRecord {
                id: id.to_string(),
                created_at_ms: 1,
                task_direction_id: "daily-briefing".to_string(),
                task_direction_title: "Daily briefing".to_string(),
                trigger_kind: "schedule-tick".to_string(),
                idempotency_key: id.to_string(),
                schedule_frequency: "daily".to_string(),
                online_enabled: false,
                output_template: "briefing".to_string(),
                push_enabled: false,
                push_channels: Vec::new(),
                lifecycle_state: lifecycle.to_string(),
                approval_state: approval.to_string(),
                execution_state: execution.to_string(),
                detail: "test".to_string(),
                generated_candidate_ids: Vec::new(),
                started_at_ms: None,
                completed_at_ms: None,
                failed_at_ms: None,
                error_summary: None,
                cancelled_at_ms: None,
                archived_at_ms: None,
                source_candidate_id: None,
            }
        };
        let review = review_scheduled_archive_for_runs(&[
            scheduled("approved", "approved", "approved", "approved-not-started"),
            scheduled("waiting", "awaiting-approval", "waiting-approval", "not-started"),
            scheduled("blocked", "cancelled", "rejected", "cancelled"),
            store::TaskRunRecord {
                trigger_kind: "manual".to_string(),
                ..scheduled("manual", "approved", "approved", "approved-not-started")
            },
        ]);

        assert_eq!(review.state, "scheduled-briefing-archive-review-ready");
        assert_eq!(review.eligible_run_ids, vec!["approved"]);
        assert_eq!(review.pending_approval_run_ids, vec!["waiting"]);
        assert_eq!(review.blocked_run_ids, vec!["blocked"]);
        assert!(!review.automatic_archive_started);
        assert!(!review.external_network_started);
        assert!(!review.durable_zhishu_write);
    }

    fn archived_briefing_artifact() -> store::TaskArtifactRecord {
        store::TaskArtifactRecord {
            id: "briefing-artifact".to_string(),
            run_id: "run-briefing".to_string(),
            task_direction_id: "direction-briefing".to_string(),
            artifact_type: "daily-briefing".to_string(),
            reference_id: "briefing-reference".to_string(),
            title: "Daily briefing".to_string(),
            summary: "Archived summary".to_string(),
            metadata: serde_json::json!({
                "domain": "daily-briefing",
                "evidence_contract": { "archive_state": "reviewable" },
            }),
            created_at_ms: 1,
        }
    }

    fn completed_briefing_run() -> store::TaskRunRecord {
        store::TaskRunRecord {
            id: "run-briefing".to_string(),
            created_at_ms: 1,
            task_direction_id: "direction-briefing".to_string(),
            task_direction_title: "Daily briefing".to_string(),
            trigger_kind: "manual".to_string(),
            idempotency_key: "briefing-test".to_string(),
            schedule_frequency: "daily".to_string(),
            online_enabled: false,
            output_template: "briefing".to_string(),
            push_enabled: false,
            push_channels: Vec::new(),
            lifecycle_state: "succeeded".to_string(),
            approval_state: "approved".to_string(),
            execution_state: "completed".to_string(),
            detail: "archived".to_string(),
            generated_candidate_ids: Vec::new(),
            started_at_ms: Some(1),
            completed_at_ms: Some(2),
            failed_at_ms: None,
            error_summary: None,
            cancelled_at_ms: None,
            archived_at_ms: Some(2),
            source_candidate_id: None,
        }
    }
}
