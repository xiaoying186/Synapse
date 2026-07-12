export type SystemStatus = {
  app_name: string;
  instance_id: string;
  mode: string;
  execution_level: string;
  failure_strategy: string;
  memory_scopes: string[];
  sandbox: string;
  max_steps: number;
  step_timeout_seconds: number;
  mode_lock_auto: boolean;
  runtime_config_path: string;
  storage_data_root: string;
  config_warnings: string[];
  capabilities: CapabilityStatus[];
  scheduler_status: SchedulerStatus;
};

export type RuntimeSettingsPreview = {
  state: string;
  config_path: string;
  mode: string;
  storage_data_dir: string;
  scheduler_background_loop_enabled: boolean;
  scheduler_poll_interval_seconds: number;
  restart_required: boolean;
  editable_fields: string[];
  blocked_fields: string[];
  gates: string[];
};

export type RuntimeSettingsUpdateRequest = {
  mode: string;
  storage_data_dir: string;
  scheduler_background_loop_enabled: boolean;
  scheduler_poll_interval_seconds: number;
  confirmed: boolean;
};

export type RuntimeSettingsUpdateReceipt = {
  state: string;
  config_path: string;
  backup_path: string;
  changed_fields: string[];
  restart_required: boolean;
};

export type SchedulerStatus = {
  background_loop_state: string;
  manual_tick_state: string;
  detail: string;
  lease_owner?: string | null;
  lease_expires_at_ms?: number | null;
  last_heartbeat_at_ms?: number | null;
  last_tick_at_ms?: number | null;
  last_success_at_ms?: number | null;
  last_error?: string | null;
  consecutive_failures?: number;
  required_gates: string[];
};

export type CapabilityStatus = {
  name: string;
  state: string;
  detail: string;
};

export type AuditEventRecord = {
  id: string;
  actor: string;
  action: string;
  target_type: string;
  target_id: string;
  risk_level: string;
  decision: string;
  input_hash: string;
  result_summary: unknown;
  error?: string | null;
  created_at_ms: number;
};

export type PlanPreview = {
  intent: string;
  risk: string;
  steps: string[];
  constraints: {
    sandbox?: string;
    failure_strategy?: string;
    max_steps?: number;
    mode_lock_auto?: boolean;
  };
  context_refs: string[];
  audit_required: boolean;
  route: string;
  audit_report: AuditReport;
  execution_preview: ExecutionPreview;
  policy_preview?: PolicyPreview;
  driver_receipt: DriverReceipt;
};

export type AuditReport = {
  required: boolean;
  decision: string;
  stages: AuditStage[];
  promotable_facts: string[];
};

export type AuditStage = {
  name: string;
  scope: string;
  status: string;
  detail: string;
};

export type ExecutionPreview = {
  strategy: string;
  route: string;
  spans: ExecutionSpan[];
};

export type ExecutionSpan = {
  id: string;
  label: string;
  status: string;
  lane: string;
  compensation?: string;
};

export type PolicyPreview = {
  permission_level: string;
  decision: string;
  requires_review: boolean;
  requires_explicit_approval: boolean;
  action_tiers: string[];
  gates: PolicyGate[];
};

export type PolicyGate = {
  name: string;
  status: string;
  detail: string;
};

export type PlanRecord = {
  id: string;
  created_at_ms: number;
  preview: PlanPreview;
  review_receipt?: ReviewReceipt;
  execution_record?: ExecutionRecord;
};

export type ReviewReceipt = {
  status: string;
  decision: string;
  execution_state: string;
  detail: string;
  execution_queue_id?: string;
};

export type ExecutionRecord = {
  id: string;
  plan_id: string;
  created_at_ms: number;
  state: string;
  route: string;
  driver_mode: string;
  accepted_steps: number;
  review_receipt: ReviewReceipt;
};

export type ExecutorContractPreview = {
  executor_state: string;
  detail: string;
  required_gates: string[];
  run_previews: ExecutorRunPreview[];
};

export type ExecutorRunPreview = {
  run_id: string;
  task_direction_title: string;
  readiness: string;
  lane: string;
  blocked_reason?: string | null;
  gates: string[];
  push_enabled?: boolean;
  push_channels?: string[];
};

export type DriverReceipt = {
  mode: string;
  status: string;
  accepted_steps: number;
  blocked_reason?: string;
};

export type MemoryItem = {
  id: string;
  created_at_ms: number;
  hub_area?: string;
  scope: string;
  level: string;
  item_type: string;
  admission_state?: string;
  admission_rule?: string;
  source: string;
  provenance?: string;
  source_trust?: string;
  content: string;
  tags: string[];
  confidence: number;
  verification: string;
  retention_policy?: string;
  authority?: string;
  linked_memory_ids: string[];
  last_reinforced_at_ms?: number | null;
  last_invalidated_at_ms?: number | null;
};

export type SnapshotRecord = {
  id: string;
  object_type: string;
  object_id: string;
  version: number;
  reason: string;
  created_at_ms: number;
  payload: unknown;
};

export type MemoryRollbackReceipt = {
  restored_item: MemoryItem;
  source_snapshot: SnapshotRecord;
  protection_snapshot: SnapshotRecord;
  audit_event: {
    id: string;
    action: string;
    target_id: string;
    decision: string;
  };
};

export type ProtectedSnapshotRollbackReceipt = {
  source_snapshot: SnapshotRecord;
  protection_snapshot: SnapshotRecord;
  object_type: string;
  object_id: string;
  restored_state: string;
  audit_event: {
    id: string;
    action: string;
    target_id: string;
    decision: string;
  };
};

export type ZhishuSearchQuery = {
  text: string;
  hub_area?: string | null;
  item_type?: string | null;
  scope?: string | null;
  admission_state?: string | null;
  minimum_confidence?: number | null;
  max_age_days?: number | null;
  limit?: number | null;
};

export type ZhishuSearchResult = {
  item: MemoryItem;
  score: number;
  matched_fields: string[];
  explanation: string;
};

export type ZhishuSearchResponse = {
  query: {
    text: string;
    filters: string[];
    limit: number;
  };
  total_matches: number;
  results: ZhishuSearchResult[];
};

export type ZhishuRelationRecord = {
  id: string;
  source_memory_id: string;
  target_memory_id: string;
  relation_type: string;
  reason: string;
  evidence: string[];
  confidence: number;
  review_state: string;
  created_at_ms: number;
  reviewed_at_ms?: number | null;
};

