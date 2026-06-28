import { useState } from "react";
import type {
  BrowserInspectionPreview,
  BrowserInspectionReceipt,
  BrowserInspectionRequest,
  TaskRunRecord,
} from "../types";

type BrowserAutomationPanelProps = {
  isExecuting: boolean;
  isPreviewing: boolean;
  onExecute: (request: BrowserInspectionRequest) => void;
  onPreview: (request: BrowserInspectionRequest) => void;
  preview: BrowserInspectionPreview | null;
  receipt: BrowserInspectionReceipt | null;
  runs: TaskRunRecord[];
};

export function BrowserAutomationPanel({
  isExecuting,
  isPreviewing,
  onExecute,
  onPreview,
  preview,
  receipt,
  runs,
}: BrowserAutomationPanelProps) {
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
          <p className="eyebrow">Browser automation</p>
          <h3>Read-only inspection</h3>
        </div>
        <strong>{preview?.state ?? "allowlist required"}</strong>
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
          placeholder="Allowlisted http(s) URL"
        />
        <select value={runId} onChange={(event) => setRunId(event.target.value)}>
          <option value="">Select Task Run</option>
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {run.task_direction_title} / {run.approval_state}
            </option>
          ))}
        </select>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={captureScreenshot}
            onChange={(event) => setCaptureScreenshot(event.target.checked)}
          />
          <span>Capture screenshot</span>
        </label>
        <button type="submit" disabled={isPreviewing || !url.trim() || !runId}>
          {isPreviewing ? "Checking" : "Preview inspection"}
        </button>
        <button
          type="button"
          disabled={isExecuting || !canExecute}
          onClick={() => onExecute(request())}
        >
          {isExecuting ? "Inspecting" : "Request read-only inspection"}
        </button>
      </form>
      {preview && (
        <div className="agent-harness-receipt">
          <p>
            host: {preview.host} / browser: {preview.browser_discovery_state},{" "}
            {preview.browser_allow_state} / Python: {preview.python_discovery_state},{" "}
            {preview.python_allow_state} / run: {preview.task_approval_state}
          </p>
          <small>
            allowed hosts: {preview.allowed_hosts.join(", ") || "none configured"}
          </small>
          <div className="policy-tiers">
            {preview.gates.map((gate) => (
              <span key={gate}>{gate}</span>
            ))}
          </div>
        </div>
      )}
      {receipt && (
        <div className="browser-inspection-result">
          <span>
            HTTP {receipt.result.status ?? "n/a"} / {receipt.result.final_url}
          </span>
          <strong>{receipt.result.title || "Untitled page"}</strong>
          <p>{receipt.result.text}</p>
          {receipt.result.screenshot_path && (
            <small>screenshot: {receipt.result.screenshot_path}</small>
          )}
          <small>artifact: {receipt.artifact.id}</small>
        </div>
      )}
    </section>
  );
}
