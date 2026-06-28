use crate::{config, scheduler, CapabilityStatus, SystemStatus};

pub(crate) fn status() -> SystemStatus {
    status_from_config(config::read_runtime_config())
}

pub(crate) fn status_from_config(config: config::RuntimeConfig) -> SystemStatus {
    let scheduler_status = scheduler::status(&config);
    let capabilities = capability_statuses(&config, &scheduler_status);

    SystemStatus {
        app_name: config.app_name,
        instance_id: config.instance_id,
        mode: config::display_mode(&config.mode),
        execution_level: config.execution_level,
        failure_strategy: config.failure_strategy,
        memory_scopes: ["L0 Session", "L1 Working", "L2 Knowledge"],
        sandbox: config::display_sandbox(&config.sandbox),
        max_steps: config.max_steps,
        step_timeout_seconds: config.step_timeout_seconds,
        mode_lock_auto: config.mode_lock_auto,
        config_warnings: config.warnings,
        capabilities,
        scheduler_status,
    }
}

fn capability_statuses(
    config: &config::RuntimeConfig,
    scheduler_status: &scheduler::SchedulerStatus,
) -> Vec<CapabilityStatus> {
    let push_delivery_state = if config.external_delivery_enabled {
        "email-guarded"
    } else {
        "disabled"
    };
    let push_delivery_detail = if config.external_delivery_enabled {
        "Email delivery is guarded; Feishu and WeChat remain contract-only adapters."
    } else {
        "External delivery is disabled by default; notification channels remain preview-only until explicitly enabled in local config."
    };
    let agent_state = if config.agent_execution_enabled {
        "guarded"
    } else {
        "disabled"
    };
    let agent_detail = if config.agent_execution_enabled {
        "Agent execution requires detected tools, allowlisting, Task Run approval, and Agent Harness gates."
    } else {
        "Agent process execution is disabled by default under the V6.5 production baseline."
    };

    vec![
        capability(
            "memory-capture",
            "available",
            "Local L0 and reviewed L1 memory writes are enabled.",
        ),
        capability(
            "zhishu-capture",
            "available",
            "Manual knowledge, rule, skill, and script-interface candidates can be captured into L2 review.",
        ),
        capability(
            "zhishu-retrieval",
            "available",
            "Explained metadata-aware search and reviewable relation indexing are enabled.",
        ),
        capability(
            "task-center",
            "available",
            "Directions, candidate mining, review, and run-aware schedule previews are enabled.",
        ),
        capability(
            "policy-enforcement",
            "dry-run",
            "Drivers respect policy readiness, but no external executor is enabled.",
        ),
        capability(
            "protected-recovery",
            "guarded",
            "Zhishu restore, Task Direction active-state rollback, and Arsenal allow-state rollback are protected by pre-change snapshots and audit events.",
        ),
        capability(
            "executor-contract",
            "local-only",
            "Approved local task runs can execute internal candidate mining only.",
        ),
        capability(
            "information-aggregation",
            "read-only",
            "Fixture, manual import, and one configured allowlisted HTTP JSON source are available behind quarantine gates.",
        ),
        capability(
            "context-budget",
            "preview-only",
            "Context packages can be budgeted locally while preserving evidence references and quarantining untrusted sources.",
        ),
        capability(
            "library-home",
            "preview-only",
            "Zhishu memory, task outputs, restore points, and audit metadata can be viewed through a read-only home projection.",
        ),
        capability(
            "codebase-memory",
            "preview-only",
            "CodeGraph-backed project structure can be previewed without command execution, repository-wide scanning, raw file ingestion, automatic L2 writes, or index rebuild.",
        ),
        capability(
            "permission-memory",
            "preview-only",
            "Reusable approval candidates can be reviewed, but they never auto-grant high-risk actions or bypass policy approval.",
        ),
        capability(
            "arsenal-registry",
            "preview-only",
            "Tool registry, allowlist, and PATH discovery are modeled without execution.",
        ),
        capability(
            "agent-harness",
            agent_state,
            agent_detail,
        ),
        capability(
            "browser-automation",
            "guarded",
            "Allowlisted read-only Playwright inspection is available behind dual-tool and Task Run approval gates.",
        ),
        capability(
            "agent-teams",
            if config.agent_execution_enabled { "guarded" } else { "preview-only" },
            "Bounded linear and roundtable graphs can be reviewed; real process execution remains behind Agent Harness gates.",
        ),
        capability(
            "local-app-bridge",
            "guarded",
            "Canonical allowlisted applications can be launched without arguments or session-data extraction.",
        ),
        capability(
            "notification-gateway",
            "guarded",
            "SMTP email delivery is available behind configuration, environment credential, channel, and Task Run approval gates.",
        ),
        capability(
            "device-sync",
            "guarded-local",
            "Zhishu sync packages can be exported, integrity-checked, conflict-previewed, and explicitly imported; relay upload remains dry-run only.",
        ),
        capability(
            "custom-arsenal-tools",
            "preview-only",
            "Optional custom tool descriptors can extend the registry while remaining blocked by default.",
        ),
        capability(
            "memory-synthesis",
            "preview-only",
            "Memory summary and association candidates are modeled without automatic Zhishu writes.",
        ),
        capability(
            "experience-reuse",
            "preview-only",
            "Matched success and avoidance records can appear as plan context hints.",
        ),
        capability(
            "push-delivery",
            push_delivery_state,
            push_delivery_detail,
        ),
        capability(
            "real-network",
            "disabled",
            "Network retrieval remains unavailable in the runtime.",
        ),
        capability(
            "tool-execution",
            "disabled",
            "Agents, scripts, browsers, and local apps are not executed.",
        ),
        capability(
            "scheduler-loop",
            &scheduler_status.background_loop_state,
            &scheduler_status.detail,
        ),
    ]
}

