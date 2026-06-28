import { useState } from "react";
import type {
  LocalAppDescriptor,
  LocalAppLaunchPreview,
  LocalAppLaunchReceipt,
  LocalAppLaunchRequest,
  TaskRunRecord,
} from "../types";

type LocalAppBridgePanelProps = {
  apps: LocalAppDescriptor[];
  isExecuting: boolean;
  isPreviewing: boolean;
  onExecute: (request: LocalAppLaunchRequest) => void;
  onPreview: (request: LocalAppLaunchRequest) => void;
  onSetAllowState: (appId: string, allowState: "allowed" | "blocked") => void;
  preview: LocalAppLaunchPreview | null;
  receipt: LocalAppLaunchReceipt | null;
  runs: TaskRunRecord[];
  updatingAppId: string | null;
};

export function LocalAppBridgePanel({
  apps,
  isExecuting,
  isPreviewing,
  onExecute,
  onPreview,
  onSetAllowState,
  preview,
  receipt,
  runs,
  updatingAppId,
}: LocalAppBridgePanelProps) {
  const [appId, setAppId] = useState("windows-notepad");
  const [runId, setRunId] = useState("");
  const request = (): LocalAppLaunchRequest => ({ app_id: appId, run_id: runId });
  const canExecute =
    preview?.app.id === appId &&
    preview.run_id === runId &&
    preview.state === "ready-for-explicit-launch-approval";

  return (
    <section className="panel local-app-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Local app bridge</p>
          <h3>Approved launch-only applications</h3>
        </div>
        <strong>{preview?.state ?? "blocked by default"}</strong>
      </div>
      <div className="local-app-list">
        {apps.map((app) => (
          <article className="local-app-item" key={app.id}>
            <div>
              <span>
                {app.risk_level} / {app.session_policy}
              </span>
              <strong>{app.label}</strong>
              <small>{app.executable}</small>
              <div className="tool-capability-list">
                {app.capabilities.map((capability) => (
                  <span key={`${app.id}-${capability}`}>{capability}</span>
                ))}
              </div>
            </div>
            <b>{app.allow_state}</b>
            <div className="tool-actions">
              <button
                type="button"
                disabled={updatingAppId === app.id || app.allow_state === "allowed"}
                onClick={() => onSetAllowState(app.id, "allowed")}
              >
                Allow
              </button>
              <button
                type="button"
                disabled={updatingAppId === app.id || app.allow_state === "blocked"}
                onClick={() => onSetAllowState(app.id, "blocked")}
              >
                Block
              </button>
            </div>
          </article>
        ))}
      </div>
      <form
        className="local-app-launch-form"
        onSubmit={(event) => {
          event.preventDefault();
          onPreview(request());
        }}
      >
        <select value={appId} onChange={(event) => setAppId(event.target.value)}>
          {apps.map((app) => (
            <option key={app.id} value={app.id}>
              {app.label} / {app.allow_state}
            </option>
          ))}
        </select>
        <select value={runId} onChange={(event) => setRunId(event.target.value)}>
          <option value="">Select Task Run</option>
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {run.task_direction_title} / {run.approval_state}
            </option>
          ))}
        </select>
        <button type="submit" disabled={isPreviewing || !runId}>
          {isPreviewing ? "Checking" : "Preview launch gate"}
        </button>
        <button
          type="button"
          disabled={isExecuting || !canExecute}
          onClick={() => onExecute(request())}
        >
          {isExecuting ? "Requesting launch" : "Request guarded launch"}
        </button>
      </form>
      {preview && (
        <div className="agent-harness-receipt">
          <p>
            bridge: {preview.bridge_discovery_state} / {preview.bridge_allow_state}; app:{" "}
            {preview.app.allow_state}; run: {preview.task_approval_state}
          </p>
          <code>{preview.argument_preview.join(" ")}</code>
          <div className="policy-tiers">
            {preview.gates.map((gate) => (
              <span key={gate}>{gate}</span>
            ))}
          </div>
        </div>
      )}
      {receipt && (
        <div className="task-run-result">
          <span>
            {receipt.state} / process {receipt.process_id}
          </span>
          <strong>{receipt.artifact.title}</strong>
          <small>Task Run remains open; artifact: {receipt.artifact.id}</small>
        </div>
      )}
    </section>
  );
}
