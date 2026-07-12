import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import type {
  AgentAdapterSmokeReport,
  AgentDryRunReceipt,
  AgentDryRunRequest,
  AgentExecutionReceipt,
  ArsenalPreview,
  RealAgentExecutionPreflight,
  TaskRunRecord,
} from "../types";

type AgentHarnessPanelProps = {
  arsenalPreview: ArsenalPreview | null;
  isRunning: boolean;
  isExecuting: boolean;
  isPreflightingRealAgent: boolean;
  isSmokingAdapters: boolean;
  onDryRun: (request: AgentDryRunRequest) => void;
  onExecute: (request: AgentDryRunRequest) => void;
  onPreflightRealAgent: (request: AgentDryRunRequest) => void;
  onSmokeAdapters: () => void;
  executionReceipt: AgentExecutionReceipt | null;
  realAgentPreflight: RealAgentExecutionPreflight | null;
  receipt: AgentDryRunReceipt | null;
  smokeReport: AgentAdapterSmokeReport | null;
  runs: TaskRunRecord[];
};

export function AgentHarnessPanel({
  arsenalPreview,
  executionReceipt,
  isExecuting,
  isPreflightingRealAgent,
  isSmokingAdapters,
  isRunning,
  onDryRun,
  onExecute,
  onPreflightRealAgent,
  onSmokeAdapters,
  realAgentPreflight,
  receipt,
  smokeReport,
  runs,
}: AgentHarnessPanelProps) {
  const { text } = useI18n();
  const agents = useMemo(
    () => (arsenalPreview?.tools ?? []).filter((tool) => tool.category === "agent"),
    [arsenalPreview],
  );
  const [toolId, setToolId] = useState("agent-codex");
  const [runId, setRunId] = useState("");
  const [mode, setMode] = useState<"native" | "deep">("native");
  const [input, setInput] = useState("");
  const request = (): AgentDryRunRequest => ({
    tool_id: toolId,
    run_id: runId,
    mode,
    input,
  });
  const canExecute =
    toolId === "agent-codex" &&
    receipt?.tool_id === toolId &&
    receipt.run_id === runId &&
    receipt.mode === mode &&
    receipt.state === "ready-for-explicit-execution-approval" &&
    realAgentPreflight?.execution_enabled === true;

  return (
    <section className="panel agent-harness-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Agent Harness")}</p>
          <h3>{text("Native and Zhishu-constrained modes")}</h3>
        </div>
        <div className="panel-actions">
          <button type="button" onClick={onSmokeAdapters} disabled={isSmokingAdapters}>
            {isSmokingAdapters ? text("Smoking adapters") : text("Smoke adapters")}
          </button>
          <strong>{text(receipt?.state ?? smokeReport?.state ?? "dry-run only")}</strong>
        </div>
      </div>
      <form
        className="agent-harness-form"
        onSubmit={(event) => {
          event.preventDefault();
          onDryRun(request());
        }}
      >
        <select value={toolId} onChange={(event) => setToolId(event.target.value)}>
          {agents.map((tool) => (
            <option key={tool.id} value={tool.id}>
              {text(tool.label)} / {text(tool.discovery_state)} / {text(tool.allow_state)}
            </option>
          ))}
        </select>
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value as "native" | "deep")}
        >
          <option value="native">{text("Native mode")}</option>
          <option value="deep">{text("Deep mode")}</option>
        </select>
        <select value={runId} onChange={(event) => setRunId(event.target.value)}>
          <option value="">{text("Select Task Run")}</option>
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {run.task_direction_title} / {text(run.approval_state)}
            </option>
          ))}
        </select>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={text("Agent task input")}
        />
        <button type="submit" disabled={isRunning || !runId || !input.trim()}>
          {isRunning ? text("Preparing") : text("Preview invocation")}
        </button>
        <button
          type="button"
          disabled={isPreflightingRealAgent || !runId || !input.trim()}
          onClick={() => onPreflightRealAgent(request())}
        >
          {isPreflightingRealAgent
            ? text("Checking real Agent gate")
            : text("Preflight real Agent gate")}
        </button>
        <button
          type="button"
          disabled={isExecuting || !canExecute || !input.trim()}
          onClick={() => onExecute(request())}
        >
          {isExecuting ? text("Quarantining output") : text("Request guarded Codex run")}
        </button>
      </form>
      {receipt && (
        <div className="agent-harness-receipt">
          <div className="capability-summary">
            <span>
              {text(receipt.tool_label)} / {text(receipt.mode)}
            </span>
            <strong>{text(receipt.process_started ? "process started" : "no process started")}</strong>
          </div>
          <p>
            {text("detected")}: {text(receipt.discovery_state)} / {text("allowlist")}: {text(receipt.allow_state)} / {text("run")}:{" "}
            {text(receipt.task_approval_state)}
          </p>
          <div className="source-gate-list">
            <article className="source-gate-item">
              <div>
                <span>{text("Repository trust")}</span>
                <strong>{text(receipt.repository_trust.level)}</strong>
              </div>
              <b>{text(receipt.repository_trust.state)}</b>
              <em>
                {receipt.repository_trust.remote_scope}
                {receipt.repository_trust.remote_host
                  ? ` / ${receipt.repository_trust.remote_host}`
                  : ""}
              </em>
              <small>{text(receipt.repository_trust.detail)}</small>
            </article>
            <article className="source-gate-item">
              <div>
                <span>{text("Command safety")}</span>
                <strong>{text(receipt.command_safety.risk_level)}</strong>
              </div>
              <b>{text(receipt.command_safety.state)}</b>
              <small>{text(receipt.command_safety.detail)}</small>
              {receipt.command_safety.denied_markers.length > 0 && (
                <em>{text("Denied")}: {receipt.command_safety.denied_markers.join(", ")}</em>
              )}
              {receipt.command_safety.review_markers.length > 0 && (
                <em>{text("Review")}: {receipt.command_safety.review_markers.join(", ")}</em>
              )}
            </article>
          </div>
          <code>{receipt.argument_preview.join(" ")}</code>
          <div className="policy-tiers">
            {receipt.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
          <div className="agent-context-list">
            {receipt.context_references.map((reference) => (
              <article key={reference.memory_id}>
                <span>{text(reference.label)}</span>
                <strong>{reference.memory_id}</strong>
                <p>{reference.excerpt}</p>
              </article>
            ))}
          </div>
          <small>{text("Output policy")}: {text(receipt.output_ingestion_policy)}</small>
        </div>
      )}
      {smokeReport && (
        <div className="agent-harness-receipt">
          <div className="capability-summary">
            <span>
              {smokeReport.detected_count}/{smokeReport.agent_count} {text("adapters detected")}
            </span>
            <strong>{text(smokeReport.process_started ? "process started" : "no process started")}</strong>
          </div>
          <div className="source-gate-list">
            {smokeReport.adapters.map((adapter) => (
              <article className="source-gate-item" key={adapter.tool_id}>
                <div>
                  <span>{text(adapter.tool_label)}</span>
                  <strong>{text(adapter.discovery_state)} / {text(adapter.allow_state)}</strong>
                </div>
                <b>{text(adapter.execution_enabled ? "enabled" : "disabled")}</b>
                <small>{adapter.command_contract.join(" ")}</small>
              </article>
            ))}
          </div>
          <div className="policy-tiers">
            {smokeReport.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
        </div>
      )}
      {realAgentPreflight && (
        <div className="agent-harness-receipt">
          <div className="capability-summary">
            <span>{text(realAgentPreflight.state)}</span>
            <strong>
              {text(realAgentPreflight.process_started ? "process started" : "no process started")}
            </strong>
          </div>
          <p>
            {text("task content sent")}:{" "}
            {text(realAgentPreflight.task_content_sent ? "yes" : "no")} /{" "}
            {text("execution enabled")}:{" "}
            {text(realAgentPreflight.execution_enabled ? "enabled" : "disabled")}
          </p>
          <div className="source-gate-list">
            {realAgentPreflight.blockers.map((blocker) => (
              <article className="source-gate-item" key={blocker.id}>
                <div>
                  <span>{text(blocker.id)}</span>
                  <strong>{text(blocker.state)}</strong>
                </div>
                <small>{text(blocker.detail)}</small>
              </article>
            ))}
          </div>
          <div className="policy-tiers">
            {realAgentPreflight.required_approvals.map((approval) => (
              <span key={approval}>{text(approval)}</span>
            ))}
          </div>
          <div className="policy-tiers">
            {realAgentPreflight.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
        </div>
      )}
      {executionReceipt && (
        <div className="task-run-result">
          <span>
            {text(executionReceipt.state)} / {text("guarded exit")} {executionReceipt.exit_code}
          </span>
          <strong>{executionReceipt.artifact.title}</strong>
          <small>
            {text("artifact")}: {executionReceipt.artifact.id}
            {executionReceipt.output_truncated ? ` / ${text("output truncated")}` : ""}
          </small>
        </div>
      )}
    </section>
  );
}
