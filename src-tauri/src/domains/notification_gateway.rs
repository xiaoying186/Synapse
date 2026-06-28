use std::time::Duration;

use lettre::message::Mailbox;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport, Transport};
use serde::{Deserialize, Serialize};

use crate::{config, store};

const MAX_SUBJECT_CHARS: usize = 200;
const MAX_BODY_CHARS: usize = 20_000;

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
}

#[derive(Debug, Clone, Serialize)]
pub struct NotificationReceipt {
    pub preview: NotificationPreview,
    pub state: String,
    pub server_response: String,
    pub artifact: store::TaskArtifactRecord,
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
    let state = if run.lifecycle_state != "approved"
        || run.approval_state != "approved"
        || run.execution_state != "approved-not-started"
    {
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
}