export type ZhishuMaintenanceFinding = {
  id: string;
  finding_kind: "duplicate" | "stale" | "conflict" | string;
  item_ids: string[];
  reason: string;
  evidence: string[];
  severity: "low" | "medium" | "high" | string;
  review_state: string;
  created_at_ms: number;
  reviewed_at_ms?: number | null;
};

export type ZhishuRepositoryBundle = {
  schema_version: number;
  memory_items: unknown[];
  relations: unknown[];
  maintenance_findings: unknown[];
};

export type ZhishuRepositoryImportReceipt = {
  memory_items: number;
  relations: number;
  maintenance_findings: number;
};

export type TaskDirection = {
  id: string;
  created_at_ms: number;
  updated_at_ms: number;
  title: string;
  description: string;
  priority: number;
  active: boolean;
  keywords: string[];
  schedule_frequency?: string;
  online_enabled?: boolean;
  output_template?: string;
  push_enabled?: boolean;
  push_channels?: string[];
};

export type TaskSchedulePreview = {
  direction_id: string;
  direction_title: string;
  frequency: string;
  next_run_at_ms?: number | null;
  next_run_label: string;
  readiness: string;
  detail: string;
  requires_network: boolean;
  output_template: string;
  push_enabled?: boolean;
  push_channels?: string[];
};

export type TaskRunRecord = {
  id: string;
  created_at_ms: number;
  task_direction_id: string;
  task_direction_title: string;
  trigger_kind: string;
  idempotency_key?: string;
  schedule_frequency: string;
  online_enabled: boolean;
  output_template: string;
    push_enabled?: boolean;
    push_channels?: string[];
    lifecycle_state?: string;
    approval_state: string;
  execution_state: string;
    detail: string;
    generated_candidate_ids: string[];
    started_at_ms?: number | null;
    completed_at_ms?: number | null;
    failed_at_ms?: number | null;
    error_summary?: string | null;
    cancelled_at_ms?: number | null;
    archived_at_ms?: number | null;
    source_candidate_id?: string | null;
};

export type TaskSchedulerTick = {
  generated_at_ms: number;
  created_run_count: number;
  skipped_run_count: number;
  created_runs: TaskRunRecord[];
  detail: string;
};

  export type TaskRunExecutionReceipt = {
    run: TaskRunRecord;
    generated_candidates: TaskCandidate[];
    artifacts: TaskArtifactRecord[];
  };

  export type TaskArtifactRecord = {
    id: string;
    run_id: string;
    task_direction_id: string;
    artifact_type: string;
    reference_id: string;
    title: string;
    summary: string;
    metadata: Record<string, unknown>;
    created_at_ms: number;
  };

export type ArtifactPromotionReceipt = {
  artifact: TaskArtifactRecord;
  memory_item: MemoryItem;
  audit_event: {
    id: string;
    action: string;
    target_id: string;
    decision: string;
  };
  gates: string[];
};

export type TaskCandidate = {
  id: string;
  created_at_ms: number;
  task_direction_id: string;
  task_direction_title: string;
  memory_item_id: string;
  summary: string;
  score: number;
  score_components?: TaskCandidateScoreComponents;
  matched_keywords: string[];
  evidence?: TaskCandidateEvidence[];
  explanation: string;
  status: string;
  reviewed_at_ms?: number;
  review_decision?: string;
  promoted_memory_id?: string;
  source_candidate_id?: string | null;
};

export type TaskCandidateScoreComponents = {
  keyword_score: number;
  priority_score: number;
  memory_confidence: number;
  final_score: number;
};

export type TaskCandidateEvidence = {
  label: string;
  value: string;
};

export type TaskCandidateReview = {
  candidate: TaskCandidate;
  promoted_memory_item?: MemoryItem;
  follow_up_run?: TaskRunRecord;
};

export type AggregationPreview = {
  query: string;
  online_enabled: boolean;
  retrieval_state: string;
  required_cross_checks: number;
  source_policy: SourcePolicy;
  source_assessments: SourceAssessment[];
  source_gates: SourceGate[];
  retrieval_contract: RetrievalContract;
  observations: SourceObservation[];
  confidence: ConfidenceAssessment;
  evidence_validation: EvidenceValidationContract;
};

export type DailyBriefingTemplate = {
  title: string;
  query: string;
  sections: string[];
  online_enabled: boolean;
};

export type DailyBriefingPreview = {
  title: string;
  rendered_markdown: string;
  sections: string[];
  aggregation: AggregationPreview;
  evidence_contract: DailyBriefingEvidenceContract;
  archive_gate: string;
};

export type DailyBriefingEvidenceContract = {
  source_count: number;
  quarantined_source_count: number;
  required_cross_checks: number;
  confidence_score: number;
  conflict_level: string;
  freshness_state: string;
  admission_state: string;
  archive_state: string;
  external_delivery_started: boolean;
  durable_zhishu_write: boolean;
  evidence_validation: EvidenceValidationContract;
  provider_receipt: ProviderAdapterExecutionReceipt;
  provider_admission_preflight: ProviderReceiptAdmissionPreflight;
  provider_review_queue_preview: ProviderReceiptAdmissionQueuePreview;
  gates: string[];
  denied_actions: string[];
};

export type DailyBriefingLiveSourceStagingPreflight = {
  state: string;
  query: string;
  requested_live_sources: boolean;
  external_network_started: boolean;
  durable_zhishu_write: boolean;
  automatic_delivery_started: boolean;
  required_cross_checks: number;
  source_quarantine_required: boolean;
  gate_enabled: boolean;
  configured_source_url_present: boolean;
  configured_source_count: number;
  provider_gates: LiveSourceProviderGate[];
  gates: string[];
  blockers: string[];
  denied_actions: string[];
};

export type LiveSourceProviderGate = {
  provider_id: string;
  provider_kind: string;
  allow_state: string;
  credential_policy: string;
  network_policy: string;
  rate_limit_policy: string;
  audit_policy: string;
  quarantine_policy: string;
  rollback_policy: string;
  required_approval: string;
  external_network_started: boolean;
};

export type DailyBriefingArchiveReceipt = {
  preview: DailyBriefingPreview;
  observations: SourceObservationRecord[];
  artifact: TaskArtifactRecord;
  run: TaskRunRecord;
  snapshot: SnapshotRecord;
  audit_event: AuditEventRecord;
  saga: SagaTransaction;
};

