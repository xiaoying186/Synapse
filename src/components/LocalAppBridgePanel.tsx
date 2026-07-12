import { useState } from "react";
import { useI18n } from "../i18n";
import type {
  LocalAppDescriptor,
  LocalAppAllowStateReceipt,
  LocalAppLaunchPreflight,
  LocalAppLaunchPreview,
  LocalAppLaunchReceipt,
  LocalAppLaunchRequest,
  TaskRunRecord,
} from "../types";

type LocalAppBridgePanelProps = {
  apps: LocalAppDescriptor[];
  allowStateReceipt: LocalAppAllowStateReceipt | null;
  isExecuting: boolean;
  isPreflighting: boolean;
  isPreviewing: boolean;
  onExecute: (request: LocalAppLaunchRequest) => void;
  onPreflight: (request: LocalAppLaunchRequest) => void;
  onPreview: (request: LocalAppLaunchRequest) => void;
  onSetAllowState: (appId: string, allowState: "allowed" | "blocked") => void;
  preflight: LocalAppLaunchPreflight | null;
  preview: LocalAppLaunchPreview | null;
  receipt: LocalAppLaunchReceipt | null;
  runs: TaskRunRecord[];
  updatingAppId: string | null;
};

export function LocalAppBridgePanel({
  apps,
  allowStateReceipt,
  isExecuting,
  isPreflighting,
  isPreviewing,
  onExecute,
  onPreflight,
  onPreview,
  onSetAllowState,
  preflight,
  preview,
  receipt,
  runs,
  updatingAppId,
}: LocalAppBridgePanelProps) {
  const { text } = useI18n();
  const [appId, setAppId] = useState("windows-notepad");
  const [runId, setRunId] = useState("");
  const request = (): LocalAppLaunchRequest => ({ app_id: appId, run_id: runId });
  const canExecute =
    preview?.app.id === appId &&
    preview.run_id === runId &&
    preview.state === "ready-for-explicit-launch-approval";

  return (
    <section className="panel local-app-panel" data-testid="local-app-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Local app bridge")}</p>
          <h3>{text("Approved launch-only applications")}</h3>
        </div>
        <strong>{text(preview?.state ?? "blocked by default")}</strong>
      </div>
      <div className="local-app-list">
        {apps.map((app) => (
          <article className="local-app-item" key={app.id}>
            <div>
              <span>
                {text(app.risk_level)} / {text(app.session_policy)}
              </span>
              <strong>{app.label}</strong>
              <small>{app.executable}</small>
              <div className="tool-capability-list">
                {app.capabilities.map((capability) => (
                  <span key={`${app.id}-${capability}`}>{text(capability)}</span>
                ))}
              </div>
            </div>
            <b>{text(app.allow_state)}</b>
            <div className="tool-actions">
              <button
                type="button"
                data-testid={`local-app-allow-${app.id}`}
                disabled={updatingAppId === app.id || app.allow_state === "allowed"}
                onClick={() => onSetAllowState(app.id, "allowed")}
              >
                {text("Allow")}
              </button>
              <button
                type="button"
                disabled={updatingAppId === app.id || app.allow_state === "blocked"}
                onClick={() => onSetAllowState(app.id, "blocked")}
              >
                {text("Block")}
              </button>
            </div>
          </article>
        ))}
      </div>
      {allowStateReceipt && (
        <div className="agent-harness-receipt" data-testid="local-app-allow-state-receipt">
          <strong>{text("Local app permission review recorded")}</strong>
          <span>{allowStateReceipt.changed_app.label}: {text(allowStateReceipt.changed_app.allow_state)}</span>
          <small>{text("Snapshot")}: {allowStateReceipt.snapshot.id}</small>
          <small>{text("Audit event")}: {allowStateReceipt.audit_event.id}</small>
          <small>{text("Saga")}: {text(allowStateReceipt.saga.state)}</small>
        </div>
      )}
      <form
        className="local-app-launch-form"
        onSubmit={(event) => {
          event.preventDefault();
          onPreview(request());
        }}
      >
        <select
          data-testid="local-app-select"
          value={appId}
          onChange={(event) => setAppId(event.target.value)}
        >
          {apps.map((app) => (
            <option key={app.id} value={app.id}>
              {app.label} / {app.allow_state}
            </option>
          ))}
        </select>
        <select
          data-testid="local-app-run-select"
          value={runId}
          onChange={(event) => setRunId(event.target.value)}
        >
          <option value="">{text("Select Task Run")}</option>
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {run.task_direction_title} / {text(run.approval_state)}
            </option>
          ))}
        </select>
        <button type="submit" disabled={isPreviewing || !runId}>
          {isPreviewing ? text("Checking") : text("Preview launch gate")}
        </button>
        <button
          type="button"
          data-testid="local-app-launch-preflight-button"
          disabled={isPreflighting || !runId}
          onClick={() => onPreflight(request())}
        >
          {isPreflighting ? text("Checking launch preflight") : text("Check launch preflight")}
        </button>
        <button
          type="button"
          data-testid="local-app-launch-button"
          disabled={isExecuting || !canExecute}
          onClick={() => onExecute(request())}
        >
          {isExecuting ? text("Requesting launch") : text("Request guarded launch")}
        </button>
      </form>
      {preflight && (
        <div className="agent-harness-receipt" data-testid="local-app-launch-preflight-result">
          <span>{text(preflight.state)}</span>
          <strong>
            {text("launch state")}: {text(preflight.launch_state)}
          </strong>
          <p>
            {text("process started")}: {text(preflight.process_started ? "true" : "false")} /{" "}
            {text("user arguments allowed")}:{" "}
            {text(preflight.user_arguments_allowed ? "true" : "false")} /{" "}
            {text("session blind")}: {text(preflight.session_blind ? "true" : "false")}
          </p>
          <p>
            {text("credentials read")}: {text(preflight.credentials_read ? "true" : "false")} /{" "}
            {text("window content read")}: {text(preflight.window_content_read ? "true" : "false")}
          </p>
          <div className="policy-tiers">
            {preflight.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
          <small>
            {text("Blockers")}: {preflight.blockers.map((blocker) => text(blocker)).join(", ")}
          </small>
          <small>
            {text("Denied")}: {preflight.denied_actions.map((action) => text(action)).join(", ")}
          </small>
        </div>
      )}
      {preview && (
        <div className="agent-harness-receipt">
          <p>
            {text("bridge")}: {text(preview.bridge_discovery_state)} / {text(preview.bridge_allow_state)}; {text("app")}:{" "}
            {text(preview.app.allow_state)}; {text("run")}: {text(preview.task_approval_state)}
          </p>
          <code>{preview.argument_preview.join(" ")}</code>
          <div className="policy-tiers">
            {preview.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
        </div>
      )}
      {receipt && (
        <div className="task-run-result" data-testid="local-app-launch-receipt">
          <span>
            {text(receipt.state)} / {text("process")} {receipt.process_id}
          </span>
          <strong>{receipt.artifact.title}</strong>
          <small>{text("Task Run remains open")}; {text("artifact")}: {receipt.artifact.id}</small>
          <small>{text("Audit event")}: {receipt.audit_event.id}</small>
        </div>
      )}
    </section>
  );
}
