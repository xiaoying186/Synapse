import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { useI18n } from "../i18n";
import type {
  AdapterExecutionReceipt,
  AggregationPreview,
  ArsenalPreview,
  HttpSourceReceipt,
  ProviderAdapterExecutionReceipt,
  ProviderReceiptAdmissionPreflight,
  ProviderReceiptAdmissionQueuePreview,
  ProviderReceiptReviewCandidate,
  ProviderReceiptReviewDecisionReceipt,
  ProviderReceiptReviewQueueReceipt,
  ProviderReceiptTaskArtifactPreflight,
  ProviderReceiptTaskArtifactReceipt,
  ProviderArtifactAdmissionReviewReceipt,
  ProviderArtifactZhishuAdmissionPreflight,
  ProviderArtifactZhishuCandidateReceipt,
  SourceHealthReport,
  SourceObservationRecord,
  SourceImportReceipt,
  ToolDescriptor,
} from "../types";

type CapabilityPreviewPanelProps = {
  aggregationPreview: AggregationPreview | null;
  arsenalPreview: ArsenalPreview | null;
  isLoadingAggregation: boolean;
  isLoadingArsenal: boolean;
  isRunningMockAdapter: boolean;
  isImportingSources: boolean;
  isFetchingHttpSource: boolean;
  isPreviewingProviderAdapterReceipt: boolean;
  isPreflightingProviderReceiptAdmission: boolean;
  isPreviewingProviderReceiptAdmissionQueue: boolean;
  isStagingProviderReceiptReviewCandidate: boolean;
  reviewingProviderReceiptCandidateId: string | null;
  preflightingProviderTaskArtifactCandidateId: string | null;
  creatingProviderTaskArtifactCandidateId: string | null;
  preflightingProviderArtifactZhishuId: string | null;
  reviewingProviderArtifactZhishuId: string | null;
  creatingProviderArtifactZhishuCandidateId: string | null;
  isLoadingSourceHealth: boolean;
  mockAdapterInput: string;
  mockAdapterReceipt: AdapterExecutionReceipt | null;
  mockAdapterRunId: string;
  httpSourceReceipt: HttpSourceReceipt | null;
  providerAdapterReceipt: ProviderAdapterExecutionReceipt | null;
  providerReceiptAdmissionPreflight: ProviderReceiptAdmissionPreflight | null;
  providerReceiptAdmissionQueuePreview: ProviderReceiptAdmissionQueuePreview | null;
  providerReceiptReviewQueueReceipt: ProviderReceiptReviewQueueReceipt | null;
  providerReceiptReviewDecisionReceipt: ProviderReceiptReviewDecisionReceipt | null;
  providerReceiptTaskArtifactPreflight: ProviderReceiptTaskArtifactPreflight | null;
  providerReceiptTaskArtifactReceipt: ProviderReceiptTaskArtifactReceipt | null;
  providerArtifactZhishuAdmissionPreflight: ProviderArtifactZhishuAdmissionPreflight | null;
  providerArtifactAdmissionReviewReceipt: ProviderArtifactAdmissionReviewReceipt | null;
  providerArtifactZhishuCandidateReceipt: ProviderArtifactZhishuCandidateReceipt | null;
  providerReceiptReviewCandidates: ProviderReceiptReviewCandidate[];
  sourceImportContent: string;
  sourceImportFormat: string;
  sourceImportReceipt: SourceImportReceipt | null;
  sourceHealthReport: SourceHealthReport | null;
  onAggregationQueryChange: (value: string) => void;
  onOnlineEnabledChange: (value: boolean) => void;
  onMockAdapterInputChange: (value: string) => void;
  onMockAdapterRunIdChange: (value: string) => void;
  onRunMockAdapter: (approved: boolean) => void;
  onFetchHttpSource: () => void;
  onPreviewProviderAdapterReceipt: () => void;
  onPreflightProviderReceiptAdmission: () => void;
  onPreviewProviderReceiptAdmissionQueue: () => void;
  onStageProviderReceiptReviewCandidate: () => void;
  onReviewProviderReceiptReviewCandidate: (candidateId: string, decision: string) => void;
  onPreflightProviderReceiptTaskArtifact: (candidateId: string) => void;
  onCreateProviderReceiptTaskArtifact: (candidateId: string) => void;
  onPreflightProviderArtifactZhishuAdmission: (artifactId: string) => void;
  onReviewProviderArtifactZhishuAdmission: (artifactId: string, decision: string) => void;
  onCreateProviderArtifactZhishuCandidate: (artifactId: string) => void;
  onSourceImportContentChange: (value: string) => void;
  onSourceImportFormatChange: (value: string) => void;
  onSubmitSourceImport: () => void;
  onPreviewAggregation: () => void;
  onRefreshArsenal: () => void;
  onRefreshSecurityCenter: () => void;
  onRefreshSourceHealth: () => void;
  onSetToolAllowState: (toolId: string, allowState: "allowed" | "blocked") => void;
  onlineEnabled: boolean;
  query: string;
  sourceObservationHistory: SourceObservationRecord[];
  updatingToolId: string | null;
};