export type DailyBriefingDeliveryReview = {
  artifact_id: string;
  run_id: string;
  state: string;
  notification_previews: NotificationPreview[];
  delivery_started: boolean;
  external_network_started: boolean;
  durable_zhishu_write: boolean;
  gates: string[];
  denied_actions: string[];
};

export type DailyBriefingScheduledArchiveReview = {
  generated_at_ms: number;
  state: string;
  eligible_run_ids: string[];
  pending_approval_run_ids: string[];
  blocked_run_ids: string[];
  automatic_archive_started: boolean;
  external_network_started: boolean;
  durable_zhishu_write: boolean;
  gates: string[];
  denied_actions: string[];
};

export type DailyBriefingLiveSourceReceipt = {
  preflight: DailyBriefingLiveSourceStagingPreflight;
  http_receipts: HttpSourceReceipt[];
  evidence_validation: EvidenceValidationContract;
  artifact: TaskArtifactRecord;
  snapshot: SnapshotRecord;
  audit_event: AuditEventRecord;
  saga: SagaTransaction;
  external_network_started: boolean;
  durable_zhishu_write: boolean;
  automatic_delivery_started: boolean;
};

export type EvidenceValidationContract = {
  observation_count: number;
  source_count: number;
  distinct_claim_count: number;
  required_cross_checks: number;
  cross_check_state: string;
  conflict_state: string;
  quarantine_state: string;
  admission_decision: string;
  summary_allowed: boolean;
  durable_write_allowed: boolean;
  gates: string[];
  blockers: string[];
  denied_actions: string[];
};

export type DiagnosticCheck = {
  id: string;
  label: string;
  state: string;
  evidence: string;
  recommendation: string;
};

export type ComputerDiagnosticReport = {
  generated_at_ms: number;
  overall_state: string;
  system_profile: SystemProfileSnapshot;
  checks: DiagnosticCheck[];
  detected_tools: string[];
  safety_boundary: string[];
};

export type SystemProfileSnapshot = {
  snapshot_kind: string;
  os_family: string;
  os: string;
  architecture: string;
  runtime_executable_available: boolean;
  temp_dir_available: boolean;
  path_entry_count: number;
  unique_path_entry_count: number;
  detected_tool_count: number;
  context_policy: string;
  persistence_policy: string;
  allowed_fields: string[];
  denied_fields: string[];
  safety_boundary: string[];
};

export type ComputerDiagnosticArchiveReceipt = {
  report: ComputerDiagnosticReport;
  artifact: TaskArtifactRecord;
  run: TaskRunRecord;
};

export type CleanupCandidate = {
  id: string;
  label: string;
  location_kind: string;
  path_preview: string;
  estimated_reclaimable_bytes: number;
  confidence: string;
  action_policy: string;
};

export type CleanupDryRunPreview = {
  generated_at_ms: number;
  state: string;
  candidate_count: number;
  estimated_reclaimable_bytes: number;
  deleted_bytes: number;
  mutation_started: boolean;
  requires_restore_point: boolean;
  requires_explicit_approval: boolean;
  candidates: CleanupCandidate[];
  denied_actions: string[];
  safety_boundary: string[];
};

export type CleanupMutationPreflight = {
  generated_at_ms: number;
  state: string;
  cleanup_state: string;
  candidate_count: number;
  restore_point_required: boolean;
  restore_point_available: boolean;
  explicit_approval_required: boolean;
  audit_required: boolean;
  rollback_plan_required: boolean;
  requires_admin: boolean;
  system_mutation_started: boolean;
  file_deletion_started: boolean;
  registry_write_started: boolean;
  process_kill_started: boolean;
  candidates: CleanupCandidate[];
  gates: string[];
  blockers: string[];
  denied_actions: string[];
};

export type WebAppShellDescriptor = {
  id: string;
  label: string;
  origin: string;
  profile_id: string;
  allow_state: string;
  session_policy: string;
  capabilities: string[];
};

export type WebAppShellPreview = {
  generated_at_ms: number;
  state: string;
  descriptors: WebAppShellDescriptor[];
  gates: string[];
  denied_actions: string[];
  profile_root: string;
  process_started: boolean;
};

export type CodebaseMemorySource = {
  id: string;
  label: string;
  path: string;
  state: string;
  scope: string;
};

export type CodebaseMemoryPreview = {
  generated_at_ms: number;
  state: string;
  adapter_mode: string;
  index_root: string;
  index_present: boolean;
  process_started: boolean;
  repository_scanned: boolean;
  file_content_ingested: boolean;
  sources: CodebaseMemorySource[];
  gates: string[];
  denied_actions: string[];
};

export type CodebaseMemoryAdmissionPreflight = {
  generated_at_ms: number;
  state: string;
  adapter_state: string;
  source_id: string;
  process_started: boolean;
  repository_scanned: boolean;
  file_content_ingested: boolean;
  l2_write_started: boolean;
  requires_index_freshness_check: boolean;
  requires_source_scope_review: boolean;
  requires_human_summary_review: boolean;
  requires_zhishu_admission_review: boolean;
  gates: string[];
  blockers: string[];
  denied_actions: string[];
};

export type PermissionMemoryCandidate = {
  id: string;
  scope: string;
  tool_scope: string;
  permission_level: string;
  action_pattern: string;
  reuse_conditions: string[];
  expires_after: string;
  revoked: boolean;
  audit_ref: string;
  reuse_state: string;
};

export type PermissionMemoryPreview = {
  generated_at_ms: number;
  state: string;
  candidates: PermissionMemoryCandidate[];
  gates: string[];
  non_reusable_risks: string[];
  auto_grants_permissions: boolean;
};

export type PermissionReusePreflight = {
  generated_at_ms: number;
  state: string;
  candidate_id: string;
  candidate_state: string;
  permission_level: string;
  scope: string;
  tool_scope: string;
  requested_action: string;
  auto_grant_started: boolean;
  permission_reused: boolean;
  durable_policy_write_started: boolean;
  requires_same_scope: boolean;
  requires_fresh_audit_reference: boolean;
  requires_explicit_review: boolean;
  requires_expiry_check: boolean;
  high_risk_blocked: boolean;
  gates: string[];
  blockers: string[];
  denied_actions: string[];
};

