(function () {
  const now = () => Date.now();
  const state = {
    directions: [],
    runs: [],
    candidates: [],
    artifacts: [],
    memory: [],
    providerReceiptReviewCandidates: [],
    notificationPreview: null,
    deviceSyncState: {
      device_id: "device-ui-smoke",
      device_label: "UI Smoke Device",
      last_synced_hash: null,
      last_exported_at_ms: null,
      last_imported_at_ms: null,
    },
    localApps: [
      {
        id: "windows-notepad",
        label: "Windows Notepad",
        executable: "C:\\Windows\\System32\\notepad.exe",
        allow_state: "blocked",
        risk_level: "low",
        session_policy: "app-owned-session-only",
        capabilities: ["launch-only", "no-arguments", "no-session-extraction"],
      },
    ],
    notificationDeliveryAttempts: [
      {
        id: "notification-attempt-ui-smoke",
        idempotency_key: "ui-smoke-idempotency",
        run_id: "run-ui-smoke",
        channel: "feishu",
        state: "outcome-uncertain",
        artifact_id: null,
        audit_event_id: "audit-notification-prepare-ui-smoke",
        detail: "Timeout after request; provider outcome requires human reconciliation.",
        created_at_ms: now(),
        updated_at_ms: now(),
      },
    ],
  };

  function directionFromArgs(args) {
    return {
      id: `direction-${state.directions.length + 1}`,
      created_at_ms: now(),
      updated_at_ms: now(),
      title: args.title,
      description: args.description || "",
      priority: args.priority || 3,
      active: true,
      keywords: args.keywords || [],
      schedule_frequency: args.scheduleFrequency || "manual",
      online_enabled: Boolean(args.onlineEnabled),
      output_template: args.outputTemplate || "auto",
      push_enabled: Boolean(args.pushEnabled && args.pushChannels?.length),
      push_channels: args.pushChannels || [],
    };
  }

  function schedulePreview(direction) {
    return {
      direction_id: direction.id,
      direction_title: direction.title,
      frequency: direction.schedule_frequency,
      next_run_at_ms: null,
      next_run_label: "manual only",
      readiness: direction.active ? "ready-local" : "blocked",
      detail: "UI smoke manual direction.",
      requires_network: direction.online_enabled,
      output_template: direction.output_template,
      push_enabled: direction.push_enabled,
      push_channels: direction.push_channels,
    };
  }

  function runForDirection(direction) {
    return {
      id: `run-${state.runs.length + 1}`,
      created_at_ms: now(),
      task_direction_id: direction.id,
      task_direction_title: direction.title,
      trigger_kind: "manual-request",
      idempotency_key: `manual:${direction.id}`,
      schedule_frequency: direction.schedule_frequency,
      online_enabled: direction.online_enabled,
      output_template: direction.output_template,
      push_enabled: direction.push_enabled,
      push_channels: direction.push_channels,
      lifecycle_state: "awaiting-approval",
      approval_state: "waiting-approval",
      execution_state: "not-started",
      detail: "UI smoke run request recorded.",
      generated_candidate_ids: [],
      started_at_ms: null,
      completed_at_ms: null,
      failed_at_ms: null,
      error_summary: null,
      cancelled_at_ms: null,
      archived_at_ms: null,
      source_candidate_id: null,
    };
  }

  function capability(name, stateValue, detail) {
    return { name, state: stateValue, detail };
  }

  function agentTool(id, label) {
    return {
      id,
      label,
      registry_source: "ui-smoke",
      category: "agent",
      invocation_mode: "native",
      allow_state: "allowed",
      risk_level: "high",
      ingestion_policy: "quarantine-output",
      capabilities: ["agent-harness", "read-only"],
      discovery_state: "detected",
      detected_path: `${id}.cmd`,
    };
  }

  function arsenalPreview() {
    const tools = [
      agentTool("agent-codex", "Codex CLI"),
      agentTool("agent-claude", "Claude Code CLI"),
      {
        id: "mock-cli",
        label: "Mock CLI",
        registry_source: "ui-smoke",
        category: "tool",
        invocation_mode: "mock",
        allow_state: "allowed",
        risk_level: "low",
        ingestion_policy: "quarantine-output",
        capabilities: ["mock-execution"],
        discovery_state: "detected",
        detected_path: "mock-cli.cmd",
      },
    ];
    return {
      registry_state: "preview-ready",
      allowed_tools: tools.filter((tool) => tool.allow_state === "allowed").length,
      blocked_tools: tools.filter((tool) => tool.allow_state !== "allowed").length,
      tools,
      gates: ["ui-smoke-registry", "no-process-spawn"],
    };
  }

  function agentTeamSteps(request) {
    const participants = request.participant_tool_ids || [];
    const steps = [];
    for (let round = 1; round <= Number(request.max_rounds || 1); round += 1) {
      participants.forEach((participant, index) => {
        steps.push({
          order: steps.length + 1,
          phase: `round-${round}`,
          participant_tool_id: participant,
          input_source:
            request.team_mode === "linear" && index > 0
              ? "previous-participant-quarantined-output"
              : "team-goal-and-reviewed-context",
          output_policy:
            request.context_mode === "deep"
              ? "quarantine-then-review-before-memory"
              : "quarantine-only",
        });
      });
      if (request.team_mode === "roundtable") {
        steps.push({
          order: steps.length + 1,
          phase: `round-${round}-synthesis`,
          participant_tool_id: "team-synthesizer",
          input_source: "all-round-quarantined-outputs",
          output_policy: "quarantine-only",
        });
      }
    }
    return steps;
  }

  function agentTeamPreview(request) {
    const run = state.runs.find((item) => item.id === request.run_id);
    if (!run) {
      throw new Error("task run not found");
    }
    const tools = arsenalPreview().tools;
    const participants = (request.participant_tool_ids || [])
      .map((id) => tools.find((tool) => tool.id === id))
      .filter(Boolean);
    const steps = agentTeamSteps(request);
    return {
      run_id: run.id,
      team_mode: request.team_mode,
      context_mode: request.context_mode,
      goal: request.goal,
      state:
        run.lifecycle_state === "approved" &&
        run.approval_state === "approved" &&
        run.execution_state === "approved-not-started" &&
        participants.length >= 2
          ? "blueprint-preview-ready"
          : "blocked-run-not-approved",
      max_rounds: request.max_rounds,
      estimated_agent_calls: steps.length,
      max_agent_calls: request.max_agent_calls || steps.length,
      cancel_after_steps: request.cancel_after_steps || null,
      participants,
      steps,
      gates: [
        "2-to-4-distinct-agents",
        "maximum-3-rounds",
        "explicit-call-budget",
        "per-agent-output-quarantine",
        "no-direct-agent-to-memory-write",
        "task-run-approved",
        "blueprint-preview-only",
        "fake-agent-harness-only",
      ],
      process_started: false,
    };
  }

  function normalizeTags(tags) {
    return (tags || [])
      .map((tag) => String(tag).trim().toLowerCase())
      .filter(Boolean)
      .filter((tag, index, values) => values.indexOf(tag) === index)
      .slice(0, 8);
  }

  function zhishuMemoryFromArgs(args) {
    const itemKind = args.itemKind || "knowledge";
    const hubArea =
      itemKind === "skill" || itemKind === "skill-flow" || itemKind === "script-interface"
        ? "skill"
        : "knowledge";
    return {
      id: `memory-${state.memory.length + 1}`,
      created_at_ms: now(),
      hub_area: hubArea,
      scope: "L2 Knowledge",
      level: "candidate",
      item_type: itemKind,
      admission_state: "captured",
      admission_rule:
        itemKind === "rule"
          ? "rule-review-required"
          : itemKind.startsWith("skill") || itemKind === "script-interface"
            ? "skill-review-required"
            : "knowledge-review-required",
      source: "manual-zhishu",
      provenance: "local-user-input",
      source_trust: "unverified-local",
      content: args.content,
      tags: normalizeTags(args.tags),
      confidence: 0.6,
      verification: "unverified",
      retention_policy: "durable-review",
      authority: "user-reviewable",
      linked_memory_ids: [],
      last_reinforced_at_ms: null,
      last_invalidated_at_ms: null,
    };
  }

  function searchZhishu(args) {
    const query = args.query || {};
    const terms = String(query.text || "")
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const results = state.memory
      .filter((item) => item.admission_state !== "rejected" && item.level !== "rejected")
      .filter((item) => !query.scope || item.scope === query.scope)
      .filter((item) => !query.admission_state || item.admission_state === query.admission_state)
      .filter((item) => {
        if (terms.length === 0) {
          return true;
        }
        const haystack = `${item.content} ${item.tags.join(" ")} ${item.item_type} ${item.hub_area}`.toLowerCase();
        return terms.every((term) => haystack.includes(term));
      })
      .map((item) => ({
        item,
        score: item.admission_state === "accepted" ? 0.95 : 0.65,
        matched_fields: ["content", "tags"],
        explanation: `Matched content and tags with ${Math.round(item.confidence * 100)}% item confidence and ${item.admission_state} admission.`,
      }));
    return {
      query: {
        text: String(query.text || "").trim(),
        filters: [query.scope, query.admission_state].filter(Boolean),
        limit: query.limit || 20,
      },
      total_matches: results.length,
      results,
    };
  }

  function dailyBriefingPreview(template) {
    const query = String(template.query || "").trim();
    const observations = [
      {
        source_id: "fixture-official-primary",
        source_uri: "fixture://official-primary",
        captured_at_ms: now(),
        freshness: "fixture-stable",
        field_coverage: 1,
        normalized_claim: `Fixture observation for: ${query.toLowerCase()}`,
        quarantine_state: "quarantined",
        fallback_used: true,
      },
      {
        source_id: "fixture-secondary",
        source_uri: "fixture://secondary",
        captured_at_ms: now(),
        freshness: "fixture-stable",
        field_coverage: 0.8,
        normalized_claim: `Fixture observation for: ${query.toLowerCase()}`,
        quarantine_state: "quarantined",
        fallback_used: true,
      },
    ];
    const evidenceValidation = {
      observation_count: observations.length,
      source_count: 2,
      distinct_claim_count: 1,
      required_cross_checks: 1,
      cross_check_state: "cross-check-passed",
      conflict_state: "no-conflict-detected",
      quarantine_state: "all-sources-quarantined",
      admission_decision: "reviewable-summary-only",
      summary_allowed: true,
      durable_write_allowed: false,
      gates: [
        "independent-source-count-before-summary",
        "same-claim-or-conflict-review-before-summary",
        "all-source-output-quarantined-before-summary",
        "freshness-visible-before-summary",
        "human-review-before-durable-write",
        "no-automatic-zhishu-admission",
      ],
      blockers: [],
      denied_actions: [
        "summarize-insufficient-cross-checks",
        "write-l2-from-aggregation-without-review",
      ],
    };
    const providerReceipt = {
      receipt_id: `provider-receipt-${now()}`,
      provider_id: "daily-briefing-evidence",
      adapter_kind: "daily-briefing-fixture-evidence",
      execution_mode: "local-fixture-evidence-preview",
      execution_state: "quarantined-receipt-recorded",
      source_url: "fixture://daily-briefing/evidence",
      source_sha256: "d".repeat(64),
      response_bytes: 128,
      external_network_started: false,
      credential_read_started: false,
      process_started: false,
      durable_write_started: false,
      audit_recorded: true,
      quarantine_recorded: true,
      rollback_required: false,
      gates: [
        "provider-adapter-receipt-required",
        "source-sha256-recorded",
        "audit-record-before-admission",
        "quarantine-record-before-use",
        "no-credential-read",
        "no-durable-write-from-provider",
      ],
      denied_actions: [
        "provider-output-without-receipt",
        "provider-output-without-sha256",
        "provider-output-without-quarantine",
        "provider-credential-read-without-guard",
        "provider-durable-write-without-review",
      ],
    };
    const providerAdmissionPreflight = {
      generated_at_ms: now(),
      state: "provider-receipt-admission-review-required",
      provider_id: providerReceipt.provider_id,
      receipt_id: providerReceipt.receipt_id,
      candidate_id: `provider-receipt-candidate-${providerReceipt.source_sha256}`,
      candidate_kind: "zhishu-source-evidence-candidate",
      source_sha256: providerReceipt.source_sha256,
      audit_recorded: true,
      quarantine_recorded: true,
      summary_candidate_created: true,
      task_artifact_write_started: false,
      durable_zhishu_write_started: false,
      requires_human_review: true,
      requires_evidence_validation: true,
      requires_source_trust_review: true,
      requires_conflict_review: true,
      gates: [
        "provider-receipt-audit-required",
        "provider-receipt-quarantine-required",
        "source-sha256-required-before-admission",
        "evidence-validation-before-provider-admission",
        "source-trust-review-before-provider-admission",
        "conflict-review-before-provider-admission",
        "human-review-before-zhishu-admission",
        "no-automatic-l2-write",
      ],
      blockers: [
        "provider-receipt-human-review-not-complete",
        "provider-source-trust-not-reviewed",
        "provider-evidence-validation-not-approved",
      ],
      denied_actions: [
        "write-provider-receipt-to-l2-without-review",
        "promote-provider-output-without-evidence-validation",
        "create-task-artifact-without-approval",
        "skip-provider-source-trust-review",
        "reuse-provider-receipt-without-quarantine",
      ],
    };
    const providerReviewQueuePreview = {
      generated_at_ms: now(),
      state: "provider-receipt-review-queue-preview",
      queue_id: `provider-receipt-review-queue-${providerReceipt.source_sha256}`,
      provider_id: providerReceipt.provider_id,
      receipt_id: providerReceipt.receipt_id,
      candidate_count: 1,
      pending_review_count: 1,
      task_artifact_write_started: false,
      durable_zhishu_write_started: false,
      candidates: [providerAdmissionPreflight],
      gates: [
        "receipt-candidate-quarantine-only",
        "human-review-queue-before-task-artifact",
        "taiheng-approval-before-provider-promotion",
        "no-automatic-l2-write",
      ],
      blockers: [
        "provider-receipt-review-queue-not-persisted",
        "provider-receipt-review-not-approved",
      ],
      denied_actions: [
        "persist-provider-review-queue-without-store-transaction",
        "promote-provider-candidate-without-review",
        "write-provider-candidate-to-task-artifact-without-approval",
      ],
    };
    return {
      title: template.title || "Daily intelligence brief",
      rendered_markdown: `# ${template.title || "Daily intelligence brief"}\n\n## Evidence preview\n- ${observations[0].normalized_claim}`,
      sections: template.sections || ["Key developments", "Risks and uncertainty", "Suggested follow-ups"],
      aggregation: {
        query,
        online_enabled: Boolean(template.online_enabled),
        retrieval_state: template.online_enabled ? "network-disabled-preview" : "local-only-preview",
        required_cross_checks: 1,
        source_policy: {
          freshness_required: false,
          cross_check_required: false,
          injection_defense: "strip-instructions-and-quarantine-source-claims",
          durable_write_gate: "review-before-intelligence-hub-admission",
        },
        source_assessments: [],
        source_gates: [],
        retrieval_contract: {
          readiness: "local-only",
          blocked_reason: "Online retrieval is disabled for this preview.",
          allowed_source_count: 0,
          quarantine_source_count: 1,
          gates: ["no-network-call"],
        },
        observations,
        confidence: {
          score: 0.9,
          source_count: 2,
          average_field_coverage: 0.9,
          conflict_level: "none",
          freshness_state: "stable-fixture",
          admission_state: "quarantined-review-ready",
          notes: ["No observation is eligible for direct Zhishu admission."],
        },
        evidence_validation: evidenceValidation,
      },
      evidence_contract: {
        source_count: 2,
        quarantined_source_count: 2,
        required_cross_checks: 1,
        confidence_score: 0.9,
        conflict_level: "none",
        freshness_state: "stable-fixture",
        admission_state: "quarantined-review-ready",
        archive_state: "reviewable",
        external_delivery_started: false,
        durable_zhishu_write: false,
        evidence_validation: evidenceValidation,
        provider_receipt: providerReceipt,
        provider_admission_preflight: providerAdmissionPreflight,
        provider_review_queue_preview: providerReviewQueuePreview,
        gates: ["quarantine-before-summary", "no-automatic-zhishu-admission"],
        denied_actions: ["send-briefing-without-approval", "write-l2-without-review"],
      },
      archive_gate: "reviewable",
    };
  }

  function dailyBriefingLiveSourcePreflight(template) {
    const requested = Boolean(template.online_enabled);
    return {
      state: requested ? "live-source-staging-blocked-by-default" : "live-source-staging-not-requested",
      query: String(template.query || "").trim(),
      requested_live_sources: requested,
      external_network_started: false,
      durable_zhishu_write: false,
      automatic_delivery_started: false,
      required_cross_checks: 2,
      source_quarantine_required: true,
      gate_enabled: false,
      configured_source_url_present: false,
      configured_source_count: 0,
      provider_gates: [
        {
          provider_id: "public-web-json",
          provider_kind: "configured-http-json",
          allow_state: "blocked-until-provider-review",
          credential_policy: "no-credentials",
          network_policy: "https-get-only-no-redirect",
          rate_limit_policy: "manual-or-low-frequency",
          audit_policy: "audit-before-and-after-provider-fetch",
          quarantine_policy: "quarantine-before-summary",
          rollback_policy: "no-durable-write-to-rollback",
          required_approval: "taiheng-live-source-approval",
          external_network_started: false,
        },
        {
          provider_id: "official-primary-source",
          provider_kind: "official-document-or-standard",
          allow_state: "allowlist-required",
          credential_policy: "credential-guard-required-if-authenticated",
          network_policy: "provider-profile-required",
          rate_limit_policy: "provider-rate-limit-required",
          audit_policy: "source-provenance-and-capture-time-required",
          quarantine_policy: "quarantine-before-briefing-render",
          rollback_policy: "artifact-only-before-human-review",
          required_approval: "source-owner-and-taiheng-review",
          external_network_started: false,
        },
        {
          provider_id: "general-web-source",
          provider_kind: "untrusted-web",
          allow_state: "quarantine-only-blocked-by-default",
          credential_policy: "no-cookies-no-session-reuse",
          network_policy: "anti-injection-review-required",
          rate_limit_policy: "bounded-manual-fetch-only",
          audit_policy: "prompt-injection-and-claim-audit-required",
          quarantine_policy: "quarantine-and-cross-check-before-use",
          rollback_policy: "discardable-observation-only",
          required_approval: "manual-security-review",
          external_network_started: false,
        },
      ],
      gates: [
        "explicit-live-source-approval-required",
        "provider-allowlist-before-network",
        "provider-specific-gate-before-network",
        "credential-policy-before-provider-use",
        "provider-audit-before-network",
        "cross-check-before-summary",
        "quarantine-before-briefing-render",
        "human-review-before-zhishu-admission",
        "no-automatic-external-delivery",
      ],
      blockers: requested
        ? [
            "external-source-network-gate-disabled",
            "configured-http-source-url-required",
            "configured-http-source-cross-check-required",
            "provider-allowlist-required",
            "source-cross-check-plan-required",
            "zhishu-admission-review-required",
          ]
        : ["online-evidence-not-requested"],
      denied_actions: [
        "fetch-live-source-without-approval",
        "fetch-provider-without-allowlist",
        "read-provider-credential-before-approval",
        "summarize-unverified-live-source",
        "write-l2-without-review",
        "send-briefing-without-approval",
      ],
    };
  }

  function systemStatus() {
    return {
      app_name: "Synapse",
      instance_id: "ui-smoke",
      mode: "Lite",
      execution_level: "L0_SINGLE",
      failure_strategy: "auto_fallback",
      memory_scopes: ["L0 Session", "L1 Working", "L2 Knowledge"],
      sandbox: "WASI",
      max_steps: 128,
      step_timeout_seconds: 60,
      mode_lock_auto: true,
      runtime_config_path: "C:\\Users\\ui-smoke\\AppData\\Roaming\\com.synapse.local\\synapse.config.toml",
      storage_data_root: "C:\\Users\\ui-smoke\\AppData\\Roaming\\com.synapse.local\\.synapse",
      config_warnings: [],
      scheduler_status: {
        background_loop_state: "disabled",
        manual_tick_state: "ready-local",
        detail: "UI smoke scheduler.",
        required_gates: [],
      },
      capabilities: [
        capability(
          "memory-capture",
          "available",
          "Local L0 and reviewed L1 memory writes are enabled.",
        ),
        capability("agent-harness", "disabled", "Agent process execution is disabled by default."),
        capability("push-delivery", "disabled", "External delivery is disabled by default."),
        capability("real-network", "disabled", "Network retrieval remains unavailable."),
        capability("tool-execution", "disabled", "Tools are not executed in UI smoke."),
        capability("scheduler-loop", "disabled", "Background scheduler is disabled."),
        capability("device-sync", "guarded-local", "Local package sync only."),
      ],
    };
  }

  function runtimeSettingsPreview(request = {}) {
    return {
      state: "runtime-settings-preview",
      config_path: "C:\\Users\\ui-smoke\\AppData\\Roaming\\com.synapse.local\\synapse.config.toml",
      mode: request.mode || "lite",
      storage_data_dir: request.storage_data_dir || ".synapse",
      scheduler_background_loop_enabled: Boolean(request.scheduler_background_loop_enabled),
      scheduler_poll_interval_seconds: Number(request.scheduler_poll_interval_seconds || 30),
      restart_required: true,
      editable_fields: [
        "system.mode",
        "storage.data_dir",
        "scheduler.background_loop_enabled",
        "scheduler.poll_interval_seconds",
      ],
      blocked_fields: [
        "safety.external_delivery_enabled",
        "safety.agent_execution_enabled",
        "safety.script_execution_enabled",
        "sync.relay.enabled",
      ],
      gates: [
        "low-risk-fields-only",
        "explicit-confirmation-required-before-write",
        "local-backup-before-write",
        "restart-required-before-activation",
      ],
    };
  }

  function runtimeSettingsReceipt(request = {}) {
    return {
      state: "runtime-settings-written-restart-required",
      config_path: "C:\\Users\\ui-smoke\\AppData\\Roaming\\com.synapse.local\\synapse.config.toml",
      backup_path: "C:\\Users\\ui-smoke\\AppData\\Roaming\\com.synapse.local\\synapse.config.toml.bak",
      changed_fields: ["system.mode"],
      restart_required: true,
      request,
    };
  }

  function sourceRegistryPreview() {
    return {
      generated_at_ms: now(),
      state: "preview-only",
      registry_scope: "baigong-taiheng-governance",
      entries: [
        {
          source_id: "akshare_cn_stock",
          name: "AkShare A-share data source",
          type: "financial_market_data",
          scope: "module_specific",
          owner_module: "baigong.cn_alphaforge",
          enabled: false,
          auth_required: false,
          network_profile: "default_proxy",
          rate_limit: "normal",
          storage_policy: "module_local",
          shared_config_allowed: true,
          status: "example-disabled",
          adapter_kind: "python-adapter-preview",
          health_check_policy: "on-demand-or-low-frequency",
          credential_policy: "no-credentials-in-registry",
          observation_policy: "manual-observation-only",
          freshness_policy: "review-before-enable",
          verification_policy: "cross-check-before-use",
          quarantine_policy: "quarantine-before-zhishu-admission",
          risk_level: "review-before-enable",
          last_health_check_at_ms: null,
          last_health_state: "not-checked",
          last_health_observation_id: null,
        },
      ],
      gates: [
        "lightweight-registration-only",
        "no-heavy-data-processing",
        "credential-guard-required-before-auth",
        "taiheng-permission-review-before-enable",
      ],
      denied_actions: ["store-credentials-in-registry", "auto-fetch-live-data"],
    };
  }

  function providerAdapterLoopbackReceipt() {
    return {
      receipt_id: `provider-receipt-${now()}`,
      provider_id: "loopback-fixture-provider",
      adapter_kind: "fixture-json-adapter",
      execution_mode: "loopback-fixture-no-network",
      execution_state: "quarantined-receipt-recorded",
      source_url: "fixture://loopback-provider",
      source_sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      response_bytes: 48,
      external_network_started: false,
      credential_read_started: false,
      process_started: false,
      durable_write_started: false,
      audit_recorded: true,
      quarantine_recorded: true,
      rollback_required: false,
      gates: [
        "provider-adapter-receipt-required",
        "source-sha256-recorded",
        "audit-record-before-admission",
        "quarantine-record-before-use",
        "no-credential-read",
        "no-durable-write-from-provider",
      ],
      denied_actions: [
        "provider-output-without-receipt",
        "provider-output-without-sha256",
        "provider-output-without-quarantine",
        "provider-credential-read-without-guard",
        "provider-durable-write-without-review",
      ],
    };
  }

  function providerReceiptAdmissionPreflight(receipt) {
    return {
      generated_at_ms: now(),
      state: "provider-receipt-admission-review-required",
      provider_id: receipt.provider_id || "loopback-fixture-provider",
      receipt_id: receipt.receipt_id || `provider-receipt-${now()}`,
      candidate_id: `provider-receipt-candidate-${receipt.source_sha256 || "0123456789abcdef"}`,
      candidate_kind: "zhishu-source-evidence-candidate",
      source_sha256: receipt.source_sha256 || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      audit_recorded: Boolean(receipt.audit_recorded),
      quarantine_recorded: Boolean(receipt.quarantine_recorded),
      summary_candidate_created: true,
      task_artifact_write_started: false,
      durable_zhishu_write_started: false,
      requires_human_review: true,
      requires_evidence_validation: true,
      requires_source_trust_review: true,
      requires_conflict_review: true,
      gates: [
        "provider-receipt-audit-required",
        "provider-receipt-quarantine-required",
        "source-sha256-required-before-admission",
        "evidence-validation-before-provider-admission",
        "source-trust-review-before-provider-admission",
        "conflict-review-before-provider-admission",
        "human-review-before-zhishu-admission",
        "no-automatic-l2-write",
      ],
      blockers: [
        "provider-receipt-human-review-not-complete",
        "provider-source-trust-not-reviewed",
        "provider-evidence-validation-not-approved",
      ],
      denied_actions: [
        "write-provider-receipt-to-l2-without-review",
        "promote-provider-output-without-evidence-validation",
        "create-task-artifact-without-approval",
      ],
    };
  }

  function providerReceiptAdmissionQueuePreview(receipt) {
    const candidate = providerReceiptAdmissionPreflight(receipt);
    return {
      generated_at_ms: now(),
      state: "provider-receipt-review-queue-preview",
      queue_id: `provider-receipt-review-queue-${candidate.source_sha256}`,
      provider_id: candidate.provider_id,
      receipt_id: candidate.receipt_id,
      candidate_count: 1,
      pending_review_count: 1,
      task_artifact_write_started: false,
      durable_zhishu_write_started: false,
      candidates: [candidate],
      gates: [
        "receipt-candidate-quarantine-only",
        "human-review-queue-before-task-artifact",
        "taiheng-approval-before-provider-promotion",
        "no-automatic-l2-write",
      ],
      blockers: [
        "provider-receipt-review-queue-not-persisted",
        "provider-receipt-review-not-approved",
      ],
      denied_actions: [
        "persist-provider-review-queue-without-store-transaction",
        "promote-provider-candidate-without-review",
        "write-provider-candidate-to-task-artifact-without-approval",
      ],
    };
  }

  function stageProviderReceiptReviewCandidate(receipt) {
    const queuePreview = providerReceiptAdmissionQueuePreview(receipt);
    const admission = queuePreview.candidates[0];
    const candidate = {
      id: admission.candidate_id,
      created_at_ms: now(),
      provider_id: admission.provider_id,
      receipt_id: admission.receipt_id,
      candidate_kind: admission.candidate_kind,
      source_sha256: admission.source_sha256,
      review_state: "pending-human-review",
      queue_state: queuePreview.state,
      task_artifact_write_started: false,
      durable_zhishu_write_started: false,
      requires_human_review: true,
      gates: queuePreview.gates,
      blockers: queuePreview.blockers,
      denied_actions: queuePreview.denied_actions,
      reviewed_at_ms: null,
      review_decision: null,
    };
    state.providerReceiptReviewCandidates = state.providerReceiptReviewCandidates.filter(
      (item) => item.id !== candidate.id,
    );
    state.providerReceiptReviewCandidates.unshift(candidate);
    return {
      state: "provider-receipt-review-candidate-staged",
      candidate,
      queue_preview: queuePreview,
      snapshot: {
        id: `snapshot-${now()}`,
        object_type: "provider-receipt-review-candidate",
        object_id: candidate.id,
        version: 1,
        reason: "before-provider-receipt-review",
        created_at_ms: now(),
        payload: {},
      },
      audit_event: {
        id: `audit-${now()}`,
        actor: "taiheng",
        action: "stage-provider-receipt-review-candidate",
        target_type: "provider-receipt-review-candidate",
        target_id: candidate.id,
        risk_level: "medium",
        decision: "quarantined-review-required",
        input_hash: "mock",
        result_summary: {},
        error: null,
        created_at_ms: now(),
      },
      saga: {
        id: `saga-${now()}`,
        kind: "provider-receipt-review-candidate",
        target_id: candidate.id,
        state: "committed",
        metadata: {},
        created_at_ms: now(),
        updated_at_ms: now(),
      },
      task_artifact_write_started: false,
      durable_zhishu_write_started: false,
    };
  }

  function reviewProviderReceiptReviewCandidate(candidateId, decision) {
    const candidate = state.providerReceiptReviewCandidates.find((item) => item.id === candidateId);
    if (!candidate) {
      throw new Error("provider receipt review candidate not found");
    }
    candidate.review_decision = decision;
    candidate.reviewed_at_ms = now();
    candidate.review_state =
      decision === "approved" ? "approved-for-task-artifact-review" : "rejected";
    candidate.task_artifact_write_started = false;
    candidate.durable_zhishu_write_started = false;
    return {
      state: "provider-receipt-review-decision-recorded",
      candidate,
      snapshot: {
        id: `snapshot-${now()}`,
        object_type: "provider-receipt-review-candidate",
        object_id: candidate.id,
        version: 2,
        reason: "before-provider-receipt-review-decision",
        created_at_ms: now(),
        payload: {},
      },
      audit_event: {
        id: `audit-${now()}`,
        actor: "taiheng",
        action: "review-provider-receipt-review-candidate",
        target_type: "provider-receipt-review-candidate",
        target_id: candidate.id,
        risk_level: "medium",
        decision,
        input_hash: "mock",
        result_summary: {},
        error: null,
        created_at_ms: now(),
      },
      task_artifact_write_started: false,
      durable_zhishu_write_started: false,
      gates: [
        "approved-candidate-still-needs-task-artifact-review",
        "zhishu-admission-still-requires-separate-review",
        "no-automatic-task-artifact-write",
        "no-automatic-l2-write",
      ],
      denied_actions: [
        "auto-create-task-artifact-after-provider-review",
        "auto-promote-provider-candidate-to-zhishu",
      ],
    };
  }

  function preflightProviderReceiptTaskArtifact(candidateId) {
    const candidate = state.providerReceiptReviewCandidates.find((item) => item.id === candidateId);
    if (!candidate) {
      throw new Error("provider receipt review candidate not found");
    }
    const approved = candidate.review_state === "approved-for-task-artifact-review";
    return {
      generated_at_ms: now(),
      state: approved
        ? "provider-task-artifact-preflight-ready-for-review"
        : "provider-task-artifact-preflight-blocked",
      candidate_id: candidate.id,
      review_state: candidate.review_state,
      provider_id: candidate.provider_id,
      receipt_id: candidate.receipt_id,
      source_sha256: candidate.source_sha256,
      task_artifact_write_started: false,
      durable_zhishu_write_started: false,
      requires_approved_provider_review: true,
      requires_task_artifact_review: true,
      requires_zhishu_admission_review: true,
      gates: [
        "approved-provider-review-required",
        "task-artifact-review-required-before-write",
        "zhishu-admission-still-requires-separate-review",
        "no-automatic-task-artifact-write",
        "no-automatic-l2-write",
      ],
      blockers: approved
        ? ["task-artifact-review-not-complete", "zhishu-admission-not-approved"]
        : [
            "provider-receipt-candidate-not-approved",
            "task-artifact-review-not-complete",
            "zhishu-admission-not-approved",
          ],
      denied_actions: [
        "write-task-artifact-from-provider-preflight",
        "promote-provider-artifact-to-zhishu-without-review",
      ],
    };
  }

  function createProviderReceiptTaskArtifact(candidateId) {
    const preflight = preflightProviderReceiptTaskArtifact(candidateId);
    if (preflight.state !== "provider-task-artifact-preflight-ready-for-review") {
      throw new Error("provider receipt task artifact is not ready");
    }
    const candidate = state.providerReceiptReviewCandidates.find((item) => item.id === candidateId);
    candidate.review_state = "task-artifact-staged";
    candidate.task_artifact_write_started = true;
    candidate.durable_zhishu_write_started = false;
    const artifact = {
      id: `task-artifact-${state.artifacts.length + 1}`,
      run_id: `provider-receipt-run-${candidate.receipt_id}`,
      task_direction_id: "baigong-provider-receipt",
      artifact_type: "provider-receipt-evidence",
      reference_id: candidate.id,
      title: `Provider evidence ${candidate.provider_id}`,
      summary: `Quarantined provider receipt evidence ${candidate.receipt_id}.`,
      metadata: {
        source: "provider-receipt-review-candidate",
        candidate_id: candidate.id,
        provider_id: candidate.provider_id,
        receipt_id: candidate.receipt_id,
        source_sha256: candidate.source_sha256,
        quarantine_state: "task-artifact-review-required",
        zhishu_admission_state: "not-started",
        durable_zhishu_write_started: false,
      },
      created_at_ms: now(),
    };
    state.artifacts.unshift(artifact);
    return {
      state: "provider-task-artifact-staged",
      candidate,
      artifact,
      snapshot: {
        id: `snapshot-${now()}`,
        object_type: "provider-receipt-review-candidate",
        object_id: candidate.id,
        version: 3,
        reason: "before-provider-task-artifact-create",
        created_at_ms: now(),
        payload: {},
      },
      audit_event: {
        id: `audit-${now()}`,
        actor: "taiheng",
        action: "create-provider-receipt-task-artifact",
        target_type: "task-artifact",
        target_id: artifact.id,
        risk_level: "medium",
        decision: "isolated-artifact-created",
        input_hash: "mock",
        result_summary: {},
        error: null,
        created_at_ms: now(),
      },
      saga: {
        id: `saga-${now()}`,
        kind: "provider-receipt-task-artifact",
        target_id: candidate.id,
        state: "committed",
        metadata: {},
        created_at_ms: now(),
        updated_at_ms: now(),
      },
      task_artifact_write_started: true,
      durable_zhishu_write_started: false,
      gates: [
        "isolated-task-artifact-created",
        "artifact-review-required-before-zhishu",
        "zhishu-admission-still-requires-separate-review",
        "no-automatic-l2-write",
      ],
      denied_actions: [
        "auto-promote-provider-artifact-to-zhishu",
        "skip-artifact-review-after-provider-staging",
      ],
    };
  }

  function preflightProviderArtifactZhishuAdmission(artifactId) {
    const artifact = state.artifacts.find((item) => item.id === artifactId);
    if (!artifact) {
      throw new Error("provider task artifact not found");
    }
    const sourceSha = artifact.metadata?.source_sha256 || "";
    const quarantineState = artifact.metadata?.quarantine_state || "missing";
    return {
      generated_at_ms: now(),
      state: "provider-artifact-zhishu-admission-review-required",
      artifact_id: artifact.id,
      artifact_type: artifact.artifact_type,
      reference_id: artifact.reference_id,
      source_sha256: sourceSha,
      quarantine_state: quarantineState,
      task_artifact_write_started: false,
      durable_zhishu_write_started: false,
      requires_artifact_review: true,
      requires_source_trust_review: true,
      requires_zhishu_admission_review: true,
      gates: [
        "provider-artifact-type-required",
        "source-sha256-required-before-admission",
        "artifact-review-required-before-zhishu",
        "source-trust-review-before-provider-admission",
        "review-before-zhishu-admission",
        "no-automatic-l2-write",
      ],
      blockers: [
        "artifact-review-not-approved",
        "provider-source-trust-not-reviewed",
        "zhishu-admission-not-approved",
      ],
      denied_actions: [
        "promote-provider-artifact-to-zhishu-without-review",
        "skip-provider-source-trust-review",
        "write-provider-artifact-to-l2-from-preflight",
      ],
    };
  }

  function reviewProviderArtifactZhishuAdmission(artifactId, decision) {
    const artifact = state.artifacts.find((item) => item.id === artifactId);
    if (!artifact) {
      throw new Error("provider task artifact not found");
    }
    const approved = decision === "approved";
    return {
      state: "provider-artifact-zhishu-admission-reviewed",
      review: {
        id: `provider-artifact-admission-review-${now()}`,
        created_at_ms: now(),
        artifact_id: artifact.id,
        artifact_type: artifact.artifact_type,
        reference_id: artifact.reference_id,
        source_sha256: artifact.metadata?.source_sha256 || "",
        review_state: approved ? "approved-for-zhishu-candidate" : "rejected",
        review_decision: decision,
        reviewed_at_ms: now(),
        durable_zhishu_candidate_write_started: false,
        confirmed_knowledge_write_started: false,
        gates: [
          "artifact-review-complete",
          "source-trust-review-complete",
          "candidate-only-zhishu-admission",
          "confirmed-knowledge-review-still-required",
        ],
        blockers: approved
          ? ["confirmed-knowledge-review-not-complete"]
          : ["provider-artifact-admission-rejected"],
        denied_actions: [
          "auto-confirm-provider-artifact-knowledge",
          "skip-candidate-zhishu-review",
        ],
      },
      snapshot: {
        id: `snapshot-${now()}`,
        object_type: "provider-artifact-admission-review",
        object_id: artifact.id,
        version: 4,
        reason: "before-provider-artifact-admission-review",
        created_at_ms: now(),
        payload: {},
      },
      audit_event: {
        id: `audit-${now()}`,
        actor: "taiheng",
        action: "review-provider-artifact-zhishu-admission",
        target_type: "provider-artifact-admission-review",
        target_id: artifact.id,
        risk_level: "high",
        decision,
        input_hash: "mock",
        result_summary: {},
        error: null,
        created_at_ms: now(),
      },
      durable_zhishu_candidate_write_started: false,
      confirmed_knowledge_write_started: false,
      gates: [
        "provider-artifact-admission-reviewed",
        "candidate-write-requires-explicit-next-step",
        "confirmed-knowledge-review-still-required",
      ],
      denied_actions: [
        "auto-write-provider-artifact-to-zhishu-after-review",
        "auto-confirm-provider-artifact-knowledge",
      ],
    };
  }

  function createProviderArtifactZhishuCandidate(artifactId) {
    const artifact = state.artifacts.find((item) => item.id === artifactId);
    if (!artifact) {
      throw new Error("provider task artifact not found");
    }
    const memoryItem = {
      id: `memory-${state.memory.length + 1}`,
      created_at_ms: now(),
      hub_area: "knowledge",
      scope: "L2 Knowledge",
      level: "candidate",
      item_type: "knowledge",
      admission_state: "candidate",
      admission_rule: "knowledge-review-required",
      source: "provider-artifact-review",
      provenance: "local-runtime",
      source_trust: "unverified-local",
      content: `Provider artifact candidate from ${artifact.metadata?.provider_id || "provider"} / ${
        artifact.metadata?.receipt_id || "receipt"
      }. This is candidate knowledge and still requires final Zhishu confirmation.`,
      tags: ["provider-artifact", "zhishu-candidate", artifact.id],
      confidence: 0.58,
      verification: "review-required",
      retention_policy: "durable-review",
      authority: "user-reviewable",
      linked_memory_ids: [],
      last_reinforced_at_ms: null,
      last_invalidated_at_ms: null,
    };
    state.memory.unshift(memoryItem);
    const review = reviewProviderArtifactZhishuAdmission(artifactId, "approved").review;
    return {
      state: "provider-artifact-zhishu-candidate-created",
      review,
      artifact,
      memory_item: memoryItem,
      snapshot: {
        id: `snapshot-${now()}`,
        object_type: "provider-artifact-zhishu-candidate",
        object_id: artifact.id,
        version: 5,
        reason: "before-provider-artifact-zhishu-candidate-create",
        created_at_ms: now(),
        payload: {},
      },
      audit_event: {
        id: `audit-${now()}`,
        actor: "taiheng",
        action: "create-provider-artifact-zhishu-candidate",
        target_type: "memory-item",
        target_id: memoryItem.id,
        risk_level: "high",
        decision: "candidate-created-review-required",
        input_hash: "mock",
        result_summary: {},
        error: null,
        created_at_ms: now(),
      },
      saga: {
        id: `saga-${now()}`,
        kind: "provider-artifact-zhishu-candidate",
        target_id: artifact.id,
        state: "committed",
        metadata: {},
        created_at_ms: now(),
        updated_at_ms: now(),
      },
      durable_zhishu_candidate_write_started: true,
      confirmed_knowledge_write_started: false,
      gates: [
        "approved-provider-artifact-admission-review",
        "zhishu-candidate-created",
        "confirmed-knowledge-review-still-required",
      ],
      denied_actions: [
        "auto-confirm-provider-artifact-knowledge",
        "skip-final-zhishu-candidate-review",
      ],
    };
  }

  async function invoke(cmd, args = {}) {
    switch (cmd) {
      case "get_system_status":
        return systemStatus();
      case "preview_runtime_settings":
        return runtimeSettingsPreview();
      case "preflight_runtime_settings_update":
        return runtimeSettingsPreview(args.request || {});
      case "update_runtime_settings":
        return runtimeSettingsReceipt(args.request || {});
      case "preview_source_registry":
        return sourceRegistryPreview();
      case "preview_provider_adapter_loopback_receipt":
        return providerAdapterLoopbackReceipt();
      case "preflight_provider_receipt_admission":
        return providerReceiptAdmissionPreflight(args.receipt || {});
      case "preview_provider_receipt_admission_queue":
        return providerReceiptAdmissionQueuePreview(args.receipt || {});
      case "stage_provider_receipt_review_candidate":
        return stageProviderReceiptReviewCandidate(args.receipt || {});
      case "get_provider_receipt_review_candidates":
        return state.providerReceiptReviewCandidates.slice(0, args.limit || 20);
      case "review_provider_receipt_review_candidate":
        return reviewProviderReceiptReviewCandidate(args.candidateId, args.decision);
      case "preflight_provider_receipt_task_artifact":
        return preflightProviderReceiptTaskArtifact(args.candidateId);
      case "create_provider_receipt_task_artifact":
        return createProviderReceiptTaskArtifact(args.candidateId);
      case "preflight_provider_artifact_zhishu_admission":
        return preflightProviderArtifactZhishuAdmission(args.artifactId);
      case "review_provider_artifact_zhishu_admission":
        return reviewProviderArtifactZhishuAdmission(args.artifactId, args.decision);
      case "create_provider_artifact_zhishu_candidate":
        return createProviderArtifactZhishuCandidate(args.artifactId);
      case "preflight_source_enablement":
        return {
          generated_at_ms: now(),
          state: "source-enablement-review-required",
          source_id: args.sourceId || "akshare_cn_stock",
          source_type: "financial_market_data",
          owner_module: "baigong.cn_alphaforge",
          current_status: "example-disabled",
          enabled: false,
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
          gates: [
            "owner-module-review-required",
            "auth-policy-review-required",
            "network-profile-review-required",
            "rate-limit-review-required",
            "storage-policy-review-required",
            "verification-plan-required-before-source-enable",
            "quarantine-plan-required-before-source-enable",
            "anti-injection-defense-required-before-source-enable",
            "human-review-before-enable",
            "no-auto-fetch-before-enable",
          ],
          blockers: [
            "source-enablement-not-approved",
            "verification-plan-not-attached",
            "quarantine-plan-not-attached",
          ],
          denied_actions: [
            "enable-source-without-review",
            "fetch-live-source-before-enable",
            "store-source-output-without-quarantine",
            "persist-credentials-in-registry",
          ],
        };
      case "review_source_enablement":
        return {
          approval: {
            source_id: args.sourceId || "akshare_cn_stock",
            enabled: Boolean(args.enabled),
            reviewed_at_ms: now(),
            review_state: args.enabled ? "enabled-reviewed" : "disabled-reviewed",
          },
          snapshot: { id: `snapshot-${now()}`, object_type: "source-registry-approval" },
          audit_event: { id: `audit-${now()}`, action: "review-source-enablement" },
          saga: { id: `saga-${now()}`, state: "committed" },
        };
      case "preflight_source_health_check":
        return {
          generated_at_ms: now(),
          state: "source-health-check-ready",
          source_id: args.request?.source_id || "akshare_cn_stock",
          enabled: true,
          configured_url_present: true,
          explicit_approval: true,
          network_started: false,
          ready: true,
          blockers: [],
          gates: ["read-only-get-no-redirects-no-credentials"],
        };
      case "execute_source_health_check":
        return {
          state: "source-health-check-recorded",
          source_id: args.request?.source_id || "akshare_cn_stock",
          status_code: 200,
          response_bytes: 128,
          observation: { id: `source-observation-${now()}`, quarantine_state: "quarantined-health-observation" },
          snapshot: { id: `snapshot-${now()}`, object_type: "source-registry-health" },
          audit_event: { id: `audit-${now()}`, action: "execute-source-health-check" },
          saga: { id: `saga-${now()}`, state: "committed" },
        };
      case "preview_arsenal_registry":
        return arsenalPreview();
      case "preview_codebase_memory_adapter":
        return {
          generated_at_ms: now(),
          state: "readonly-structural-preview",
          adapter_mode: "codegraph-mcp-preview",
          index_root: ".codegraph",
          index_present: true,
          process_started: false,
          repository_scanned: false,
          file_content_ingested: false,
          sources: [
            {
              id: "codegraph-index",
              label: "CodeGraph structural index",
              path: ".codegraph",
              state: "available",
              scope: "structural-symbols-only",
            },
          ],
          gates: [
            "codegraph-readonly-structural-context",
            "no-repository-wide-scan",
            "no-file-content-ingest",
            "no-command-execution",
            "no-automatic-l2-write",
            "review-before-zhishu-admission",
          ],
          denied_actions: [
            "run-codegraph-init",
            "rebuild-index-without-approval",
            "ingest-raw-source-files",
            "write-durable-memory",
          ],
        };
      case "preflight_codebase_memory_admission":
        return {
          generated_at_ms: now(),
          state: "codebase-memory-admission-review-required",
          adapter_state: "readonly-structural-preview",
          source_id: args.sourceId || "codegraph-index",
          process_started: false,
          repository_scanned: false,
          file_content_ingested: false,
          l2_write_started: false,
          requires_index_freshness_check: true,
          requires_source_scope_review: true,
          requires_human_summary_review: true,
          requires_zhishu_admission_review: true,
          gates: [
            "codegraph-readonly-structural-context",
            "index-freshness-visible-before-use",
            "source-scope-review-before-admission",
            "human-summary-review-before-l2-write",
            "review-before-zhishu-admission",
            "no-repository-wide-scan",
            "no-file-content-ingest",
            "no-command-execution",
            "no-automatic-l2-write",
          ],
          blockers: [
            "index-freshness-not-confirmed",
            "source-scope-not-reviewed",
            "human-summary-not-approved",
            "zhishu-admission-not-approved",
          ],
          denied_actions: [
            "run-codegraph-init",
            "rebuild-index-without-approval",
            "repository-wide-scan",
            "ingest-raw-source-files",
            "write-durable-memory",
          ],
        };
      case "preview_permission_memory":
        return {
          generated_at_ms: now(),
          state: "candidate-preview-only",
          candidates: [
            {
              id: "pm-local-readonly-code-context",
              scope: "current-project",
              tool_scope: "codegraph-structural-context",
              permission_level: "read-only-observation",
              action_pattern: "reuse structural code context for planning prompts",
              reuse_conditions: [
                "same-project-root",
                "same-tool-scope",
                "no-file-content-ingest",
                "no-command-execution",
                "fresh-audit-reference-required",
              ],
              expires_after: "session-or-24h-review",
              revoked: false,
              audit_ref: "pending-user-review",
              reuse_state: "review-required-before-reuse",
            },
          ],
          gates: [
            "not-a-permanent-whitelist",
            "scope-tool-level-pattern-required",
            "expiry-and-revocation-required",
            "audit-reference-required",
            "high-risk-never-auto-reuse",
            "explicit-review-before-action",
            "no-policy-engine-auto-grant",
          ],
          non_reusable_risks: [
            "cross-project",
            "delete-move-cleanup",
            "account-or-session-action",
            "publish-or-submit",
            "trade-or-financial-action",
            "durable-zhishu-write",
            "external-agent-execution",
          ],
          auto_grants_permissions: false,
        };
      case "preflight_permission_reuse":
        return {
          generated_at_ms: now(),
          state: "permission-reuse-review-required",
          candidate_id: args.candidateId || "pm-local-readonly-code-context",
          candidate_state: "review-required-before-reuse",
          permission_level: "read-only-observation",
          scope: "current-project",
          tool_scope: "codegraph-structural-context",
          requested_action: args.requestedAction || "trade-or-financial-action",
          auto_grant_started: false,
          permission_reused: false,
          durable_policy_write_started: false,
          requires_same_scope: true,
          requires_fresh_audit_reference: true,
          requires_explicit_review: true,
          requires_expiry_check: true,
          high_risk_blocked: true,
          gates: [
            "same-scope-required-before-permission-reuse",
            "same-tool-scope-required-before-permission-reuse",
            "fresh-audit-reference-required",
            "expiry-check-required-before-permission-reuse",
            "explicit-review-before-action",
            "high-risk-never-auto-reuse",
            "no-policy-engine-auto-grant",
          ],
          blockers: [
            "permission-reuse-not-user-approved",
            "fresh-audit-reference-not-attached",
            "expiry-check-not-confirmed",
            "policy-engine-auto-grant-disabled",
          ],
          denied_actions: [
            "cross-project",
            "delete-move-cleanup",
            "account-or-session-action",
            "publish-or-submit",
            "trade-or-financial-action",
            "durable-zhishu-write",
            "external-agent-execution",
            "auto-grant-permission",
          ],
        };
      case "get_local_apps":
        return state.localApps;
      case "get_notification_delivery_attempts":
        return state.notificationDeliveryAttempts;
      case "reconcile_notification_delivery_attempt": {
        const attempt = state.notificationDeliveryAttempts.find((item) => item.id === args.attemptId);
        const retryAllowed = args.decision === "confirmed-not-delivered";
        attempt.state = retryAllowed ? "reconciled-not-delivered" : "reconciled-delivered";
        attempt.detail = `Human reconciliation decision: ${args.decision}`;
        return {
          attempt: { ...attempt },
          decision: args.decision,
          retry_allowed: retryAllowed,
          snapshot: { id: `snapshot-notification-${now()}`, object_type: "notification-delivery-attempt", object_id: attempt.id, version: 1, reason: "before-notification-delivery-reconciliation", created_at_ms: now(), payload: {} },
          audit_event: { id: `audit-notification-reconcile-${now()}`, occurred_at_ms: now(), actor: "local-user", action: "reconcile-notification-delivery", target_type: "notification-delivery-attempt", target_id: attempt.id, risk_level: "critical", decision: args.decision, input: {}, result_summary: { retry_allowed: retryAllowed }, error: null },
          saga: { id: `saga-notification-reconcile-${now()}`, kind: "notification-delivery-reconciliation", target_id: attempt.id, state: "committed", metadata: {}, created_at_ms: now(), updated_at_ms: now() },
        };
      }
      case "set_local_app_allow_state": {
        state.localApps = state.localApps.map((app) =>
          app.id === args.appId ? { ...app, allow_state: args.allowState } : app,
        );
        const changedApp = state.localApps.find((app) => app.id === args.appId);
        return {
          apps: state.localApps,
          changed_app: changedApp,
          snapshot: { id: `snapshot-local-app-${now()}`, object_type: "local-app-allow-state", object_id: args.appId, version: 1, reason: "before-local-app-allow-state-review", created_at_ms: now(), payload: {} },
          audit_event: { id: `audit-local-app-policy-${now()}`, occurred_at_ms: now(), actor: "local-user", action: "set-local-app-allow-state", target_type: "local-app", target_id: args.appId, risk_level: "high", decision: args.allowState, input: {}, result_summary: {}, error: null },
          saga: { id: `saga-local-app-${now()}`, kind: "local-app-allow-state-review", target_id: args.appId, state: "committed", metadata: {}, created_at_ms: now(), updated_at_ms: now() },
        };
      }
      case "preview_local_app_launch": {
        const request = args.request || {};
        const app = state.localApps.find((item) => item.id === request.app_id) || state.localApps[0];
        const run = state.runs.find((item) => item.id === request.run_id);
        return {
          app,
          run_id: request.run_id,
          state:
            app.allow_state !== "allowed"
              ? "blocked-app-not-allowed"
              : run?.approval_state === "approved"
                ? "ready-for-explicit-launch-approval"
                : "blocked-run-not-approved",
          bridge_discovery_state: "detected",
          bridge_allow_state: "allowed",
          argument_preview: [app.executable],
          task_approval_state: run?.approval_state || "missing",
          gates: ["app-allowlisted", "task-run-approved", "explicit-launch-confirmation"],
          process_started: false,
        };
      }
      case "execute_local_app_launch": {
        const request = args.request || {};
        const app = state.localApps.find((item) => item.id === request.app_id) || state.localApps[0];
        const artifact = {
          id: `artifact-local-app-${now()}`,
          run_id: request.run_id,
          task_direction_id: "direction-ui-smoke",
          artifact_type: "local-app-launch-receipt",
          reference_id: `local-app-launch-${now()}`,
          title: `Launched ${app.label}`,
          summary: "Started approved local application without arguments.",
          metadata: { app_id: app.id, credentials_read: false, window_content_read: false },
          created_at_ms: now(),
        };
        return {
          preview: await window.__TAURI_INTERNALS__.invoke("preview_local_app_launch", { request }),
          state: "launched-app-owned-session",
          process_id: 4242,
          artifact,
          audit_event: {
            id: `audit-local-app-${now()}`,
            occurred_at_ms: now(),
            actor: "taiheng",
            action: "execute-local-app-launch",
            target_type: "local-app",
            target_id: app.id,
            risk_level: "high",
            decision: "launched-app-owned-session",
            input: { run_id: request.run_id, approved: true },
            result_summary: { artifact_id: artifact.id, process_id: 4242 },
            error: null,
          },
        };
      }
      case "get_device_sync_state":
        return state.deviceSyncState;
      case "export_device_sync_package": {
        const pkg = {
          schema_version: 1,
          package_id: `sync-package-${now()}`,
          source_device_id: state.deviceSyncState.device_id,
          source_device_label: state.deviceSyncState.device_label,
          created_at_ms: now(),
          base_hash: state.deviceSyncState.last_synced_hash,
          content_hash: "ui-smoke-content-hash",
          zhishu: { schema_version: 1, memory_items: [], relations: [], maintenance_findings: [] },
        };
        state.deviceSyncState.last_exported_at_ms = pkg.created_at_ms;
        return pkg;
      }
      case "preflight_device_sync_import_apply":
        return {
          generated_at_ms: now(),
          package_id: "sync-package-ui-smoke",
          source_device_id: "device-ui-smoke",
          local_device_id: state.deviceSyncState.device_id,
          state: "device-sync-import-apply-review-required",
          preview_state: "initial-import-ready",
          can_apply: true,
          allow_replace: Boolean(args.allowReplace),
          requires_explicit_replace: false,
          import_started: false,
          durable_write_started: false,
          backup_required: true,
          audit_required: true,
          rollback_snapshot_required: true,
          cloud_source_of_truth: false,
          gates: [
            "schema-version-check",
            "sha256-content-integrity",
            "device-identity-visible",
            "base-hash-conflict-detection",
            "rollback-snapshot-before-import",
            "audit-required-before-device-sync-import",
            "local-device-remains-source-of-truth",
            "no-automatic-merge",
          ],
          blockers: ["rollback-snapshot-not-created", "import-audit-record-not-opened"],
          denied_actions: [
            "import-without-preview",
            "replace-without-explicit-approval",
            "cloud-relay-as-source-of-truth",
            "automatic-merge",
          ],
        };
      case "preflight_local_app_launch": {
        const request = args.request || {};
        const app = state.localApps.find((item) => item.id === request.app_id) || state.localApps[0];
        const run = state.runs.find((item) => item.id === request.run_id);
        const launchState =
          app.allow_state !== "allowed"
            ? "blocked-app-not-allowed"
            : run?.approval_state === "approved"
              ? "ready-for-explicit-launch-approval"
              : "blocked-run-not-approved";
        return {
          generated_at_ms: now(),
          state: "local-app-launch-preflight-review-required",
          launch_state: launchState,
          app_id: app.id,
          run_id: request.run_id,
          process_started: false,
          argument_count: 1,
          user_arguments_allowed: false,
          credentials_read: false,
          window_content_read: false,
          requires_bridge_allowlist: true,
          requires_app_allowlist: true,
          requires_task_approval: true,
          requires_explicit_launch_confirmation: true,
          audit_required: true,
          session_blind: true,
          gates: [
            "built-in-or-reviewed-app-descriptor",
            "bridge-tool-allowlisted",
            "app-allowlisted",
            "task-run-approved",
            "explicit-launch-confirmation",
            "argument-vector-only",
            "no-user-supplied-executable",
            "no-user-supplied-arguments",
            "no-credential-or-session-extraction",
            "no-window-content-reading",
            "audit-required-before-local-app-launch",
          ],
          blockers: ["local-app-not-allowlisted"],
          denied_actions: [
            "user-supplied-executable",
            "user-supplied-arguments",
            "credential-read",
            "session-extraction",
            "window-content-read",
            "background-launch-without-confirmation",
          ],
        };
      }
      case "preview_skill_library":
        return {
          generated_at_ms: now(),
          state: "guarded-skill-library-preview",
          registry_scope: "ui-smoke-manifests",
          manifests: [
            {
              skill_id: "skill.safe-release-review",
              name: "Safe release review",
              owner_center: "Zhishu",
              governed_by: "Taiheng",
              version: "0.0.0-preview",
              manifest_state: "review-required",
              execution_mode: "manual-procedure-preview",
              script_adapter: "none",
              permission_level: "read-only-guidance",
              admission_policy: "zhishu-review-before-reuse",
              rollback_policy: "supersede-manifest-version",
              tests_required: ["i18n-check", "ui-smoke"],
              safety_gates: ["versioned-skill-manifest", "taiheng-permission-review"],
            },
            {
              skill_id: "script.safe-system-inventory",
              name: "Safe system inventory script adapter",
              owner_center: "Baigong",
              governed_by: "Taiheng",
              version: "1.0.0",
              manifest_state: "built-in-hash-locked",
              execution_mode: "guarded-read-only-script",
              script_adapter: "powershell-safe-system-inventory",
              permission_level: "no-system-mutation",
              admission_policy: "quarantine-output-before-zhishu-review",
              rollback_policy: "restore-point-required-before-real-action",
              tests_required: ["script-adapter-contract-test", "no-mutation-smoke"],
              safety_gates: [
                "allowlisted-script-path-required",
                "script-hash-required",
                "explicit-approval-required",
              ],
            },
          ],
          execution_contracts: [
            {
              skill_id: "skill.safe-release-review",
              state: "execution-blocked-preview-only",
              process_started: false,
              script_content_read: false,
              durable_zhishu_write: false,
              requires_explicit_approval: true,
              requires_test_receipt: true,
              output_policy: "quarantine-before-review",
              denied_actions: ["spawn-process", "read-script-content", "write-durable-memory"],
            },
            {
              skill_id: "script.safe-system-inventory",
              state: "execution-blocked-preview-only",
              process_started: false,
              script_content_read: false,
              durable_zhishu_write: false,
              requires_explicit_approval: true,
              requires_test_receipt: true,
              output_policy: "quarantine-before-review",
              denied_actions: ["spawn-process", "read-script-content", "write-durable-memory"],
            },
          ],
          gates: [
            "versioned-skill-manifest-required",
            "taiheng-approval-before-process-start",
            "zhishu-admission-review-required",
          ],
          denied_actions: ["run-unreviewed-script", "spawn-process", "write-l2-without-review"],
          process_started: false,
          script_content_read: false,
          durable_zhishu_write: false,
        };
      case "preflight_skill_script_execution": {
        const skillRequest = args.request || {};
        return {
          generated_at_ms: now(),
          state: "script-execution-blocked-by-default",
          skill_id: skillRequest.skill_id || "script.safe-system-inventory",
          script_adapter: "powershell-safe-system-inventory",
          manifest_state: "built-in-hash-locked",
          process_started: false,
          script_content_read: false,
          durable_zhishu_write: false,
          filesystem_mutation_started: false,
          network_call_started: false,
          requires_allowlisted_script_path: true,
          requires_script_hash: true,
          requires_explicit_approval: true,
          requires_test_receipt: true,
          requires_quarantine_output: true,
          requires_rollback_plan: true,
          gates: [
            "allowlisted-script-path-required",
            "script-hash-required-before-execution",
            "taiheng-approval-before-process-start",
            "test-receipt-before-reuse",
            "quarantine-output-before-zhishu-review",
            "rollback-plan-required-before-script-execution",
            "least-privilege-sandbox-required",
          ],
          blockers: [
            "script-execution-gate-disabled",
          ],
          denied_actions: [
            "execute-unregistered-script",
            "pass-user-script-arguments",
            "modify-filesystem",
            "network-call",
            "write-durable-memory",
          ],
          run_id: skillRequest.run_id || "",
          task_approval_state: "approved",
          executor_enabled: false,
          script_path_allowlisted: true,
          script_hash_verified: true,
          expected_sha256: "d18be7479b9514e4959251d06101694dbf9aefe0b8f15568847d00d003ac95c2",
          actual_sha256: "d18be7479b9514e4959251d06101694dbf9aefe0b8f15568847d00d003ac95c2",
          powershell_available: true,
        };
      }
      case "execute_skill_script":
        throw new Error("script execution is disabled in UI smoke");
      case "preview_information_aggregation":
        return dailyBriefingPreview({
          title: "UI smoke aggregation preview",
          query: args.query || "UI smoke aggregation query",
          online_enabled: Boolean(args.onlineEnabled),
        }).aggregation;
      case "preview_daily_briefing":
        return dailyBriefingPreview(args.template || {});
      case "review_daily_briefing_scheduled_archive": {
        const scheduledRuns = state.runs.filter((run) => run.trigger_kind === "schedule-tick");
        const eligible = scheduledRuns.filter(
          (run) =>
            run.lifecycle_state === "approved" &&
            run.approval_state === "approved" &&
            run.execution_state === "approved-not-started",
        );
        const pending = scheduledRuns.filter(
          (run) =>
            run.lifecycle_state === "awaiting-approval" &&
            run.approval_state === "waiting-approval",
        );
        const blocked = scheduledRuns.filter(
          (run) => !eligible.includes(run) && !pending.includes(run),
        );
        return {
          generated_at_ms: now(),
          state: eligible.length
            ? "scheduled-briefing-archive-review-ready"
            : "scheduled-briefing-archive-review-waiting-approval",
          eligible_run_ids: eligible.map((run) => run.id),
          pending_approval_run_ids: pending.map((run) => run.id),
          blocked_run_ids: blocked.map((run) => run.id),
          automatic_archive_started: false,
          external_network_started: false,
          durable_zhishu_write: false,
          gates: [
            "schedule-tick-requires-human-approval",
            "briefing-preview-required-before-archive",
            "manual-archive-selection-required",
          ],
          denied_actions: [
            "auto-archive-scheduled-briefing",
            "auto-fetch-live-sources-for-scheduled-briefing",
            "auto-deliver-scheduled-briefing",
            "auto-admit-scheduled-briefing-to-zhishu",
          ],
        };
      }
      case "archive_daily_briefing": {
        const run = state.runs.find((item) => item.id === args.runId);
        if (!run || run.lifecycle_state !== "approved") {
          throw new Error("daily briefing archive requires an approved run");
        }
        const preview = dailyBriefingPreview(args.template || {});
        const artifact = {
          id: `task-artifact-${now()}`,
          reference_id: `daily-briefing-${now()}`,
          artifact_type: "daily-briefing",
        };
        run.lifecycle_state = "succeeded";
        run.execution_state = "completed";
        return {
          preview,
          observations: preview.aggregation.observations.map((observation, index) => ({
            id: `source-observation-${now()}-${index}`,
            ...observation,
          })),
          artifact,
          run,
          snapshot: { id: `snapshot-${now()}`, object_type: "daily-briefing-archive" },
          audit_event: { id: `audit-${now()}`, action: "archive-daily-briefing" },
          saga: { id: `saga-${now()}`, state: "committed" },
        };
      }
      case "review_daily_briefing_delivery":
        return {
          artifact_id: args.artifactId,
          run_id: state.runs.find((run) => run.lifecycle_state === "succeeded")?.id || "run-daily-briefing",
          state: "daily-briefing-delivery-review-recorded",
          notification_previews: [],
          delivery_started: false,
          external_network_started: false,
          durable_zhishu_write: false,
          gates: ["notification-gateway-preview-only"],
          denied_actions: ["auto-deliver-daily-briefing"],
        };
      case "preflight_daily_briefing_live_sources":
        return dailyBriefingLiveSourcePreflight(args.template || {});
      case "fetch_daily_briefing_live_source":
        throw new Error("daily briefing live source fetch is blocked in UI smoke");
      case "preflight_browser_write_action_staging": {
        const request = args.request || {};
        const rawUrl = String(request.url || "").trim();
        const host = rawUrl.replace(/^https?:\/\//, "").split(/[/?#]/)[0].toLowerCase();
        return {
          run_id: request.run_id,
          url: rawUrl,
          host,
          state: "browser-write-staging-blocked-by-default",
          process_started: false,
          web_mutation_started: false,
          task_content_sent: false,
          approval_required: true,
          action_policy: {
            mode: "read-only-default-write-blocked",
            read_actions: ["navigate-http-get", "capture-title", "capture-visible-text"],
            write_actions_allowed: [],
            write_actions_denied: ["click", "type", "form-submit", "file-upload", "download"],
            approval_required_for_write: true,
            anti_injection_policy: "strip-source-instructions-and-revalidate-action-intent",
            audit_policy: "record-preview-decision-and-quarantine-output-before-admission",
            rollback_policy: "write-actions-require-domain-specific-rollback-or-manual-recovery-plan",
            denied_reasons: [
              "no-write-allowlist-configured",
              "no-human-approval-for-browser-write",
              "no-rollback-contract-for-web-mutation",
              "no-trusted-action-plan",
            ],
          },
          requested_write_actions: ["click", "type", "form-submit", "file-upload", "download"],
          gates: [
            "browser-write-allowlist-required",
            "explicit-human-approval-required",
            "anti-injection-revalidation-required",
            "rollback-contract-required",
            "audit-before-and-after-write",
            "output-quarantine-before-zhishu-admission",
          ],
          blockers: [
            "no-write-allowlist-configured",
            "no-human-approval-for-browser-write",
            "no-rollback-contract-for-web-mutation",
            "no-trusted-action-plan",
          ],
          denied_actions: [
            "click-without-allowlist",
            "type-without-approval",
            "submit-form-without-rollback",
            "upload-or-download-without-policy",
            "payment-trade-or-publish",
          ],
        };
      }
      case "get_task_directions":
        return state.directions;
      case "get_task_schedule_previews":
        return state.directions.map(schedulePreview);
      case "get_task_candidates":
        return state.candidates;
      case "get_task_run_records":
        return state.runs;
      case "get_task_artifacts":
        return state.artifacts;
      case "get_recent_memory_items":
        return state.memory;
      case "get_object_snapshots":
      case "get_zhishu_relations":
      case "get_zhishu_maintenance_findings":
        return [];
      case "capture_zhishu_item": {
        const item = zhishuMemoryFromArgs(args);
        state.memory = [item, ...state.memory];
        return item;
      }
      case "review_memory_item": {
        const item = state.memory.find((memoryItem) => memoryItem.id === args.memoryId);
        if (!item) {
          throw new Error("memory item not found");
        }
        if (args.decision === "accepted") {
          item.admission_state = "accepted";
          item.verification = "review-accepted";
          item.level = "reviewed";
          item.source_trust = "reviewed-local";
          item.last_reinforced_at_ms = now();
        } else {
          item.admission_state = "rejected";
          item.verification = "rejected";
          item.level = "rejected";
          item.last_invalidated_at_ms = now();
        }
        return item;
      }
      case "review_provider_artifact_zhishu_candidate": {
        const item = state.memory.find((memoryItem) => memoryItem.id === args.memoryId);
        if (!item) {
          throw new Error("memory item not found");
        }
        if (item.source !== "provider-artifact-review") {
          throw new Error("memory item is not a provider artifact Zhishu candidate");
        }
        if (args.decision === "accepted") {
          item.admission_state = "accepted";
          item.verification = "review-accepted";
          item.level = "reviewed";
          item.source_trust = "reviewed-local";
          item.last_reinforced_at_ms = now();
        } else {
          item.admission_state = "rejected";
          item.verification = "rejected";
          item.level = "rejected";
          item.last_invalidated_at_ms = now();
        }
        return {
          state:
            args.decision === "accepted"
              ? "provider-artifact-zhishu-candidate-accepted"
              : "provider-artifact-zhishu-candidate-rejected",
          memory_item: item,
          decision: args.decision,
          confirmed_knowledge_write_started: false,
          gates: [
            "final-zhishu-candidate-review-complete",
            "provider-artifact-source-trace-retained",
            "no-automatic-provider-knowledge-confirmation",
          ],
          denied_actions: [
            "auto-confirm-provider-artifact-knowledge",
            "bypass-provider-candidate-final-review",
          ],
        };
      }
      case "search_zhishu":
        return searchZhishu(args);
      case "save_task_direction": {
        const direction = directionFromArgs(args);
        state.directions = [direction, ...state.directions];
        return direction;
      }
      case "request_task_run": {
        const direction = state.directions.find((item) => item.id === args.directionId);
        if (!direction) {
          throw new Error("direction not found");
        }
        const run = runForDirection(direction);
        state.runs = [run, ...state.runs];
        return run;
      }
      case "task_scheduler_tick": {
        const createdRuns = [];
        let skipped = 0;
        for (const direction of state.directions.filter((item) => item.active)) {
          if (direction.schedule_frequency === "manual") {
            skipped += 1;
            continue;
          }
          if (state.runs.some((run) => run.task_direction_id === direction.id && ["awaiting-approval", "approved"].includes(run.lifecycle_state))) {
            skipped += 1;
            continue;
          }
          const run = runForDirection(direction);
          run.trigger_kind = "schedule-tick";
          run.idempotency_key = `schedule-tick:${direction.id}:${now()}`;
          createdRuns.push(run);
          state.runs = [run, ...state.runs];
        }
        return {
          generated_at_ms: now(),
          created_run_count: createdRuns.length,
          skipped_run_count: skipped,
          created_runs: createdRuns,
          detail: "UI smoke scheduler tick recorded due runs only; no execution was started.",
        };
      }
      case "review_task_run": {
        const run = state.runs.find((item) => item.id === args.runId);
        if (!run) {
          throw new Error("run not found");
        }
        run.lifecycle_state = args.approved ? "approved" : "blocked";
        run.approval_state = args.approved ? "approved" : "rejected";
        run.execution_state = args.approved ? "approved-not-started" : "blocked";
        run.detail = args.approved ? "UI smoke run approved." : "UI smoke run rejected.";
        return run;
      }
      case "execute_task_run": {
        const run = state.runs.find((item) => item.id === args.runId);
        if (!run) {
          throw new Error("run not found");
        }
        const candidate = {
          id: `candidate-${state.candidates.length + 1}`,
          created_at_ms: now(),
          task_direction_id: run.task_direction_id,
          task_direction_title: run.task_direction_title,
          memory_item_id: "ui-smoke-memory",
          summary: `${run.task_direction_title} -> UI smoke opportunity`,
          score: 0.8,
          score_components: {
            keyword_score: 0.3,
            priority_score: 0.3,
            memory_confidence: 0.2,
            final_score: 0.8,
          },
          matched_keywords: ["workflow", "template"],
          evidence: [{ label: "Resolved output template", value: "opportunity" }],
          explanation: "UI smoke generated candidate.",
          status: "candidate",
          reviewed_at_ms: null,
          review_decision: null,
          promoted_memory_id: null,
          source_candidate_id: null,
        };
        const artifact = {
          id: `artifact-${state.artifacts.length + 1}`,
          run_id: run.id,
          task_direction_id: run.task_direction_id,
          artifact_type: "task-candidate",
          reference_id: candidate.id,
          title: run.task_direction_title,
          summary: candidate.summary,
          metadata: { score: candidate.score, status: candidate.status },
          created_at_ms: now(),
        };
        run.lifecycle_state = "succeeded";
        run.execution_state = "completed";
        run.detail = "UI smoke local executor completed.";
        run.started_at_ms = now();
        run.completed_at_ms = now();
        run.generated_candidate_ids = [candidate.id];
        state.candidates = [candidate, ...state.candidates];
        state.artifacts = [artifact, ...state.artifacts];
        return { run, generated_candidates: [candidate], artifacts: [artifact] };
      }
      case "promote_task_artifact_to_zhishu": {
        const artifact = state.artifacts.find((item) => item.id === args.artifactId);
        if (!artifact) {
          throw new Error("artifact not found");
        }
        const memoryItem = {
          id: `memory-${state.memory.length + 1}`,
          created_at_ms: now(),
          hub_area: "knowledge",
          scope: "L1 Working",
          level: "reviewed",
          item_type: args.itemKind || "knowledge",
          admission_state: "accepted",
          admission_rule: "task-artifact-promotion",
          source: "task-artifact",
          provenance: "ui-smoke",
          source_trust: "reviewed-local",
          content: artifact.summary,
          tags: [`artifact:${artifact.id}`],
          confidence: 0.8,
          verification: "review-accepted",
          retention_policy: "durable",
          authority: "user-reviewable",
          linked_memory_ids: [],
          last_reinforced_at_ms: null,
          last_invalidated_at_ms: null,
        };
        state.memory = [memoryItem, ...state.memory];
        return { artifact, memory_item: memoryItem, snapshot: null, audit_event: null };
      }
      case "preview_notification": {
        const run = state.runs.find((item) => item.id === args.request.run_id);
        if (!run) {
          throw new Error("task run not found");
        }
        const channel = String(args.request.channel || "").toLowerCase();
        const subject = String(args.request.subject || "").trim();
        const body = String(args.request.body || "").trim();
        const webhookStagingPolicy =
          channel === "feishu" || channel === "wechat"
            ? {
                mode: "staging-contract-external-delivery-disabled",
                channel,
                signature_policy: "platform-signature-or-hmac-required-before-real-send",
                retry_policy: "bounded-retry-with-idempotency-key-and-backoff",
                redaction_policy: "redact-webhook-url-token-and-response-before-audit",
                error_classes: [
                  "configuration-missing",
                  "credential-missing",
                  "network-disabled",
                  "http-non-success",
                  "timeout",
                  "rate-limited",
                  "payload-rejected",
                ],
                external_delivery_gate: "safety.external_delivery_enabled",
                approval_required: true,
                external_delivery_started: false,
                network_started: false,
                denied_actions: [
                  "send-real-webhook",
                  "persist-webhook-secret",
                  "retry-without-idempotency",
                  "deliver-without-task-approval",
                  "deliver-without-redaction",
                ],
              }
            : null;
        const webhookStagingEnvelope =
          channel === "feishu" || channel === "wechat"
            ? {
                contract: "synapse.notification.webhook.staging.v1",
                channel,
                idempotency_key: `synapse-webhook-ui-smoke-${channel}`,
                payload_sha256: "a".repeat(64),
                body_preview_chars: Math.min(Array.from(body).length, 240),
                destination_configured: channel !== "email",
                endpoint_redaction: "configured-secret-redacted",
                required_headers: [
                  "content-type: application/json",
                  "platform-signature-or-hmac",
                  "x-synapse-idempotency-key",
                ],
                admission_state: "preview-only-not-deliverable",
                expires_after_secs: 300,
                external_delivery_started: false,
                network_started: false,
              }
            : null;
        const preview = {
          run_id: run.id,
          channel,
          state:
            run.lifecycle_state === "approved" &&
            run.approval_state === "approved" &&
            run.execution_state === "approved-not-started" &&
            run.push_enabled &&
            run.push_channels.includes(channel)
              ? channel === "email"
                ? "blocked-external-delivery-disabled"
                : "adapter-preview-only"
              : "blocked-channel-not-enabled-for-run",
          subject,
          body_chars: Array.from(body).length,
          task_push_enabled: run.push_enabled,
          task_push_channels: run.push_channels,
          endpoint_configured: channel !== "email",
          credentials_present: false,
          gates: [
            "task-run-approved",
            "channel-enabled-for-run",
            "configured-endpoint-only",
            "credentials-from-environment-only",
            "explicit-delivery-confirmation",
            "bounded-message-size",
            "no-credential-persistence",
            "delivery-receipt-artifact",
          ],
          delivery_started: false,
          webhook_staging_policy: webhookStagingPolicy,
          webhook_staging_envelope: webhookStagingEnvelope,
        };
        state.notificationPreview = preview;
        return preview;
      }
      case "execute_email_notification": {
        const preview = state.notificationPreview;
        if (!args.approved || !preview || preview.state !== "adapter-preview-only") {
          throw new Error("notification mock webhook was blocked");
        }
        const run = state.runs.find((item) => item.id === preview.run_id);
        if (!run) {
          throw new Error("task run not found");
        }
        const artifact = {
          id: `artifact-${state.artifacts.length + 1}`,
          run_id: run.id,
          task_direction_id: run.task_direction_id,
          artifact_type: "notification-dry-run-receipt",
          reference_id: `${preview.channel}-dry-run-${now()}`,
          title: preview.subject,
          summary: `${preview.channel} notification mock webhook receipt recorded. No external delivery was started.`,
          metadata: {
            channel: preview.channel,
            mock_webhook_delivery: {
              attempts: 0,
              final_status: "mock-only-no-endpoint",
              failure_class: "none",
              redacted_endpoint: null,
            },
            external_delivery_started: false,
            credentials_persisted: false,
            task_run_completed: false,
          },
          created_at_ms: now(),
        };
        state.artifacts = [artifact, ...state.artifacts];
        return {
          preview,
          state: "mock-webhook-receipt-recorded",
          server_response: `mock-webhook-accepted:${preview.channel}:ui-smoke`,
          artifact,
        };
      }
      case "preflight_webhook_staging": {
        const preview = state.notificationPreview;
        const channel = String(args.request.channel || "").toLowerCase();
        if (!preview || preview.channel !== channel || preview.state !== "adapter-preview-only") {
          throw new Error("webhook staging preflight was blocked");
        }
        return {
          channel,
          state: "staging-webhook-blocked",
          endpoint_scope: "http-loopback-staging-only",
          endpoint_configured: true,
          endpoint_allowed_for_staging: false,
          signature_material_present: false,
          external_delivery_gate_enabled: false,
          approval_required: true,
          delivery_started: false,
          network_started: false,
          checks: [
            "approved-task-run-required",
            "channel-preview-state-required",
            "loopback-staging-endpoint-required",
            "signature-material-required",
            "external-delivery-gate-required",
            "explicit-send-approval-required",
            "no-secret-persistence",
            "no-network-started-during-preflight",
          ],
          blocked_reasons: [
            "endpoint-not-loopback-staging",
            "signature-material-missing",
            "external-delivery-gate-disabled",
          ],
        };
      }
      case "preflight_webhook_production": {
        const preview = state.notificationPreview;
        const channel = String(args.request.channel || "").toLowerCase();
        if (!preview || preview.channel !== channel || preview.state !== "adapter-preview-only") {
          throw new Error("webhook production preflight was blocked");
        }
        return {
          channel,
          state: "production-webhook-blocked",
          endpoint_scope: "official-feishu-wechat-https-only",
          endpoint_configured: true,
          endpoint_allowed_for_production: false,
          signature_material_present: false,
          external_delivery_gate_enabled: false,
          approval_required: true,
          audit_required: true,
          redaction_required: true,
          delivery_started: false,
          network_started: false,
          checks: [
            "approved-task-run-required",
            "channel-preview-state-required",
            "official-provider-https-endpoint-required",
            "signature-material-required",
            "external-delivery-gate-required",
            "final-human-send-approval-required",
            "audit-event-required-before-send",
            "redacted-endpoint-and-response-required",
            "bounded-retry-with-idempotency-required",
            "no-network-started-during-preflight",
          ],
          blocked_reasons: [
            "endpoint-not-allowed-for-production",
            "signature-material-missing",
            "external-delivery-gate-disabled",
          ],
        };
      }
      case "execute_webhook_staging":
        throw new Error("loopback staging webhook delivery is blocked in UI smoke");
      case "execute_webhook_production":
        throw new Error("production webhook delivery is blocked in UI smoke");
      case "preview_agent_team":
        return agentTeamPreview(args.request);
      case "preflight_real_agent_team": {
        const preview = agentTeamPreview(args.request);
        const stepPreflights = preview.steps.map((step) => ({
          order: step.order,
          phase: step.phase,
          participant_tool_id: step.participant_tool_id,
          state:
            step.participant_tool_id === "agent-codex"
              ? "real-agent-execution-blocked-by-default"
              : step.participant_tool_id === "team-synthesizer"
                ? "blocked-synthesizer-real-adapter-not-implemented"
                : "real-agent-execution-blocked-by-default",
          execution_enabled: false,
          process_started: false,
          task_content_sent: false,
          blockers: [
            {
              id:
                step.participant_tool_id === "team-synthesizer"
                  ? "team-synthesizer-real-adapter-not-implemented"
                  : "external-agent-execution-gate-disabled",
              state: "blocked",
              detail: "UI smoke keeps real Agent team execution blocked by default.",
            },
          ],
          gates: ["per-step-agent-harness-preflight", "no-process-spawn", "no-task-content-sent"],
        }));
        return {
          preview,
          state: "real-team-execution-blocked-by-default",
          execution_enabled: false,
          process_started: false,
          task_content_sent: false,
          executable_step_count: 0,
          blocked_step_count: stepPreflights.length,
          step_preflights: stepPreflights,
          required_approvals: [
            "all-participants-pass-agent-harness-preflight",
            "external-agent-execution-gate-enabled",
            "explicit-human-team-execution-approval",
          ],
          gates: [
            "per-step-agent-harness-preflight",
            "no-process-spawn",
            "no-task-content-sent",
            "all-steps-must-pass-before-team-execution",
          ],
        };
      }
      case "stage_real_agent_team": {
        if (!args.approved) {
          throw new Error("real Agent team staging requires approval");
        }
        const preview = agentTeamPreview(args.request);
        const stepPreflights = preview.steps.map((step) => ({
          order: step.order,
          phase: step.phase,
          participant_tool_id: step.participant_tool_id,
          state: "real-agent-execution-blocked-by-default",
          execution_enabled: false,
          process_started: false,
          task_content_sent: false,
          blockers: [
            {
              id: "external-agent-execution-gate-disabled",
              state: "blocked",
              detail: "UI smoke keeps real Agent team execution blocked by default.",
            },
          ],
          gates: ["per-step-agent-harness-preflight", "no-process-spawn", "no-task-content-sent"],
        }));
        const preflight = {
          preview,
          state: "real-team-execution-blocked-by-default",
          execution_enabled: false,
          process_started: false,
          task_content_sent: false,
          executable_step_count: 0,
          blocked_step_count: stepPreflights.length,
          step_preflights: stepPreflights,
          required_approvals: ["external-agent-execution-gate-enabled", "explicit-human-team-execution-approval"],
          gates: ["per-step-agent-harness-preflight", "no-process-spawn", "no-task-content-sent"],
        };
        const steps = stepPreflights.map((step) => ({
          order: step.order,
          phase: step.phase,
          participant_tool_id: step.participant_tool_id,
          state: step.state,
          input_sha256: "b".repeat(64),
          blocker_ids: step.blockers.map((blocker) => blocker.id),
          process_started: false,
          task_content_sent: false,
          admission_state: "quarantined-staging-only",
        }));
        const artifact = {
          id: `artifact-${state.artifacts.length + 1}`,
          run_id: preview.run_id,
          task_direction_id: state.runs.find((run) => run.id === preview.run_id)?.task_direction_id ?? "direction-1",
          artifact_type: "agent-team-real-staging-receipt",
          reference_id: `agent-team-real-staging-${now()}`,
          title: `Agent team real staging: ${preview.goal}`,
          summary: `${steps.length} real-agent steps staged; no process was started.`,
          metadata: {
            execution_mode: "real-agent-staging-only",
            process_started: false,
            task_content_sent: false,
            output_admission: "quarantine-before-memory",
            step_receipts: steps,
          },
          created_at_ms: now(),
        };
        state.artifacts = [artifact, ...state.artifacts];
        return {
          preflight,
          state: "real-agent-staging-receipt-recorded",
          execution_mode: "real-agent-staging-only",
          staged_step_count: steps.length,
          executable_step_count: 0,
          blocked_step_count: steps.length,
          process_started: false,
          task_content_sent: false,
          steps,
          artifact,
        };
      }
      case "execute_real_agent_team":
        throw new Error("real Agent team execution is blocked in UI smoke");
      case "cancel_real_agent_team":
        return true;
      case "preview_executor_contract":
      case "preview_synthesis":
      case "preview_production_readiness":
      case "preview_library_home":
        return null;
      case "preview_computer_cleanup":
        return {
          generated_at_ms: now(),
          state: "cleanup-dry-run-review-required",
          candidate_count: 2,
          estimated_reclaimable_bytes: 0,
          deleted_bytes: 0,
          mutation_started: false,
          requires_restore_point: true,
          requires_explicit_approval: true,
          candidates: [
            {
              id: "user-temp-directory",
              label: "User temporary directory",
              location_kind: "directory",
              path_preview: "<local-user-path>\\Temp",
              estimated_reclaimable_bytes: 0,
              confidence: "manual-review-required",
              action_policy: "preview-only-no-delete",
            },
            {
              id: "windows-temp-cache",
              label: "Windows temporary cache",
              location_kind: "directory",
              path_preview: "<local-user-path>\\AppData\\Local\\Temp",
              estimated_reclaimable_bytes: 0,
              confidence: "manual-review-required",
              action_policy: "preview-only-no-delete",
            },
          ],
          denied_actions: ["delete-files", "registry-cleanup", "process-kill"],
          safety_boundary: [
            "dry-run-only",
            "no-file-deletion",
            "no-file-content-read",
            "no-registry-write",
            "no-process-launch",
            "restore-point-required-before-real-cleanup",
            "explicit-approval-required-before-real-cleanup",
            "audit-required-before-real-cleanup",
          ],
        };
      case "preflight_computer_cleanup_mutation":
        return {
          generated_at_ms: now(),
          state: "cleanup-mutation-blocked-by-default",
          cleanup_state: "cleanup-dry-run-review-required",
          candidate_count: 2,
          restore_point_required: true,
          restore_point_available: false,
          explicit_approval_required: true,
          audit_required: true,
          rollback_plan_required: true,
          requires_admin: true,
          system_mutation_started: false,
          file_deletion_started: false,
          registry_write_started: false,
          process_kill_started: false,
          candidates: [
            {
              id: "user-temp-directory",
              label: "User temporary directory",
              location_kind: "directory",
              path_preview: "<local-user-path>\\Temp",
              estimated_reclaimable_bytes: 0,
              confidence: "manual-review-required",
              action_policy: "preview-only-no-delete",
            },
          ],
          gates: [
            "restore-point-required-before-real-cleanup",
            "explicit-approval-required-before-real-cleanup",
            "audit-required-before-real-cleanup",
            "rollback-plan-required-before-real-cleanup",
            "admin-session-required-before-real-cleanup",
            "candidate-review-required-before-real-cleanup",
          ],
          blockers: [
            "restore-point-not-created",
            "cleanup-approval-not-granted",
            "cleanup-audit-record-not-opened",
            "rollback-plan-not-attached",
            "real-cleanup-executor-disabled",
          ],
          denied_actions: ["delete-files", "registry-cleanup", "process-kill"],
        };
      default:
        throw new Error(`ui smoke mock does not implement ${cmd}`);
    }
  }

  window.__TAURI_INTERNALS__ = {
    invoke,
    transformCallback: function () {
      return 1;
    },
    unregisterCallback: function () {},
    convertFileSrc: function (filePath) {
      return filePath;
    },
  };
})();
