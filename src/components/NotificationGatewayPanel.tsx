import { useState } from "react";
import { useI18n } from "../i18n";
import type {
  NotificationPreview,
  NotificationDeliveryAttempt,
  NotificationDeliveryReconciliationReceipt,
  NotificationReceipt,
  NotificationRequest,
  TaskRunRecord,
  WebhookProductionPreflight,
  WebhookStagingPreflight,
} from "../types";

type NotificationGatewayPanelProps = {
  attempts: NotificationDeliveryAttempt[];
  isDelivering: boolean;
  isExecutingWebhookProduction: boolean;
  isExecutingWebhookStaging: boolean;
  isPreflightingWebhookProduction: boolean;
  isPreflightingWebhookStaging: boolean;
  isPreviewing: boolean;
  onDeliver: (request: NotificationRequest) => void;
  onExecuteWebhookProduction: (request: NotificationRequest) => void;
  onExecuteWebhookStaging: (request: NotificationRequest) => void;
  onPreview: (request: NotificationRequest) => void;
  onPreflightWebhookProduction: (request: NotificationRequest) => void;
  onPreflightWebhookStaging: (request: NotificationRequest) => void;
  onReconcileAttempt: (attemptId: string, decision: "confirmed-delivered" | "confirmed-not-delivered") => void;
  preview: NotificationPreview | null;
  receipt: NotificationReceipt | null;
  reconciliationReceipt: NotificationDeliveryReconciliationReceipt | null;
  reconcilingAttemptId: string | null;
  runs: TaskRunRecord[];
  webhookProductionPreflight: WebhookProductionPreflight | null;
  webhookStagingPreflight: WebhookStagingPreflight | null;
};