export type SkillManifest = {
  skill_id: string;
  name: string;
  owner_center: string;
  governed_by: string;
  version: string;
  manifest_state: string;
  execution_mode: string;
  script_adapter: string;
  permission_level: string;
  admission_policy: string;
  rollback_policy: string;
  tests_required: string[];
  safety_gates: string[];
};

export type SkillExecutionContract = {
  skill_id: string;
  state: string;
  process_started: boolean;
  script_content_read: boolean;
  durable_zhishu_write: boolean;
  requires_explicit_approval: boolean;
  requires_test_receipt: boolean;
  output_policy: string;
  denied_actions: string[];
};

export type SkillLibraryPreview = {
  generated_at_ms: number;
  state: string;
  registry_scope: string;
  manifests: SkillManifest[];
  execution_contracts: SkillExecutionContract[];
  gates: string[];
  denied_actions: string[];
  process_started: boolean;
  script_content_read: boolean;
  durable_zhishu_write: boolean;
};

export type SkillScriptExecutionPreflight = {
  generated_at_ms: number;
  state: string;
  skill_id: string;
  script_adapter: string;
  manifest_state: string;
  process_started: boolean;
  script_content_read: boolean;
  durable_zhishu_write: boolean;
  filesystem_mutation_started: boolean;
  network_call_started: boolean;
  requires_allowlisted_script_path: boolean;
  requires_script_hash: boolean;
  requires_explicit_approval: boolean;
  requires_test_receipt: boolean;
  requires_quarantine_output: boolean;
  requires_rollback_plan: boolean;
  gates: string[];
  blockers: string[];
  denied_actions: string[];
  run_id: string;
  task_approval_state: string;
  executor_enabled: boolean;
  script_path_allowlisted: boolean;
  script_hash_verified: boolean;
  expected_sha256: string;
  actual_sha256: string;
  powershell_available: boolean;
};

export type SkillScriptExecutionRequest = {
  skill_id: string;
  run_id: string;
};

export type SkillScriptExecutionReceipt = {
  preflight: SkillScriptExecutionPreflight;
  state: string;
  exit_code: number;
  output_sha256: string;
  output_truncated: boolean;
  artifact: TaskArtifactRecord;
  rollback_snapshot: SnapshotRecord;
  audit_event: AuditEventRecord;
  saga: SagaTransaction;
};

export type StrategyConfig = {
  name: string;
  short_window: number;
  long_window: number;
};

export type QuantResearchReport = {
  strategy_name: string;
  strategy_version: string;
  state: string;
  sample_count: number;
  start_date?: string | null;
  end_date?: string | null;
  strategy_return?: number | null;
  benchmark_return?: number | null;
  max_drawdown?: number | null;
  position_changes: number;
  warnings: string[];
  disclaimer: string;
};

export type QuantArchiveReceipt = {
  report: QuantResearchReport;
  artifact: TaskArtifactRecord;
  run: TaskRunRecord;
};

export type SourceObservation = {
  source_id: string;
  source_uri: string;
  captured_at_ms: number;
  freshness: string;
  field_coverage: number;
  normalized_claim: string;
  quarantine_state: string;
  fallback_used: boolean;
};

export type ConfidenceAssessment = {
  score: number;
  source_count: number;
  average_field_coverage: number;
  conflict_level: string;
  freshness_state: string;
  admission_state: string;
  notes: string[];
};

export type SourceObservationRecord = {
  id: string;
  query: string;
  source_id: string;
  source_uri: string;
  observed_at_ms: number;
  freshness: string;
  field_coverage: number;
  normalized_claim: string;
  quarantine_state: string;
  fallback_used: boolean;
  confidence_score: number;
  conflict_level: string;
  admission_state: string;
  recorded_at_ms: number;
};

export type SourceHealthSummary = {
  source_id: string;
  observation_count: number;
  average_confidence: number;
  average_field_coverage: number;
  fallback_ratio: number;
  conflict_count: number;
  last_observed_at_ms: number;
  state: string;
};

export type QueryCrossCheckSummary = {
  query: string;
  observation_count: number;
  source_count: number;
  distinct_claim_count: number;
  average_confidence: number;
  state: string;
};

export type SourceHealthReport = {
  generated_at_ms: number;
  observation_count: number;
  source_count: number;
  query_count: number;
  overall_state: string;
  source_health: SourceHealthSummary[];
  query_cross_checks: QueryCrossCheckSummary[];
  gates: string[];
};

export type SourceImportReceipt = {
  format: string;
  imported_count: number;
  observations: SourceObservation[];
  confidence: ConfidenceAssessment;
  gates: string[];
};

export type HttpSourceReceipt = {
  source_url: string;
  status_code: number;
  content_type: string;
  response_bytes: number;
  observation: SourceObservation;
  confidence: ConfidenceAssessment;
  evidence_validation: EvidenceValidationContract;
  provider_receipt: ProviderAdapterExecutionReceipt;
  gates: string[];
};

export type ProviderAdapterExecutionReceipt = {
  receipt_id: string;
  provider_id: string;
  adapter_kind: string;
  execution_mode: string;
  execution_state: string;
  source_url: string;
  source_sha256: string;
  response_bytes: number;
  external_network_started: boolean;
  credential_read_started: boolean;
  process_started: boolean;
  durable_write_started: boolean;
  audit_recorded: boolean;
  quarantine_recorded: boolean;
  rollback_required: boolean;
  gates: string[];
  denied_actions: string[];
};

export type ProviderReceiptAdmissionPreflight = {
  generated_at_ms: number;
  state: string;
  provider_id: string;
  receipt_id: string;
  candidate_id: string;
  candidate_kind: string;
  source_sha256: string;
  audit_recorded: boolean;
  quarantine_recorded: boolean;
  summary_candidate_created: boolean;
  task_artifact_write_started: boolean;
  durable_zhishu_write_started: boolean;
  requires_human_review: boolean;
  requires_evidence_validation: boolean;
  requires_source_trust_review: boolean;
  requires_conflict_review: boolean;
  gates: string[];
  blockers: string[];
  denied_actions: string[];
};

export type ProviderReceiptAdmissionQueuePreview = {
  generated_at_ms: number;
  state: string;
  queue_id: string;
  provider_id: string;
  receipt_id: string;
  candidate_count: number;
  pending_review_count: number;
  task_artifact_write_started: boolean;
  durable_zhishu_write_started: boolean;
  candidates: ProviderReceiptAdmissionPreflight[];
  gates: string[];
  blockers: string[];
  denied_actions: string[];
};

