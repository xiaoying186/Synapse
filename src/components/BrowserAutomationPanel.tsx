import { useState } from "react";
import { useI18n } from "../i18n";
import type {
  BrowserInspectionPreview,
  BrowserInspectionReceipt,
  BrowserInspectionRequest,
  BrowserWriteActionStagingPreflight,
  TaskRunRecord,
} from "../types";

type BrowserAutomationPanelProps = {
  isExecuting: boolean;
  isPreflightingWriteStaging: boolean;
  isPreviewing: boolean;
  onExecute: (request: BrowserInspectionRequest) => void;
  onPreflightWriteStaging: (request: BrowserInspectionRequest) => void;
  onPreview: (request: BrowserInspectionRequest) => void;
  preview: BrowserInspectionPreview | null;
  receipt: BrowserInspectionReceipt | null;
  runs: TaskRunRecord[];
  writeStagingPreflight: BrowserWriteActionStagingPreflight | null;
};

export function BrowserAutomationPanel({
  isExecuting,
  isPreflightingWriteStaging,
  isPreviewing,
  onExecute,
  onPreflightWriteStaging,
  onPreview,
  preview,
  receipt,
  runs,
  writeStagingPreflight,
}: BrowserAutomationPanelProps) {
  const { text } = useI18n();
  const [url, setUrl] = useState("");
  const [runId, setRunId] = useState("");
  const [captureScreenshot, setCaptureScreenshot] = useState(true);
  const request = (): BrowserInspectionRequest => ({
    run_id: runId,
    url,
    capture_screenshot: captureScreenshot,
  });
  const canExecute =
    preview?.run_id === runId &&
    preview.url === url &&
    preview.capture_screenshot === captureScreenshot &&
    preview.state === "ready-for-explicit-execution-approval";

  return (
    <section className="panel browser-automation-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Browser automation")}</p>
          <h3>{text("Read-only inspection")}</h3>
        </div>
        <strong>{text(preview?.state ?? "allowlist required")}</strong>
      </div>
      <form
        className="browser-inspection-form"
        onSubmit={(event) => {
          event.preventDefault();
          onPreview(request());
        }}
      >
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={text("Allowlisted http(s) URL")}
        />
        <select value={runId} onChange={(event) => setRunId(event.target.value)}>
          <option value="">{text("Select Task Run")}</option>
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {run.task_direction_title} / {text(run.approval_state)}
            </option>
          ))}
        </select>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={captureScreenshot}
            onChange={(event) => setCaptureScreenshot(event.target.checked)}
          />
          <span>{text("Capture screenshot")}</span>
        </label>
        <button type="submit" disabled={isPreviewing || !url.trim() || !runId}>
          {isPreviewing ? text("Checking") : text("Preview inspection")}
        </button>
        <button
          type="button"
          disabled={isExecuting || !canExecute}
          onClick={() => onExecute(request())}
        >
          {isExecuting ? text("Inspecting") : text("Request read-only inspection")}
        </button>
        <button
          type="button"
          data-testid="browser-write-staging-preflight-button"
          disabled={isPreflightingWriteStaging || !url.trim() || !runId}
          onClick={() => onPreflightWriteStaging(request())}
        >
          {isPreflightingWriteStaging ? text("Checking") : text("Write action staging preflight")}
        </button>
      </form>
      {writeStagingPreflight && (
        <div
          className="retrieval-contract"
          data-testid="browser-write-staging-preflight-result"
        >
          <span>{text("Browser write staging")}</span>
          <strong>{text(writeStagingPreflight.state)}</strong>
          <p>
            {text("process started")}:{" "}
            {text(writeStagingPreflight.process_started ? "true" : "false")} /{" "}
            {text("web mutation started")}:{" "}
            {text(writeStagingPreflight.web_mutation_started ? "true" : "false")}
          </p>
          <p>
            {text("task content sent")}:{" "}
            {text(writeStagingPreflight.task_content_sent ? "true" : "false")} /{" "}
            {text("approval required")}:{" "}
            {text(writeStagingPreflight.approval_required ? "true" : "false")}
          </p>
          <div className="policy-tiers">
            {writeStagingPreflight.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
          <small>
            {text("Blocked")}: {writeStagingPreflight.blockers.map((blocker) => text(blocker)).join(", ")}
          </small>
        </div>
      )}
      {preview && (
        <div className="agent-harness-receipt">
          <p>
            {text("host")}: {preview.host} / {text("browser")}: {text(preview.browser_discovery_state)},{" "}
            {text(preview.browser_allow_state)} / Python: {text(preview.python_discovery_state)},{" "}
            {text(preview.python_allow_state)} / {text("run")}: {text(preview.task_approval_state)}
          </p>
          <small>
            {text("allowed hosts")}: {preview.allowed_hosts.join(", ") || text("none configured")}
          </small>
          <div className="policy-tiers">
            {preview.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
          <div className="retrieval-contract" data-testid="browser-action-policy">
            <span>{text("Browser action policy")}</span>
            <strong>{text(preview.action_policy.mode)}</strong>
            <p>
              {text("write actions allowed")}: {preview.action_policy.write_actions_allowed.length} /{" "}
              {text("approval required for write")}:{" "}
              {text(preview.action_policy.approval_required_for_write ? "true" : "false")}
            </p>
            <small>
              {text("anti-injection")}: {text(preview.action_policy.anti_injection_policy)}
            </small>
            <div className="policy-tiers">
              {preview.action_policy.write_actions_denied.map((action) => (
                <span key={action}>{text(action)}</span>
              ))}
            </div>
            <small>
              {text("Denied")}: {preview.action_policy.denied_reasons.map((reason) => text(reason)).join(", ")}
            </small>
          </div>
        </div>
      )}
      {receipt && (
        <div className="browser-inspection-result">
          <span>
            HTTP {receipt.result.status ?? "n/a"} / {receipt.result.final_url}
          </span>
          <strong>{receipt.result.title || text("Untitled page")}</strong>
          <p>{receipt.result.text}</p>
          {receipt.result.screenshot_path && (
            <small>{text("screenshot")}: {receipt.result.screenshot_path}</small>
          )}
          <small>{text("artifact")}: {receipt.artifact.id}</small>
        </div>
      )}
    </section>
  );
}
