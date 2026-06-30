use serde::Serialize;

use crate::store;

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
    pub risk_level: String,
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

pub fn preview() -> SourceRegistryPreview {
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
        ],
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
        risk_level: "review-before-enable".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::preview;

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
}
