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
  config_warnings: string[];
  capabilities: CapabilityStatus[];
  scheduler_status: SchedulerStatus;
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
  archive_gate: string;
};

export type DailyBriefingArchiveReceipt = {
  preview: DailyBriefingPreview;
  artifact: TaskArtifactRecord;
  run: TaskRunRecord;
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
  gates: string[];
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
  gates: string[];
  process_started: boolean;
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

export type AgentTeamRequest = {
  run_id: string;
  team_mode: "linear" | "roundtable";
  context_mode: "native" | "deep";
  goal: string;
  participant_tool_ids: string[];
  max_rounds: number;
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
  participants: ToolDescriptor[];
  steps: AgentTeamStep[];
  gates: string[];
  process_started: boolean;
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

export type LocalAppLaunchReceipt = {
  preview: LocalAppLaunchPreview;
  state: string;
  process_id: number;
  artifact: TaskArtifactRecord;
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
};

export type NotificationReceipt = {
  preview: NotificationPreview;
  state: string;
  server_response: string;
  artifact: TaskArtifactRecord;
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

export type DeviceSyncImportReceipt = {
  preview: DeviceSyncImportPreview;
  imported: ZhishuRepositoryImportReceipt;
  state: DeviceSyncState;
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
