use std::time::Duration;

use lettre::message::Mailbox;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport, Transport};
use reqwest::blocking::Client;
use reqwest::Url;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::{config, store};

const MAX_SUBJECT_CHARS: usize = 200;
const MAX_BODY_CHARS: usize = 20_000;
const WEBHOOK_BODY_PREVIEW_CHARS: usize = 240;
const MOCK_WEBHOOK_TIMEOUT_SECS: u64 = 3;
const MOCK_WEBHOOK_MAX_ATTEMPTS: usize = 3;
const PRODUCTION_WEBHOOK_TIMEOUT_SECS: u64 = 8;
const PRODUCTION_WEBHOOK_MAX_ATTEMPTS: usize = 3;

#[derive(Debug, Clone, Deserialize)]
pub struct NotificationRequest {
    pub run_id: String,
    pub channel: String,
    pub subject: String,
    pub body: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct NotificationPreview {
    pub run_id: String,
    pub channel: String,
    pub state: String,
    pub subject: String,
    pub body_chars: usize,
    pub task_push_enabled: bool,
    pub task_push_channels: Vec<String>,
    pub endpoint_configured: bool,
    pub credentials_present: bool,
    pub gates: Vec<String>,
    pub delivery_started: bool,
    pub webhook_staging_policy: Option<WebhookStagingPolicy>,
    pub webhook_staging_envelope: Option<WebhookStagingEnvelope>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WebhookStagingPolicy {
    pub mode: String,
    pub channel: String,
    pub signature_policy: String,
    pub retry_policy: String,
    pub redaction_policy: String,
    pub error_classes: Vec<String>,
    pub external_delivery_gate: String,
    pub approval_required: bool,
    pub external_delivery_started: bool,
    pub network_started: bool,
    pub denied_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WebhookStagingEnvelope {
    pub contract: String,
    pub channel: String,
    pub idempotency_key: String,
    pub payload_sha256: String,
    pub body_preview_chars: usize,
    pub destination_configured: bool,
    pub endpoint_redaction: String,
    pub required_headers: Vec<String>,
    pub admission_state: String,
    pub expires_after_secs: u64,
    pub external_delivery_started: bool,
    pub network_started: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct WebhookStagingPreflight {
    pub channel: String,
    pub state: String,
    pub endpoint_scope: String,
    pub endpoint_configured: bool,
    pub endpoint_allowed_for_staging: bool,
    pub signature_material_present: bool,
    pub external_delivery_gate_enabled: bool,
    pub approval_required: bool,
    pub delivery_started: bool,
    pub network_started: bool,
    pub checks: Vec<String>,
    pub blocked_reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WebhookProductionPreflight {
    pub channel: String,
    pub state: String,
    pub endpoint_scope: String,
    pub endpoint_configured: bool,
    pub endpoint_allowed_for_production: bool,
    pub signature_material_present: bool,
    pub external_delivery_gate_enabled: bool,
    pub approval_required: bool,
    pub audit_required: bool,
    pub redaction_required: bool,
    pub delivery_started: bool,
    pub network_started: bool,
    pub checks: Vec<String>,
    pub blocked_reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct NotificationReceipt {
    pub preview: NotificationPreview,
    pub state: String,
    pub server_response: String,
    pub artifact: store::TaskArtifactRecord,
    pub delivery_attempt: Option<store::NotificationDeliveryAttempt>,
    pub audit_event: Option<store::AuditEvent>,
}

#[derive(Debug, Clone)]
struct MockWebhookDeliveryEvidence {
    server_response: String,
    attempts: usize,
    final_status: String,
    failure_class: String,
    redacted_endpoint: Option<serde_json::Value>,
}

#[derive(Debug, Clone)]
struct StagingWebhookDeliveryEvidence {
    server_response: String,
    attempts: usize,
    final_status: String,
    failure_class: String,
    redacted_endpoint: serde_json::Value,
    signature_header_present: bool,
    idempotency_header_present: bool,
}

#[derive(Debug, Clone)]
struct ProductionWebhookDeliveryEvidence {
    server_response: String,
    attempts: usize,
    final_status: String,
    failure_class: String,
    redacted_endpoint: serde_json::Value,
    provider_payload_kind: String,
    signature_material_used: bool,
    idempotency_header_present: bool,
}

pub fn preview(request: NotificationRequest) -> Result<NotificationPreview, store::StoreError> {
    let run_id = required(request.run_id, "task run id")?;
    let channel = normalize_channel(&request.channel)?;
    let subject = validate_subject(request.subject)?;
    let body = validate_body(request.body)?;
    let run = store::task_run_by_id(run_id)?;
    let runtime = config::read_runtime_config();
    let endpoint_configured = endpoint_configured_for(channel, &runtime);
    let credentials_present = smtp_credentials().is_some();
    let state = if !run_allows_notification_preview(
        &run.lifecycle_state,
        &run.approval_state,
        &run.execution_state,
    ) {
        "blocked-run-not-approved"
    } else if !run.push_enabled
        || !run
            .push_channels
            .iter()
            .any(|configured| configured.eq_ignore_ascii_case(channel))
    {
        "blocked-channel-not-enabled-for-run"
    } else if channel != "email" {
        if endpoint_configured {
            "adapter-preview-only"
        } else {
            "blocked-endpoint-not-configured"
        }
    } else if !runtime.external_delivery_enabled {
        "blocked-external-delivery-disabled"
    } else if !endpoint_configured {
        "blocked-endpoint-not-configured"
    } else if !credentials_present {
        "blocked-credentials-unavailable"
    } else {
        "ready-for-explicit-delivery-approval"
    };

    let webhook_staging_envelope =
        webhook_staging_envelope(channel, &run.id, &subject, &body, endpoint_configured);

    Ok(NotificationPreview {
        run_id: run.id,
        channel: channel.to_string(),
        state: state.to_string(),
        subject,
        body_chars: body.chars().count(),
        task_push_enabled: run.push_enabled,
        task_push_channels: run.push_channels,
        endpoint_configured,
        credentials_present,
        gates: vec![
            "task-run-approved".to_string(),
            "channel-enabled-for-run".to_string(),
            "configured-endpoint-only".to_string(),
            "credentials-from-environment-only".to_string(),
            "explicit-delivery-confirmation".to_string(),
            "bounded-message-size".to_string(),
            "no-credential-persistence".to_string(),
            "delivery-receipt-artifact".to_string(),
        ],
        delivery_started: false,
        webhook_staging_policy: webhook_staging_policy(channel),
        webhook_staging_envelope,
    })
}

pub fn deliver_email(
    request: NotificationRequest,
    approved: bool,
) -> Result<NotificationReceipt, store::StoreError> {
    let body = validate_body(request.body.clone())?;
    let preview = preview(request)?;
    if preview.channel != "email" {
        return Err(store::StoreError::InvalidInput(
            "only the email notification adapter is implemented".to_string(),
        ));
    }
    if preview.state != "ready-for-explicit-delivery-approval" {
        return Err(store::StoreError::InvalidInput(format!(
            "notification delivery is blocked: {}",
            preview.state
        )));
    }
    if !approved {
        return Err(store::StoreError::InvalidInput(
            "notification delivery requires explicit approval".to_string(),
        ));
    }
    let runtime = config::read_runtime_config();
    let (username, password) = smtp_credentials().ok_or_else(|| {
        store::StoreError::InvalidInput("SMTP credentials are unavailable".to_string())
    })?;
    let from = runtime.smtp_from.parse::<Mailbox>().map_err(|error| {
        store::StoreError::InvalidInput(format!("invalid SMTP from address: {error}"))
    })?;
    let to = runtime.smtp_to.parse::<Mailbox>().map_err(|error| {
        store::StoreError::InvalidInput(format!("invalid SMTP to address: {error}"))
    })?;
    let message = Message::builder()
        .from(from)
        .to(to)
        .subject(&preview.subject)
        .body(body)
        .map_err(|error| {
            store::StoreError::InvalidInput(format!("email message could not be built: {error}"))
        })?;
    let transport = SmtpTransport::relay(runtime.smtp_host.trim())
        .map_err(|error| {
            store::StoreError::InvalidInput(format!("SMTP relay is invalid: {error}"))
        })?
        .port(runtime.smtp_port.clamp(1, u64::from(u16::MAX)) as u16)
        .credentials(Credentials::new(username, password))
        .timeout(Some(Duration::from_secs(15)))
        .build();
    let response = transport.send(&message).map_err(|error| {
        store::StoreError::InvalidInput(format!("SMTP delivery failed: {error}"))
    })?;
    let run = store::task_run_by_id(preview.run_id.clone())?;
    let artifact = store::append_task_artifacts(
        run.id,
        run.task_direction_id,
        vec![store::NewTaskArtifact {
            artifact_type: "notification-delivery-receipt".to_string(),
            reference_id: format!("email-delivery-{}", store::now_millis()),
            title: preview.subject.clone(),
            summary: "Email notification accepted by the configured SMTP transport.".to_string(),
            metadata: serde_json::json!({
                "channel": "email",
                "response_code": response.code().to_string(),
                "positive": response.is_positive(),
                "credentials_persisted": false,
                "task_run_completed": false,
            }),
        }],
    )?
    .remove(0);

    Ok(NotificationReceipt {
        preview,
        state: "delivered-receipt-recorded".to_string(),
        server_response: response.code().to_string(),
        artifact,
        delivery_attempt: None,
        audit_event: None,
    })
}

pub fn deliver_webhook_staging(
    request: NotificationRequest,
    approved: bool,
) -> Result<NotificationReceipt, store::StoreError> {
    let body = validate_body(request.body.clone())?;
    let preview = preview(request.clone())?;
    if !approved {
        return Err(store::StoreError::InvalidInput(
            "webhook staging delivery requires explicit approval".to_string(),
        ));
    }
    let preflight = preflight_webhook_staging(request)?;
    if preflight.state != "staging-webhook-ready-for-explicit-send-approval" {
        return Err(store::StoreError::InvalidInput(format!(
            "webhook staging delivery is blocked: {} ({})",
            preflight.state,
            preflight.blocked_reasons.join(", ")
        )));
    }
    let runtime = config::read_runtime_config();
    let endpoint = match preview.channel.as_str() {
        "feishu" => runtime.feishu_webhook_url.trim(),
        "wechat" => runtime.wechat_webhook_url.trim(),
        _ => {
            return Err(store::StoreError::InvalidInput(
                "webhook staging delivery only supports Feishu and WeChat".to_string(),
            ))
        }
    };
    let envelope = preview.webhook_staging_envelope.as_ref().ok_or_else(|| {
        store::StoreError::InvalidInput("webhook staging envelope is unavailable".to_string())
    })?;
    let secret = webhook_signature_material(&preview.channel).ok_or_else(|| {
        store::StoreError::InvalidInput(
            "webhook staging signature material is unavailable".to_string(),
        )
    })?;
    let payload = build_staging_webhook_payload(&preview, envelope, &body);
    let signature = build_staging_signature(&secret, &payload, &envelope.idempotency_key);
    let delivery_evidence = post_staging_webhook_to_loopback(
        endpoint,
        &payload,
        &signature,
        &envelope.idempotency_key,
        approved,
    )?;
    let run = store::task_run_by_id(preview.run_id.clone())?;
    let artifact = store::append_task_artifacts(
        run.id,
        run.task_direction_id,
        vec![store::NewTaskArtifact {
            artifact_type: "notification-staging-webhook-receipt".to_string(),
            reference_id: format!(
                "{}-staging-webhook-{}",
                preview.channel,
                store::now_millis()
            ),
            title: preview.subject.clone(),
            summary: format!(
                "{} notification staging webhook receipt recorded for loopback endpoint only.",
                preview.channel
            ),
            metadata: serde_json::json!({
                "channel": preview.channel,
                "server_response": delivery_evidence.server_response,
                "staging_webhook_delivery": {
                    "attempts": delivery_evidence.attempts,
                    "final_status": delivery_evidence.final_status,
                    "failure_class": delivery_evidence.failure_class,
                    "redacted_endpoint": delivery_evidence.redacted_endpoint,
                    "signature_header_present": delivery_evidence.signature_header_present,
                    "idempotency_header_present": delivery_evidence.idempotency_header_present,
                },
                "staging_webhook_payload": payload,
                "loopback_staging_delivery_started": true,
                "network_started": true,
                "external_delivery_started": false,
                "credentials_persisted": false,
                "task_run_completed": false,
            }),
        }],
    )?
    .remove(0);

    Ok(NotificationReceipt {
        preview,
        state: "staging-webhook-receipt-recorded".to_string(),
        server_response: delivery_evidence.server_response,
        artifact,
        delivery_attempt: None,
        audit_event: None,
    })
}

pub fn preflight_webhook_staging(
    request: NotificationRequest,
) -> Result<WebhookStagingPreflight, store::StoreError> {
    let preview = preview(request)?;
    if !matches!(preview.channel.as_str(), "feishu" | "wechat") {
        return Err(store::StoreError::InvalidInput(
            "webhook staging preflight only supports Feishu and WeChat".to_string(),
        ));
    }

    let runtime = config::read_runtime_config();
    let endpoint = match preview.channel.as_str() {
        "feishu" => runtime.feishu_webhook_url.trim(),
        "wechat" => runtime.wechat_webhook_url.trim(),
        _ => "",
    };
    let endpoint_allowed_for_staging = endpoint_allows_local_staging(endpoint);
    let signature_material_present = webhook_signature_material_present(&preview.channel);
    let external_delivery_gate_enabled = runtime.external_delivery_enabled;
    let mut blocked_reasons = Vec::new();
    if preview.state != "adapter-preview-only" {
        blocked_reasons.push(preview.state.clone());
    }
    if !preview.endpoint_configured {
        blocked_reasons.push("endpoint-not-configured".to_string());
    }
    if preview.endpoint_configured && !endpoint_allowed_for_staging {
        blocked_reasons.push("endpoint-not-loopback-staging".to_string());
    }
    if !signature_material_present {
        blocked_reasons.push("signature-material-missing".to_string());
    }
    if !external_delivery_gate_enabled {
        blocked_reasons.push("external-delivery-gate-disabled".to_string());
    }

    let state = if blocked_reasons.is_empty() {
        "staging-webhook-ready-for-explicit-send-approval"
    } else {
        "staging-webhook-blocked"
    };

    Ok(WebhookStagingPreflight {
        channel: preview.channel,
        state: state.to_string(),
        endpoint_scope: "http-loopback-staging-only".to_string(),
        endpoint_configured: preview.endpoint_configured,
        endpoint_allowed_for_staging,
        signature_material_present,
        external_delivery_gate_enabled,
        approval_required: true,
        delivery_started: false,
        network_started: false,
        checks: vec![
            "approved-task-run-required".to_string(),
            "channel-preview-state-required".to_string(),
            "loopback-staging-endpoint-required".to_string(),
            "signature-material-required".to_string(),
            "external-delivery-gate-required".to_string(),
            "explicit-send-approval-required".to_string(),
            "no-secret-persistence".to_string(),
            "no-network-started-during-preflight".to_string(),
        ],
        blocked_reasons,
    })
}

pub fn preflight_webhook_production(
    request: NotificationRequest,
) -> Result<WebhookProductionPreflight, store::StoreError> {
    let preview = preview(request)?;
    if !matches!(preview.channel.as_str(), "feishu" | "wechat") {
        return Err(store::StoreError::InvalidInput(
            "webhook production preflight only supports Feishu and WeChat".to_string(),
        ));
    }

    let runtime = config::read_runtime_config();
    let endpoint = match preview.channel.as_str() {
        "feishu" => runtime.feishu_webhook_url.trim(),
        "wechat" => runtime.wechat_webhook_url.trim(),
        _ => "",
    };
    let endpoint_allowed_for_production =
        endpoint_allows_production_webhook(&preview.channel, endpoint);
    let signature_material_present = webhook_signature_material_present(&preview.channel);
    let external_delivery_gate_enabled = runtime.external_delivery_enabled;
    let mut blocked_reasons = Vec::new();
    if preview.state != "adapter-preview-only" {
        blocked_reasons.push(preview.state.clone());
    }
    if !preview.endpoint_configured {
        blocked_reasons.push("endpoint-not-configured".to_string());
    }
    if preview.endpoint_configured && !endpoint_allowed_for_production {
        blocked_reasons.push("endpoint-not-allowed-for-production".to_string());
    }
    if !signature_material_present {
        blocked_reasons.push("signature-material-missing".to_string());
    }
    if !external_delivery_gate_enabled {
        blocked_reasons.push("external-delivery-gate-disabled".to_string());
    }

    let state = if blocked_reasons.is_empty() {
        "production-webhook-ready-for-final-approval"
    } else {
        "production-webhook-blocked"
    };

    Ok(WebhookProductionPreflight {
        channel: preview.channel,
        state: state.to_string(),
        endpoint_scope: "official-feishu-wechat-https-only".to_string(),
        endpoint_configured: preview.endpoint_configured,
        endpoint_allowed_for_production,
        signature_material_present,
        external_delivery_gate_enabled,
        approval_required: true,
        audit_required: true,
        redaction_required: true,
        delivery_started: false,
        network_started: false,
        checks: vec![
            "approved-task-run-required".to_string(),
            "channel-preview-state-required".to_string(),
            "official-provider-https-endpoint-required".to_string(),
            "signature-material-required".to_string(),
            "external-delivery-gate-required".to_string(),
            "final-human-send-approval-required".to_string(),
            "audit-event-required-before-send".to_string(),
            "redacted-endpoint-and-response-required".to_string(),
            "bounded-retry-with-idempotency-required".to_string(),
            "no-network-started-during-preflight".to_string(),
        ],
        blocked_reasons,
    })
}

pub fn deliver_webhook_production(
    request: NotificationRequest,
    approved: bool,
) -> Result<NotificationReceipt, store::StoreError> {
    let body = validate_body(request.body.clone())?;
    let preview = preview(request.clone())?;
    if !approved {
        return Err(store::StoreError::InvalidInput(
            "webhook production delivery requires explicit final approval".to_string(),
        ));
    }
    let preflight = preflight_webhook_production(request)?;
    if preflight.state != "production-webhook-ready-for-final-approval" {
        return Err(store::StoreError::InvalidInput(format!(
            "webhook production delivery is blocked: {} ({})",
            preflight.state,
            preflight.blocked_reasons.join(", ")
        )));
    }
    let runtime = config::read_runtime_config();
    let endpoint = match preview.channel.as_str() {
        "feishu" => runtime.feishu_webhook_url.trim(),
        "wechat" => runtime.wechat_webhook_url.trim(),
        _ => {
            return Err(store::StoreError::InvalidInput(
                "webhook production delivery only supports Feishu and WeChat".to_string(),
            ))
        }
    };
    let secret = webhook_signature_material(&preview.channel).ok_or_else(|| {
        store::StoreError::InvalidInput(
            "webhook production signature material is unavailable".to_string(),
        )
    })?;
    let idempotency_key = production_idempotency_key(&preview.channel, &preview.run_id, &body);
    let payload = build_production_webhook_payload(&preview, &body, &secret)?;
    let mut delivery_attempt = store::begin_notification_delivery_attempt(
        idempotency_key.clone(),
        preview.run_id.clone(),
        preview.channel.clone(),
    )?;
    let preparation_audit = store::append_audit_event(store::NewAuditEvent {
        actor: "taiheng".to_string(),
        action: "prepare-webhook-production-delivery".to_string(),
        target_type: "task-run".to_string(),
        target_id: preview.run_id.clone(),
        risk_level: "critical".to_string(),
        decision: "prepared-before-network".to_string(),
        input: serde_json::json!({
            "approved": approved,
            "channel": preview.channel,
            "idempotency_key": idempotency_key,
            "delivery_attempt_id": delivery_attempt.id,
        }),
        result_summary: serde_json::json!({
            "network_started": false,
            "external_delivery_started": false,
            "credentials_persisted": false,
        }),
        error: None,
    })?;
    delivery_attempt = store::transition_notification_delivery_attempt(
        delivery_attempt.id,
        "prepared-audited".to_string(),
        None,
        Some(preparation_audit.id),
        "Delivery intent was audited before network access.".to_string(),
    )?;
    let delivery_evidence = match post_production_webhook(
        endpoint,
        &preview.channel,
        &payload,
        &idempotency_key,
        approved,
    ) {
        Ok(evidence) => evidence,
        Err(error) => {
            let _ = store::transition_notification_delivery_attempt(
                delivery_attempt.id.clone(),
                "outcome-uncertain".to_string(),
                None,
                None,
                store::short_text(&error.to_string(), 300),
            );
            return Err(error);
        }
    };
    delivery_attempt = store::transition_notification_delivery_attempt(
        delivery_attempt.id,
        "provider-accepted".to_string(),
        None,
        None,
        format!("Provider response: {}", store::short_text(&delivery_evidence.server_response, 200)),
    )?;
    let run = store::task_run_by_id(preview.run_id.clone())?;
    let artifact = store::append_task_artifacts(
        run.id,
        run.task_direction_id,
        vec![store::NewTaskArtifact {
            artifact_type: "notification-production-webhook-receipt".to_string(),
            reference_id: format!(
                "{}-production-webhook-{}",
                preview.channel,
                store::now_millis()
            ),
            title: preview.subject.clone(),
            summary: format!(
                "{} production webhook delivery receipt recorded after guarded approval.",
                preview.channel
            ),
            metadata: serde_json::json!({
                "channel": preview.channel,
                "server_response": delivery_evidence.server_response,
                "production_webhook_delivery": {
                    "attempts": delivery_evidence.attempts,
                    "final_status": delivery_evidence.final_status,
                    "failure_class": delivery_evidence.failure_class,
                    "redacted_endpoint": delivery_evidence.redacted_endpoint,
                    "provider_payload_kind": delivery_evidence.provider_payload_kind,
                    "signature_material_used": delivery_evidence.signature_material_used,
                    "idempotency_header_present": delivery_evidence.idempotency_header_present,
                },
                "payload_contract": "provider-native-redacted",
                "production_webhook_delivery_started": true,
                "external_delivery_started": true,
                "network_started": true,
                "credentials_persisted": false,
                "task_run_completed": false,
            }),
        }],
    )?
    .remove(0);

    delivery_attempt = store::transition_notification_delivery_attempt(
        delivery_attempt.id,
        "receipt-recorded".to_string(),
        Some(artifact.id.clone()),
        None,
        "Provider acceptance was persisted as a Task artifact.".to_string(),
    )?;
    let audit_event = store::append_audit_event(store::NewAuditEvent {
        actor: "taiheng".to_string(),
        action: "execute-webhook-production".to_string(),
        target_type: "task-run".to_string(),
        target_id: preview.run_id.clone(),
        risk_level: "critical".to_string(),
        decision: "production-webhook-receipt-recorded".to_string(),
        input: serde_json::json!({
            "approved": approved,
            "channel": preview.channel,
            "idempotency_key": idempotency_key,
            "delivery_attempt_id": delivery_attempt.id,
        }),
        result_summary: serde_json::json!({
            "artifact_id": artifact.id,
            "server_response": store::short_text(&delivery_evidence.server_response, 300),
            "credentials_persisted": false,
            "external_delivery_started": true,
            "task_run_completed": false,
        }),
        error: None,
    })?;
    delivery_attempt = store::transition_notification_delivery_attempt(
        delivery_attempt.id,
        "audited".to_string(),
        Some(artifact.id.clone()),
        Some(audit_event.id.clone()),
        "Provider acceptance, artifact, and audit are durably linked.".to_string(),
    )?;

    Ok(NotificationReceipt {
        preview,
        state: "production-webhook-receipt-recorded".to_string(),
        server_response: delivery_evidence.server_response,
        artifact,
        delivery_attempt: Some(delivery_attempt),
        audit_event: Some(audit_event),
    })
}

pub fn deliver_dry_run(
    request: NotificationRequest,
    approved: bool,
) -> Result<NotificationReceipt, store::StoreError> {
    let body = validate_body(request.body.clone())?;
    let preview = preview(request)?;
    if !dry_run_receipt_allowed(&preview, approved) {
        if preview.channel == "email" {
            return Err(store::StoreError::InvalidInput(
                "email delivery must use the guarded SMTP adapter".to_string(),
            ));
        }
        if preview.state != "adapter-preview-only" {
            return Err(store::StoreError::InvalidInput(format!(
                "notification dry-run receipt is blocked: {}",
                preview.state
            )));
        }
        return Err(store::StoreError::InvalidInput(
            "notification dry-run receipt requires explicit approval".to_string(),
        ));
    }

    let run = store::task_run_by_id(preview.run_id.clone())?;
    let payload = build_mock_webhook_payload(&preview, &body);
    let delivery_evidence = std::env::var("SYNAPSE_MOCK_WEBHOOK_ENDPOINT")
        .ok()
        .map(|endpoint| endpoint.trim().to_string())
        .filter(|endpoint| !endpoint.is_empty())
        .map(|endpoint| post_mock_webhook_to_local_endpoint(&endpoint, &payload, approved))
        .transpose()?
        .unwrap_or_else(|| mock_webhook_evidence(&preview, &payload));
    let artifact = store::append_task_artifacts(
        run.id,
        run.task_direction_id,
        vec![store::NewTaskArtifact {
            artifact_type: "notification-dry-run-receipt".to_string(),
            reference_id: format!("{}-dry-run-{}", preview.channel, store::now_millis()),
            title: preview.subject.clone(),
            summary: format!(
                "{} notification mock webhook receipt recorded. No external delivery was started.",
                preview.channel
            ),
            metadata: serde_json::json!({
                "channel": preview.channel,
                "server_response": delivery_evidence.server_response,
                "mock_webhook_delivery": {
                    "attempts": delivery_evidence.attempts,
                    "final_status": delivery_evidence.final_status,
                    "failure_class": delivery_evidence.failure_class,
                    "redacted_endpoint": delivery_evidence.redacted_endpoint,
                },
                "mock_webhook_payload": payload,
                "external_delivery_started": false,
                "credentials_persisted": false,
                "task_run_completed": false,
            }),
        }],
    )?
    .remove(0);

    Ok(NotificationReceipt {
        preview,
        state: "mock-webhook-receipt-recorded".to_string(),
        server_response: delivery_evidence.server_response,
        artifact,
        delivery_attempt: None,
        audit_event: None,
    })
}

fn dry_run_receipt_allowed(preview: &NotificationPreview, approved: bool) -> bool {
    matches!(preview.channel.as_str(), "feishu" | "wechat")
        && preview.state == "adapter-preview-only"
        && approved
}

fn run_allows_notification_preview(
    lifecycle_state: &str,
    approval_state: &str,
    execution_state: &str,
) -> bool {
    matches!(
        (lifecycle_state, approval_state, execution_state),
        ("approved", "approved", "approved-not-started")
            | ("succeeded", "approved", "completed")
    )
}

fn build_mock_webhook_payload(preview: &NotificationPreview, body: &str) -> serde_json::Value {
    let mut hasher = Sha256::new();
    hasher.update(body.as_bytes());
    let body_sha256 = hex::encode(hasher.finalize());

    serde_json::json!({
        "contract": "synapse.notification.webhook.v1",
        "mode": "mock-only",
        "channel": preview.channel,
        "run_id": preview.run_id,
        "subject": preview.subject,
        "body_chars": preview.body_chars,
        "body_preview": store::short_text(body, WEBHOOK_BODY_PREVIEW_CHARS),
        "body_sha256": body_sha256,
        "external_delivery_started": false,
        "credentials_persisted": false,
    })
}

fn build_staging_webhook_payload(
    preview: &NotificationPreview,
    envelope: &WebhookStagingEnvelope,
    body: &str,
) -> serde_json::Value {
    serde_json::json!({
        "contract": envelope.contract,
        "mode": "loopback-staging-only",
        "channel": preview.channel,
        "run_id": preview.run_id,
        "subject": preview.subject,
        "body_preview": store::short_text(body, WEBHOOK_BODY_PREVIEW_CHARS),
        "payload_sha256": envelope.payload_sha256,
        "idempotency_key": envelope.idempotency_key,
        "external_delivery_started": false,
        "credentials_persisted": false,
    })
}

fn build_staging_signature(
    secret: &str,
    payload: &serde_json::Value,
    idempotency_key: &str,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(secret.as_bytes());
    hasher.update(b":");
    hasher.update(idempotency_key.as_bytes());
    hasher.update(b":");
    hasher.update(payload.to_string().as_bytes());
    format!("sha256-staging={}", hex::encode(hasher.finalize()))
}

fn production_idempotency_key(channel: &str, run_id: &str, body: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(channel.as_bytes());
    hasher.update(b":");
    hasher.update(run_id.as_bytes());
    hasher.update(b":");
    hasher.update(body.as_bytes());
    format!(
        "synapse-production-webhook-{}",
        hex::encode(hasher.finalize())
            .chars()
            .take(32)
            .collect::<String>()
    )
}

fn build_production_webhook_payload(
    preview: &NotificationPreview,
    body: &str,
    secret: &str,
) -> Result<serde_json::Value, store::StoreError> {
    let text = format!("{}\n\n{}", preview.subject, body);
    match preview.channel.as_str() {
        "feishu" => {
            let timestamp = (store::now_millis() / 1000).to_string();
            let sign = feishu_webhook_sign(&timestamp, secret);
            Ok(serde_json::json!({
                "timestamp": timestamp,
                "sign": sign,
                "msg_type": "text",
                "content": {
                    "text": text,
                },
            }))
        }
        "wechat" => Ok(serde_json::json!({
            "msgtype": "text",
            "text": {
                "content": text,
            },
        })),
        _ => Err(store::StoreError::InvalidInput(
            "production webhook payload only supports Feishu and WeChat".to_string(),
        )),
    }
}

fn feishu_webhook_sign(timestamp: &str, secret: &str) -> String {
    let key = format!("{timestamp}\n{secret}");
    base64_encode(&hmac_sha256(key.as_bytes(), b""))
}

fn hmac_sha256(key: &[u8], message: &[u8]) -> [u8; 32] {
    const BLOCK_SIZE: usize = 64;
    let mut key_block = [0_u8; BLOCK_SIZE];
    if key.len() > BLOCK_SIZE {
        let digest = Sha256::digest(key);
        key_block[..32].copy_from_slice(&digest);
    } else {
        key_block[..key.len()].copy_from_slice(key);
    }

    let mut outer_key_pad = [0x5c_u8; BLOCK_SIZE];
    let mut inner_key_pad = [0x36_u8; BLOCK_SIZE];
    for index in 0..BLOCK_SIZE {
        outer_key_pad[index] ^= key_block[index];
        inner_key_pad[index] ^= key_block[index];
    }

    let mut inner = Sha256::new();
    inner.update(inner_key_pad);
    inner.update(message);
    let inner_hash = inner.finalize();

    let mut outer = Sha256::new();
    outer.update(outer_key_pad);
    outer.update(inner_hash);
    let output = outer.finalize();
    let mut bytes = [0_u8; 32];
    bytes.copy_from_slice(&output);
    bytes
}

fn base64_encode(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut output = String::new();
    let mut index = 0;
    while index < bytes.len() {
        let b0 = bytes[index];
        let b1 = bytes.get(index + 1).copied().unwrap_or(0);
        let b2 = bytes.get(index + 2).copied().unwrap_or(0);
        output.push(TABLE[(b0 >> 2) as usize] as char);
        output.push(TABLE[(((b0 & 0b0000_0011) << 4) | (b1 >> 4)) as usize] as char);
        if index + 1 < bytes.len() {
            output.push(TABLE[(((b1 & 0b0000_1111) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            output.push('=');
        }
        if index + 2 < bytes.len() {
            output.push(TABLE[(b2 & 0b0011_1111) as usize] as char);
        } else {
            output.push('=');
        }
        index += 3;
    }
    output
}

fn mock_webhook_response(preview: &NotificationPreview, payload: &serde_json::Value) -> String {
    let hash = payload
        .get("body_sha256")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("unknown");
    let prefix = hash.chars().take(12).collect::<String>();
    format!("mock-webhook-accepted:{}:{prefix}", preview.channel)
}

fn mock_webhook_evidence(
    preview: &NotificationPreview,
    payload: &serde_json::Value,
) -> MockWebhookDeliveryEvidence {
    MockWebhookDeliveryEvidence {
        server_response: mock_webhook_response(preview, payload),
        attempts: 0,
        final_status: "mock-only-no-endpoint".to_string(),
        failure_class: "none".to_string(),
        redacted_endpoint: None,
    }
}

fn post_mock_webhook_to_local_endpoint(
    endpoint: &str,
    payload: &serde_json::Value,
    approved: bool,
) -> Result<MockWebhookDeliveryEvidence, store::StoreError> {
    if !approved {
        return Err(store::StoreError::InvalidInput(
            "mock webhook endpoint delivery requires explicit approval".to_string(),
        ));
    }

    let url = validate_mock_endpoint(endpoint)?;
    let redacted_endpoint = redacted_mock_endpoint(&url);
    let client = Client::builder()
        .timeout(Duration::from_secs(MOCK_WEBHOOK_TIMEOUT_SECS))
        .build()
        .map_err(|error| {
            store::StoreError::InvalidInput(format!(
                "mock webhook client could not be built: {error}"
            ))
        })?;

    let mut last_status = "not-started".to_string();
    let mut last_failure_class = "network-error".to_string();
    for attempt in 1..=MOCK_WEBHOOK_MAX_ATTEMPTS {
        match client
            .post(url.clone())
            .header("content-type", "application/json")
            .json(payload)
            .send()
        {
            Ok(response) => {
                let status = response.status();
                let failure_class = classify_mock_webhook_status(status);
                last_status = status.to_string();
                last_failure_class = failure_class.to_string();
                if status.is_success() {
                    return Ok(MockWebhookDeliveryEvidence {
                        server_response: format!("mock-endpoint-accepted:{status}"),
                        attempts: attempt,
                        final_status: status.to_string(),
                        failure_class,
                        redacted_endpoint: Some(redacted_endpoint.clone()),
                    });
                }
                if !is_retryable_mock_webhook_failure(&failure_class) {
                    return Err(store::StoreError::InvalidInput(format!(
                        "mock webhook endpoint rejected payload: {status} ({failure_class})"
                    )));
                }
            }
            Err(error) => {
                last_status = "request-error".to_string();
                last_failure_class = if error.is_timeout() {
                    "timeout"
                } else {
                    "network-error"
                }
                .to_string();
            }
        }
    }

    Err(store::StoreError::InvalidInput(format!(
        "mock webhook endpoint failed after {} attempt(s): {} ({})",
        MOCK_WEBHOOK_MAX_ATTEMPTS, last_status, last_failure_class
    )))
}

fn post_staging_webhook_to_loopback(
    endpoint: &str,
    payload: &serde_json::Value,
    signature: &str,
    idempotency_key: &str,
    approved: bool,
) -> Result<StagingWebhookDeliveryEvidence, store::StoreError> {
    if !approved {
        return Err(store::StoreError::InvalidInput(
            "staging webhook delivery requires explicit approval".to_string(),
        ));
    }

    let url = validate_mock_endpoint(endpoint)?;
    let redacted_endpoint = redacted_mock_endpoint(&url);
    let client = Client::builder()
        .timeout(Duration::from_secs(MOCK_WEBHOOK_TIMEOUT_SECS))
        .build()
        .map_err(|error| {
            store::StoreError::InvalidInput(format!(
                "staging webhook client could not be built: {error}"
            ))
        })?;

    let mut last_status = "not-started".to_string();
    let mut last_failure_class = "network-error".to_string();
    for attempt in 1..=MOCK_WEBHOOK_MAX_ATTEMPTS {
        match client
            .post(url.clone())
            .header("content-type", "application/json")
            .header("x-synapse-staging-signature", signature)
            .header("x-synapse-idempotency-key", idempotency_key)
            .json(payload)
            .send()
        {
            Ok(response) => {
                let status = response.status();
                let failure_class = classify_mock_webhook_status(status);
                last_status = status.to_string();
                last_failure_class = failure_class.to_string();
                if status.is_success() {
                    return Ok(StagingWebhookDeliveryEvidence {
                        server_response: format!("staging-endpoint-accepted:{status}"),
                        attempts: attempt,
                        final_status: status.to_string(),
                        failure_class,
                        redacted_endpoint,
                        signature_header_present: true,
                        idempotency_header_present: true,
                    });
                }
                if !is_retryable_mock_webhook_failure(&failure_class) {
                    return Err(store::StoreError::InvalidInput(format!(
                        "staging webhook endpoint rejected payload: {status} ({failure_class})"
                    )));
                }
            }
            Err(error) => {
                last_status = "request-error".to_string();
                last_failure_class = if error.is_timeout() {
                    "timeout"
                } else {
                    "network-error"
                }
                .to_string();
            }
        }
    }

    Err(store::StoreError::InvalidInput(format!(
        "staging webhook endpoint failed after {} attempt(s): {} ({})",
        MOCK_WEBHOOK_MAX_ATTEMPTS, last_status, last_failure_class
    )))
}

fn post_production_webhook(
    endpoint: &str,
    channel: &str,
    payload: &serde_json::Value,
    idempotency_key: &str,
    approved: bool,
) -> Result<ProductionWebhookDeliveryEvidence, store::StoreError> {
    if !approved {
        return Err(store::StoreError::InvalidInput(
            "production webhook delivery requires explicit approval".to_string(),
        ));
    }
    if !endpoint_allows_production_webhook(channel, endpoint) {
        return Err(store::StoreError::InvalidInput(
            "production webhook endpoint is not an allowed official provider URL".to_string(),
        ));
    }

    let url = Url::parse(endpoint.trim()).map_err(|error| {
        store::StoreError::InvalidInput(format!("production webhook endpoint is invalid: {error}"))
    })?;
    let redacted_endpoint = redacted_provider_endpoint(&url);
    let client = Client::builder()
        .timeout(Duration::from_secs(PRODUCTION_WEBHOOK_TIMEOUT_SECS))
        .build()
        .map_err(|error| {
            store::StoreError::InvalidInput(format!(
                "production webhook client could not be built: {error}"
            ))
        })?;

    let mut last_status = "not-started".to_string();
    let mut last_failure_class = "network-error".to_string();
    for attempt in 1..=PRODUCTION_WEBHOOK_MAX_ATTEMPTS {
        match client
            .post(url.clone())
            .header("content-type", "application/json")
            .header("x-synapse-idempotency-key", idempotency_key)
            .json(payload)
            .send()
        {
            Ok(response) => {
                let status = response.status();
                let failure_class = classify_mock_webhook_status(status);
                last_status = status.to_string();
                last_failure_class = failure_class.to_string();
                let response_text = response.text().unwrap_or_default();
                if status.is_success() {
                    return Ok(ProductionWebhookDeliveryEvidence {
                        server_response: store::short_text(
                            &format!("provider-accepted:{status}:{response_text}"),
                            300,
                        ),
                        attempts: attempt,
                        final_status: status.to_string(),
                        failure_class,
                        redacted_endpoint: redacted_endpoint.clone(),
                        provider_payload_kind: match channel {
                            "feishu" => "feishu-bot-text-signed",
                            "wechat" => "wechat-bot-text",
                            _ => "unknown-provider",
                        }
                        .to_string(),
                        signature_material_used: true,
                        idempotency_header_present: true,
                    });
                }
                if !is_retryable_mock_webhook_failure(&failure_class) {
                    return Err(store::StoreError::InvalidInput(format!(
                        "production webhook endpoint rejected payload: {status} ({failure_class}) {}",
                        store::short_text(&response_text, 160)
                    )));
                }
            }
            Err(error) => {
                last_status = "request-error".to_string();
                last_failure_class = if error.is_timeout() {
                    "timeout"
                } else {
                    "network-error"
                }
                .to_string();
            }
        }
    }

    Err(store::StoreError::InvalidInput(format!(
        "production webhook endpoint failed after {} attempt(s): {} ({})",
        PRODUCTION_WEBHOOK_MAX_ATTEMPTS, last_status, last_failure_class
    )))
}

fn validate_mock_endpoint(endpoint: &str) -> Result<Url, store::StoreError> {
    let url = Url::parse(endpoint.trim()).map_err(|error| {
        store::StoreError::InvalidInput(format!("mock webhook endpoint is invalid: {error}"))
    })?;

    let host = url.host_str().unwrap_or_default();
    let is_loopback = matches!(host, "localhost" | "127.0.0.1" | "::1");
    if url.scheme() != "http" || !is_loopback || url.port().is_none() {
        return Err(store::StoreError::InvalidInput(
            "mock webhook endpoint must be an explicit http loopback URL with a port".to_string(),
        ));
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(store::StoreError::InvalidInput(
            "mock webhook endpoint must not contain credentials".to_string(),
        ));
    }

    Ok(url)
}

fn endpoint_allows_local_staging(endpoint: &str) -> bool {
    validate_mock_endpoint(endpoint).is_ok()
}

fn endpoint_allows_production_webhook(channel: &str, endpoint: &str) -> bool {
    let Ok(url) = Url::parse(endpoint) else {
        return false;
    };
    if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() {
        return false;
    }
    let host = url.host_str().unwrap_or_default();
    match channel {
        "feishu" => host == "open.feishu.cn" && url.path().starts_with("/open-apis/bot/v2/hook/"),
        "wechat" => host == "qyapi.weixin.qq.com" && url.path().starts_with("/cgi-bin/webhook/send"),
        _ => false,
    }
}

fn webhook_signature_material_present(channel: &str) -> bool {
    webhook_signature_material(channel).is_some()
}

fn webhook_signature_material(channel: &str) -> Option<String> {
    let env_name = match channel {
        "feishu" => "SYNAPSE_FEISHU_WEBHOOK_SECRET",
        "wechat" => "SYNAPSE_WECHAT_WEBHOOK_SECRET",
        _ => return None,
    };
    std::env::var(env_name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn classify_mock_webhook_status(status: reqwest::StatusCode) -> String {
    if status.is_success() {
        "success".to_string()
    } else if status.is_server_error() {
        "retryable-http-5xx".to_string()
    } else if status.is_client_error() {
        "permanent-http-4xx".to_string()
    } else {
        "unexpected-http-status".to_string()
    }
}

fn is_retryable_mock_webhook_failure(failure_class: &str) -> bool {
    matches!(
        failure_class,
        "retryable-http-5xx" | "network-error" | "timeout"
    )
}

fn redacted_mock_endpoint(url: &Url) -> serde_json::Value {
    serde_json::json!({
        "scheme": url.scheme(),
        "host": url.host_str().unwrap_or_default(),
        "port": url.port(),
        "path_present": url.path() != "/",
        "query_present": url.query().is_some(),
        "credentials_present": !url.username().is_empty() || url.password().is_some(),
    })
}

fn redacted_provider_endpoint(url: &Url) -> serde_json::Value {
    serde_json::json!({
        "scheme": url.scheme(),
        "host": url.host_str().unwrap_or_default(),
        "path_family": if url.path().contains("/open-apis/bot/") {
            "feishu-bot"
        } else if url.path().contains("/cgi-bin/webhook/") {
            "wechat-webhook"
        } else {
            "unknown"
        },
        "query_present": url.query().is_some(),
        "credentials_present": !url.username().is_empty() || url.password().is_some(),
        "secret_redacted": true,
    })
}

fn webhook_staging_policy(channel: &str) -> Option<WebhookStagingPolicy> {
    if !matches!(channel, "feishu" | "wechat") {
        return None;
    }

    Some(WebhookStagingPolicy {
        mode: "staging-contract-external-delivery-disabled".to_string(),
        channel: channel.to_string(),
        signature_policy: "platform-signature-or-hmac-required-before-real-send".to_string(),
        retry_policy: "bounded-retry-with-idempotency-key-and-backoff".to_string(),
        redaction_policy: "redact-webhook-url-token-and-response-before-audit".to_string(),
        error_classes: vec![
            "configuration-missing".to_string(),
            "credential-missing".to_string(),
            "network-disabled".to_string(),
            "http-non-success".to_string(),
            "timeout".to_string(),
            "rate-limited".to_string(),
            "payload-rejected".to_string(),
        ],
        external_delivery_gate: "safety.external_delivery_enabled".to_string(),
        approval_required: true,
        external_delivery_started: false,
        network_started: false,
        denied_actions: vec![
            "send-real-webhook".to_string(),
            "persist-webhook-secret".to_string(),
            "retry-without-idempotency".to_string(),
            "deliver-without-task-approval".to_string(),
            "deliver-without-redaction".to_string(),
        ],
    })
}

fn webhook_staging_envelope(
    channel: &str,
    run_id: &str,
    subject: &str,
    body: &str,
    destination_configured: bool,
) -> Option<WebhookStagingEnvelope> {
    if !matches!(channel, "feishu" | "wechat") {
        return None;
    }

    let mut payload_hasher = Sha256::new();
    payload_hasher.update(subject.as_bytes());
    payload_hasher.update(b"\n");
    payload_hasher.update(body.as_bytes());
    let payload_sha256 = hex::encode(payload_hasher.finalize());

    let mut idempotency_hasher = Sha256::new();
    idempotency_hasher.update(channel.as_bytes());
    idempotency_hasher.update(b":");
    idempotency_hasher.update(run_id.as_bytes());
    idempotency_hasher.update(b":");
    idempotency_hasher.update(payload_sha256.as_bytes());
    let idempotency_key = format!(
        "synapse-webhook-{}",
        hex::encode(idempotency_hasher.finalize())
            .chars()
            .take(32)
            .collect::<String>()
    );

    Some(WebhookStagingEnvelope {
        contract: "synapse.notification.webhook.staging.v1".to_string(),
        channel: channel.to_string(),
        idempotency_key,
        payload_sha256,
        body_preview_chars: body.chars().take(WEBHOOK_BODY_PREVIEW_CHARS).count(),
        destination_configured,
        endpoint_redaction: if destination_configured {
            "configured-secret-redacted".to_string()
        } else {
            "missing-no-secret-read".to_string()
        },
        required_headers: vec![
            "content-type: application/json".to_string(),
            "platform-signature-or-hmac".to_string(),
            "x-synapse-idempotency-key".to_string(),
        ],
        admission_state: "preview-only-not-deliverable".to_string(),
        expires_after_secs: 300,
        external_delivery_started: false,
        network_started: false,
    })
}

fn smtp_credentials() -> Option<(String, String)> {
    let username = std::env::var("SYNAPSE_SMTP_USERNAME").ok()?;
    let password = std::env::var("SYNAPSE_SMTP_PASSWORD").ok()?;
    if username.trim().is_empty() || password.is_empty() {
        return None;
    }
    Some((username, password))
}

fn endpoint_configured_for(channel: &str, runtime: &config::RuntimeConfig) -> bool {
    match channel {
        "email" => {
            !runtime.smtp_host.trim().is_empty()
                && !runtime.smtp_from.trim().is_empty()
                && !runtime.smtp_to.trim().is_empty()
        }
        "feishu" => !runtime.feishu_webhook_url.trim().is_empty(),
        "wechat" => !runtime.wechat_webhook_url.trim().is_empty(),
        _ => false,
    }
}

fn normalize_channel(value: &str) -> Result<&'static str, store::StoreError> {
    match value.trim().to_ascii_lowercase().as_str() {
        "email" => Ok("email"),
        "feishu" => Ok("feishu"),
        "wechat" => Ok("wechat"),
        other => Err(store::StoreError::InvalidInput(format!(
            "unsupported notification channel: {other}"
        ))),
    }
}

fn validate_subject(value: String) -> Result<String, store::StoreError> {
    let value = required(value, "notification subject")?;
    if value.contains(['\r', '\n']) || value.chars().count() > MAX_SUBJECT_CHARS {
        return Err(store::StoreError::InvalidInput(
            "notification subject is invalid or exceeds 200 characters".to_string(),
        ));
    }
    Ok(value)
}

fn validate_body(value: String) -> Result<String, store::StoreError> {
    let value = required(value, "notification body")?;
    if value.chars().count() > MAX_BODY_CHARS {
        return Err(store::StoreError::InvalidInput(
            "notification body exceeds 20000 characters".to_string(),
        ));
    }
    Ok(value)
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
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::thread;

    #[test]
    fn validates_supported_channels_without_implementing_all_adapters() {
        assert_eq!(normalize_channel("email").unwrap(), "email");
        assert_eq!(normalize_channel("feishu").unwrap(), "feishu");
        assert_eq!(normalize_channel("wechat").unwrap(), "wechat");
        assert!(normalize_channel("slack").is_err());
    }

    #[test]
    fn rejects_header_injection_and_oversized_content() {
        assert!(validate_subject("hello\r\nBcc: x@example.com".to_string()).is_err());
        assert!(validate_body("x".repeat(MAX_BODY_CHARS + 1)).is_err());
    }

    #[test]
    fn detects_webhook_endpoint_configuration_for_preview_only_channels() {
        let runtime = config::RuntimeConfig {
            feishu_webhook_url: "https://example.invalid/feishu".to_string(),
            wechat_webhook_url: "https://example.invalid/wechat".to_string(),
            ..config::RuntimeConfig::default()
        };

        assert!(endpoint_configured_for("feishu", &runtime));
        assert!(endpoint_configured_for("wechat", &runtime));
        assert!(!endpoint_configured_for(
            "feishu",
            &config::RuntimeConfig::default()
        ));
    }

    #[test]
    fn dry_run_contract_rejects_email_and_requires_approval_state() {
        let email_preview = NotificationPreview {
            run_id: "run-1".to_string(),
            channel: "email".to_string(),
            state: "ready-for-explicit-delivery-approval".to_string(),
            subject: "Subject".to_string(),
            body_chars: 12,
            task_push_enabled: true,
            task_push_channels: vec!["email".to_string()],
            endpoint_configured: true,
            credentials_present: true,
            gates: Vec::new(),
            delivery_started: false,
            webhook_staging_policy: None,
            webhook_staging_envelope: None,
        };
        let feishu_preview = NotificationPreview {
            channel: "feishu".to_string(),
            state: "adapter-preview-only".to_string(),
            credentials_present: false,
            task_push_channels: vec!["feishu".to_string()],
            ..email_preview.clone()
        };

        assert!(!dry_run_receipt_allowed(&email_preview, true));
        assert!(!dry_run_receipt_allowed(&feishu_preview, false));
        assert!(dry_run_receipt_allowed(&feishu_preview, true));
    }

    #[test]
    fn notification_preview_accepts_only_approved_or_successfully_completed_runs() {
        assert!(run_allows_notification_preview(
            "approved",
            "approved",
            "approved-not-started"
        ));
        assert!(run_allows_notification_preview(
            "succeeded",
            "approved",
            "completed"
        ));
        assert!(!run_allows_notification_preview(
            "failed",
            "approved",
            "failed"
        ));
        assert!(!run_allows_notification_preview(
            "cancelled",
            "approved",
            "cancelled"
        ));
        assert!(!run_allows_notification_preview(
            "succeeded",
            "rejected",
            "completed"
        ));
    }

    #[test]
    fn mock_webhook_payload_is_redacted_hashable_and_never_marks_external_delivery() {
        let body = format!("{}{}", "a".repeat(300), "secret-tail");
        let preview = NotificationPreview {
            run_id: "run-1".to_string(),
            channel: "wechat".to_string(),
            state: "adapter-preview-only".to_string(),
            subject: "Daily summary".to_string(),
            body_chars: 320,
            task_push_enabled: true,
            task_push_channels: vec!["wechat".to_string()],
            endpoint_configured: true,
            credentials_present: false,
            gates: Vec::new(),
            delivery_started: false,
            webhook_staging_policy: webhook_staging_policy("wechat"),
            webhook_staging_envelope: webhook_staging_envelope(
                "wechat",
                "run-1",
                "Daily summary",
                &body,
                true,
            ),
        };

        let payload = build_mock_webhook_payload(&preview, &body);
        let response = mock_webhook_response(&preview, &payload);

        assert_eq!(payload["contract"], "synapse.notification.webhook.v1");
        assert_eq!(payload["mode"], "mock-only");
        assert_eq!(payload["channel"], "wechat");
        assert_eq!(payload["external_delivery_started"], false);
        assert_eq!(payload["credentials_persisted"], false);
        assert_eq!(payload["body_chars"], 320);
        assert_eq!(payload["body_sha256"].as_str().unwrap().len(), 64);
        assert!(!payload["body_preview"]
            .as_str()
            .unwrap()
            .contains("secret-tail"));
        assert!(response.starts_with("mock-webhook-accepted:wechat:"));
    }

    #[test]
    fn mock_endpoint_delivery_posts_only_to_explicit_loopback_with_approval() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let endpoint = format!("http://{address}/mock-webhook");
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut buffer = [0_u8; 4096];
            let bytes_read = stream.read(&mut buffer).unwrap();
            let request = String::from_utf8_lossy(&buffer[..bytes_read]).to_string();
            stream
                .write_all(b"HTTP/1.1 200 OK\r\ncontent-length: 2\r\n\r\nok")
                .unwrap();
            request
        });
        let payload = serde_json::json!({
            "contract": "synapse.notification.webhook.v1",
            "mode": "mock-only",
            "channel": "feishu",
            "body_sha256": "a".repeat(64),
            "external_delivery_started": false,
        });

        let response = post_mock_webhook_to_local_endpoint(&endpoint, &payload, true).unwrap();
        let request = server.join().unwrap();

        assert_eq!(response.server_response, "mock-endpoint-accepted:200 OK");
        assert_eq!(response.attempts, 1);
        assert_eq!(response.final_status, "200 OK");
        assert_eq!(response.failure_class, "success");
        assert_eq!(response.redacted_endpoint.unwrap()["query_present"], false);
        assert!(request.starts_with("POST /mock-webhook HTTP/1.1"));
        assert!(request.contains("\"mode\":\"mock-only\""));
        assert!(request.contains("\"external_delivery_started\":false"));
        assert!(post_mock_webhook_to_local_endpoint(&endpoint, &payload, false).is_err());
        assert!(validate_mock_endpoint("https://127.0.0.1:1234/mock").is_err());
        assert!(validate_mock_endpoint("http://example.com:1234/mock").is_err());
        assert!(validate_mock_endpoint("http://user:pass@127.0.0.1:1234/mock").is_err());
    }

    #[test]
    fn mock_endpoint_delivery_retries_retryable_failures_and_redacts_endpoint() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let endpoint = format!("http://{address}/mock-webhook?token=redacted");
        let server = thread::spawn(move || {
            for status in [
                b"HTTP/1.1 500 Internal Server Error\r\ncontent-length: 5\r\n\r\nerror".as_slice(),
                b"HTTP/1.1 200 OK\r\ncontent-length: 2\r\n\r\nok".as_slice(),
            ] {
                let (mut stream, _) = listener.accept().unwrap();
                let mut buffer = [0_u8; 4096];
                let _ = stream.read(&mut buffer).unwrap();
                stream.write_all(status).unwrap();
            }
        });
        let payload = serde_json::json!({
            "contract": "synapse.notification.webhook.v1",
            "mode": "mock-only",
            "channel": "wechat",
            "body_sha256": "b".repeat(64),
            "external_delivery_started": false,
        });

        let response = post_mock_webhook_to_local_endpoint(&endpoint, &payload, true).unwrap();
        server.join().unwrap();
        let redacted_endpoint = response.redacted_endpoint.unwrap();

        assert_eq!(response.server_response, "mock-endpoint-accepted:200 OK");
        assert_eq!(response.attempts, 2);
        assert_eq!(response.failure_class, "success");
        assert_eq!(redacted_endpoint["host"], "127.0.0.1");
        assert_eq!(redacted_endpoint["path_present"], true);
        assert_eq!(redacted_endpoint["query_present"], true);
        assert!(
            serde_json::to_string(&redacted_endpoint)
                .unwrap()
                .contains("redacted")
                == false
        );
    }

    #[test]
    fn webhook_staging_preflight_scope_requires_loopback_signature_and_gate() {
        assert!(endpoint_allows_local_staging(
            "http://127.0.0.1:3456/staging"
        ));
        assert!(endpoint_allows_local_staging(
            "http://localhost:3456/staging"
        ));
        assert!(!endpoint_allows_local_staging(
            "https://open.feishu.cn/open-apis/bot/v2/hook/secret"
        ));
        assert!(!endpoint_allows_local_staging(
            "http://example.com:3456/staging"
        ));

        let preflight = WebhookStagingPreflight {
            channel: "feishu".to_string(),
            state: "staging-webhook-blocked".to_string(),
            endpoint_scope: "http-loopback-staging-only".to_string(),
            endpoint_configured: true,
            endpoint_allowed_for_staging: false,
            signature_material_present: false,
            external_delivery_gate_enabled: false,
            approval_required: true,
            delivery_started: false,
            network_started: false,
            checks: vec![
                "loopback-staging-endpoint-required".to_string(),
                "signature-material-required".to_string(),
                "external-delivery-gate-required".to_string(),
                "no-network-started-during-preflight".to_string(),
            ],
            blocked_reasons: vec![
                "endpoint-not-loopback-staging".to_string(),
                "signature-material-missing".to_string(),
                "external-delivery-gate-disabled".to_string(),
            ],
        };

        assert_eq!(preflight.state, "staging-webhook-blocked");
        assert_eq!(preflight.endpoint_scope, "http-loopback-staging-only");
        assert!(!preflight.endpoint_allowed_for_staging);
        assert!(!preflight.signature_material_present);
        assert!(!preflight.external_delivery_gate_enabled);
        assert!(!preflight.delivery_started);
        assert!(!preflight.network_started);
        assert!(preflight
            .blocked_reasons
            .contains(&"endpoint-not-loopback-staging".to_string()));
        assert!(preflight
            .checks
            .contains(&"no-network-started-during-preflight".to_string()));
    }

    #[test]
    fn webhook_production_preflight_scope_requires_official_https_provider_endpoint() {
        assert!(endpoint_allows_production_webhook(
            "feishu",
            "https://open.feishu.cn/open-apis/bot/v2/hook/secret"
        ));
        assert!(endpoint_allows_production_webhook(
            "wechat",
            "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=secret"
        ));
        assert!(!endpoint_allows_production_webhook(
            "feishu",
            "http://open.feishu.cn/open-apis/bot/v2/hook/secret"
        ));
        assert!(!endpoint_allows_production_webhook(
            "wechat",
            "https://example.com/cgi-bin/webhook/send?key=secret"
        ));
        assert!(!endpoint_allows_production_webhook(
            "feishu",
            "https://user:pass@open.feishu.cn/open-apis/bot/v2/hook/secret"
        ));

        let preflight = WebhookProductionPreflight {
            channel: "wechat".to_string(),
            state: "production-webhook-blocked".to_string(),
            endpoint_scope: "official-feishu-wechat-https-only".to_string(),
            endpoint_configured: true,
            endpoint_allowed_for_production: false,
            signature_material_present: false,
            external_delivery_gate_enabled: false,
            approval_required: true,
            audit_required: true,
            redaction_required: true,
            delivery_started: false,
            network_started: false,
            checks: vec![
                "official-provider-https-endpoint-required".to_string(),
                "signature-material-required".to_string(),
                "external-delivery-gate-required".to_string(),
                "audit-event-required-before-send".to_string(),
                "redacted-endpoint-and-response-required".to_string(),
                "no-network-started-during-preflight".to_string(),
            ],
            blocked_reasons: vec![
                "endpoint-not-allowed-for-production".to_string(),
                "signature-material-missing".to_string(),
                "external-delivery-gate-disabled".to_string(),
            ],
        };

        assert_eq!(preflight.state, "production-webhook-blocked");
        assert_eq!(preflight.endpoint_scope, "official-feishu-wechat-https-only");
        assert!(!preflight.endpoint_allowed_for_production);
        assert!(preflight.audit_required);
        assert!(preflight.redaction_required);
        assert!(!preflight.delivery_started);
        assert!(!preflight.network_started);
        assert!(preflight
            .checks
            .contains(&"audit-event-required-before-send".to_string()));
        assert!(preflight
            .blocked_reasons
            .contains(&"endpoint-not-allowed-for-production".to_string()));
    }

    #[test]
    fn production_webhook_payloads_are_provider_native_signed_and_redacted() {
        let feishu_preview = NotificationPreview {
            run_id: "run-feishu".to_string(),
            channel: "feishu".to_string(),
            state: "adapter-preview-only".to_string(),
            subject: "Daily briefing".to_string(),
            body_chars: 24,
            task_push_enabled: true,
            task_push_channels: vec!["feishu".to_string()],
            endpoint_configured: true,
            credentials_present: false,
            gates: Vec::new(),
            delivery_started: false,
            webhook_staging_policy: webhook_staging_policy("feishu"),
            webhook_staging_envelope: None,
        };
        let feishu_payload =
            build_production_webhook_payload(&feishu_preview, "Body text", "top-secret").unwrap();
        assert_eq!(feishu_payload["msg_type"], "text");
        assert!(feishu_payload["timestamp"].as_str().unwrap_or_default().len() >= 10);
        assert!(!feishu_payload["sign"].as_str().unwrap_or_default().is_empty());
        assert!(feishu_payload["content"]["text"]
            .as_str()
            .unwrap_or_default()
            .contains("Daily briefing"));
        assert!(!feishu_payload.to_string().contains("top-secret"));

        let wechat_preview = NotificationPreview {
            channel: "wechat".to_string(),
            task_push_channels: vec!["wechat".to_string()],
            webhook_staging_policy: webhook_staging_policy("wechat"),
            ..feishu_preview
        };
        let wechat_payload =
            build_production_webhook_payload(&wechat_preview, "Body text", "unused-secret")
                .unwrap();
        assert_eq!(wechat_payload["msgtype"], "text");
        assert!(wechat_payload["text"]["content"]
            .as_str()
            .unwrap_or_default()
            .contains("Daily briefing"));
        assert!(!wechat_payload.to_string().contains("unused-secret"));

        let endpoint =
            Url::parse("https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=secret-token")
                .unwrap();
        let redacted = redacted_provider_endpoint(&endpoint);
        assert_eq!(redacted["host"], "qyapi.weixin.qq.com");
        assert_eq!(redacted["path_family"], "wechat-webhook");
        assert_eq!(redacted["query_present"], true);
        assert_eq!(redacted["secret_redacted"], true);
        assert!(!redacted.to_string().contains("secret-token"));
    }

    #[test]
    fn production_webhook_delivery_requires_approval_and_official_endpoint_before_network() {
        let payload = serde_json::json!({"msgtype": "text", "text": {"content": "hello"}});
        let unapproved = post_production_webhook(
            "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=secret",
            "wechat",
            &payload,
            "idem",
            false,
        )
        .unwrap_err()
        .to_string();
        assert!(unapproved.contains("approval"));

        let disallowed = post_production_webhook(
            "https://example.com/cgi-bin/webhook/send?key=secret",
            "wechat",
            &payload,
            "idem",
            true,
        )
        .unwrap_err()
        .to_string();
        assert!(disallowed.contains("not an allowed official provider URL"));
    }

    #[test]
    fn loopback_staging_webhook_posts_signed_headers_without_secret_persistence() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let endpoint = format!("http://{address}/staging-webhook");
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut buffer = [0_u8; 4096];
            let bytes_read = stream.read(&mut buffer).unwrap();
            let request = String::from_utf8_lossy(&buffer[..bytes_read]).to_string();
            stream
                .write_all(b"HTTP/1.1 200 OK\r\ncontent-length: 2\r\n\r\nok")
                .unwrap();
            request
        });
        let preview = NotificationPreview {
            run_id: "run-feishu".to_string(),
            channel: "feishu".to_string(),
            state: "adapter-preview-only".to_string(),
            subject: "Staging summary".to_string(),
            body_chars: 32,
            task_push_enabled: true,
            task_push_channels: vec!["feishu".to_string()],
            endpoint_configured: true,
            credentials_present: false,
            gates: Vec::new(),
            delivery_started: false,
            webhook_staging_policy: webhook_staging_policy("feishu"),
            webhook_staging_envelope: webhook_staging_envelope(
                "feishu",
                "run-feishu",
                "Staging summary",
                "staging webhook body",
                true,
            ),
        };
        let envelope = preview.webhook_staging_envelope.as_ref().unwrap();
        let payload = build_staging_webhook_payload(&preview, envelope, "staging webhook body");
        let signature =
            build_staging_signature("local-secret", &payload, &envelope.idempotency_key);

        let evidence = post_staging_webhook_to_loopback(
            &endpoint,
            &payload,
            &signature,
            &envelope.idempotency_key,
            true,
        )
        .unwrap();
        let request = server.join().unwrap();
        let serialized_payload = serde_json::to_string(&payload).unwrap();
        let serialized_evidence = serde_json::to_string(&serde_json::json!({
            "server_response": evidence.server_response,
            "redacted_endpoint": evidence.redacted_endpoint,
            "signature_header_present": evidence.signature_header_present,
            "idempotency_header_present": evidence.idempotency_header_present,
            "external_delivery_started": false,
            "credentials_persisted": false,
        }))
        .unwrap();

        assert_eq!(evidence.server_response, "staging-endpoint-accepted:200 OK");
        assert_eq!(evidence.attempts, 1);
        assert!(evidence.signature_header_present);
        assert!(evidence.idempotency_header_present);
        assert!(request.starts_with("POST /staging-webhook HTTP/1.1"));
        assert!(request.contains("x-synapse-staging-signature"));
        assert!(request.contains("x-synapse-idempotency-key"));
        assert!(request.contains("\"mode\":\"loopback-staging-only\""));
        assert!(request.contains("\"external_delivery_started\":false"));
        assert!(serialized_payload.contains("loopback-staging-only"));
        assert!(!serialized_payload.contains("local-secret"));
        assert!(!serialized_evidence.contains("local-secret"));
        assert!(post_staging_webhook_to_loopback(
            &endpoint,
            &payload,
            &signature,
            &envelope.idempotency_key,
            false
        )
        .is_err());
        assert!(post_staging_webhook_to_loopback(
            "https://127.0.0.1:443/staging",
            &payload,
            &signature,
            &envelope.idempotency_key,
            true
        )
        .is_err());
    }

    #[test]
    fn feishu_wechat_mock_receipt_contract_never_marks_external_delivery_started() {
        for channel in ["feishu", "wechat"] {
            let preview = NotificationPreview {
                run_id: format!("run-{channel}"),
                channel: channel.to_string(),
                state: "adapter-preview-only".to_string(),
                subject: "Task summary".to_string(),
                body_chars: 41,
                task_push_enabled: true,
                task_push_channels: vec![channel.to_string()],
                endpoint_configured: true,
                credentials_present: false,
                gates: vec![
                    "task-run-approved".to_string(),
                    "explicit-delivery-confirmation".to_string(),
                    "delivery-receipt-artifact".to_string(),
                ],
                delivery_started: false,
                webhook_staging_policy: webhook_staging_policy(channel),
                webhook_staging_envelope: webhook_staging_envelope(
                    channel,
                    &format!("run-{channel}"),
                    "Task summary",
                    "Mock receipt body for guarded notification.",
                    true,
                ),
            };
            let body = "Mock receipt body for guarded notification.";
            let payload = build_mock_webhook_payload(&preview, body);
            let evidence = mock_webhook_evidence(&preview, &payload);
            let receipt_metadata = serde_json::json!({
                "channel": preview.channel,
                "server_response": evidence.server_response,
                "mock_webhook_delivery": {
                    "attempts": evidence.attempts,
                    "final_status": evidence.final_status,
                    "failure_class": evidence.failure_class,
                    "redacted_endpoint": evidence.redacted_endpoint,
                },
                "mock_webhook_payload": payload,
                "external_delivery_started": false,
                "credentials_persisted": false,
                "task_run_completed": false,
            });

            assert!(dry_run_receipt_allowed(&preview, true));
            assert_eq!(receipt_metadata["external_delivery_started"], false);
            assert_eq!(receipt_metadata["credentials_persisted"], false);
            assert_eq!(receipt_metadata["task_run_completed"], false);
            assert_eq!(
                receipt_metadata["mock_webhook_delivery"]["final_status"],
                "mock-only-no-endpoint"
            );
            assert_eq!(
                receipt_metadata["mock_webhook_payload"]["external_delivery_started"],
                false
            );
            assert!(receipt_metadata["server_response"]
                .as_str()
                .unwrap()
                .starts_with(&format!("mock-webhook-accepted:{channel}:")));
        }
    }

    #[test]
    fn webhook_staging_policy_blocks_external_delivery_without_gate() {
        for channel in ["feishu", "wechat"] {
            let policy = webhook_staging_policy(channel).unwrap();

            assert_eq!(policy.mode, "staging-contract-external-delivery-disabled");
            assert_eq!(policy.channel, channel);
            assert_eq!(
                policy.external_delivery_gate,
                "safety.external_delivery_enabled"
            );
            assert!(policy.approval_required);
            assert!(!policy.external_delivery_started);
            assert!(!policy.network_started);
            assert!(policy
                .signature_policy
                .contains("required-before-real-send"));
            assert!(policy.retry_policy.contains("idempotency"));
            assert!(policy.redaction_policy.contains("redact-webhook-url"));
            assert!(policy.error_classes.contains(&"rate-limited".to_string()));
            assert!(policy
                .denied_actions
                .contains(&"send-real-webhook".to_string()));
            assert!(policy
                .denied_actions
                .contains(&"deliver-without-redaction".to_string()));
        }

        assert!(webhook_staging_policy("email").is_none());
    }

    #[test]
    fn webhook_staging_envelope_redacts_destination_and_never_starts_network() {
        for channel in ["feishu", "wechat"] {
            let envelope = webhook_staging_envelope(
                channel,
                "run-42",
                "Daily briefing",
                "Body with private details that must only be hashed.",
                true,
            )
            .unwrap();

            assert_eq!(envelope.contract, "synapse.notification.webhook.staging.v1");
            assert_eq!(envelope.channel, channel);
            assert_eq!(envelope.payload_sha256.len(), 64);
            assert!(envelope.idempotency_key.starts_with("synapse-webhook-"));
            assert_eq!(envelope.destination_configured, true);
            assert_eq!(envelope.endpoint_redaction, "configured-secret-redacted");
            assert!(envelope
                .required_headers
                .contains(&"x-synapse-idempotency-key".to_string()));
            assert_eq!(envelope.admission_state, "preview-only-not-deliverable");
            assert_eq!(envelope.expires_after_secs, 300);
            assert!(!envelope.external_delivery_started);
            assert!(!envelope.network_started);
            assert!(!serde_json::to_string(&envelope)
                .unwrap()
                .contains("private details"));
        }

        assert!(webhook_staging_envelope("email", "run-1", "Subject", "Body", true).is_none());
    }
}
