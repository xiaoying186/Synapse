import { useMemo, useState } from "react";
import type {
  AgentDryRunReceipt,
  AgentDryRunRequest,
  AgentExecutionReceipt,
  ArsenalPreview,
  TaskRunRecord,
} from "../types";

type AgentHarnessPanelProps = {
  arsenalPreview: ArsenalPreview | null;
  isRunning: boolean;
  isExecuting: boolean;
  onDryRun: (request: AgentDryRunRequest) => void;
  onExecute: (request: AgentDryRunRequest) => void;
  executionReceipt: AgentExecutionReceipt | null;
  receipt: AgentDryRunReceipt | null;
  runs: TaskRunRecord[];
};

export function AgentHarnessPanel({
  arsenalPreview,
  executionReceipt,
  isExecuting,
  isRunning,
  onDryRun,
  onExecute,
  receipt,
  runs,
}: AgentHarnessPanelProps) {
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
    receipt.state === "ready-for-explicit-execution-approval";

  return (
    <section className="panel agent-harness-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Agent Harness</p>
          <h3>Native and Zhishu-constrained modes</h3>
        </div>
        <strong>{receipt?.state ?? "dry-run only"}</strong>
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
              {tool.label} / {tool.discovery_state} / {tool.allow_state}
            </option>
          ))}
        </select>
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value as "native" | "deep")}
        >
          <option value="native">Native mode</option>
          <option value="deep">Deep mode</option>
        </select>
        <select value={runId} onChange={(event) => setRunId(event.target.value)}>
          <option value="">Select Task Run</option>
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {run.task_direction_title} / {run.approval_state}
            </option>
          ))}
        </select>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Agent task input"
        />
        <button type="submit" disabled={isRunning || !runId || !input.trim()}>
          {isRunning ? "Preparing" : "Preview invocation"}
        </button>
        <button
          type="button"
          disabled={isExecuting || !canExecute || !input.trim()}
          onClick={() => onExecute(request())}
        >
          {isExecuting ? "Quarantining output" : "Request guarded Codex run"}
        </button>
      </form>
      {receipt && (
        <div className="agent-harness-receipt">
          <div className="capability-summary">
            <span>
              {receipt.tool_label} / {receipt.mode}
            </span>
            <strong>{receipt.process_started ? "process started" : "no process started"}</strong>
          </div>
          <p>
            detected: {receipt.discovery_state} / allowlist: {receipt.allow_state} / run:{" "}
            {receipt.task_approval_state}
          </p>
          <code>{receipt.argument_preview.join(" ")}</code>
          <div className="policy-tiers">
            {receipt.gates.map((gate) => (
              <span key={gate}>{gate}</span>
            ))}
          </div>
          <div className="agent-context-list">
            {receipt.context_references.map((reference) => (
              <article key={reference.memory_id}>
                <span>{reference.label}</span>
                <strong>{reference.memory_id}</strong>
                <p>{reference.excerpt}</p>
              </article>
            ))}
          </div>
          <small>Output policy: {receipt.output_ingestion_policy}</small>
        </div>
      )}
      {executionReceipt && (
        <div className="task-run-result">
          <span>
            {executionReceipt.state} / guarded exit {executionReceipt.exit_code}
          </span>
          <strong>{executionReceipt.artifact.title}</strong>
          <small>
            artifact: {executionReceipt.artifact.id}
            {executionReceipt.output_truncated ? " / output truncated" : ""}
          </small>
        </div>
      )}
    </section>
  );
}
