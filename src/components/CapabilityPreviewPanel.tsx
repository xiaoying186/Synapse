import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import type {
  AdapterExecutionReceipt,
  AggregationPreview,
  ArsenalPreview,
  HttpSourceReceipt,
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
  isLoadingSourceHealth: boolean;
  mockAdapterInput: string;
  mockAdapterReceipt: AdapterExecutionReceipt | null;
  mockAdapterRunId: string;
  httpSourceReceipt: HttpSourceReceipt | null;
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
  isLoadingSourceHealth,
  mockAdapterInput,
  mockAdapterReceipt,
  mockAdapterRunId,
  httpSourceReceipt,
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
            <p className="eyebrow">Information aggregation</p>
            <h3>Source preview</h3>
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
            placeholder="Query to assess before retrieval"
          />
          <label className="online-toggle">
            <input
              checked={onlineEnabled}
              type="checkbox"
              onChange={(event) => onOnlineEnabledChange(event.currentTarget.checked)}
            />
            <span>Online</span>
          </label>
          <button type="submit" disabled={isLoadingAggregation}>
            {isLoadingAggregation ? "Previewing" : "Preview"}
          </button>
        </form>

        {aggregationPreview && (
          <div className="capability-result">
            <div className="capability-summary">
              <span>{aggregationPreview.retrieval_state}</span>
              <strong>{aggregationPreview.required_cross_checks} source checks</strong>
            </div>
            <div className="policy-tiers">
              <span>{aggregationPreview.source_policy.freshness_required ? "freshness required" : "stable context"}</span>
              <span>{aggregationPreview.source_policy.cross_check_required ? "cross-check" : "single-source ok"}</span>
              <span>{aggregationPreview.source_policy.durable_write_gate}</span>
            </div>
            <div className="retrieval-contract">
              <span>{aggregationPreview.retrieval_contract.readiness}</span>
              <strong>
                {aggregationPreview.retrieval_contract.allowed_source_count} allowlisted /{" "}
                {aggregationPreview.retrieval_contract.quarantine_source_count} quarantined
              </strong>
              {aggregationPreview.retrieval_contract.blocked_reason && (
                <p>{aggregationPreview.retrieval_contract.blocked_reason}</p>
              )}
              <div className="policy-tiers">
                {aggregationPreview.retrieval_contract.gates.map((gate) => (
                  <span key={gate}>{gate}</span>
                ))}
              </div>
            </div>
            <div className="policy-gates">
              {aggregationPreview.source_assessments.map((source) => (
                <div className="policy-gate" key={source.source_type}>
                  <span>{source.source_type}</span>
                  <b>{source.trust_level}</b>
                  <p>{source.admission_state} / {source.freshness_window}</p>
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
                    <strong>{gate.allow_state}</strong>
                  </div>
                  <b>{gate.minimum_cross_checks} checks</b>
                  <small>{gate.quarantine_required ? "quarantine" : "direct context"}</small>
                  <em>{gate.admission_gate}</em>
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
                {isImportingSources ? "Importing" : "Import observations"}
              </button>
            </form>
            <div className="capability-summary">
              <span>configured HTTP source</span>
              <button type="button" onClick={onFetchHttpSource} disabled={isFetchingHttpSource}>
                {isFetchingHttpSource ? "Fetching" : "Fetch read-only JSON"}
              </button>
            </div>
            {httpSourceReceipt && (
              <div className="retrieval-contract">
                <span>{httpSourceReceipt.observation.source_id}</span>
                <strong>
                  HTTP {httpSourceReceipt.status_code} / {httpSourceReceipt.response_bytes} bytes
                </strong>
                <p>{httpSourceReceipt.observation.normalized_claim}</p>
                <small>
                  {Math.round(httpSourceReceipt.confidence.score * 100)}% confidence /{" "}
                  {httpSourceReceipt.confidence.admission_state}
                </small>
                <div className="policy-tiers">
                  {httpSourceReceipt.gates.map((gate) => (
                    <span key={gate}>{gate}</span>
                  ))}
                </div>
              </div>
            )}
            {sourceImportReceipt && (
              <div className="retrieval-contract">
                <span>manual {sourceImportReceipt.format} fallback</span>
                <strong>{sourceImportReceipt.imported_count} imported</strong>
                <p>
                  {Math.round(sourceImportReceipt.confidence.score * 100)}% confidence /{" "}
                  {sourceImportReceipt.confidence.conflict_level} conflict /{" "}
                  {sourceImportReceipt.confidence.admission_state}
                </p>
                <div className="policy-tiers">
                  {sourceImportReceipt.gates.map((gate) => (
                    <span key={gate}>{gate}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="retrieval-contract">
              <span>fixture confidence</span>
              <strong>{Math.round(aggregationPreview.confidence.score * 100)}%</strong>
              <p>
                {aggregationPreview.confidence.conflict_level} conflict /{" "}
                {aggregationPreview.confidence.freshness_state} /{" "}
                {aggregationPreview.confidence.admission_state}
              </p>
              <div className="source-gate-list">
                {aggregationPreview.observations.map((observation) => (
                  <article className="source-gate-item" key={observation.source_id}>
                    <div>
                      <span>{observation.source_id}</span>
                      <strong>{observation.normalized_claim}</strong>
                    </div>
                    <b>{Math.round(observation.field_coverage * 100)}%</b>
                    <small>{observation.freshness}</small>
                    <em>
                      {observation.quarantine_state} / {observation.source_uri}
                    </em>
                  </article>
                ))}
              </div>
            </div>
            <div className="retrieval-contract">
              <span>source history</span>
              <strong>{sourceObservationHistory.length} recent observations</strong>
              <button type="button" onClick={onRefreshSourceHealth} disabled={isLoadingSourceHealth}>
                {isLoadingSourceHealth ? "Refreshing" : "Health report"}
              </button>
              <div className="source-gate-list">
                {sourceObservationHistory.slice(0, 6).map((observation) => (
                  <article className="source-gate-item" key={observation.id}>
                    <div>
                      <span>{observation.source_id}</span>
                      <strong>{observation.query}</strong>
                    </div>
                    <b>{Math.round(observation.confidence_score * 100)}%</b>
                    <small>{observation.conflict_level}</small>
                    <em>{observation.admission_state}</em>
                  </article>
                ))}
              </div>
            </div>
            {sourceHealthReport && (
              <div className="retrieval-contract">
                <span>source health</span>
                <strong>
                  {sourceHealthReport.overall_state} / {sourceHealthReport.source_count} sources
                </strong>
                <p>
                  {sourceHealthReport.observation_count} observations across{" "}
                  {sourceHealthReport.query_count} queries
                </p>
                <div className="policy-tiers">
                  {sourceHealthReport.gates.map((gate) => (
                    <span key={gate}>{gate}</span>
                  ))}
                </div>
                <div className="source-gate-list">
                  {sourceHealthReport.source_health.slice(0, 6).map((source) => (
                    <article className="source-gate-item" key={source.source_id}>
                      <div>
                        <span>{source.source_id}</span>
                        <strong>{source.state}</strong>
                      </div>
                      <b>{Math.round(source.average_confidence * 100)}%</b>
                      <small>{source.conflict_count} conflicts</small>
                      <em>
                        coverage {Math.round(source.average_field_coverage * 100)}% / fallback{" "}
                        {Math.round(source.fallback_ratio * 100)}%
                      </em>
                    </article>
                  ))}
                </div>
                <div className="source-gate-list">
                  {sourceHealthReport.query_cross_checks.slice(0, 4).map((query) => (
                    <article className="source-gate-item" key={query.query}>
                      <div>
                        <span>{query.state}</span>
                        <strong>{query.query}</strong>
                      </div>
                      <b>{query.source_count} sources</b>
                      <small>{query.distinct_claim_count} claims</small>
                      <em>{Math.round(query.average_confidence * 100)}% confidence</em>
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
            <p className="eyebrow">Arsenal</p>
            <h3>Registry preview</h3>
          </div>
          <button className="text-action" type="button" onClick={onRefreshArsenal} disabled={isLoadingArsenal}>
            {isLoadingArsenal ? "Loading" : "Refresh"}
          </button>
        </div>

        {arsenalPreview && (
          <div className="capability-result">
            <div className="capability-summary">
              <span>{arsenalPreview.registry_state}</span>
              <strong>{arsenalPreview.allowed_tools} allowed / {arsenalPreview.blocked_tools} blocked</strong>
            </div>
            <form
              className="capability-form"
              onSubmit={(event) => {
                event.preventDefault();
                previewCustomTool();
              }}
            >
              <input value={customToolDraft.id} onChange={(event) => setCustomToolDraft({ ...customToolDraft, id: event.currentTarget.value })} placeholder="Custom tool ID" />
              <input value={customToolDraft.label} onChange={(event) => setCustomToolDraft({ ...customToolDraft, label: event.currentTarget.value })} placeholder="Tool label" />
              <input value={customToolDraft.command_candidates} onChange={(event) => setCustomToolDraft({ ...customToolDraft, command_candidates: event.currentTarget.value })} placeholder="Command candidates, comma-separated" />
              <button type="submit" disabled={isPreviewingCustomTool}>{isPreviewingCustomTool ? "Checking" : "Check draft"}</button>
              <button type="button" disabled={!customToolPreview || isSavingCustomTool} onClick={saveCustomTool}>
                {isSavingCustomTool ? "Saving" : "Save blocked tool"}
              </button>
            </form>
            {customToolError && <p className="empty-state">{customToolError}</p>}
            {customToolMessage && <p className="empty-state">{customToolMessage}</p>}
            {customToolPreview && (
              <div className="retrieval-contract">
                <span>custom draft / {customToolPreview.allow_state}</span>
                <strong>{customToolPreview.discovery_state}</strong>
                <p>{customToolPreview.label} / {customToolPreview.ingestion_policy}</p>
                {customToolPreview.detected_path && <small>{customToolPreview.detected_path}</small>}
              </div>
            )}
            <div className="policy-tiers">
              {arsenalPreview.gates.map((gate) => (
                <span key={gate}>{gate}</span>
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
                placeholder="Approved Task Run ID"
              />
              <input
                value={mockAdapterInput}
                onChange={(event) => onMockAdapterInputChange(event.target.value)}
                placeholder="Mock adapter input"
              />
              <button type="submit" disabled={isRunningMockAdapter}>
                Dry-run
              </button>
              <button
                type="button"
                disabled={isRunningMockAdapter}
                onClick={() => onRunMockAdapter(true)}
              >
                Execute
              </button>
            </form>
            {mockAdapterReceipt && (
              <div className="retrieval-contract">
                <span>
                  {mockAdapterReceipt.tool_id} / {mockAdapterReceipt.execution_mode}
                </span>
                <strong>{mockAdapterReceipt.state}</strong>
                <p>{mockAdapterReceipt.output_summary}</p>
                {mockAdapterReceipt.artifact && (
                  <small>artifact: {mockAdapterReceipt.artifact.id}</small>
                )}
                <div className="policy-tiers">
                  {mockAdapterReceipt.gates.map((gate) => (
                    <span key={gate}>{gate}</span>
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
                            {tool.registry_source} / {tool.category} / {tool.invocation_mode} /{" "}
                            {tool.discovery_state}
                          </span>
                          <strong>{tool.label}</strong>
                        </div>
                        <b>{tool.allow_state}</b>
                        <small>{tool.risk_level}</small>
                        <div className="tool-capability-list">
                          {tool.capabilities.map((capability) => (
                            <span key={`${tool.id}-${capability}`}>{capability}</span>
                          ))}
                        </div>
                        <em>
                          {tool.ingestion_policy}
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
                            {canAllow ? "Allow" : "Unavailable"}
                          </button>
                          <button
                            type="button"
                            onClick={() => onSetToolAllowState(tool.id, "blocked")}
                            disabled={updatingToolId === tool.id || tool.allow_state === "blocked"}
                          >
                            Block
                          </button>
                          {tool.registry_source === "custom" && (
                            <button
                              type="button"
                              onClick={() => removeCustomTool(tool.id)}
                              disabled={removingCustomToolId === tool.id}
                            >
                              {removingCustomToolId === tool.id ? "Removing" : "Remove"}
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
      </section>
    </section>
  );
}