export type ProviderReceiptReviewCandidate = {
  id: string;
  created_at_ms: number;
  provider_id: string;
  receipt_id: string;
  candidate_kind: string;
  source_sha256: string;
  review_state: string;
  queue_state: string;
  task_artifact_write_started: boolean;
  durable_zhishu_write_started: boolean;
  requires_human_review: boolean;
  gates: string[];
  blockers: string[];
  denied_actions: string[];
  reviewed_at_ms?: number | null;
  review_decision?: string | null;
};

export type ProviderReceiptReviewQueueReceipt = {
  state: string;
  candidate: ProviderReceiptReviewCandidate;
  queue_preview: ProviderReceiptAdmissionQueuePreview;
  snapshot: SnapshotRecord;
  audit_event: AuditEventRecord;
  saga: SagaTransaction;
  task_artifact_write_started: boolean;
  durable_zhishu_write_started: boolean;
};

export type ProviderReceiptReviewDecisionReceipt = {
  state: string;
  candidate: ProviderReceiptReviewCandidate;
  snapshot: SnapshotRecord;
  audit_event: AuditEventRecord;
  task_artifact_write_started: boolean;
  durable_zhishu_write_started: boolean;
  gates: string[];
  denied_actions: string[];
};

export type ProviderReceiptTaskArtifactPreflight = {
  generated_at_ms: number;
  state: string;
  candidate_id: string;
  review_state: string;
  provider_id: string;
  receipt_id: string;
  source_sha256: string;
  task_artifact_write_started: boolean;
  durable_zhishu_write_started: boolean;
  requires_approved_provider_review: boolean;
  requires_task_artifact_review: boolean;
  requires_zhishu_admission_review: boolean;
  gates: string[];
  blockers: string[];
  denied_actions: string[];
};

export type ProviderReceiptTaskArtifactReceipt = {
  state: string;
  candidate: ProviderReceiptReviewCandidate;
  artifact: TaskArtifactRecord;
  snapshot: SnapshotRecord;
  audit_event: AuditEventRecord;
  saga: SagaTransaction;
  task_artifact_write_started: boolean;
  durable_zhishu_write_started: boolean;
  gates: string[];
  denied_actions: string[];
};

export type ProviderArtifactZhishuAdmissionPreflight = {
  generated_at_ms: number;
  state: string;
  artifact_id: string;
  artifact_type: string;
  reference_id: string;
  source_sha256: string;
  quarantine_state: string;
  task_artifact_write_started: boolean;
  durable_zhishu_write_started: boolean;
  requires_artifact_review: boolean;
  requires_source_trust_review: boolean;
  requires_zhishu_admission_review: boolean;
  gates: string[];
  blockers: string[];
  denied_actions: string[];
};

export type ProviderArtifactAdmissionReview = {
  id: string;
  created_at_ms: number;
  artifact_id: string;
  artifact_type: string;
  reference_id: string;
  source_sha256: string;
  review_state: string;
  review_decision: string;
  reviewed_at_ms: number;
  durable_zhishu_candidate_write_started: boolean;
  confirmed_knowledge_write_started: boolean;
  gates: string[];
  blockers: string[];
  denied_actions: string[];
};

export type ProviderArtifactAdmissionReviewReceipt = {
  state: string;
  review: ProviderArtifactAdmissionReview;
  snapshot: SnapshotRecord;
  audit_event: AuditEventRecord;
  durable_zhishu_candidate_write_started: boolean;
  confirmed_knowledge_write_started: boolean;
  gates: string[];
  denied_actions: string[];
};

export type ProviderArtifactZhishuCandidateReceipt = {
  state: string;
  review: ProviderArtifactAdmissionReview;
  artifact: TaskArtifactRecord;
  memory_item: MemoryItem;
  snapshot: SnapshotRecord;
  audit_event: AuditEventRecord;
  saga: SagaTransaction;
  durable_zhishu_candidate_write_started: boolean;
  confirmed_knowledge_write_started: boolean;
  gates: string[];
  denied_actions: string[];
};

export type ProviderArtifactZhishuFinalReviewReceipt = {
  state: string;
  memory_item: MemoryItem;
  decision: string;
  confirmed_knowledge_write_started: boolean;
  gates: string[];
  denied_actions: string[];
};

export type SourcePolicy = {
  freshness_required: boolean;
  cross_check_required: boolean;
  injection_defense: string;
  durable_write_gate: string;
};

export type SourceAssessment = {
  source_type: string;
  trust_level: string;
  freshness_window: string;
  admission_state: string;
  notes: string[];
};

export type SourceGate = {
  source_id: string;
  label: string;
  allow_state: string;
  minimum_cross_checks: number;
  quarantine_required: boolean;
  admission_gate: string;
  notes: string[];
};

export type RetrievalContract = {
  readiness: string;
  blocked_reason?: string | null;
  allowed_source_count: number;
  quarantine_source_count: number;
  gates: string[];
};

export type SourceRegistryEntry = {
  source_id: string;
  name: string;
  type: string;
  scope: string;
  owner_module: string;
  enabled: boolean;
  auth_required: boolean;
  network_profile: string;
  rate_limit: string;
  storage_policy: string;
  shared_config_allowed: boolean;
  status: string;
  adapter_kind: string;
  health_check_policy: string;
  credential_policy: string;
  observation_policy: string;
  freshness_policy: string;
  verification_policy: string;
  quarantine_policy: string;
  risk_level: string;
  last_health_check_at_ms: number | null;
  last_health_state: string;
  last_health_observation_id: string | null;
};

export type SourceRegistryPreview = {
  generated_at_ms: number;
  state: string;
  registry_scope: string;
  entries: SourceRegistryEntry[];
  gates: string[];
  denied_actions: string[];
};

export type SourceEnablementPreflight = {
  generated_at_ms: number;
  state: string;
  source_id: string;
  source_type: string;
  owner_module: string;
  current_status: string;
  enabled: boolean;
  network_started: boolean;
  credential_read_started: boolean;
  fetch_started: boolean;
  storage_write_started: boolean;
  shared_config_write_started: boolean;
  requires_owner_review: boolean;
  requires_auth_policy_review: boolean;
  requires_network_profile_review: boolean;
  requires_rate_limit_review: boolean;
  requires_storage_policy_review: boolean;
  requires_verification_plan: boolean;
  requires_quarantine_plan: boolean;
  requires_injection_defense: boolean;
  gates: string[];
  blockers: string[];
  denied_actions: string[];
};

