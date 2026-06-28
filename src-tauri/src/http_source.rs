use std::io::Read;
use std::time::Duration;

use reqwest::blocking::Client;
use reqwest::redirect::Policy;
use reqwest::Url;
use serde::{Deserialize, Serialize};

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
    pub gates: Vec<String>,
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

fn build_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(HTTP_TIMEOUT_SECONDS))
        .redirect(Policy::none())
        .user_agent("Synapse/0.1 read-only-source")
        .build()
        .map_err(|error| format!("HTTP client could not be created: {error}"))
}

fn fetch_source_with_client(url: String, client: Client) -> Result<HttpSourceReceipt, String> {
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
    let source_id = payload
        .source_id
        .map(|value| bounded_required(value, "source_id"))
        .transpose()?
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

    Ok(HttpSourceReceipt {
        source_url: url.to_string(),
        status_code,
        content_type,
        response_bytes: bytes.len(),
        observation,
        confidence,
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
        assert!(receipt.gates.contains(&"no-redirects".to_string()));
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