fn capability(name: &str, state: &str, detail: &str) -> CapabilityStatus {
    CapabilityStatus {
        name: name.to_string(),
        state: state.to_string(),
        detail: detail.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_reports_external_delivery_disabled_by_default() {
        let status = status_from_config(config::RuntimeConfig::default());
        let push_delivery = status
            .capabilities
            .iter()
            .find(|capability| capability.name == "push-delivery")
            .unwrap();

        assert_eq!(push_delivery.state, "disabled");
        assert!(push_delivery.detail.contains("disabled by default"));
    }

    #[test]
    fn status_reports_guarded_email_when_external_delivery_is_enabled() {
        let status = status_from_config(config::RuntimeConfig {
            external_delivery_enabled: true,
            ..config::RuntimeConfig::default()
        });
        let push_delivery = status
            .capabilities
            .iter()
            .find(|capability| capability.name == "push-delivery")
            .unwrap();

        assert_eq!(push_delivery.state, "email-guarded");
        assert!(push_delivery.detail.contains("Feishu"));
    }

    #[test]
    fn status_reports_guarded_device_sync_without_relay_upload() {
        let status = status_from_config(config::RuntimeConfig::default());
        let device_sync = status
            .capabilities
            .iter()
            .find(|capability| capability.name == "device-sync")
            .unwrap();

        assert_eq!(device_sync.state, "guarded-local");
        assert!(device_sync.detail.contains("relay upload remains dry-run"));
    }

    #[test]
    fn status_reports_protected_recovery_boundaries() {
        let status = status_from_config(config::RuntimeConfig::default());
        let recovery = status
            .capabilities
            .iter()
            .find(|capability| capability.name == "protected-recovery")
            .unwrap();

        assert_eq!(recovery.state, "guarded");
        assert!(recovery.detail.contains("pre-change snapshots"));
        assert!(recovery.detail.contains("Arsenal"));
    }

    #[test]
    fn status_includes_zhishu_and_custom_tool_capabilities() {
        let status = status_from_config(config::RuntimeConfig::default());

        assert!(status.capabilities.iter().any(|capability| {
            capability.name == "zhishu-capture" && capability.state == "available"
        }));
        assert!(status.capabilities.iter().any(|capability| {
            capability.name == "custom-arsenal-tools" && capability.state == "preview-only"
        }));
    }

    #[test]
    fn status_reports_codebase_memory_as_preview_only() {
        let status = status_from_config(config::RuntimeConfig::default());
        let codebase_memory = status
            .capabilities
            .iter()
            .find(|capability| capability.name == "codebase-memory")
            .unwrap();

        assert_eq!(codebase_memory.state, "preview-only");
        assert!(codebase_memory.detail.contains("CodeGraph"));
        assert!(codebase_memory.detail.contains("without command execution"));
    }

    #[test]
    fn status_reports_permission_memory_as_preview_only() {
        let status = status_from_config(config::RuntimeConfig::default());
        let permission_memory = status
            .capabilities
            .iter()
            .find(|capability| capability.name == "permission-memory")
            .unwrap();

        assert_eq!(permission_memory.state, "preview-only");
        assert!(permission_memory.detail.contains("never auto-grant"));
        assert!(permission_memory.detail.contains("policy approval"));
    }

    #[test]
    fn status_reports_agent_execution_disabled_by_default() {
        let status = status_from_config(config::RuntimeConfig::default());
        let agent_harness = status
            .capabilities
            .iter()
            .find(|capability| capability.name == "agent-harness")
            .unwrap();

        assert_eq!(agent_harness.state, "disabled");
        assert!(agent_harness.detail.contains("disabled by default"));
    }
}
