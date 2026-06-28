use serde::Serialize;

use crate::store;

#[derive(Debug, Clone, Serialize)]
pub struct WebAppShellDescriptor {
    pub id: String,
    pub label: String,
    pub origin: String,
    pub profile_id: String,
    pub allow_state: String,
    pub session_policy: String,
    pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WebAppShellPreview {
    pub generated_at_ms: u128,
    pub state: String,
    pub descriptors: Vec<WebAppShellDescriptor>,
    pub gates: Vec<String>,
    pub denied_actions: Vec<String>,
    pub profile_root: String,
    pub process_started: bool,
}

pub fn preview() -> WebAppShellPreview {
    let descriptors = default_descriptors();
    WebAppShellPreview {
        generated_at_ms: store::now_millis(),
        state: "manual-shell-preview-only".to_string(),
        descriptors,
        gates: vec![
            "built-in-or-reviewed-web-app-descriptor".to_string(),
            "isolated-profile-per-web-app".to_string(),
            "manual-login-only".to_string(),
            "manual-copy-paste-only".to_string(),
            "no-browser-write-automation".to_string(),
            "no-auto-submit-send-publish-or-trade".to_string(),
            "no-sensitive-page-content-read".to_string(),
            "no-cookie-token-or-session-export".to_string(),
            "synapse-guard-required-before-higher-permission".to_string(),
            "process-start-not-implemented".to_string(),
        ],
        denied_actions: vec![
            "auto-login".to_string(),
            "auto-submit".to_string(),
            "auto-send".to_string(),
            "auto-publish".to_string(),
            "auto-trade".to_string(),
            "read-sensitive-page-content".to_string(),
            "export-cookies-or-tokens".to_string(),
            "bypass-platform-risk-controls".to_string(),
        ],
        profile_root: project_root()
            .join(".synapse")
            .join("web-app-shell")
            .display()
            .to_string(),
        process_started: false,
    }
}

fn project_root() -> std::path::PathBuf {
    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri must live inside the project root")
        .to_path_buf()
}

fn default_descriptors() -> Vec<WebAppShellDescriptor> {
    vec![
        descriptor(
            "chatgpt-web",
            "ChatGPT Web",
            "https://chatgpt.com",
            "chatgpt-web",
        ),
        descriptor(
            "github-web",
            "GitHub Web",
            "https://github.com",
            "github-web",
        ),
    ]
}

fn descriptor(id: &str, label: &str, origin: &str, profile_id: &str) -> WebAppShellDescriptor {
    WebAppShellDescriptor {
        id: id.to_string(),
        label: label.to_string(),
        origin: origin.to_string(),
        profile_id: profile_id.to_string(),
        allow_state: "preview-only".to_string(),
        session_policy: "isolated-manual-session-only".to_string(),
        capabilities: vec![
            "windowed-launch-preview".to_string(),
            "manual-login".to_string(),
            "manual-copy-paste".to_string(),
            "no-automation".to_string(),
            "no-session-extraction".to_string(),
        ],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preview_is_manual_and_does_not_start_processes() {
        let preview = preview();

        assert_eq!(preview.state, "manual-shell-preview-only");
        assert!(!preview.process_started);
        assert!(preview
            .gates
            .contains(&"process-start-not-implemented".to_string()));
        assert!(preview.denied_actions.contains(&"auto-login".to_string()));
        assert!(preview
            .denied_actions
            .contains(&"export-cookies-or-tokens".to_string()));
    }

    #[test]
    fn descriptors_are_isolated_manual_sessions() {
        let preview = preview();

        assert!(preview.descriptors.iter().all(|descriptor| {
            descriptor.allow_state == "preview-only"
                && descriptor.session_policy == "isolated-manual-session-only"
                && descriptor
                    .capabilities
                    .contains(&"no-automation".to_string())
        }));
    }
}
