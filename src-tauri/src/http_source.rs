use std::io::Read;
use std::time::Duration;

use reqwest::blocking::Client;
use reqwest::redirect::Policy;
use reqwest::Url;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::aggregation::{self, ConfidenceAssessment, SourceObservation};

const HTTP_TIMEOUT_SECONDS: u64 = 5;
const MAX_HTTP_RESPONSE_BYTES: u64 = 256 * 1024;

#[derive(Debug, Clone, Serialize)]
pub struct HttpSourceReceipt {
    pub source_url: String,
    pub status_code: u16,
    pub content_type: String,
    pub response_bytes: usize,
    pub observation: SourceObservation,
    pub confidence: ConfidenceAssessment,
    pub evidence_validation: aggregation::EvidenceValidationContract,
    pub provider_receipt: ProviderAdapterExecutionReceipt,
    pub gates: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ProviderAdapterExecutionReceipt {
    pub receipt_id: String,
    pub provider_id: String,
    pub adapter_kind: String,
    pub execution_mode: String,
    pub execution_state: String,
    pub source_url: String,
    pub source_sha256: String,
    pub response_bytes: usize,
    pub external_network_started: bool,
    pub credential_read_started: bool,
    pub process_started: bool,
    pub durable_write_started: bool,
    pub audit_recorded: bool,
    pub quarantine_recorded: bool,
    pub rollback_required: bool,
    pub gates: Vec<String>,
    pub denied_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderReceiptAdmissionPreflight {
    pub generated_at_ms: u128,
    pub state: String,
    pub provider_id: String,
    pub receipt_id: String,
    pub candidate_id: String,
    pub candidate_kind: String,
    pub source_sha256: String,
    pub audit_recorded: bool,
    pub quarantine_recorded: bool,
    pub summary_candidate_created: bool,
    pub task_artifact_write_started: bool,
    pub durable_zhishu_write_started: bool,
    pub requires_human_review: bool,
    pub requires_evidence_validation: bool,
    pub requires_source_trust_review: bool,
    pub requires_conflict_review: bool,
    pub gates: Vec<String>,
    pub blockers: Vec<String>,
    pub denied_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderReceiptAdmissionQueuePreview {
    pub generated_at_ms: u128,
    pub state: String,
    pub queue_id: String,
    pub provider_id: String,
    pub receipt_id: String,
    pub candidate_count: usize,
    pub pending_review_count: usize,
    pub task_artifact_write_started: bool,
    pub durable_zhishu_write_started: bool,
    pub candidates: Vec<ProviderReceiptAdmissionPreflight>,
    pub gates: Vec<String>,
    pub blockers: Vec<String>,
    pub denied_actions: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct HttpSourcePayload {
    #[serde(default)]
    source_id: Option<String>,
    normalized_claim: String,
    #[serde(default)]
    freshness: Option<String>,
    #[serde(default)]
    field_coverage: Option<f64>,
}

pub fn fetch_configured_source(url: String) -> Result<HttpSourceReceipt, String> {
    fetch_source_with_client(url, build_client()?)
}

pub fn fetch_configured_source_as(
    url: String,
    expected_source_id: String,
) -> Result<HttpSourceReceipt, String> {
    let expected_source_id = bounded_required(expected_source_id, "expected source_id")?;
    fetch_source_with_client_expected(url, build_client()?, Some(expected_source_id.as_str()))
}

fn build_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(HTTP_TIMEOUT_SECONDS))
        .redirect(Policy::none())
        .user_agent("Synapse/0.1 read-only-source")
        .build()
        .map_err(|error| format!("HTTP client could not be created: {error}"))
}

fn fetch_source_with_client(url: String, client: Client) -> Result<HttpSourceReceipt, String> {
    fetch_source_with_client_expected(url, client, None)
}

fn fetch_source_with_client_expected(
    url: String,
    client: Client,
    expected_source_id: Option<&str>,
) -> Result<HttpSourceReceipt, String> {
    let url = validate_source_url(&url)?;
    let response = client
        .get(url.clone())
        .header("Accept", "application/json")
        .send()
        .map_err(|error| format!("HTTP source request failed: {error}"))?;
    let status_code = response.status().as_u16();
    if !response.status().is_success() {
        return Err(format!("HTTP source returned status {status_code}"));
    }
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !content_type.starts_with("application/json") {
        return Err(format!(
            "HTTP source content type is not JSON: {content_type}"
        ));
    }
    if response
        .content_length()
        .is_some_and(|length| length > MAX_HTTP_RESPONSE_BYTES)
    {
        return Err("HTTP source response exceeds 256 KB.".to_string());
    }

    let mut bytes = Vec::new();
    response
        .take(MAX_HTTP_RESPONSE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("HTTP source response could not be read: {error}"))?;
    if bytes.len() as u64 > MAX_HTTP_RESPONSE_BYTES {
        return Err("HTTP source response exceeds 256 KB.".to_string());
    }
    let payload = serde_json::from_slice::<HttpSourcePayload>(&bytes)
        .map_err(|error| format!("HTTP source JSON is invalid: {error}"))?;
    let claim = bounded_required(payload.normalized_claim, "normalized_claim")?;
    let declared_source_id = payload
        .source_id
        .map(|value| bounded_required(value, "source_id"))
        .transpose()?;
    if let (Some(expected), Some(declared)) = (expected_source_id, declared_source_id.as_deref()) {
        if expected != declared {
            return Err(format!(
                "HTTP source identity mismatch: configured {expected}, response declared {declared}"
            ));
        }
    }
    let source_id = expected_source_id
        .map(str::to_string)
        .or(declared_source_id)
        .unwrap_or_else(|| {
            format!(
                "http-{}",
                url.host_str()
                    .unwrap_or("configured-source")
                    .replace('.', "-")
            )
        });
    let observation = SourceObservation {
        source_id,
        source_uri: url.to_string(),
        captured_at_ms: crate::store::now_millis(),
        freshness: payload
            .freshness
            .map(|value| bounded_required(value, "freshness"))
            .transpose()?
            .unwrap_or_else(|| "http-current-at-fetch".to_string()),
        field_coverage: payload.field_coverage.unwrap_or(0.5).clamp(0.0, 1.0),
        normalized_claim: claim,
        quarantine_state: "quarantined".to_string(),
        fallback_used: false,
    };
    let confidence = aggregation::assess_confidence(std::slice::from_ref(&observation), 1);
    let evidence_validation =
        aggregation::validate_evidence_contract(std::slice::from_ref(&observation), &confidence, 2);
    let provider_receipt = provider_adapter_receipt(
        "public-web-json",
        "configured-http-json",
        "read-only-http-get",
        url.as_str(),
        &bytes,
        true,
    );

    Ok(HttpSourceReceipt {
        source_url: url.to_string(),
        status_code,
        content_type,
        response_bytes: bytes.len(),
        observation,
        confidence,
        evidence_validation,
        provider_receipt,
        gates: vec![
            "configured-url-only".to_string(),
            "get-only".to_string(),
            "no-redirects".to_string(),
            "no-credentials".to_string(),
            "five-second-timeout".to_string(),
            "256kb-response-limit".to_string(),
            "json-content-type".to_string(),
            "quarantine-before-use".to_string(),
            "review-before-zhishu-admission".to_string(),
        ],
    })
}

pub fn loopback_provider_fixture_receipt() -> ProviderAdapterExecutionReceipt {
    provider_adapter_receipt(
        "loopback-fixture-provider",
        "fixture-json-adapter",
        "loopback-fixture-no-network",
        "fixture://loopback-provider",
        br#"{"normalized_claim":"loopback provider fixture"}"#,
        false,
    )
}

pub fn preflight_provider_receipt_admission(
    receipt: ProviderAdapterExecutionReceipt,
) -> ProviderReceiptAdmissionPreflight {
    let audit_recorded = receipt.audit_recorded;
    let quarantine_recorded = receipt.quarantine_recorded;
    let receipt_has_hash = receipt.source_sha256.len() == 64;
    let candidate_ready = audit_recorded && quarantine_recorded && receipt_has_hash;
    let mut blockers = Vec::new();
    if !audit_recorded {
        blockers.push("provider-receipt-audit-missing".to_string());
    }
    if !quarantine_recorded {
        blockers.push("provider-receipt-quarantine-missing".to_string());
    }
    if !receipt_has_hash {
        blockers.push("provider-receipt-sha256-missing".to_string());
    }
    blockers.extend([
        "provider-receipt-human-review-not-complete".to_string(),
        "provider-source-trust-not-reviewed".to_string(),
        "provider-evidence-validation-not-approved".to_string(),
    ]);

    ProviderReceiptAdmissionPreflight {
        generated_at_ms: crate::store::now_millis(),
        state: "provider-receipt-admission-review-required".to_string(),
        provider_id: receipt.provider_id.clone(),
        receipt_id: receipt.receipt_id.clone(),
        candidate_id: format!("provider-receipt-candidate-{}", receipt.source_sha256),
        candidate_kind: "zhishu-source-evidence-candidate".to_string(),
        source_sha256: receipt.source_sha256,
        audit_recorded,
        quarantine_recorded,
        summary_candidate_created: candidate_ready,
        task_artifact_write_started: false,
        durable_zhishu_write_started: false,
        requires_human_review: true,
        requires_evidence_validation: true,
        requires_source_trust_review: true,
        requires_conflict_review: true,
        gates: vec![
            "provider-receipt-audit-required".to_string(),
            "provider-receipt-quarantine-required".to_string(),
            "source-sha256-required-before-admission".to_string(),
            "evidence-validation-before-provider-admission".to_string(),
            "source-trust-review-before-provider-admission".to_string(),
            "conflict-review-before-provider-admission".to_string(),
            "human-review-before-zhishu-admission".to_string(),
            "no-automatic-l2-write".to_string(),
        ],
        blockers,
        denied_actions: vec![
            "write-provider-receipt-to-l2-without-review".to_string(),
            "promote-provider-output-without-evidence-validation".to_string(),
            "create-task-artifact-without-approval".to_string(),
            "skip-provider-source-trust-review".to_string(),
            "reuse-provider-receipt-without-quarantine".to_string(),
        ],
    }
}

pub fn preview_provider_receipt_admission_queue(
    receipt: ProviderAdapterExecutionReceipt,
) -> ProviderReceiptAdmissionQueuePreview {
    let candidate = preflight_provider_receipt_admission(receipt);
    ProviderReceiptAdmissionQueuePreview {
        generated_at_ms: crate::store::now_millis(),
        state: "provider-receipt-review-queue-preview".to_string(),
        queue_id: format!("provider-receipt-review-queue-{}", candidate.source_sha256),
        provider_id: candidate.provider_id.clone(),
        receipt_id: candidate.receipt_id.clone(),
        candidate_count: 1,
        pending_review_count: usize::from(candidate.requires_human_review),
        task_artifact_write_started: false,
        durable_zhishu_write_started: false,
        candidates: vec![candidate],
        gates: vec![
            "receipt-candidate-quarantine-only".to_string(),
            "human-review-queue-before-task-artifact".to_string(),
            "taiheng-approval-before-provider-promotion".to_string(),
            "no-automatic-l2-write".to_string(),
        ],
        blockers: vec![
            "provider-receipt-review-queue-not-persisted".to_string(),
            "provider-receipt-review-not-approved".to_string(),
        ],
        denied_actions: vec![
            "persist-provider-review-queue-without-store-transaction".to_string(),
            "promote-provider-candidate-without-review".to_string(),
            "write-provider-candidate-to-task-artifact-without-approval".to_string(),
        ],
    }
}

pub(crate) fn provider_adapter_receipt(
    provider_id: &str,
    adapter_kind: &str,
    execution_mode: &str,
    source_url: &str,
    bytes: &[u8],
    external_network_started: bool,
) -> ProviderAdapterExecutionReceipt {
    let source_sha256 = sha256_hex(bytes);
    ProviderAdapterExecutionReceipt {
        receipt_id: format!("provider-receipt-{}", crate::store::now_millis()),
        provider_id: provider_id.to_string(),
        adapter_kind: adapter_kind.to_string(),
        execution_mode: execution_mode.to_string(),
        execution_state: "quarantined-receipt-recorded".to_string(),
        source_url: source_url.to_string(),
        source_sha256,
        response_bytes: bytes.len(),
        external_network_started,
        credential_read_started: false,
        process_started: false,
        durable_write_started: false,
        audit_recorded: true,
        quarantine_recorded: true,
        rollback_required: false,
        gates: vec![
            "provider-adapter-receipt-required".to_string(),
            "source-sha256-recorded".to_string(),
            "audit-record-before-admission".to_string(),
            "quarantine-record-before-use".to_string(),
            "no-credential-read".to_string(),
            "no-durable-write-from-provider".to_string(),
        ],
        denied_actions: vec![
            "provider-output-without-receipt".to_string(),
            "provider-output-without-sha256".to_string(),
            "provider-output-without-quarantine".to_string(),
            "provider-credential-read-without-guard".to_string(),
            "provider-durable-write-without-review".to_string(),
        ],
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>()
}

fn validate_source_url(value: &str) -> Result<Url, String> {
    let value = value.trim();
    if value.is_empty() {
        return Err("No HTTP aggregation source is configured.".to_string());
    }
    let url =
        Url::parse(value).map_err(|error| format!("Configured source URL is invalid: {error}"))?;
    if !url.username().is_empty() || url.password().is_some() {
        return Err("Configured source URL cannot contain credentials.".to_string());
    }
    if url.fragment().is_some() {
        return Err("Configured source URL cannot contain a fragment.".to_string());
    }
    let localhost_http =
        url.scheme() == "http" && matches!(url.host_str(), Some("127.0.0.1" | "::1" | "localhost"));
    if url.scheme() != "https" && !localhost_http {
        return Err("Configured source URL must use HTTPS.".to_string());
    }
    Ok(url)
}

fn bounded_required(value: String, field: &str) -> Result<String, String> {
    let value = value.trim().to_string();
    if value.is_empty() {
        return Err(format!("HTTP source field cannot be empty: {field}"));
    }
    if value.chars().count() > 4_000 {
        return Err(format!(
            "HTTP source field exceeds 4000 characters: {field}"
        ));
    }
    Ok(value)
}

#[cfg(test)]
mod tests {
    use std::io::Write;
    use std::net::TcpListener;
    use std::thread;

    use super::*;

    #[test]
    fn rejects_credentials_redirectable_scheme_and_unconfigured_url() {
        assert!(validate_source_url("").unwrap_err().contains("configured"));
        assert!(validate_source_url("http://example.com/data")
            .unwrap_err()
            .contains("HTTPS"));
        assert!(validate_source_url("https://user:secret@example.com/data")
            .unwrap_err()
            .contains("credentials"));
    }

    #[test]
    fn rejects_response_that_claims_a_different_configured_source_id() {
        let (url, server) = serve_once(
            "200 OK",
            "application/json",
            r#"{"source_id":"untrusted-source","normalized_claim":"identity mismatch"}"#,
        );

        let error = fetch_source_with_client_expected(
            url,
            build_client().unwrap(),
            Some("approved-registry-source"),
        )
        .unwrap_err();
        server.join().unwrap();

        assert!(error.contains("identity mismatch"));
    }

    #[test]
    fn fetches_local_json_without_redirect_or_process_access() {
        let (url, server) = serve_once(
            "200 OK",
            "application/json",
            r#"{"source_id":"local-test","normalized_claim":"verified local response","field_coverage":0.9}"#,
        );

        let receipt = fetch_source_with_client(url, build_client().unwrap()).unwrap();
        server.join().unwrap();

        assert_eq!(receipt.status_code, 200);
        assert_eq!(receipt.observation.source_id, "local-test");
        assert_eq!(receipt.observation.quarantine_state, "quarantined");
        assert!(!receipt.observation.fallback_used);
        assert_eq!(
            receipt.evidence_validation.cross_check_state,
            "cross-check-insufficient"
        );
        assert!(!receipt.evidence_validation.summary_allowed);
        assert!(!receipt.evidence_validation.durable_write_allowed);
        assert_eq!(receipt.provider_receipt.provider_id, "public-web-json");
        assert!(receipt.provider_receipt.external_network_started);
        assert!(!receipt.provider_receipt.credential_read_started);
        assert!(!receipt.provider_receipt.process_started);
        assert!(!receipt.provider_receipt.durable_write_started);
        assert!(receipt.provider_receipt.audit_recorded);
        assert!(receipt.provider_receipt.quarantine_recorded);
        assert_eq!(receipt.provider_receipt.source_sha256.len(), 64);
        assert!(receipt.gates.contains(&"no-redirects".to_string()));
    }

    #[test]
    fn loopback_provider_fixture_receipt_has_hash_audit_and_quarantine_without_network() {
        let receipt = loopback_provider_fixture_receipt();

        assert_eq!(receipt.provider_id, "loopback-fixture-provider");
        assert_eq!(receipt.execution_mode, "loopback-fixture-no-network");
        assert!(!receipt.external_network_started);
        assert!(!receipt.credential_read_started);
        assert!(!receipt.process_started);
        assert!(!receipt.durable_write_started);
        assert!(receipt.audit_recorded);
        assert!(receipt.quarantine_recorded);
        assert_eq!(receipt.source_sha256.len(), 64);
        assert!(receipt
            .gates
            .contains(&"provider-adapter-receipt-required".to_string()));
        assert!(receipt
            .denied_actions
            .contains(&"provider-output-without-sha256".to_string()));
    }

    #[test]
    fn provider_receipt_admission_preflight_never_writes_l2_or_task_artifact() {
        let receipt = loopback_provider_fixture_receipt();
        let preflight = preflight_provider_receipt_admission(receipt);

        assert_eq!(
            preflight.state,
            "provider-receipt-admission-review-required"
        );
        assert!(preflight.summary_candidate_created);
        assert!(!preflight.task_artifact_write_started);
        assert!(!preflight.durable_zhishu_write_started);
        assert!(preflight.requires_human_review);
        assert!(preflight.requires_evidence_validation);
        assert!(preflight.requires_source_trust_review);
        assert!(preflight
            .gates
            .contains(&"no-automatic-l2-write".to_string()));
        assert!(preflight
            .blockers
            .contains(&"provider-receipt-human-review-not-complete".to_string()));
        assert!(preflight
            .denied_actions
            .contains(&"write-provider-receipt-to-l2-without-review".to_string()));
    }

    #[test]
    fn provider_receipt_review_queue_preview_stays_quarantined_and_review_gated() {
        let receipt = loopback_provider_fixture_receipt();
        let preview = preview_provider_receipt_admission_queue(receipt);

        assert_eq!(preview.state, "provider-receipt-review-queue-preview");
        assert_eq!(preview.candidate_count, 1);
        assert_eq!(preview.pending_review_count, 1);
        assert!(!preview.task_artifact_write_started);
        assert!(!preview.durable_zhishu_write_started);
        assert_eq!(
            preview.candidates[0].state,
            "provider-receipt-admission-review-required"
        );
        assert!(preview
            .gates
            .contains(&"human-review-queue-before-task-artifact".to_string()));
        assert!(preview
            .denied_actions
            .contains(&"persist-provider-review-queue-without-store-transaction".to_string()));
    }

    #[test]
    fn rejects_non_json_content_type() {
        let (url, server) = serve_once("200 OK", "text/plain", "not json");

        let error = fetch_source_with_client(url, build_client().unwrap()).unwrap_err();
        server.join().unwrap();

        assert!(error.contains("content type is not JSON"));
    }

    #[test]
    fn rejects_redirect_response() {
        let (url, server) = serve_once("302 Found", "application/json", "{}");

        let error = fetch_source_with_client(url, build_client().unwrap()).unwrap_err();
        server.join().unwrap();

        assert!(error.contains("status 302"));
    }

    #[test]
    fn rejects_response_larger_than_limit() {
        let body = "x".repeat(MAX_HTTP_RESPONSE_BYTES as usize + 1);
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let handle = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0_u8; 1024];
            let _ = stream.read(&mut request);
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            )
            .unwrap();
        });

        let error =
            fetch_source_with_client(format!("http://{address}/source"), build_client().unwrap())
                .unwrap_err();
        handle.join().unwrap();

        assert!(error.contains("exceeds 256 KB"));
    }

    fn serve_once(
        status: &'static str,
        content_type: &'static str,
        body: &'static str,
    ) -> (String, thread::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let handle = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0_u8; 1024];
            let _ = stream.read(&mut request);
            write!(
                stream,
                "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            )
            .unwrap();
        });
        (format!("http://{address}/source"), handle)
    }
}