export function CapabilityPreviewPanel({
  aggregationPreview,
  arsenalPreview,
  isLoadingAggregation,
  isLoadingArsenal,
  isRunningMockAdapter,
  isImportingSources,
  isFetchingHttpSource,
  isPreviewingProviderAdapterReceipt,
  isPreflightingProviderReceiptAdmission,
  isPreviewingProviderReceiptAdmissionQueue,
  isStagingProviderReceiptReviewCandidate,
  reviewingProviderReceiptCandidateId,
  preflightingProviderTaskArtifactCandidateId,
  creatingProviderTaskArtifactCandidateId,
  preflightingProviderArtifactZhishuId,
  reviewingProviderArtifactZhishuId,
  creatingProviderArtifactZhishuCandidateId,
  isLoadingSourceHealth,
  mockAdapterInput,
  mockAdapterReceipt,
  mockAdapterRunId,
  httpSourceReceipt,
  providerAdapterReceipt,
  providerReceiptAdmissionPreflight,
  providerReceiptAdmissionQueuePreview,
  providerReceiptReviewQueueReceipt,
  providerReceiptReviewDecisionReceipt,
  providerReceiptTaskArtifactPreflight,
  providerReceiptTaskArtifactReceipt,
  providerArtifactZhishuAdmissionPreflight,
  providerArtifactAdmissionReviewReceipt,
  providerArtifactZhishuCandidateReceipt,
  providerReceiptReviewCandidates,
  sourceImportContent,
  sourceImportFormat,
  sourceImportReceipt,
  sourceHealthReport,
  onAggregationQueryChange,
  onOnlineEnabledChange,
  onMockAdapterInputChange,
  onMockAdapterRunIdChange,
  onRunMockAdapter,
  onFetchHttpSource,
  onPreviewProviderAdapterReceipt,
  onPreflightProviderReceiptAdmission,
  onPreviewProviderReceiptAdmissionQueue,
  onStageProviderReceiptReviewCandidate,
  onReviewProviderReceiptReviewCandidate,
  onPreflightProviderReceiptTaskArtifact,
  onCreateProviderReceiptTaskArtifact,
  onPreflightProviderArtifactZhishuAdmission,
  onReviewProviderArtifactZhishuAdmission,
  onCreateProviderArtifactZhishuCandidate,
  onSourceImportContentChange,
  onSourceImportFormatChange,
  onSubmitSourceImport,
  onPreviewAggregation,
  onRefreshArsenal,
  onRefreshSecurityCenter,
  onRefreshSourceHealth,
  onSetToolAllowState,
  onlineEnabled,
  query,
  sourceObservationHistory,
  updatingToolId,
}: CapabilityPreviewPanelProps) {
  const { text } = useI18n();
  const [customToolDraft, setCustomToolDraft] = useState({
    id: "",
    label: "",
    command_candidates: "",
  });
  const [customToolPreview, setCustomToolPreview] = useState<ToolDescriptor | null>(null);
  const [customToolError, setCustomToolError] = useState("");
  const [customToolMessage, setCustomToolMessage] = useState("");
  const [isPreviewingCustomTool, setIsPreviewingCustomTool] = useState(false);
  const [isSavingCustomTool, setIsSavingCustomTool] = useState(false);
  const [removingCustomToolId, setRemovingCustomToolId] = useState<string | null>(null);

  function customToolDraftRequest() {
    return {
      ...customToolDraft,
      category: "custom-tool",
      invocation_mode: "deep",
      risk_level: "high",
      ingestion_policy: "review-before-memory",
      capabilities: [],
      command_candidates: customToolDraft.command_candidates.split(","),
    };
  }

  async function previewCustomTool() {
    setIsPreviewingCustomTool(true);
    setCustomToolError("");
    setCustomToolMessage("");
    try {
      const preview = await invoke<ToolDescriptor>("preview_custom_arsenal_tool", {
        draft: customToolDraftRequest(),
      });
      setCustomToolPreview(preview);
    } catch (error) {
      setCustomToolPreview(null);
      setCustomToolError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPreviewingCustomTool(false);
    }
  }

  async function saveCustomTool() {
    if (!window.confirm("Save this custom tool blocked by default? It will not be executed.")) {
      return;
    }
    setIsSavingCustomTool(true);
    setCustomToolError("");
    setCustomToolMessage("");
    try {
      const saved = await invoke<ToolDescriptor>("save_custom_arsenal_tool", {
        draft: customToolDraftRequest(),
      });
      setCustomToolPreview(saved);
      onRefreshArsenal();
      onRefreshSecurityCenter();
      setCustomToolMessage(`Saved ${saved.id} blocked by default.`);
    } catch (error) {
      setCustomToolError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSavingCustomTool(false);
    }
  }

  async function removeCustomTool(toolId: string) {
    if (!window.confirm(`Remove custom tool ${toolId} from the registry? Audit history remains.`)) {
      return;
    }
    setRemovingCustomToolId(toolId);
    setCustomToolError("");
    setCustomToolMessage("");
    try {
      await invoke<ToolDescriptor>("remove_custom_arsenal_tool", { toolId });
      await onRefreshArsenal();
      await onRefreshSecurityCenter();
      setCustomToolMessage(`Removed ${toolId}; audit history remains.`);
    } catch (error) {
      setCustomToolError(error instanceof Error ? error.message : String(error));
    } finally {
      setRemovingCustomToolId(null);
    }
  }

  return (
    <section className="capability-grid">
      <section className="panel capability-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{text("Information aggregation")}</p>
            <h3>{text("Source preview")}</h3>
          </div>
        </div>
        <form
          className="capability-form"
          onSubmit={(event) => {
            event.preventDefault();
            onPreviewAggregation();
          }}
        >
          <input
            value={query}
            onChange={(event) => onAggregationQueryChange(event.currentTarget.value)}
            placeholder={text("Query to assess before retrieval")}
          />
          <label className="online-toggle">
            <input
              checked={onlineEnabled}
              type="checkbox"
              onChange={(event) => onOnlineEnabledChange(event.currentTarget.checked)}
            />
            <span>{text("Online")}</span>
          </label>
          <button type="submit" disabled={isLoadingAggregation}>
            {isLoadingAggregation ? text("Previewing") : text("Preview")}
          </button>
        </form>

        {aggregationPreview && (
          <div className="capability-result">
            <div className="capability-summary">
              <span>{text(aggregationPreview.retrieval_state)}</span>
              <strong>{aggregationPreview.required_cross_checks} {text("source checks")}</strong>
            </div>
            <div className="policy-tiers">
              <span>{text(aggregationPreview.source_policy.freshness_required ? "freshness required" : "stable context")}</span>
              <span>{text(aggregationPreview.source_policy.cross_check_required ? "cross-check" : "single-source ok")}</span>
              <span>{text(aggregationPreview.source_policy.durable_write_gate)}</span>
            </div>
            <div className="retrieval-contract">
              <span>{text(aggregationPreview.retrieval_contract.readiness)}</span>
              <strong>
                {aggregationPreview.retrieval_contract.allowed_source_count} {text("allowlisted")} /{" "}
                {aggregationPreview.retrieval_contract.quarantine_source_count} {text("quarantined")}
              </strong>
              {aggregationPreview.retrieval_contract.blocked_reason && (
                <p>{text(aggregationPreview.retrieval_contract.blocked_reason)}</p>
              )}
              <div className="policy-tiers">
                {aggregationPreview.retrieval_contract.gates.map((gate) => (
                  <span key={gate}>{text(gate)}</span>
                ))}
              </div>
            </div>
            <div className="retrieval-contract" data-testid="aggregation-evidence-validation">
              <span>{text("Evidence validation")}</span>
              <strong>
                {text(aggregationPreview.evidence_validation.cross_check_state)} /{" "}
                {text(aggregationPreview.evidence_validation.conflict_state)}
              </strong>
              <p>
                {aggregationPreview.evidence_validation.source_count} {text("sources")} /{" "}
                {aggregationPreview.evidence_validation.distinct_claim_count} {text("claims")} /{" "}
                {text(aggregationPreview.evidence_validation.quarantine_state)}
              </p>
              <p>
                {text("summary allowed")}:{" "}
                {text(aggregationPreview.evidence_validation.summary_allowed ? "true" : "false")} /{" "}
                {text("durable write allowed")}:{" "}
                {text(aggregationPreview.evidence_validation.durable_write_allowed ? "true" : "false")}
              </p>
              <div className="policy-tiers">
                {aggregationPreview.evidence_validation.gates.map((gate) => (
                  <span key={gate}>{text(gate)}</span>
                ))}
              </div>
              {aggregationPreview.evidence_validation.blockers.length > 0 && (
                <small>
                  {text("Blocked")}:{" "}
                  {aggregationPreview.evidence_validation.blockers.map((blocker) => text(blocker)).join(", ")}
                </small>
              )}
            </div>
            <div className="policy-gates">
              {aggregationPreview.source_assessments.map((source) => (
                <div className="policy-gate" key={source.source_type}>
                  <span>{text(source.source_type)}</span>
                  <b>{text(source.trust_level)}</b>
                  <p>{text(source.admission_state)} / {text(source.freshness_window)}</p>
                  {source.notes.length > 0 && (
                    <small>{source.notes.slice(0, 2).join(" / ")}</small>
                  )}
                </div>
              ))}
            </div>
            <div className="source-gate-list">
              {aggregationPreview.source_gates.map((gate) => (
                <article className="source-gate-item" key={gate.source_id}>
                  <div>
                    <span>{gate.label}</span>
                    <strong>{text(gate.allow_state)}</strong>
                  </div>
                  <b>{gate.minimum_cross_checks} {text("checks")}</b>
                  <small>{text(gate.quarantine_required ? "quarantine" : "direct context")}</small>
                  <em>{text(gate.admission_gate)}</em>
                </article>
              ))}
            </div>
            <form
              className="capability-form source-import-form"
              onSubmit={(event) => {
                event.preventDefault();
                onSubmitSourceImport();
              }}
            >
              <select
                value={sourceImportFormat}
                onChange={(event) => onSourceImportFormatChange(event.target.value)}
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
              <textarea
                value={sourceImportContent}
                onChange={(event) => onSourceImportContentChange(event.target.value)}
                placeholder={
                  sourceImportFormat === "json"
                    ? '[{"source_id":"manual","normalized_claim":"claim"}]'
                    : "source_id,normalized_claim,field_coverage"
                }
              />
              <button type="submit" disabled={isImportingSources}>
                {isImportingSources ? text("Importing") : text("Import observations")}
              </button>
            </form>
            <div className="capability-summary">
              <span>{text("configured HTTP source")}</span>
              <button type="button" onClick={onFetchHttpSource} disabled={isFetchingHttpSource}>
                {isFetchingHttpSource ? text("Fetching") : text("Fetch read-only JSON")}
              </button>
              <button
                type="button"
                data-testid="provider-adapter-loopback-receipt-button"
                onClick={onPreviewProviderAdapterReceipt}
                disabled={isPreviewingProviderAdapterReceipt}
              >
                {isPreviewingProviderAdapterReceipt
                  ? text("Recording provider receipt")
                  : text("Provider loopback receipt")}
              </button>
            </div>
            {providerAdapterReceipt && (
              <div className="retrieval-contract" data-testid="provider-adapter-loopback-receipt">
                <span>{text("Provider receipt")}</span>
                <strong>
                  {providerAdapterReceipt.provider_id} / {text(providerAdapterReceipt.execution_state)}
                </strong>
                <p>
                  sha256 {providerAdapterReceipt.source_sha256.slice(0, 16)} /{" "}
                  {providerAdapterReceipt.response_bytes} bytes
                </p>
                <small>
                  {text("network started")}:{" "}
                  {text(providerAdapterReceipt.external_network_started ? "true" : "false")} /{" "}
                  {text("credential read")}:{" "}
                  {text(providerAdapterReceipt.credential_read_started ? "true" : "false")} /{" "}
                  {text("durable write started")}:{" "}
                  {text(providerAdapterReceipt.durable_write_started ? "true" : "false")}
                </small>
                <small>
                  {text("audit recorded")}: {text(providerAdapterReceipt.audit_recorded ? "true" : "false")} /{" "}
                  {text("quarantine recorded")}:{" "}
                  {text(providerAdapterReceipt.quarantine_recorded ? "true" : "false")}
                </small>
                <div className="policy-tiers">
                  {providerAdapterReceipt.gates.map((gate) => (
                    <span key={gate}>{text(gate)}</span>
                  ))}
                </div>
                <button
                  type="button"
                  data-testid="provider-receipt-admission-preflight-button"
                  onClick={onPreflightProviderReceiptAdmission}
                  disabled={isPreflightingProviderReceiptAdmission}
                >
                  {isPreflightingProviderReceiptAdmission
                    ? text("Checking provider admission")
                    : text("Check provider admission")}
                </button>
                <button
                  type="button"
                  data-testid="provider-receipt-review-queue-button"
                  onClick={onPreviewProviderReceiptAdmissionQueue}
                  disabled={isPreviewingProviderReceiptAdmissionQueue}
                >
                  {isPreviewingProviderReceiptAdmissionQueue
                    ? text("Previewing provider review queue")
                    : text("Preview provider review queue")}
                </button>
                <button
                  type="button"
                  data-testid="provider-receipt-stage-review-candidate-button"
                  onClick={onStageProviderReceiptReviewCandidate}
                  disabled={isStagingProviderReceiptReviewCandidate}
                >
                  {isStagingProviderReceiptReviewCandidate
                    ? text("Staging provider review candidate")
                    : text("Stage provider review candidate")}
                </button>
              </div>
            )}
            {providerReceiptAdmissionPreflight && (
              <div
                className="retrieval-contract"
                data-testid="provider-receipt-admission-preflight-result"
              >
                <span>{text("Provider admission preflight")}</span>
                <strong>{text(providerReceiptAdmissionPreflight.state)}</strong>
                <p>
                  {providerReceiptAdmissionPreflight.candidate_kind} /{" "}
                  {providerReceiptAdmissionPreflight.source_sha256.slice(0, 16)}
                </p>
                <small>
                  {text("summary candidate created")}:{" "}
                  {text(providerReceiptAdmissionPreflight.summary_candidate_created ? "true" : "false")} /{" "}
                  {text("task artifact write started")}:{" "}
                  {text(providerReceiptAdmissionPreflight.task_artifact_write_started ? "true" : "false")} /{" "}
                  {text("durable Zhishu write")}:{" "}
                  {text(providerReceiptAdmissionPreflight.durable_zhishu_write_started ? "true" : "false")}
                </small>
                <div className="policy-tiers">
                  {providerReceiptAdmissionPreflight.gates.map((gate) => (
                    <span key={gate}>{text(gate)}</span>
                  ))}
                </div>
                <small>
                  {text("Blocked")}:{" "}
                  {providerReceiptAdmissionPreflight.blockers.map((blocker) => text(blocker)).join(", ")}
                </small>
              </div>
            )}
            {httpSourceReceipt && (
              <div className="retrieval-contract">
                <span>{httpSourceReceipt.observation.source_id}</span>
                <strong>
                  HTTP {httpSourceReceipt.status_code} / {httpSourceReceipt.response_bytes} bytes
                </strong>
                <p>{httpSourceReceipt.observation.normalized_claim}</p>
                <small>
                  {Math.round(httpSourceReceipt.confidence.score * 100)}% {text("confidence")} /{" "}
                  {text(httpSourceReceipt.confidence.admission_state)}
                </small>
                <small>
                  {text("Evidence validation")}:{" "}
                  {text(httpSourceReceipt.evidence_validation.cross_check_state)} /{" "}
                  {text("durable write allowed")}:{" "}
                  {text(httpSourceReceipt.evidence_validation.durable_write_allowed ? "true" : "false")}
                </small>
                <small data-testid="http-provider-receipt">
                  {text("Provider receipt")}: {httpSourceReceipt.provider_receipt.provider_id} /{" "}
                  {text(httpSourceReceipt.provider_receipt.execution_state)} / sha256{" "}
                  {httpSourceReceipt.provider_receipt.source_sha256.slice(0, 12)}
                </small>
                <small>
                  {text("audit recorded")}:{" "}
                  {text(httpSourceReceipt.provider_receipt.audit_recorded ? "true" : "false")} /{" "}
                  {text("quarantine recorded")}:{" "}
                  {text(httpSourceReceipt.provider_receipt.quarantine_recorded ? "true" : "false")} /{" "}
                  {text("credential read")}:{" "}
                  {text(httpSourceReceipt.provider_receipt.credential_read_started ? "true" : "false")}
                </small>
                <div className="policy-tiers">
                  {httpSourceReceipt.gates.map((gate) => (
                    <span key={gate}>{text(gate)}</span>
                  ))}
                  {httpSourceReceipt.provider_receipt.gates.map((gate) => (
                    <span key={gate}>{text(gate)}</span>
                  ))}
                </div>
              </div>
            )}
            {sourceImportReceipt && (
              <div className="retrieval-contract">
                <span>{text("manual")} {sourceImportReceipt.format} {text("fallback")}</span>
                <strong>{sourceImportReceipt.imported_count} {text("imported")}</strong>
                <p>
                  {Math.round(sourceImportReceipt.confidence.score * 100)}% {text("confidence")} /{" "}
                  {text(sourceImportReceipt.confidence.conflict_level)} {text("conflict")} /{" "}
                  {text(sourceImportReceipt.confidence.admission_state)}
                </p>
                <div className="policy-tiers">
                  {sourceImportReceipt.gates.map((gate) => (
                    <span key={gate}>{text(gate)}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="retrieval-contract">
              <span>{text("fixture confidence")}</span>
              <strong>{Math.round(aggregationPreview.confidence.score * 100)}%</strong>
              <p>
                {text(aggregationPreview.confidence.conflict_level)} {text("conflict")} /{" "}
                {text(aggregationPreview.confidence.freshness_state)} /{" "}
                {text(aggregationPreview.confidence.admission_state)}
              </p>
              <div className="source-gate-list">
                {aggregationPreview.observations.map((observation) => (
                  <article className="source-gate-item" key={observation.source_id}>
                    <div>
                      <span>{observation.source_id}</span>
                      <strong>{observation.normalized_claim}</strong>
                    </div>
                    <b>{Math.round(observation.field_coverage * 100)}%</b>
                    <small>{text(observation.freshness)}</small>
                    <em>
                      {text(observation.quarantine_state)} / {observation.source_uri}
                    </em>
                  </article>
                ))}
              </div>
            </div>
            <div className="retrieval-contract">
              <span>{text("source history")}</span>
              <strong>{sourceObservationHistory.length} {text("recent observations")}</strong>
              <button type="button" onClick={onRefreshSourceHealth} disabled={isLoadingSourceHealth}>
                {isLoadingSourceHealth ? text("Refreshing") : text("Health report")}
              </button>
              <div className="source-gate-list">
                {sourceObservationHistory.slice(0, 6).map((observation) => (
                  <article className="source-gate-item" key={observation.id}>
                    <div>
                      <span>{observation.source_id}</span>
                      <strong>{observation.query}</strong>
                    </div>
                    <b>{Math.round(observation.confidence_score * 100)}%</b>
                    <small>{text(observation.conflict_level)}</small>
                    <em>{text(observation.admission_state)}</em>
                  </article>
                ))}
              </div>
            </div>
            {sourceHealthReport && (
              <div className="retrieval-contract">
                <span>{text("source health")}</span>
                <strong>
                  {text(sourceHealthReport.overall_state)} / {sourceHealthReport.source_count} {text("sources")}
                </strong>
                <p>
                  {sourceHealthReport.observation_count} {text("observations across")}{" "}
                  {sourceHealthReport.query_count} {text("queries")}
                </p>
                <div className="policy-tiers">
                  {sourceHealthReport.gates.map((gate) => (
                    <span key={gate}>{text(gate)}</span>
                  ))}
                </div>
                <div className="source-gate-list">
                  {sourceHealthReport.source_health.slice(0, 6).map((source) => (
                    <article className="source-gate-item" key={source.source_id}>
                      <div>
                        <span>{source.source_id}</span>
                        <strong>{text(source.state)}</strong>
                      </div>
                      <b>{Math.round(source.average_confidence * 100)}%</b>
                      <small>{source.conflict_count} {text("conflicts")}</small>
                      <em>
                        {text("coverage")} {Math.round(source.average_field_coverage * 100)}% / {text("fallback")}{" "}
                        {Math.round(source.fallback_ratio * 100)}%
                      </em>
                    </article>
                  ))}
                </div>
                <div className="source-gate-list">
                  {sourceHealthReport.query_cross_checks.slice(0, 4).map((query) => (
                    <article className="source-gate-item" key={query.query}>
                      <div>
                        <span>{text(query.state)}</span>
                        <strong>{query.query}</strong>
                      </div>
                      <b>{query.source_count} {text("sources")}</b>
                      <small>{query.distinct_claim_count} {text("claims")}</small>
                      <em>{Math.round(query.average_confidence * 100)}% {text("confidence")}</em>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="panel capability-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{text("Arsenal")}</p>
            <h3>{text("Registry preview")}</h3>
          </div>
          <button className="text-action" type="button" onClick={onRefreshArsenal} disabled={isLoadingArsenal}>
            {isLoadingArsenal ? text("Loading") : text("Refresh")}
          </button>
        </div>

        {arsenalPreview && (
          <div className="capability-result">
            <div className="capability-summary">
              <span>{text(arsenalPreview.registry_state)}</span>
              <strong>{arsenalPreview.allowed_tools} {text("allowed")} / {arsenalPreview.blocked_tools} {text("blocked")}</strong>
            </div>
            <form
              className="capability-form"
              onSubmit={(event) => {
                event.preventDefault();
                previewCustomTool();
              }}
            >
              <input value={customToolDraft.id} onChange={(event) => setCustomToolDraft({ ...customToolDraft, id: event.currentTarget.value })} placeholder={text("Custom tool ID")} />
              <input value={customToolDraft.label} onChange={(event) => setCustomToolDraft({ ...customToolDraft, label: event.currentTarget.value })} placeholder={text("Tool label")} />
              <input value={customToolDraft.command_candidates} onChange={(event) => setCustomToolDraft({ ...customToolDraft, command_candidates: event.currentTarget.value })} placeholder={text("Command candidates, comma-separated")} />
              <button type="submit" disabled={isPreviewingCustomTool}>{isPreviewingCustomTool ? text("Checking") : text("Check draft")}</button>
              <button type="button" disabled={!customToolPreview || isSavingCustomTool} onClick={saveCustomTool}>
                {isSavingCustomTool ? text("Saving") : text("Save blocked tool")}
              </button>
            </form>
            {customToolError && <p className="empty-state">{customToolError}</p>}
            {customToolMessage && <p className="empty-state">{customToolMessage}</p>}
            {customToolPreview && (
              <div className="retrieval-contract">
                <span>{text("custom draft")} / {text(customToolPreview.allow_state)}</span>
                <strong>{text(customToolPreview.discovery_state)}</strong>
                <p>{customToolPreview.label} / {text(customToolPreview.ingestion_policy)}</p>
                {customToolPreview.detected_path && <small>{customToolPreview.detected_path}</small>}
              </div>
            )}
            <div className="policy-tiers">
              {arsenalPreview.gates.map((gate) => (
                <span key={gate}>{text(gate)}</span>
              ))}
            </div>
            <form
              className="capability-form"
              onSubmit={(event) => {
                event.preventDefault();
                onRunMockAdapter(false);
              }}
            >
              <input
                value={mockAdapterRunId}
                onChange={(event) => onMockAdapterRunIdChange(event.target.value)}
                placeholder={text("Approved Task Run ID")}
              />
              <input
                value={mockAdapterInput}
                onChange={(event) => onMockAdapterInputChange(event.target.value)}
                placeholder={text("Mock adapter input")}
              />
              <button type="submit" disabled={isRunningMockAdapter}>
                {text("Dry-run")}
              </button>
              <button
                type="button"
                disabled={isRunningMockAdapter}
                onClick={() => onRunMockAdapter(true)}
              >
                {text("Execute")}
              </button>
            </form>
            {mockAdapterReceipt && (
              <div className="retrieval-contract">
                <span>
                  {mockAdapterReceipt.tool_id} / {text(mockAdapterReceipt.execution_mode)}
                </span>
                <strong>{text(mockAdapterReceipt.state)}</strong>
                <p>{text(mockAdapterReceipt.output_summary)}</p>
                {mockAdapterReceipt.artifact && (
                  <small>{text("artifact")}: {mockAdapterReceipt.artifact.id}</small>
                )}
                <div className="policy-tiers">
                  {mockAdapterReceipt.gates.map((gate) => (
                    <span key={gate}>{text(gate)}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="tool-list">
              {arsenalPreview.tools.map((tool) => (
                <article className="tool-item" key={tool.id}>
                  {(() => {
                    const canAllow = tool.discovery_state === "detected";

                    return (
                      <>
                        <div>
                          <span>
                            {text(tool.registry_source)} / {text(tool.category)} / {text(tool.invocation_mode)} /{" "}
                            {text(tool.discovery_state)}
                          </span>
                          <strong>{tool.label}</strong>
                        </div>
                        <b>{text(tool.allow_state)}</b>
                        <small>{text(tool.risk_level)}</small>
                        <div className="tool-capability-list">
                          {tool.capabilities.map((capability) => (
                            <span key={`${tool.id}-${capability}`}>{text(capability)}</span>
                          ))}
                        </div>
                        <em>
                          {text(tool.ingestion_policy)}
                          {tool.detected_path ? ` / ${tool.detected_path}` : ""}
                        </em>
                        <div className="tool-actions">
                          <button
                            type="button"
                            onClick={() => onSetToolAllowState(tool.id, "allowed")}
                            disabled={
                              updatingToolId === tool.id || tool.allow_state === "allowed" || !canAllow
                            }
                          >
                            {canAllow ? text("Allow") : text("Unavailable")}
                          </button>
                          <button
                            type="button"
                            onClick={() => onSetToolAllowState(tool.id, "blocked")}
                            disabled={updatingToolId === tool.id || tool.allow_state === "blocked"}
                          >
                            {text("Block")}
                          </button>
                          {tool.registry_source === "custom" && (
                            <button
                              type="button"
                              onClick={() => removeCustomTool(tool.id)}
                              disabled={removingCustomToolId === tool.id}
                            >
                              {removingCustomToolId === tool.id ? text("Removing") : text("Remove")}
                            </button>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </article>
              ))}
                </div>
              </div>
            )}
            {providerReceiptAdmissionQueuePreview && (
              <div
                className="retrieval-contract"
                data-testid="provider-receipt-review-queue-result"
              >
                <span>{text("Provider review queue preview")}</span>
                <strong>{text(providerReceiptAdmissionQueuePreview.state)}</strong>
                <p>
                  {providerReceiptAdmissionQueuePreview.candidate_count} {text("candidates")} /{" "}
                  {providerReceiptAdmissionQueuePreview.pending_review_count}{" "}
                  {text("pending review")}
                </p>
                <small>
                  {text("task artifact write started")}:{" "}
                  {text(providerReceiptAdmissionQueuePreview.task_artifact_write_started ? "true" : "false")} /{" "}
                  {text("durable Zhishu write")}:{" "}
                  {text(providerReceiptAdmissionQueuePreview.durable_zhishu_write_started ? "true" : "false")}
                </small>
                <div className="policy-tiers">
                  {providerReceiptAdmissionQueuePreview.gates.map((gate) => (
                    <span key={gate}>{text(gate)}</span>
                  ))}
                </div>
                <ul className="compact-list">
                  {providerReceiptAdmissionQueuePreview.blockers.map((blocker) => (
                    <li key={blocker}>{text(blocker)}</li>
                  ))}
                </ul>
              </div>
            )}
            {providerReceiptReviewQueueReceipt && (
              <div
                className="retrieval-contract"
                data-testid="provider-receipt-stage-review-candidate-result"
              >
                <span>{text("Provider review candidate staged")}</span>
                <strong>{text(providerReceiptReviewQueueReceipt.state)}</strong>
                <p>
                  {providerReceiptReviewQueueReceipt.candidate.id.slice(0, 48)} /{" "}
                  {text(providerReceiptReviewQueueReceipt.candidate.review_state)}
                </p>
                <small>
                  {text("snapshot")}: {providerReceiptReviewQueueReceipt.snapshot.id} /{" "}
                  {text("audit")}: {providerReceiptReviewQueueReceipt.audit_event.id} / saga:{" "}
                  {text(providerReceiptReviewQueueReceipt.saga.state)}
                </small>
                <small>
                  {text("task artifact write started")}:{" "}
                  {text(providerReceiptReviewQueueReceipt.task_artifact_write_started ? "true" : "false")} /{" "}
                  {text("durable Zhishu write")}:{" "}
                  {text(providerReceiptReviewQueueReceipt.durable_zhishu_write_started ? "true" : "false")}
                </small>
              </div>
            )}
            {providerReceiptReviewDecisionReceipt && (
              <div
                className="retrieval-contract"
                data-testid="provider-receipt-review-decision-result"
              >
                <span>{text("Provider review decision")}</span>
                <strong>{text(providerReceiptReviewDecisionReceipt.state)}</strong>
                <p>
                  {providerReceiptReviewDecisionReceipt.candidate.id.slice(0, 48)} /{" "}
                  {text(providerReceiptReviewDecisionReceipt.candidate.review_state)}
                </p>
                <small>
                  {text("task artifact write started")}:{" "}
                  {text(providerReceiptReviewDecisionReceipt.task_artifact_write_started ? "true" : "false")} /{" "}
                  {text("durable Zhishu write")}:{" "}
                  {text(providerReceiptReviewDecisionReceipt.durable_zhishu_write_started ? "true" : "false")}
                </small>
                <div className="policy-tiers">
                  {providerReceiptReviewDecisionReceipt.gates.map((gate) => (
                    <span key={gate}>{text(gate)}</span>
                  ))}
                </div>
              </div>
            )}
            {providerReceiptTaskArtifactPreflight && (
              <div
                className="retrieval-contract"
                data-testid="provider-task-artifact-preflight-result"
              >
                <span>{text("Provider task artifact preflight")}</span>
                <strong>{text(providerReceiptTaskArtifactPreflight.state)}</strong>
                <p>
                  {providerReceiptTaskArtifactPreflight.candidate_id.slice(0, 48)} /{" "}
                  {text(providerReceiptTaskArtifactPreflight.review_state)}
                </p>
                <small>
                  {text("task artifact write started")}:{" "}
                  {text(providerReceiptTaskArtifactPreflight.task_artifact_write_started ? "true" : "false")} /{" "}
                  {text("durable Zhishu write")}:{" "}
                  {text(providerReceiptTaskArtifactPreflight.durable_zhishu_write_started ? "true" : "false")}
                </small>
                <div className="policy-tiers">
                  {providerReceiptTaskArtifactPreflight.gates.map((gate) => (
                    <span key={gate}>{text(gate)}</span>
                  ))}
                </div>
                <ul className="compact-list">
                  {providerReceiptTaskArtifactPreflight.blockers.map((blocker) => (
                    <li key={blocker}>{text(blocker)}</li>
                  ))}
                </ul>
              </div>
            )}
            {providerReceiptTaskArtifactReceipt && (
              <div
                className="retrieval-contract"
                data-testid="provider-task-artifact-stage-result"
              >
                <span>{text("Provider task artifact staged")}</span>
                <strong>{text(providerReceiptTaskArtifactReceipt.state)}</strong>
                <p>
                  {providerReceiptTaskArtifactReceipt.artifact.id} /{" "}
                  {text(providerReceiptTaskArtifactReceipt.candidate.review_state)}
                </p>
                <small>
                  {text("task artifact write started")}:{" "}
                  {text(providerReceiptTaskArtifactReceipt.task_artifact_write_started ? "true" : "false")} /{" "}
                  {text("durable Zhishu write")}:{" "}
                  {text(providerReceiptTaskArtifactReceipt.durable_zhishu_write_started ? "true" : "false")}
                </small>
                <div className="policy-tiers">
                  {providerReceiptTaskArtifactReceipt.gates.map((gate) => (
                    <span key={gate}>{text(gate)}</span>
                  ))}
                </div>
                <button
                  type="button"
                  data-testid="provider-artifact-zhishu-preflight-button"
                  onClick={() =>
                    onPreflightProviderArtifactZhishuAdmission(providerReceiptTaskArtifactReceipt.artifact.id)
                  }
                  disabled={preflightingProviderArtifactZhishuId === providerReceiptTaskArtifactReceipt.artifact.id}
                >
                  {text("Zhishu admission preflight")}
                </button>
              </div>
            )}
            {providerArtifactZhishuAdmissionPreflight && (
              <div
                className="retrieval-contract"
                data-testid="provider-artifact-zhishu-preflight-result"
              >
                <span>{text("Provider artifact Zhishu admission preflight")}</span>
                <strong>{text(providerArtifactZhishuAdmissionPreflight.state)}</strong>
                <p>
                  {providerArtifactZhishuAdmissionPreflight.artifact_id} /{" "}
                  {text(providerArtifactZhishuAdmissionPreflight.quarantine_state)}
                </p>
                <small>
                  {text("task artifact write started")}:{" "}
                  {text(providerArtifactZhishuAdmissionPreflight.task_artifact_write_started ? "true" : "false")} /{" "}
                  {text("durable Zhishu write")}:{" "}
                  {text(providerArtifactZhishuAdmissionPreflight.durable_zhishu_write_started ? "true" : "false")}
                </small>
                <div className="policy-tiers">
                  {providerArtifactZhishuAdmissionPreflight.gates.map((gate) => (
                    <span key={gate}>{text(gate)}</span>
                  ))}
                </div>
                <ul className="compact-list">
                  {providerArtifactZhishuAdmissionPreflight.blockers.map((blocker) => (
                    <li key={blocker}>{text(blocker)}</li>
                  ))}
                </ul>
                <div className="inline-actions">
                  <button
                    type="button"
                    data-testid="provider-artifact-zhishu-review-approve-button"
                    onClick={() =>
                      onReviewProviderArtifactZhishuAdmission(
                        providerArtifactZhishuAdmissionPreflight.artifact_id,
                        "approved",
                      )
                    }
                    disabled={
                      reviewingProviderArtifactZhishuId ===
                      providerArtifactZhishuAdmissionPreflight.artifact_id
                    }
                  >
                    {text("Approve Zhishu candidate review")}
                  </button>
                  <button
                    type="button"
                    data-testid="provider-artifact-zhishu-review-reject-button"
                    onClick={() =>
                      onReviewProviderArtifactZhishuAdmission(
                        providerArtifactZhishuAdmissionPreflight.artifact_id,
                        "rejected",
                      )
                    }
                    disabled={
                      reviewingProviderArtifactZhishuId ===
                      providerArtifactZhishuAdmissionPreflight.artifact_id
                    }
                  >
                    {text("Reject Zhishu candidate review")}
                  </button>
                </div>
              </div>
            )}
            {providerArtifactAdmissionReviewReceipt && (
              <div
                className="retrieval-contract"
                data-testid="provider-artifact-zhishu-review-result"
              >
                <span>{text("Provider artifact Zhishu admission review")}</span>
                <strong>{text(providerArtifactAdmissionReviewReceipt.review.review_state)}</strong>
                <p>
                  {providerArtifactAdmissionReviewReceipt.review.artifact_id} /{" "}
                  {text(providerArtifactAdmissionReviewReceipt.review.review_decision)}
                </p>
                <small>
                  {text("durable Zhishu candidate write")}:{" "}
                  {text(
                    providerArtifactAdmissionReviewReceipt.durable_zhishu_candidate_write_started
                      ? "true"
                      : "false",
                  )}{" "}
                  / {text("confirmed knowledge write")}:{" "}
                  {text(
                    providerArtifactAdmissionReviewReceipt.confirmed_knowledge_write_started
                      ? "true"
                      : "false",
                  )}
                </small>
                <div className="policy-tiers">
                  {providerArtifactAdmissionReviewReceipt.gates.map((gate) => (
                    <span key={gate}>{text(gate)}</span>
                  ))}
                </div>
                <button
                  type="button"
                  data-testid="provider-artifact-zhishu-candidate-create-button"
                  onClick={() =>
                    onCreateProviderArtifactZhishuCandidate(
                      providerArtifactAdmissionReviewReceipt.review.artifact_id,
                    )
                  }
                  disabled={
                    creatingProviderArtifactZhishuCandidateId ===
                      providerArtifactAdmissionReviewReceipt.review.artifact_id ||
                    providerArtifactAdmissionReviewReceipt.review.review_state !==
                      "approved-for-zhishu-candidate"
                  }
                >
                  {text("Create Zhishu candidate receipt")}
                </button>
              </div>
            )}
            {providerArtifactZhishuCandidateReceipt && (
              <div
                className="retrieval-contract"
                data-testid="provider-artifact-zhishu-candidate-result"
              >
                <span>{text("Provider artifact Zhishu candidate receipt")}</span>
                <strong>{text(providerArtifactZhishuCandidateReceipt.state)}</strong>
                <p>
                  {providerArtifactZhishuCandidateReceipt.memory_item.id} /{" "}
                  {text(providerArtifactZhishuCandidateReceipt.memory_item.admission_state)}
                </p>
                <small>
                  {text("durable Zhishu candidate write")}:{" "}
                  {text(
                    providerArtifactZhishuCandidateReceipt.durable_zhishu_candidate_write_started
                      ? "true"
                      : "false",
                  )}{" "}
                  / {text("confirmed knowledge write")}:{" "}
                  {text(
                    providerArtifactZhishuCandidateReceipt.confirmed_knowledge_write_started
                      ? "true"
                      : "false",
                  )}
                </small>
                <div className="policy-tiers">
                  {providerArtifactZhishuCandidateReceipt.gates.map((gate) => (
                    <span key={gate}>{text(gate)}</span>
                  ))}
                </div>
              </div>
            )}
            {providerReceiptReviewCandidates.length > 0 && (
              <div className="retrieval-contract" data-testid="provider-receipt-review-candidates">
                <span>{text("Provider review candidates")}</span>
                <strong>
                  {providerReceiptReviewCandidates.length} {text("pending review")}
                </strong>
                <ul className="compact-list">
                  {providerReceiptReviewCandidates.slice(0, 3).map((candidate) => (
                    <li key={candidate.id}>
                      {candidate.id.slice(0, 48)} / {text(candidate.review_state)}
                      <div className="inline-actions">
                        <button
                          type="button"
                          data-testid={`provider-receipt-review-approve-${candidate.id}`}
                          onClick={() => onReviewProviderReceiptReviewCandidate(candidate.id, "approved")}
                          disabled={reviewingProviderReceiptCandidateId === candidate.id}
                        >
                          {text("Approve")}
                        </button>
                        <button
                          type="button"
                          data-testid={`provider-receipt-review-reject-${candidate.id}`}
                          onClick={() => onReviewProviderReceiptReviewCandidate(candidate.id, "rejected")}
                          disabled={reviewingProviderReceiptCandidateId === candidate.id}
                        >
                          {text("Reject")}
                        </button>
                        <button
                          type="button"
                          data-testid={`provider-task-artifact-preflight-${candidate.id}`}
                          onClick={() => onPreflightProviderReceiptTaskArtifact(candidate.id)}
                          disabled={preflightingProviderTaskArtifactCandidateId === candidate.id}
                        >
                          {text("Task artifact preflight")}
                        </button>
                        <button
                          type="button"
                          data-testid={`provider-task-artifact-stage-${candidate.id}`}
                          onClick={() => onCreateProviderReceiptTaskArtifact(candidate.id)}
                          disabled={creatingProviderTaskArtifactCandidateId === candidate.id}
                        >
                          {text("Stage task artifact")}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
    </section>
  );
}