export type SourceRegistryApproval = {
  source_id: string;
  enabled: boolean;
  reviewed_at_ms: number;
  review_state: string;
};

export type SourceEnablementReviewReceipt = {
  approval: SourceRegistryApproval;
  snapshot: SnapshotRecord;
  audit_event: AuditEventRecord;
  saga: SagaTransaction;
};

export type SourceHealthCheckRequest = {
  source_id: string;
  approved: boolean;
};

export type SourceHealthCheckPreflight = {
  generated_at_ms: number;
  state: string;
  source_id: string;
  enabled: boolean;
  configured_url_present: boolean;
  explicit_approval: boolean;
  network_started: boolean;
  ready: boolean;
  blockers: string[];
  gates: string[];
};

export type SourceHealthCheckReceipt = {
  state: string;
  source_id: string;
  status_code: number;
  response_bytes: number;
  observation: SourceObservationRecord;
  snapshot: SnapshotRecord;
  audit_event: AuditEventRecord;
  saga: SagaTransaction;
};

export type ArsenalPreview = {
  registry_state: string;
  allowed_tools: number;
  blocked_tools: number;
  tools: ToolDescriptor[];
  gates: string[];
};

export type AdapterExecutionReceipt = {
  tool_id: string;
  run_id: string;
  execution_mode: string;
  state: string;
  requires_approval: boolean;
  output_summary: string;
  duration_ms: number;
  artifact?: TaskArtifactRecord | null;
  gates: string[];
};

export type AgentDryRunRequest = {
  tool_id: string;
  run_id: string;
  mode: "native" | "deep";
  input: string;
};

export type AgentContextReference = {
  memory_id: string;
  label: string;
  excerpt: string;
};

export type RepositoryTrustPreview = {
  state: string;
  level: string;
  remote_scope: string;
  remote_host?: string | null;
  detail: string;
  gates: string[];
};

export type CommandSafetyPreview = {
  state: string;
  risk_level: string;
  denied_markers: string[];
  review_markers: string[];
  detail: string;
};

export type AgentDryRunReceipt = {
  tool_id: string;
  tool_label: string;
  run_id: string;
  mode: string;
  state: string;
  discovery_state: string;
  allow_state: string;
  task_approval_state: string;
  executable_path?: string | null;
  argument_preview: string[];
  context_references: AgentContextReference[];
  repository_trust: RepositoryTrustPreview;
  command_safety: CommandSafetyPreview;
  output_ingestion_policy: string;
  gates: string[];
  process_started: boolean;
};

export type AgentExecutionReceipt = {
  dry_run: AgentDryRunReceipt;
  state: string;
  exit_code: number;
  output_truncated: boolean;
  artifact: TaskArtifactRecord;
  run: TaskRunRecord;
  audit_event: AuditEventRecord;
  saga: SagaTransaction;
};

export type RealAgentPreflightBlocker = {
  id: string;
  state: string;
  detail: string;
};

export type RealAgentExecutionPreflight = {
  state: string;
  dry_run: AgentDryRunReceipt;
  execution_enabled: boolean;
  process_started: boolean;
  task_content_sent: boolean;
  required_approvals: string[];
  blockers: RealAgentPreflightBlocker[];
  gates: string[];
};

export type BrowserInspectionRequest = {
  run_id: string;
  url: string;
  capture_screenshot: boolean;
};

export type BrowserInspectionPreview = {
  run_id: string;
  url: string;
  host: string;
  state: string;
  browser_discovery_state: string;
  browser_allow_state: string;
  python_discovery_state: string;
  python_allow_state: string;
  task_approval_state: string;
  allowed_hosts: string[];
  capture_screenshot: boolean;
  action_policy: BrowserActionPolicy;
  gates: string[];
  process_started: boolean;
};

export type BrowserActionPolicy = {
  mode: string;
  read_actions: string[];
  write_actions_allowed: string[];
  write_actions_denied: string[];
  approval_required_for_write: boolean;
  anti_injection_policy: string;
  audit_policy: string;
  rollback_policy: string;
  denied_reasons: string[];
};

export type BrowserWriteActionStagingPreflight = {
  run_id: string;
  url: string;
  host: string;
  state: string;
  process_started: boolean;
  web_mutation_started: boolean;
  task_content_sent: boolean;
  approval_required: boolean;
  action_policy: BrowserActionPolicy;
  requested_write_actions: string[];
  gates: string[];
  blockers: string[];
  denied_actions: string[];
};

export type BrowserInspectionResult = {
  final_url: string;
  status?: number | null;
  title: string;
  text: string;
  screenshot_path?: string | null;
};

export type BrowserInspectionReceipt = {
  preview: BrowserInspectionPreview;
  result: BrowserInspectionResult;
  artifact: TaskArtifactRecord;
  run: TaskRunRecord;
};

export type AgentAdapterSmokeItem = {
  tool_id: string;
  tool_label: string;
  discovery_state: string;
  allow_state: string;
  command_contract: string[];
  execution_enabled: boolean;
  process_started: boolean;
  gates: string[];
};

export type AgentAdapterSmokeReport = {
  state: string;
  agent_count: number;
  detected_count: number;
  execution_enabled: boolean;
  process_started: boolean;
  adapters: AgentAdapterSmokeItem[];
  gates: string[];
};

export type AgentTeamRequest = {
  run_id: string;
  team_mode: "linear" | "roundtable";
  context_mode: "native" | "deep";
  goal: string;
  participant_tool_ids: string[];
  max_rounds: number;
  max_agent_calls?: number;
  cancel_after_steps?: number;
};

export type AgentTeamStep = {
  order: number;
  phase: string;
  participant_tool_id: string;
  input_source: string;
  output_policy: string;
};

export type AgentTeamPreview = {
  run_id: string;
  team_mode: string;
  context_mode: string;
  goal: string;
  state: string;
  max_rounds: number;
  estimated_agent_calls: number;
  max_agent_calls: number;
  cancel_after_steps?: number | null;
  participants: ToolDescriptor[];
  steps: AgentTeamStep[];
  gates: string[];
  process_started: boolean;
};

export type AgentTeamStepReceipt = {
  order: number;
  phase: string;
  participant_tool_id: string;
  output_ref: string;
  output_sha256: string;
  process_started: boolean;
  admission_state: string;
};