export function NotificationGatewayPanel({
  attempts,
  isDelivering,
  isExecutingWebhookProduction,
  isExecutingWebhookStaging,
  isPreflightingWebhookProduction,
  isPreflightingWebhookStaging,
  isPreviewing,
  onDeliver,
  onExecuteWebhookProduction,
  onExecuteWebhookStaging,
  onPreview,
  onPreflightWebhookProduction,
  onPreflightWebhookStaging,
  onReconcileAttempt,
  preview,
  receipt,
  reconciliationReceipt,
  reconcilingAttemptId,
  runs,
  webhookProductionPreflight,
  webhookStagingPreflight,
}: NotificationGatewayPanelProps) {
  const { text } = useI18n();
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
    preview?.run_id === runId &&
    preview.channel === channel &&
    preview.subject === subject.trim() &&
    preview.body_chars === Array.from(body.trim()).length &&
    (preview.state === "ready-for-explicit-delivery-approval" || preview.state === "adapter-preview-only");
  const canExecuteWebhookStaging =
    canDeliver &&
    webhookStagingPreflight?.channel === channel &&
    webhookStagingPreflight.state === "staging-webhook-ready-for-explicit-send-approval";
  const canExecuteWebhookProduction =
    canDeliver &&
    webhookProductionPreflight?.channel === channel &&
    webhookProductionPreflight.state === "production-webhook-ready-for-final-approval";
  const reconcilableAttempts = attempts.filter((attempt) =>
    ["prepared-before-network", "prepared-audited", "outcome-uncertain"].includes(attempt.state),
  );

  return (
    <section className="panel notification-panel" data-testid="notification-gateway-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Notification gateway")}</p>
          <h3>{text("Email, Feishu, and WeChat")}</h3>
        </div>
        <strong>{text(preview?.state ?? "dry-run first")}</strong>
      </div>
      <form
        className="notification-form"
        onSubmit={(event) => {
          event.preventDefault();
          onPreview(request());
        }}
      >
        <select
          data-testid="notification-channel-select"
          value={channel}
          onChange={(event) => setChannel(event.target.value as typeof channel)}
        >
          <option value="email">{text("Email")}</option>
          <option value="feishu">{text("Feishu")}</option>
          <option value="wechat">{text("WeChat")}</option>
        </select>
        <select
          data-testid="notification-run-select"
          value={runId}
          onChange={(event) => setRunId(event.target.value)}
        >
          <option value="">{text("Select push-enabled Task Run")}</option>
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {run.task_direction_title} / {(run.push_channels ?? []).join(", ") || text("no push")}
            </option>
          ))}
        </select>
        <input
          data-testid="notification-subject-input"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder={text("Notification subject")}
        />
        <textarea
          data-testid="notification-body-input"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={text("Notification body")}
        />
        <button
          type="submit"
          data-testid="notification-preview-button"
          disabled={isPreviewing || !runId || !subject.trim() || !body.trim()}
        >
          {isPreviewing ? text("Checking") : text("Preview channel gate")}
        </button>
        <button
          type="button"
          data-testid="notification-deliver-button"
          disabled={isDelivering || !canDeliver}
          onClick={() => onDeliver(request())}
        >
          {isDelivering
            ? text("Recording delivery")
            : channel === "email"
              ? text("Request guarded email")
              : text("Record mock webhook receipt")}
        </button>
        <button
          type="button"
          data-testid="notification-webhook-staging-preflight-button"
          disabled={isPreflightingWebhookStaging || channel === "email" || !canDeliver}
          onClick={() => onPreflightWebhookStaging(request())}
        >
          {isPreflightingWebhookStaging ? text("Checking staging") : text("Preflight staging webhook")}
        </button>
        <button
          type="button"
          data-testid="notification-webhook-staging-execute-button"
          disabled={isExecutingWebhookStaging || !canExecuteWebhookStaging}
          onClick={() => onExecuteWebhookStaging(request())}
        >
          {isExecutingWebhookStaging ? text("Sending staging webhook") : text("Send loopback staging webhook")}
        </button>
        <button
          type="button"
          data-testid="notification-webhook-production-preflight-button"
          disabled={isPreflightingWebhookProduction || channel === "email" || !canDeliver}
          onClick={() => onPreflightWebhookProduction(request())}
        >
          {isPreflightingWebhookProduction ? text("Checking production") : text("Preflight production webhook")}
        </button>
        <button
          type="button"
          data-testid="notification-webhook-production-execute-button"
          disabled={isExecutingWebhookProduction || !canExecuteWebhookProduction}
          onClick={() => onExecuteWebhookProduction(request())}
        >
          {isExecutingWebhookProduction ? text("Sending production webhook") : text("Send production webhook")}
        </button>
      </form>
      {preview && (
        <div className="agent-harness-receipt" data-testid="notification-preview-result">
          <p>
            {text("endpoint")}: {text(preview.endpoint_configured ? "configured" : "missing")} / {text("credentials")}:{" "}
            {text(preview.credentials_present ? "present" : "missing")} / {text("run push")}:{" "}
            {text(preview.task_push_enabled ? "enabled" : "disabled")}
          </p>
          <small>
            {text("enabled channels")}: {preview.task_push_channels.join(", ") || text("none")} / {text("body")}:{" "}
            {preview.body_chars} {text("characters")}
          </small>
          <div className="policy-tiers">
            {preview.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
          {preview.webhook_staging_policy && (
            <div className="policy-card" data-testid="notification-webhook-staging-policy">
              <strong>
                {text("Webhook staging policy")}: {text(preview.webhook_staging_policy.mode)}
              </strong>
              <small>
                {text("signature")}: {text(preview.webhook_staging_policy.signature_policy)} /{" "}
                {text("retry")}: {text(preview.webhook_staging_policy.retry_policy)}
              </small>
              <small>
                {text("redaction")}: {text(preview.webhook_staging_policy.redaction_policy)} /{" "}
                {text("external gate")}: {preview.webhook_staging_policy.external_delivery_gate}
              </small>
              <small>
                {text("approval required")}: {text(preview.webhook_staging_policy.approval_required ? "yes" : "no")} /{" "}
                {text("network started")}: {text(preview.webhook_staging_policy.network_started ? "yes" : "no")}
              </small>
              <div className="policy-tiers">
                {preview.webhook_staging_policy.error_classes.map((errorClass) => (
                  <span key={errorClass}>{text(errorClass)}</span>
                ))}
              </div>
              <div className="policy-tiers">
                {preview.webhook_staging_policy.denied_actions.map((action) => (
                  <span key={action}>{text(action)}</span>
                ))}
              </div>
            </div>
          )}
          {preview.webhook_staging_envelope && (
            <div className="policy-card" data-testid="notification-webhook-staging-envelope">
              <strong>
                {text("Webhook staging envelope")}: {preview.webhook_staging_envelope.contract}
              </strong>
              <small>
                {text("idempotency key")}: {preview.webhook_staging_envelope.idempotency_key} /{" "}
                {text("admission")}: {text(preview.webhook_staging_envelope.admission_state)}
              </small>
              <small>
                {text("payload hash")}: {preview.webhook_staging_envelope.payload_sha256.slice(0, 16)}... /{" "}
                {text("expires")}: {preview.webhook_staging_envelope.expires_after_secs}s
              </small>
              <small>
                {text("destination")}:{" "}
                {text(preview.webhook_staging_envelope.destination_configured ? "configured" : "missing")} /{" "}
                {text("endpoint redaction")}: {text(preview.webhook_staging_envelope.endpoint_redaction)}
              </small>
              <div className="policy-tiers">
                {preview.webhook_staging_envelope.required_headers.map((header) => (
                  <span key={header}>{text(header)}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {webhookStagingPreflight && (
        <div className="task-run-result" data-testid="notification-webhook-staging-preflight-result">
          <span>
            {text("Webhook staging preflight")}: {text(webhookStagingPreflight.state)} /{" "}
            {text(webhookStagingPreflight.endpoint_scope)}
          </span>
          <small>
            {text("endpoint")}:{" "}
            {text(webhookStagingPreflight.endpoint_allowed_for_staging ? "allowed" : "blocked")} /{" "}
            {text("signature")}:{" "}
            {text(webhookStagingPreflight.signature_material_present ? "present" : "missing")} /{" "}
            {text("external gate")}:{" "}
            {text(webhookStagingPreflight.external_delivery_gate_enabled ? "enabled" : "disabled")} /{" "}
            {text("network started")}: {text(webhookStagingPreflight.network_started ? "yes" : "no")}
          </small>
          <div className="policy-tiers">
            {webhookStagingPreflight.checks.map((check) => (
              <span key={check}>{text(check)}</span>
            ))}
          </div>
          <div className="policy-tiers">
            {webhookStagingPreflight.blocked_reasons.map((reason) => (
              <span key={reason}>{text(reason)}</span>
            ))}
          </div>
        </div>
      )}
      {webhookProductionPreflight && (
        <div className="task-run-result" data-testid="notification-webhook-production-preflight-result">
          <span>
            {text("Webhook production preflight")}: {text(webhookProductionPreflight.state)} /{" "}
            {text(webhookProductionPreflight.endpoint_scope)}
          </span>
          <small>
            {text("endpoint")}:{" "}
            {text(webhookProductionPreflight.endpoint_allowed_for_production ? "allowed" : "blocked")} /{" "}
            {text("signature")}:{" "}
            {text(webhookProductionPreflight.signature_material_present ? "present" : "missing")} /{" "}
            {text("external gate")}:{" "}
            {text(webhookProductionPreflight.external_delivery_gate_enabled ? "enabled" : "disabled")} /{" "}
            {text("audit")}: {text(webhookProductionPreflight.audit_required ? "required" : "not required")} /{" "}
            {text("network started")}: {text(webhookProductionPreflight.network_started ? "yes" : "no")}
          </small>
          <small>
            {text("approval required")}:{" "}
            {text(webhookProductionPreflight.approval_required ? "yes" : "no")} /{" "}
            {text("redaction required")}:{" "}
            {text(webhookProductionPreflight.redaction_required ? "yes" : "no")} /{" "}
            {text("delivery started")}: {text(webhookProductionPreflight.delivery_started ? "yes" : "no")}
          </small>
          <div className="policy-tiers">
            {webhookProductionPreflight.checks.map((check) => (
              <span key={check}>{text(check)}</span>
            ))}
          </div>
          <div className="policy-tiers">
            {webhookProductionPreflight.blocked_reasons.map((reason) => (
              <span key={reason}>{text(reason)}</span>
            ))}
          </div>
        </div>
      )}
      {receipt && (
        <div className="task-run-result" data-testid="notification-receipt-result">
          <span>
            {text(receipt.state)} /{" "}
            {text(
              receipt.preview.channel === "email"
                ? "guarded SMTP"
                : receipt.state === "production-webhook-receipt-recorded"
                  ? "production webhook"
                  : receipt.state === "staging-webhook-receipt-recorded"
                    ? "loopback staging only"
                    : "mock webhook only",
            )}{" "}
            {receipt.server_response}
          </span>
          <strong>{receipt.artifact.title}</strong>
          <small>{text("Task Run remains open")}; {text("artifact")}: {receipt.artifact.id}</small>
          {receipt.delivery_attempt && (
            <small data-testid="notification-delivery-attempt-receipt">
              {text("Delivery attempt")}: {receipt.delivery_attempt.id} / {text(receipt.delivery_attempt.state)}
            </small>
          )}
          {receipt.audit_event && <small>{text("Audit event")}: {receipt.audit_event.id}</small>}
        </div>
      )}
      <div className="agent-harness-receipt" data-testid="notification-reconciliation-center">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{text("Taiheng delivery reconciliation")}</p>
            <strong>{reconcilableAttempts.length}</strong>
          </div>
        </div>
        {reconcilableAttempts.length === 0 ? (
          <small>{text("No notification delivery attempts require reconciliation.")}</small>
        ) : (
          reconcilableAttempts.map((attempt) => (
            <div className="task-run-result" data-testid="notification-reconciliation-item" key={attempt.id}>
              <span>{text(attempt.channel)} / {text(attempt.state)}</span>
              <strong>{attempt.id}</strong>
              <small>{text(attempt.detail)}</small>
              <div className="tool-actions">
                <button
                  type="button"
                  disabled={reconcilingAttemptId === attempt.id}
                  onClick={() => onReconcileAttempt(attempt.id, "confirmed-delivered")}
                >
                  {text("Confirm delivered")}
                </button>
                <button
                  type="button"
                  disabled={reconcilingAttemptId === attempt.id}
                  onClick={() => onReconcileAttempt(attempt.id, "confirmed-not-delivered")}
                >
                  {text("Confirm not delivered")}
                </button>
              </div>
            </div>
          ))
        )}
        {reconciliationReceipt && (
          <div className="task-run-result" data-testid="notification-reconciliation-receipt">
            <span>{text(reconciliationReceipt.decision)}</span>
            <strong>{text("Retry allowed")}: {text(reconciliationReceipt.retry_allowed ? "yes" : "no")}</strong>
            <small>{text("Snapshot")}: {reconciliationReceipt.snapshot.id}</small>
            <small>{text("Audit event")}: {reconciliationReceipt.audit_event.id}</small>
            <small>{text("Saga")}: {text(reconciliationReceipt.saga.state)}</small>
          </div>
        )}
      </div>
    </section>
  );
}
