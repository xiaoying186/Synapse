use serde::{Deserialize, Serialize};

use crate::store;
use crate::{config, http_source};

#[derive(Debug, Clone, Serialize)]
pub struct SourceRegistryEntry {
    pub source_id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub source_type: String,
    pub scope: String,
    pub owner_module: String,
    pub enabled: bool,
    pub auth_required: bool,
    pub network_profile: String,
    pub rate_limit: String,
    pub storage_policy: String,
    pub shared_config_allowed: bool,
    pub status: String,
    pub adapter_kind: String,
    pub health_check_policy: String,
    pub credential_policy: String,
    pub observation_policy: String,
    pub freshness_policy: String,
    pub verification_policy: String,
    pub quarantine_policy: String,
    pub risk_level: String,
    pub last_health_check_at_ms: Option<u128>,
    pub last_health_state: String,
    pub last_health_observation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceRegistryApproval {
    pub source_id: String,
    pub enabled: bool,
    pub reviewed_at_ms: u128,
    pub review_state: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SourceEnablementReviewReceipt {
    pub approval: SourceRegistryApproval,
    pub snapshot: store::SnapshotRecord,
    pub audit_event: store::AuditEvent,
    pub saga: store::SagaTransaction,
}

#[derive(Debug, Clone, Serialize)]
pub struct SourceRegistryPreview {
    pub generated_at_ms: u128,
    pub state: String,
    pub registry_scope: String,
    pub entries: Vec<SourceRegistryEntry>,
    pub gates: Vec<String>,
    pub denied_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SourceEnablementPreflight {
    pub generated_at_ms: u128,
    pub state: String,
    pub source_id: String,
    pub source_type: String,
    pub owner_module: String,
    pub current_status: String,
    pub enabled: bool,
    pub network_started: bool,
    pub credential_read_started: bool,
    pub fetch_started: bool,
    pub storage_write_started: bool,
    pub shared_config_write_started: bool,
    pub requires_owner_review: bool,
    pub requires_auth_policy_review: bool,
    pub requires_network_profile_review: bool,
    pub requires_rate_limit_review: bool,
    pub requires_storage_policy_review: bool,
    pub requires_verification_plan: bool,
    pub requires_quarantine_plan: bool,
    pub requires_injection_defense: bool,
    pub gates: Vec<String>,
    pub blockers: Vec<String>,
    pub denied_actions: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SourceHealthCheckRequest {
    pub source_id: String,
    pub approved: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct SourceHealthCheckPreflight {
    pub generated_at_ms: u128,
    pub state: String,
    pub source_id: String,
    pub enabled: bool,
    pub configured_url_present: bool,
    pub explicit_approval: bool,
    pub network_started: bool,
    pub ready: bool,
    pub blockers: Vec<String>,
    pub gates: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SourceHealthCheckReceipt {
    pub state: String,
    pub source_id: String,
    pub status_code: u16,
    pub response_bytes: usize,
    pub observation: store::SourceObservationRecord,
    pub snapshot: store::SnapshotRecord,
    pub audit_event: store::AuditEvent,
    pub saga: store::SagaTransaction,
}

pub fn preview() -> SourceRegistryPreview {
    let approvals = approvals();
    SourceRegistryPreview {
        generated_at_ms: store::now_millis(),
        state: "preview-only".to_string(),
        registry_scope: "baigong-taiheng-governance".to_string(),
        entries: vec![
            entry(
                "akshare_cn_stock",
                "AkShare A-share data source",
                "financial_market_data",
                "module_specific",
                "baigong.cn_alphaforge",
                "default_proxy",
                "module_local",
                "example-disabled",
                "python-adapter-preview",
                "manual-observation-only",
                "review-before-enable",
            ),
            entry(
                "github_trending_projects",
                "GitHub Trending project radar",
                "project_radar",
                "shared_readonly",
                "baigong.project_radar",
                "public_web_readonly",
                "quarantine_observation",
                "radar-disabled",
                "http-readonly-preview",
                "read-only-quarantined-observations",
                "no-auto-fetch",
            ),
            entry(
                "ossinsight_trending_projects",
                "OSSInsight project radar",
                "project_radar",
                "shared_readonly",
                "baigong.project_radar",
                "public_web_readonly",
                "quarantine_observation",
                "radar-disabled",
                "http-readonly-preview",
                "read-only-quarantined-observations",
                "no-auto-fetch",
            ),
            entry(
                "huggingface_trending_models",
                "Hugging Face Trending model radar",
                "project_radar",
                "shared_readonly",
                "baigong.project_radar",
                "public_web_readonly",
                "quarantine_observation",
                "radar-disabled",
                "http-readonly-preview",
                "read-only-quarantined-observations",
                "no-auto-fetch",
            ),
        ]
        .into_iter()
        .map(|mut entry| {
            if approvals
                .iter()
                .any(|approval| approval.source_id == entry.source_id && approval.enabled)
            {
                entry.enabled = true;
                entry.status = "enabled-reviewed".to_string();
            }
            let health = latest_health_projection(&entry.source_id);
            entry.last_health_check_at_ms = health.0;
            entry.last_health_state = health.1;
            entry.last_health_observation_id = health.2;
            entry
        })
        .collect(),
        gates: vec![
            "lightweight-registration-only".to_string(),
            "no-heavy-data-processing".to_string(),
            "credential-guard-required-before-auth".to_string(),
            "network-profile-reference-only".to_string(),
            "health-check-on-demand-or-low-frequency".to_string(),
            "module-local-storage-by-default".to_string(),
            "taiheng-permission-review-before-enable".to_string(),
        ],
        denied_actions: vec![
            "store-credentials-in-registry".to_string(),
            "background-heavy-polling".to_string(),
            "hardcode-domain-specific-pipeline-in-core".to_string(),
            "bypass-baigong-module-boundary".to_string(),
            "auto-fetch-live-data".to_string(),
        ],
    }
}

pub fn approvals() -> Vec<SourceRegistryApproval> {
    store::read_json_records(&store::source_registry_approval_path()).unwrap_or_default()
}

pub fn review_enable_source(
    source_id: String,
    enabled: bool,
) -> Result<SourceEnablementReviewReceipt, store::StoreError> {
    let source_id = source_id.trim().to_string();
    if !preview()
        .entries
        .iter()
        .any(|entry| entry.source_id == source_id)
    {
        return Err(store::StoreError::NotFound(source_id));
    }
    let previous_approvals = approvals();
    let saga = store::begin_saga(
        "source-registry-enablement-review".to_string(),
        source_id.clone(),
        serde_json::json!({ "enabled": enabled }),
    )?;
    let snapshot = match store::create_snapshot(
        "source-registry-approval".to_string(),
        source_id.clone(),
        "before-source-enablement-review".to_string(),
        serde_json::json!({
            "approvals": previous_approvals,
            "saga_id": saga.id,
        }),
    ) {
        Ok(snapshot) => snapshot,
        Err(error) => return fail_saga(&saga, error),
    };
    let mut records = previous_approvals.clone();
    records.retain(|approval| approval.source_id != source_id);
    let approval = SourceRegistryApproval {
        source_id: source_id.clone(),
        enabled,
        reviewed_at_ms: store::now_millis(),
        review_state: if enabled {
            "enabled-reviewed"
        } else {
            "disabled-reviewed"
        }
        .to_string(),
    };
    records.push(approval.clone());
    let audit_event = finalize_enablement_review(
        || write_approvals(&records),
        || {
            store::append_audit_event(store::NewAuditEvent {
                actor: "local-user".to_string(),
                action: "review-source-enablement".to_string(),
                target_type: "source-registry".to_string(),
                target_id: source_id.clone(),
                risk_level: "high".to_string(),
                decision: approval.review_state.clone(),
                input: serde_json::json!({
                    "enabled": enabled,
                    "snapshot_id": snapshot.id,
                    "saga_id": saga.id,
                }),
                result_summary: serde_json::json!({
                    "reviewed_at_ms": approval.reviewed_at_ms,
                    "network_started": false,
                    "rollback_snapshot_id": snapshot.id,
                }),
                error: None,
            })
        },
        || compensate_enablement_review(&saga, &previous_approvals),
    )?;
    let saga = match store::transition_saga(saga.id.clone(), "committed".to_string()) {
        Ok(saga) => saga,
        Err(error) => {
            return finish_compensation(
                error,
                compensate_enablement_review(&saga, &previous_approvals),
            )
        }
    };
    Ok(SourceEnablementReviewReceipt {
        approval,
        snapshot,
        audit_event,
        saga,
    })
}

fn write_approvals(records: &[SourceRegistryApproval]) -> Result<(), store::StoreError> {
    store::write_json_records(&store::source_registry_approval_path(), records)
}

fn fail_saga<T>(
    saga: &store::SagaTransaction,
    error: store::StoreError,
) -> Result<T, store::StoreError> {
    let _ = store::transition_saga(saga.id.clone(), "failed".to_string());
    Err(error)
}

fn finalize_enablement_review<T, FWrite, FAudit, FCompensate>(
    write_approval: FWrite,
    write_audit: FAudit,
    compensate: FCompensate,
) -> Result<T, store::StoreError>
where
    FWrite: FnOnce() -> Result<(), store::StoreError>,
    FAudit: FnOnce() -> Result<T, store::StoreError>,
    FCompensate: FnOnce() -> Result<(), store::StoreError>,
{
    if let Err(error) = write_approval() {
        return finish_compensation(error, compensate());
    }
    match write_audit() {
        Ok(value) => Ok(value),
        Err(error) => finish_compensation(error, compensate()),
    }
}

fn finish_compensation<T>(
    original_error: store::StoreError,
    compensation: Result<(), store::StoreError>,
) -> Result<T, store::StoreError> {
    match compensation {
        Ok(()) => Err(original_error),
        Err(compensation_error) => Err(store::StoreError::InvalidInput(format!(
            "source enablement review failed: {original_error}; compensation failed: {compensation_error}"
        ))),
    }
}

fn compensate_enablement_review(
    saga: &store::SagaTransaction,
    previous_approvals: &[SourceRegistryApproval],
) -> Result<(), store::StoreError> {
    let _ = store::transition_saga(saga.id.clone(), "compensating".to_string());
    let result = write_approvals(previous_approvals);
    if result.is_ok() {
        let _ = store::transition_saga(saga.id.clone(), "compensated".to_string());
        return Ok(());
    }
    let _ = store::transition_saga(saga.id.clone(), "failed".to_string());
    result
}

pub fn preflight_enable_source(source_id: String) -> SourceEnablementPreflight {
    let registry = preview();
    let selected = registry
        .entries
        .iter()
        .find(|entry| entry.source_id == source_id)
        .unwrap_or(&registry.entries[0]);

    SourceEnablementPreflight {
        generated_at_ms: store::now_millis(),
        state: "source-enablement-review-required".to_string(),
        source_id: selected.source_id.clone(),
        source_type: selected.source_type.clone(),
        owner_module: selected.owner_module.clone(),
        current_status: selected.status.clone(),
        enabled: selected.enabled,
        network_started: false,
        credential_read_started: false,
        fetch_started: false,
        storage_write_started: false,
        shared_config_write_started: false,
        requires_owner_review: true,
        requires_auth_policy_review: true,
        requires_network_profile_review: true,
        requires_rate_limit_review: true,
        requires_storage_policy_review: true,
        requires_verification_plan: true,
        requires_quarantine_plan: true,
        requires_injection_defense: true,
        gates: vec![
            "owner-module-review-required".to_string(),
            "auth-policy-review-required".to_string(),
            "network-profile-review-required".to_string(),
            "rate-limit-review-required".to_string(),
            "storage-policy-review-required".to_string(),
            "verification-plan-required-before-source-enable".to_string(),
            "quarantine-plan-required-before-source-enable".to_string(),
            "anti-injection-defense-required-before-source-enable".to_string(),
            "human-review-before-enable".to_string(),
            "no-auto-fetch-before-enable".to_string(),
        ],
        blockers: vec![
            "source-enablement-not-approved".to_string(),
            "verification-plan-not-attached".to_string(),
            "quarantine-plan-not-attached".to_string(),
            "rate-limit-not-reviewed".to_string(),
            "credential-policy-not-reviewed".to_string(),
        ],
        denied_actions: vec![
            "enable-source-without-review".to_string(),
            "fetch-live-source-before-enable".to_string(),
            "store-source-output-without-quarantine".to_string(),
            "persist-credentials-in-registry".to_string(),
            "skip-source-verification".to_string(),
            "shared-config-write-without-review".to_string(),
        ],
    }
}

pub fn preflight_health_check(request: SourceHealthCheckRequest) -> SourceHealthCheckPreflight {
    let configured_url = configured_source_url(request.source_id.trim());
    preflight_health_check_with_configured_url(request, configured_url.as_deref())
}

fn preflight_health_check_with_configured_url(
    request: SourceHealthCheckRequest,
    configured_url: Option<&str>,
) -> SourceHealthCheckPreflight {
    let source_id = request.source_id.trim().to_string();
    let enabled = preview()
        .entries
        .iter()
        .any(|entry| entry.source_id == source_id && entry.enabled);
    let configured_url_present = configured_url.is_some_and(|url| !url.trim().is_empty());
    let mut blockers = Vec::new();
    if !enabled {
        blockers.push("source-not-enabled-by-taiheng-review".to_string());
    }
    if !configured_url_present {
        blockers.push("source-url-not-configured-for-registry-id".to_string());
    }
    if !request.approved {
        blockers.push("source-health-check-explicit-approval-required".to_string());
    }
    let ready = blockers.is_empty();
    SourceHealthCheckPreflight {
        generated_at_ms: store::now_millis(),
        state: if ready {
            "source-health-check-ready"
        } else {
            "source-health-check-blocked"
        }
        .to_string(),
        source_id,
        enabled,
        configured_url_present,
        explicit_approval: request.approved,
        network_started: false,
        ready,
        blockers,
        gates: vec![
            "registry-id-and-config-url-must-match".to_string(),
            "taiheng-enablement-review-required".to_string(),
            "explicit-health-check-approval-required".to_string(),
            "read-only-get-no-redirects-no-credentials".to_string(),
            "response-quarantined-before-use".to_string(),
        ],
    }
}

pub fn execute_health_check(
    request: SourceHealthCheckRequest,
) -> Result<SourceHealthCheckReceipt, store::StoreError> {
    let configured_url = configured_source_url(request.source_id.trim());
    execute_health_check_with_configured_url(request, configured_url)
}

fn execute_health_check_with_configured_url(
    request: SourceHealthCheckRequest,
    configured_url: Option<String>,
) -> Result<SourceHealthCheckReceipt, store::StoreError> {
    let preflight = preflight_health_check_with_configured_url(
        request.clone(),
        configured_url.as_deref(),
    );
    if !preflight.ready {
        return Err(store::StoreError::InvalidInput(format!(
            "source health check blocked: {}",
            preflight.blockers.join(", ")
        )));
    }
    let source_id = preflight.source_id;
    let url = configured_url.ok_or_else(|| {
        store::StoreError::InvalidInput(
            "configured source URL disappeared after preflight".to_string(),
        )
    })?;
    let saga = store::begin_saga(
        "source-registry-health-check".to_string(),
        source_id.clone(),
        serde_json::json!({ "source_id": source_id, "network_intent": "read-only-get" }),
    )?;
    let snapshot = match store::create_snapshot(
        "source-registry-health".to_string(),
        source_id.clone(),
        "before-readonly-health-check".to_string(),
        serde_json::json!({ "saga_id": saga.id, "configured_url": url }),
    ) {
        Ok(value) => value,
        Err(error) => return fail_saga(&saga, error),
    };
    let fetched = match http_source::fetch_configured_source_as(url, source_id.clone()) {
        Ok(value) => value,
        Err(error) => {
            let _ = store::transition_saga(saga.id.clone(), "failed".to_string());
            let _ = store::append_audit_event(store::NewAuditEvent {
                actor: "local-user".to_string(),
                action: "execute-source-health-check".to_string(),
                target_type: "source-registry".to_string(),
                target_id: source_id.clone(),
                risk_level: "medium".to_string(),
                decision: "network-check-failed".to_string(),
                input: serde_json::json!({ "snapshot_id": snapshot.id, "saga_id": saga.id }),
                result_summary: serde_json::json!({ "network_started": true, "observation_written": false }),
                error: Some(error.clone()),
            });
            return Err(store::StoreError::InvalidInput(error));
        }
    };
    let confidence = fetched.confidence.score;
    let conflict = fetched.confidence.conflict_level.clone();
    let created = match store::append_source_observations(vec![store::NewSourceObservationRecord {
        query: "source-registry-health-check".to_string(),
        source_id: source_id.clone(),
        source_uri: fetched.observation.source_uri.clone(),
        observed_at_ms: fetched.observation.captured_at_ms,
        freshness: fetched.observation.freshness.clone(),
        field_coverage: fetched.observation.field_coverage,
        normalized_claim: fetched.observation.normalized_claim.clone(),
        quarantine_state: "quarantined-health-observation".to_string(),
        fallback_used: false,
        confidence_score: confidence,
        conflict_level: conflict,
        admission_state: "health-check-only-not-admissible".to_string(),
    }]) {
        Ok(value) => value,
        Err(error) => return fail_saga(&saga, error),
    };
    let observation = created[0].clone();
    let audit_event = match store::append_audit_event(store::NewAuditEvent {
        actor: "local-user".to_string(),
        action: "execute-source-health-check".to_string(),
        target_type: "source-registry".to_string(),
        target_id: source_id.clone(),
        risk_level: "medium".to_string(),
        decision: "healthy-quarantined".to_string(),
        input: serde_json::json!({ "snapshot_id": snapshot.id, "saga_id": saga.id }),
        result_summary: serde_json::json!({
            "network_started": true,
            "status_code": fetched.status_code,
            "response_bytes": fetched.response_bytes,
            "observation_id": observation.id,
        }),
        error: None,
    }) {
        Ok(value) => value,
        Err(error) => {
            let _ = store::remove_source_observations(vec![observation.id.clone()]);
            return fail_saga(&saga, error);
        }
    };
    let saga = finalize_health_check_commit(
        || store::transition_saga(saga.id.clone(), "committed".to_string()),
        || store::remove_source_observations(vec![observation.id.clone()]),
    )?;
    Ok(SourceHealthCheckReceipt {
        state: "source-health-check-recorded".to_string(),
        source_id,
        status_code: fetched.status_code,
        response_bytes: fetched.response_bytes,
        observation,
        snapshot,
        audit_event,
        saga,
    })
}

fn finalize_health_check_commit<T, FCommit, FCompensate>(
    commit: FCommit,
    compensate: FCompensate,
) -> Result<T, store::StoreError>
where
    FCommit: FnOnce() -> Result<T, store::StoreError>,
    FCompensate: FnOnce() -> Result<(), store::StoreError>,
{
    match commit() {
        Ok(value) => Ok(value),
        Err(error) => finish_health_check_compensation(error, compensate()),
    }
}

fn finish_health_check_compensation<T>(
    original_error: store::StoreError,
    compensation: Result<(), store::StoreError>,
) -> Result<T, store::StoreError> {
    match compensation {
        Ok(()) => Err(original_error),
        Err(compensation_error) => Err(store::StoreError::InvalidInput(format!(
            "source health check failed: {original_error}; observation compensation failed: {compensation_error}"
        ))),
    }
}

fn configured_source_url(source_id: &str) -> Option<String> {
    let runtime = config::read_runtime_config();
    runtime
        .aggregation_source_ids()
        .into_iter()
        .zip(runtime.aggregation_source_urls())
        .find_map(|(id, url)| (id == source_id).then_some(url))
}

fn entry(
    source_id: &str,
    name: &str,
    source_type: &str,
    scope: &str,
    owner_module: &str,
    network_profile: &str,
    storage_policy: &str,
    status: &str,
    adapter_kind: &str,
    observation_policy: &str,
    freshness_policy: &str,
) -> SourceRegistryEntry {
    SourceRegistryEntry {
        source_id: source_id.to_string(),
        name: name.to_string(),
        source_type: source_type.to_string(),
        scope: scope.to_string(),
        owner_module: owner_module.to_string(),
        enabled: false,
        auth_required: false,
        network_profile: network_profile.to_string(),
        rate_limit: "normal".to_string(),
        storage_policy: storage_policy.to_string(),
        shared_config_allowed: true,
        status: status.to_string(),
        adapter_kind: adapter_kind.to_string(),
        health_check_policy: "on-demand-or-low-frequency".to_string(),
        credential_policy: "no-credentials-in-registry".to_string(),
        observation_policy: observation_policy.to_string(),
        freshness_policy: freshness_policy.to_string(),
        verification_policy: "cross-check-before-use".to_string(),
        quarantine_policy: "quarantine-before-zhishu-admission".to_string(),
        risk_level: "review-before-enable".to_string(),
        last_health_check_at_ms: None,
        last_health_state: "not-checked".to_string(),
        last_health_observation_id: None,
    }
}

fn latest_health_projection(source_id: &str) -> (Option<u128>, String, Option<String>) {
    let observation = store::list_source_observations(Some(source_id.to_string()), 50)
        .ok()
        .and_then(|records| {
            records.into_iter().find(|record| {
                record.admission_state == "health-check-only-not-admissible"
                    && record.quarantine_state == "quarantined-health-observation"
            })
        });
    match observation {
        Some(record) => (
            Some(record.observed_at_ms),
            "healthy-quarantined".to_string(),
            Some(record.id),
        ),
        None => (None, "not-checked".to_string(), None),
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;
    use std::fs;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::path::PathBuf;
    use std::thread;

    use super::{
        execute_health_check, execute_health_check_with_configured_url,
        finalize_enablement_review, finalize_health_check_commit, preflight_enable_source,
        preflight_health_check, preflight_health_check_with_configured_url, preview,
        review_enable_source, SourceHealthCheckRequest,
    };
    use crate::store;

    #[test]
    fn registry_preview_is_governance_only() {
        let preview = preview();

        assert_eq!(preview.state, "preview-only");
        assert!(preview
            .gates
            .contains(&"lightweight-registration-only".to_string()));
        assert!(preview
            .denied_actions
            .contains(&"store-credentials-in-registry".to_string()));
        assert_eq!(preview.entries[0].enabled, false);
        assert!(preview
            .entries
            .iter()
            .any(|entry| entry.source_id == "github_trending_projects"
                && entry.storage_policy == "quarantine_observation"));
    }

    #[test]
    fn registry_entries_have_required_contract_policies() {
        let preview = preview();

        assert!(!preview.entries.is_empty());
        assert!(preview.entries.iter().all(|entry| {
            !entry.source_id.is_empty()
                && !entry.owner_module.is_empty()
                && !entry.network_profile.is_empty()
                && !entry.rate_limit.is_empty()
                && !entry.storage_policy.is_empty()
                && !entry.credential_policy.is_empty()
                && !entry.freshness_policy.is_empty()
                && !entry.verification_policy.is_empty()
                && !entry.quarantine_policy.is_empty()
                && !entry.enabled
                && !entry.auth_required
        }));
        assert!(preview
            .entries
            .iter()
            .all(|entry| entry.credential_policy == "no-credentials-in-registry"));
        assert!(preview
            .entries
            .iter()
            .all(|entry| entry.quarantine_policy.contains("quarantine-before")));
        assert!(preview.entries.iter().all(|entry| {
            entry.last_health_state == "not-checked"
                || (entry.last_health_state == "healthy-quarantined"
                    && entry.last_health_check_at_ms.is_some()
                    && entry.last_health_observation_id.is_some())
        }));
    }

    #[test]
    fn source_registry_contracts_are_unique_disabled_and_review_gated() {
        let preview = preview();
        let mut source_ids = HashSet::new();

        assert_eq!(preview.registry_scope, "baigong-taiheng-governance");
        assert!(preview.entries.len() >= 4);

        for entry in &preview.entries {
            assert!(
                source_ids.insert(entry.source_id.as_str()),
                "duplicate source_id {}",
                entry.source_id
            );
            assert!(
                entry
                    .source_id
                    .chars()
                    .all(|character| character.is_ascii_lowercase()
                        || character.is_ascii_digit()
                        || character == '_'),
                "source_id must be stable snake_case: {}",
                entry.source_id
            );
            assert!(
                entry.owner_module.starts_with("baigong."),
                "source {} must be owned by a Baigong module",
                entry.source_id
            );
            assert!(
                !entry.enabled,
                "source {} must be disabled by default",
                entry.source_id
            );
            assert!(
                !entry.auth_required,
                "source {} must not require auth while credentials are not implemented",
                entry.source_id
            );
            assert_eq!(entry.credential_policy, "no-credentials-in-registry");
            assert_eq!(entry.verification_policy, "cross-check-before-use");
            assert_eq!(entry.risk_level, "review-before-enable");
            assert_eq!(entry.health_check_policy, "on-demand-or-low-frequency");
            assert_eq!(entry.rate_limit, "normal");
            assert!(
                entry.status.contains("disabled"),
                "source {} must remain disabled in the public baseline",
                entry.source_id
            );
        }
    }

    #[test]
    fn project_radar_sources_are_quarantined_readonly_observations() {
        let preview = preview();
        let project_radar_entries: Vec<_> = preview
            .entries
            .iter()
            .filter(|entry| entry.source_type == "project_radar")
            .collect();

        assert_eq!(project_radar_entries.len(), 3);
        for entry in project_radar_entries {
            assert_eq!(entry.scope, "shared_readonly");
            assert_eq!(entry.network_profile, "public_web_readonly");
            assert_eq!(entry.storage_policy, "quarantine_observation");
            assert_eq!(entry.adapter_kind, "http-readonly-preview");
            assert_eq!(
                entry.observation_policy,
                "read-only-quarantined-observations"
            );
            assert_eq!(entry.freshness_policy, "no-auto-fetch");
            assert_eq!(
                entry.quarantine_policy,
                "quarantine-before-zhishu-admission"
            );
        }
    }

    #[test]
    fn source_enablement_preflight_never_fetches_or_reads_credentials() {
        let preflight = preflight_enable_source("akshare_cn_stock".to_string());

        assert_eq!(preflight.state, "source-enablement-review-required");
        assert_eq!(preflight.source_id, "akshare_cn_stock");
        assert!(!preflight.enabled);
        assert!(!preflight.network_started);
        assert!(!preflight.credential_read_started);
        assert!(!preflight.fetch_started);
        assert!(!preflight.storage_write_started);
        assert!(!preflight.shared_config_write_started);
        assert!(preflight.requires_owner_review);
        assert!(preflight.requires_auth_policy_review);
        assert!(preflight.requires_network_profile_review);
        assert!(preflight.requires_rate_limit_review);
        assert!(preflight.requires_storage_policy_review);
        assert!(preflight.requires_verification_plan);
        assert!(preflight.requires_quarantine_plan);
        assert!(preflight.requires_injection_defense);
        assert!(preflight
            .gates
            .contains(&"human-review-before-enable".to_string()));
        assert!(preflight
            .blockers
            .contains(&"source-enablement-not-approved".to_string()));
        assert!(preflight
            .denied_actions
            .contains(&"fetch-live-source-before-enable".to_string()));
        assert!(preflight
            .denied_actions
            .contains(&"persist-credentials-in-registry".to_string()));
    }

    #[test]
    fn health_check_preflight_blocks_unknown_source_before_network() {
        let preflight = preflight_health_check(SourceHealthCheckRequest {
            source_id: "unknown_source_for_test".to_string(),
            approved: true,
        });

        assert_eq!(preflight.state, "source-health-check-blocked");
        assert!(!preflight.ready);
        assert!(!preflight.network_started);
        assert!(preflight
            .blockers
            .contains(&"source-not-enabled-by-taiheng-review".to_string()));
        assert!(preflight
            .blockers
            .contains(&"source-url-not-configured-for-registry-id".to_string()));
    }

    #[test]
    fn blocked_health_check_execution_never_starts_http() {
        let result = execute_health_check(SourceHealthCheckRequest {
            source_id: "unknown_source_for_execution_test".to_string(),
            approved: true,
        });

        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("blocked"));
    }

    #[test]
    fn approved_loopback_health_check_records_quarantined_evidence() {
        let root = temp_data_root("approved-loopback-health-check");
        fs::create_dir_all(&root).unwrap();
        let result = store::with_test_data_root(root.clone(), || {
            let source_id = "github_trending_projects".to_string();
            let review = review_enable_source(source_id.clone(), true).unwrap();
            assert_eq!(review.approval.review_state, "enabled-reviewed");

            let (url, server) = serve_health_check_source(&source_id);
            let request = SourceHealthCheckRequest {
                source_id: source_id.clone(),
                approved: true,
            };
            let preflight = preflight_health_check_with_configured_url(
                request.clone(),
                Some(url.as_str()),
            );
            assert!(preflight.ready);
            assert!(preflight.configured_url_present);
            assert!(preflight.enabled);

            let receipt = execute_health_check_with_configured_url(request, Some(url.clone()))
                .unwrap();
            server.join().unwrap();

            assert_eq!(receipt.state, "source-health-check-recorded");
            assert_eq!(receipt.source_id, source_id);
            assert_eq!(receipt.status_code, 200);
            assert_eq!(receipt.observation.source_uri, url);
            assert_eq!(
                receipt.observation.quarantine_state,
                "quarantined-health-observation"
            );
            assert_eq!(
                receipt.observation.admission_state,
                "health-check-only-not-admissible"
            );
            assert_eq!(receipt.audit_event.decision, "healthy-quarantined");
            assert_eq!(receipt.saga.state, "committed");

            let observations = store::list_source_observations(Some(source_id.clone()), 10).unwrap();
            assert_eq!(observations.len(), 1);
            assert_eq!(observations[0].id, receipt.observation.id);
            let audit_events = store::list_audit_events(
                Some("source-registry".to_string()),
                Some(source_id.clone()),
                10,
            )
            .unwrap();
            assert!(audit_events
                .iter()
                .any(|event| event.id == receipt.audit_event.id));
            assert_eq!(
                store::get_saga(receipt.saga.id.clone()).unwrap().state,
                "committed"
            );
        });
        let _ = fs::remove_dir_all(root);
        result
    }

    #[test]
    fn enablement_review_compensates_approval_write_failure_before_audit() {
        let events = std::cell::RefCell::new(Vec::new());
        let result = finalize_enablement_review::<(), _, _, _>(
            || {
                events.borrow_mut().push("approval");
                Err(store::StoreError::InvalidInput(
                    "approval failed".to_string(),
                ))
            },
            || {
                events.borrow_mut().push("audit");
                Ok(())
            },
            || {
                events.borrow_mut().push("compensate");
                Ok(())
            },
        );

        assert!(result.is_err());
        assert_eq!(events.into_inner(), vec!["approval", "compensate"]);
    }

    #[test]
    fn enablement_review_compensates_audit_failure_after_approval_write() {
        let events = std::cell::RefCell::new(Vec::new());
        let result = finalize_enablement_review::<(), _, _, _>(
            || {
                events.borrow_mut().push("approval");
                Ok(())
            },
            || {
                events.borrow_mut().push("audit");
                Err(store::StoreError::InvalidInput("audit failed".to_string()))
            },
            || {
                events.borrow_mut().push("compensate");
                Ok(())
            },
        );

        assert!(result.is_err());
        assert_eq!(events.into_inner(), vec!["approval", "audit", "compensate"]);
    }

    #[test]
    fn health_check_commit_failure_compensates_quarantined_observation() {
        let events = std::cell::RefCell::new(Vec::new());
        let result = finalize_health_check_commit::<(), _, _>(
            || {
                events.borrow_mut().push("commit");
                Err(store::StoreError::InvalidInput("saga commit failed".to_string()))
            },
            || {
                events.borrow_mut().push("remove-observation");
                Ok(())
            },
        );

        assert!(result.is_err());
        assert_eq!(events.into_inner(), vec!["commit", "remove-observation"]);
    }

    fn temp_data_root(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("synapse-source-registry-{name}-{}", store::now_millis()))
    }

    fn serve_health_check_source(source_id: &str) -> (String, thread::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let source_id = source_id.to_string();
        let handle = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0_u8; 1024];
            let _ = stream.read(&mut request);
            let body = format!(
                r#"{{"source_id":"{source_id}","normalized_claim":"Loopback health response","freshness":"fixture-current","field_coverage":0.9}}"#
            );
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            )
            .unwrap();
        });
        (format!("http://{address}/health"), handle)
    }
}