export type AgentTeamExecutionReceipt = {
  preview: AgentTeamPreview;
  state: string;
  execution_mode: string;
  calls_completed: number;
  calls_blocked: number;
  stop_reason: string;
  process_started: boolean;
  steps: AgentTeamStepReceipt[];
  artifact: TaskArtifactRecord;
};

export type AgentTeamRealStepPreflight = {
  order: number;
  phase: string;
  participant_tool_id: string;
  state: string;
  execution_enabled: boolean;
  process_started: boolean;
  task_content_sent: boolean;
  blockers: RealAgentPreflightBlocker[];
  gates: string[];
};

export type AgentTeamRealExecutionPreflight = {
  preview: AgentTeamPreview;
  state: string;
  execution_enabled: boolean;
  process_started: boolean;
  task_content_sent: boolean;
  executable_step_count: number;
  blocked_step_count: number;
  step_preflights: AgentTeamRealStepPreflight[];
  required_approvals: string[];
  gates: string[];
};

export type AgentTeamRealStagingStepReceipt = {
  order: number;
  phase: string;
  participant_tool_id: string;
  state: string;
  input_sha256: string;
  blocker_ids: string[];
  process_started: boolean;
  task_content_sent: boolean;
  admission_state: string;
};

export type AgentTeamRealStagingReceipt = {
  preflight: AgentTeamRealExecutionPreflight;
  state: string;
  execution_mode: string;
  staged_step_count: number;
  executable_step_count: number;
  blocked_step_count: number;
  process_started: boolean;
  task_content_sent: boolean;
  steps: AgentTeamRealStagingStepReceipt[];
  artifact: TaskArtifactRecord;
};

export type AgentTeamRealExecutionStepReceipt = {
  order: number;
  phase: string;
  participant_tool_id: string;
  state: string;
  exit_code: number;
  output_truncated: boolean;
  artifact_id: string;
  output_sha256: string;
  process_started: boolean;
  task_content_sent: boolean;
  admission_state: string;
};

export type AgentTeamRealExecutionReceipt = {
  preflight: AgentTeamRealExecutionPreflight;
  state: string;
  execution_mode: string;
  calls_completed: number;
  calls_blocked: number;
  stop_reason: string;
  process_started: boolean;
  task_content_sent: boolean;
  steps: AgentTeamRealExecutionStepReceipt[];
  artifact: TaskArtifactRecord;
  failure_detail?: string | null;
  cancellation_observed: boolean;
  rollback_snapshot: SnapshotRecord;
  audit_event: AuditEventRecord;
  saga: SagaTransaction;
};

export type LocalAppDescriptor = {
  id: string;
  label: string;
  executable: string;
  allow_state: string;
  risk_level: string;
  session_policy: string;
  capabilities: string[];
};

export type LocalAppLaunchRequest = {
  app_id: string;
  run_id: string;
};

export type LocalAppLaunchPreview = {
  app: LocalAppDescriptor;
  run_id: string;
  state: string;
  bridge_discovery_state: string;
  bridge_allow_state: string;
  task_approval_state: string;
  argument_preview: string[];
  gates: string[];
  process_started: boolean;
};

export type LocalAppLaunchPreflight = {
  generated_at_ms: number;
  state: string;
  launch_state: string;
  app_id: string;
  run_id: string;
  process_started: boolean;
  argument_count: number;
  user_arguments_allowed: boolean;
  credentials_read: boolean;
  window_content_read: boolean;
  requires_bridge_allowlist: boolean;
  requires_app_allowlist: boolean;
  requires_task_approval: boolean;
  requires_explicit_launch_confirmation: boolean;
  audit_required: boolean;
  session_blind: boolean;
  gates: string[];
  blockers: string[];
  denied_actions: string[];
};

export type LocalAppLaunchReceipt = {
  preview: LocalAppLaunchPreview;
  state: string;
  process_id: number;
  artifact: TaskArtifactRecord;
  audit_event: AuditEventRecord;
};

export type LocalAppAllowStateReceipt = {
  apps: LocalAppDescriptor[];
  changed_app: LocalAppDescriptor;
  snapshot: SnapshotRecord;
  audit_event: AuditEventRecord;
  saga: SagaTransaction;
};

export type NotificationRequest = {
  run_id: string;
  channel: "email" | "feishu" | "wechat";
  subject: string;
  body: string;
};

export type NotificationPreview = {
  run_id: string;
  channel: string;
  state: string;
  subject: string;
  body_chars: number;
  task_push_enabled: boolean;
  task_push_channels: string[];
  endpoint_configured: boolean;
  credentials_present: boolean;
  gates: string[];
  delivery_started: boolean;
  webhook_staging_policy?: WebhookStagingPolicy | null;
  webhook_staging_envelope?: WebhookStagingEnvelope | null;
};

export type WebhookStagingPolicy = {
  mode: string;
  channel: string;
  signature_policy: string;
  retry_policy: string;
  redaction_policy: string;
  error_classes: string[];
  external_delivery_gate: string;
  approval_required: boolean;
  external_delivery_started: boolean;
  network_started: boolean;
  denied_actions: string[];
};

export type WebhookStagingEnvelope = {
  contract: string;
  channel: string;
  idempotency_key: string;
  payload_sha256: string;
  body_preview_chars: number;
  destination_configured: boolean;
  endpoint_redaction: string;
  required_headers: string[];
  admission_state: string;
  expires_after_secs: number;
  external_delivery_started: boolean;
  network_started: boolean;
};

export type WebhookStagingPreflight = {
  channel: string;
  state: string;
  endpoint_scope: string;
  endpoint_configured: boolean;
  endpoint_allowed_for_staging: boolean;
  signature_material_present: boolean;
  external_delivery_gate_enabled: boolean;
  approval_required: boolean;
  delivery_started: boolean;
  network_started: boolean;
  checks: string[];
  blocked_reasons: string[];
};

export type WebhookProductionPreflight = {
  channel: string;
  state: string;
  endpoint_scope: string;
  endpoint_configured: boolean;
  endpoint_allowed_for_production: boolean;
  signature_material_present: boolean;
  external_delivery_gate_enabled: boolean;
  approval_required: boolean;
  audit_required: boolean;
  redaction_required: boolean;
  delivery_started: boolean;
  network_started: boolean;
  checks: string[];
  blocked_reasons: string[];
};

