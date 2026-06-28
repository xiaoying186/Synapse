import { useState } from "react";
import type {
  NotificationPreview,
  NotificationReceipt,
  NotificationRequest,
  TaskRunRecord,
} from "../types";

type NotificationGatewayPanelProps = {
  isDelivering: boolean;
  isPreviewing: boolean;
  onDeliver: (request: NotificationRequest) => void;
  onPreview: (request: NotificationRequest) => void;
  preview: NotificationPreview | null;
  receipt: NotificationReceipt | null;
  runs: TaskRunRecord[];
};

export function NotificationGatewayPanel({
  isDelivering,
  isPreviewing,
  onDeliver,
  onPreview,
  preview,
  receipt,
  runs,
}: NotificationGatewayPanelProps) {
  const [runId, setRunId] = useState("");
  const [channel, setChannel] = useState<"email" | "feishu" | "wechat">("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const request = (): NotificationRequest => ({
    run_id: runId,
    channel,
    subject,
    body,
  });
  const canDeliver =
    channel === "email" &&
    preview?.run_id === runId &&
    preview.channel === channel &&
    preview.subject === subject.trim() &&
    preview.body_chars === Array.from(body.trim()).length &&
    preview.state === "ready-for-explicit-delivery-approval";

  return (
    <section className="panel notification-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Notification gateway</p>
          <h3>Email, Feishu, and WeChat</h3>
        </div>
        <strong>{preview?.state ?? "dry-run first"}</strong>
      </div>
      <form
        className="notification-form"
        onSubmit={(event) => {
          event.preventDefault();
          onPreview(request());
        }}
      >
        <select value={channel} onChange={(event) => setChannel(event.target.value as typeof channel)}>
          <option value="email">Email</option>
          <option value="feishu">Feishu</option>
          <option value="wechat">WeChat</option>
        </select>
        <select value={runId} onChange={(event) => setRunId(event.target.value)}>
          <option value="">Select push-enabled Task Run</option>
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {run.task_direction_title} / {(run.push_channels ?? []).join(", ") || "no push"}
            </option>
          ))}
        </select>
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Notification subject"
        />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Notification body"
        />
        <button
          type="submit"
          disabled={isPreviewing || !runId || !subject.trim() || !body.trim()}
        >
          {isPreviewing ? "Checking" : "Preview channel gate"}
        </button>
        <button
          type="button"
          disabled={isDelivering || !canDeliver}
          onClick={() => onDeliver(request())}
        >
          {isDelivering ? "Recording delivery" : "Request guarded email"}
        </button>
      </form>
      {preview && (
        <div className="agent-harness-receipt">
          <p>
            endpoint: {preview.endpoint_configured ? "configured" : "missing"} / credentials:{" "}
            {preview.credentials_present ? "present" : "missing"} / run push:{" "}
            {preview.task_push_enabled ? "enabled" : "disabled"}
          </p>
          <small>
            enabled channels: {preview.task_push_channels.join(", ") || "none"} / body:{" "}
            {preview.body_chars} characters
          </small>
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
            {receipt.state} / guarded SMTP {receipt.server_response}
          </span>
          <strong>{receipt.artifact.title}</strong>
          <small>Task Run remains open; artifact: {receipt.artifact.id}</small>
        </div>
      )}
    </section>
  );
}