export type NotificationReceipt = {
  preview: NotificationPreview;
  state: string;
  server_response: string;
  artifact: TaskArtifactRecord;
  delivery_attempt?: NotificationDeliveryAttempt | null;
  audit_event?: AuditEventRecord | null;
};

export type NotificationDeliveryAttempt = {
  id: string;
  idempotency_key: string;
  run_id: string;
  channel: string;
  state: string;
  artifact_id?: string | null;
  audit_event_id?: string | null;
  detail: string;
  created_at_ms: number;
  updated_at_ms: number;
};

export type NotificationDeliveryReconciliationReceipt = {
  attempt: NotificationDeliveryAttempt;
  decision: string;
  retry_allowed: boolean;
  snapshot: SnapshotRecord;
  audit_event: AuditEventRecord;
  saga: SagaTransaction;
};

export type ContextBudgetDecision = {
  item_id: string;
  source_type: string;
  title: string;
  original_chars: number;
  allocated_chars: number;
  decision: string;
  reason: string;
  evidence_refs: string[];
  evidence_state: string;
  source_sha256: string;
  sensitive_markers: string[];
};

export type ContextBudgetPreview = {
  task_kind: string;
  max_context_chars: number;
  original_chars: number;
  allocated_chars: number;
  decision_state: string;
  preserve_evidence: boolean;
  decisions: ContextBudgetDecision[];
  gates: string[];
};

export type LibraryMetric = {
  label: string;
  value: number;
};

export type SagaTransaction = {
  id: string;
  kind: string;
  target_id: string;
  state: string;
  metadata: Record<string, unknown>;
  created_at_ms: number;
  updated_at_ms: number;
};

export type LibraryHomePreview = {
  generated_at_ms: number;
  state: string;
  recent_memory_count: number;
  pending_review_count: number;
  recent_task_artifact_count: number;
  recent_backup_snapshot_count: number;
  recent_audit_event_count: number;
  recycle_candidate_count: number;
  active_saga_count: number;
  recycle_state: string;
  backup_library_policy: string;
  restore_policy: string;
  recycle_policy: string;
  memory_by_level: LibraryMetric[];
  memory_by_area: LibraryMetric[];
  recent_memory: MemoryItem[];
  recent_task_artifacts: TaskArtifactRecord[];
  recent_snapshots: SnapshotRecord[];
  recycle_candidates: SnapshotRecord[];
  recent_audit_events: AuditEventRecord[];
  recent_sagas: SagaTransaction[];
  gates: string[];
};

export type ReadinessCheck = {
  id: string;
  label: string;
  state: string;
  severity: string;
  detail: string;
  remediation?: string | null;
};

export type ProductionReadinessPreview = {
  generated_at_ms: number;
  state: string;
  summary: string;
  checks: ReadinessCheck[];
  gates: string[];
};

export type SagaRecoveryItem = {
  saga: SagaTransaction;
  recovery_state: string;
  recommended_action: string;
  detail: string;
  gates: string[];
};

export type SagaRecoveryPreview = {
  generated_at_ms: number;
  state: string;
  active_count: number;
  items: SagaRecoveryItem[];
  gates: string[];
};

export type SagaRecoveryReviewReceipt = {
  saga: SagaTransaction;
  decision: string;
  audit_event: AuditEventRecord;
  state_changed: boolean;
  gates: string[];
};

export type DeviceSyncState = {
  device_id: string;
  device_label: string;
  last_synced_hash?: string | null;
  last_exported_at_ms?: number | null;
  last_imported_at_ms?: number | null;
};

export type DeviceSyncPackage = {
  schema_version: number;
  package_id: string;
  source_device_id: string;
  source_device_label: string;
  created_at_ms: number;
  base_hash?: string | null;
  content_hash: string;
  zhishu: ZhishuRepositoryBundle;
};

export type DeviceSyncImportPreview = {
  package_id: string;
  source_device_id: string;
  source_device_label: string;
  local_device_id: string;
  local_hash: string;
  base_hash?: string | null;
  incoming_hash: string;
  state: string;
  can_import: boolean;
  requires_explicit_replace: boolean;
  gates: string[];
};

export type DeviceSyncImportApplyPreflight = {
  generated_at_ms: number;
  package_id: string;
  source_device_id: string;
  local_device_id: string;
  state: string;
  preview_state: string;
  can_apply: boolean;
  allow_replace: boolean;
  requires_explicit_replace: boolean;
  import_started: boolean;
  durable_write_started: boolean;
  backup_required: boolean;
  audit_required: boolean;
  rollback_snapshot_required: boolean;
  cloud_source_of_truth: boolean;
  gates: string[];
  blockers: string[];
  denied_actions: string[];
};

export type DeviceSyncImportReceipt = {
  preview: DeviceSyncImportPreview;
  imported: ZhishuRepositoryImportReceipt;
  state: DeviceSyncState;
  snapshot: SnapshotRecord;
  audit_event: AuditEventRecord;
  saga: SagaTransaction;
};

export type RelayPreview = {
  enabled: boolean;
  endpoint_configured: boolean;
  endpoint_valid: boolean;
  token_present: boolean;
  state: string;
  gates: string[];
  network_started: boolean;
};

export type ToolDescriptor = {
  id: string;
  label: string;
  registry_source: string;
  category: string;
  invocation_mode: string;
  allow_state: string;
  risk_level: string;
  ingestion_policy: string;
  capabilities: string[];
  discovery_state: string;
  detected_path?: string | null;
};

export type SynthesisPreview = {
  generated_at_ms: number;
  admission_gate: string;
  maintenance_jobs: MaintenanceJobPreview[];
  summary_candidates: SummaryCandidate[];
  association_candidates: AssociationCandidate[];
};

export type SynthesisPromotionReceipt = {
  candidate_id: string;
  candidate_kind: string;
  review_state: string;
  admission_gate: string;
  promoted_memory_item: MemoryItem;
};

export type MaintenanceJobPreview = {
  id: string;
  label: string;
  cadence: string;
  candidate_count: number;
  readiness: string;
  gate: string;
  admission_gate: string;
};

export type SummaryCandidate = {
  id: string;
  title: string;
  summary: string;
  source_item_count: number;
  source_memory_ids: string[];
  suggested_level: string;
  review_state: string;
  admission_gate: string;
};

export type AssociationCandidate = {
  id: string;
  source_memory_id: string;
  target_id: string;
  target_kind: string;
  label: string;
  reason: string;
  score: number;
  review_state: string;
  admission_gate: string;
};
