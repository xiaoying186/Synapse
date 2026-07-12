import { useState } from "react";
import type { SourceEnablementPreflight, SourceEnablementReviewReceipt, SourceHealthCheckPreflight, SourceHealthCheckReceipt, SourceRegistryPreview } from "../types";
import { useI18n } from "../i18n";

type SourceRegistryPanelProps = {
  enablementPreflight: SourceEnablementPreflight | null;
  isPreflightingEnablement: boolean;
  isReviewingEnablement: boolean;
  isRefreshing: boolean;
  isCheckingHealth: boolean;
  healthPreflight: SourceHealthCheckPreflight | null;
  healthReceipt: SourceHealthCheckReceipt | null;
  onPreflightHealth: (sourceId: string) => void;
  onExecuteHealth: (sourceId: string) => void;
  onPreflightEnablement: (sourceId: string) => void;
  onReviewEnablement: (sourceId: string, enabled: boolean) => void;
  onRefresh: () => void;
  preview: SourceRegistryPreview | null;
  reviewReceipt: SourceEnablementReviewReceipt | null;
};

export function SourceRegistryPanel({
  enablementPreflight,
  isPreflightingEnablement,
  isReviewingEnablement,
  isRefreshing,
  isCheckingHealth,
  healthPreflight,
  healthReceipt,
  onPreflightHealth,
  onExecuteHealth,
  onPreflightEnablement,
  onReviewEnablement,
  onRefresh,
  preview,
  reviewReceipt,
}: SourceRegistryPanelProps) {
  const { text } = useI18n();
  const [pendingReview, setPendingReview] = useState<{ sourceId: string; enabled: boolean } | null>(null);

  return (
    <section className="panel source-registry-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Baigong / Taiheng")}</p>
          <h3>{text("Data Source Registry")}</h3>
        </div>
        <button type="button" onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? text("Refreshing") : text("Refresh")}
        </button>
      </div>

      {preview ? (
        <>
          <div className="retrieval-contract">
            <span>{text(preview.state)}</span>
            <strong>{text(preview.registry_scope)}</strong>
            <div className="policy-tiers">
              {preview.gates.map((gate) => (
                <span key={gate}>{text(gate)}</span>
              ))}
            </div>
            <small>{text("Denied")}: {preview.denied_actions.join(", ")}</small>
          </div>

          <div className="source-gate-list">
            {preview.entries.map((entry) => (
              <article className="source-gate-item" key={entry.source_id}>
                <div>
                  <span>{text(entry.status)}</span>
                  <strong>{entry.name}</strong>
                </div>
                <b>{entry.owner_module}</b>
                <small>
                  {text(entry.type)} / {text(entry.scope)} / {text(entry.storage_policy)}
                </small>
                <small>
                  {text("adapter")}: {text(entry.adapter_kind)} / {text("observation")}: {text(entry.observation_policy)}
                </small>
                <em>
                  {text("enabled")}: {text(entry.enabled ? "true" : "false")}; {text("auth")}:{" "}
                  {text(entry.auth_required ? "required" : "none")}; {text("health")}:{" "}
                  {text(entry.health_check_policy)}; {text("freshness")}: {text(entry.freshness_policy)}
                </em>
                <small data-testid="source-health-status">
                  {text("last health state")}: {text(entry.last_health_state)} / {text("last health check")}:{" "}
                  {entry.last_health_check_at_ms ?? text("not checked")}
                </small>
                <small>
                  {text("verification")}: {text(entry.verification_policy)} / {text("quarantine")}:{" "}
                  {text(entry.quarantine_policy)}
                </small>
                <button
                  type="button"
                  data-testid="source-enablement-preflight-button"
                  onClick={() => onPreflightEnablement(entry.source_id)}
                  disabled={isPreflightingEnablement}
                >
                  {isPreflightingEnablement ? text("Checking source enablement") : text("Check source enablement gates")}
                </button>
                <button
                  type="button"
                  data-testid="source-health-preflight-button"
                  disabled={isCheckingHealth}
                  onClick={() => onPreflightHealth(entry.source_id)}
                >
                  {isCheckingHealth ? text("Checking source health") : text("Check health gates")}
                </button>
                <button
                  type="button"
                  data-testid="source-health-execute-button"
                  disabled={isCheckingHealth || !healthPreflight?.ready || healthPreflight.source_id !== entry.source_id}
                  onClick={() => onExecuteHealth(entry.source_id)}
                >
                  {text("Run approved health check")}
                </button>
                <button
                  type="button"
                  data-testid="source-enablement-review-button"
                  disabled={isReviewingEnablement}
                  onClick={() => setPendingReview({ sourceId: entry.source_id, enabled: !entry.enabled })}
                >
                  {isReviewingEnablement ? text("Reviewing") : text(entry.enabled ? "Disable" : "Approve and enable")}
                </button>
              </article>
            ))}
          </div>

          {pendingReview ? (
            <div className="retrieval-contract" data-testid="source-enablement-review-confirmation" role="dialog">
              <strong>{text("Confirm source enablement review")}</strong>
              <small>{pendingReview.sourceId}</small>
              <div className="panel-actions">
                <button type="button" onClick={() => setPendingReview(null)}>{text("Cancel")}</button>
                <button
                  type="button"
                  data-testid="source-enablement-review-confirm-button"
                  onClick={() => {
                    onReviewEnablement(pendingReview.sourceId, pendingReview.enabled);
                    setPendingReview(null);
                  }}
                >
                  {text(pendingReview.enabled ? "Approve and enable" : "Disable")}
                </button>
              </div>
            </div>
          ) : null}

          {enablementPreflight ? (
            <div className="retrieval-contract" data-testid="source-enablement-preflight-result">
              <span>{text("Source enablement preflight")}</span>
              <strong>{text(enablementPreflight.state)}</strong>
              <small>
                {enablementPreflight.source_id} / {enablementPreflight.owner_module} /{" "}
                {text(enablementPreflight.current_status)}
              </small>
              <em>
                {text("network started")}: {text(enablementPreflight.network_started ? "true" : "false")};{" "}
                {text("credentials read")}: {text(enablementPreflight.credential_read_started ? "true" : "false")};{" "}
                {text("fetch started")}: {text(enablementPreflight.fetch_started ? "true" : "false")};{" "}
                {text("storage write started")}: {text(enablementPreflight.storage_write_started ? "true" : "false")}
              </em>
              <div className="policy-tiers">
                {enablementPreflight.gates.map((gate) => (
                  <span key={gate}>{text(gate)}</span>
                ))}
              </div>
              <small>{text("Blockers")}: {enablementPreflight.blockers.map((item) => text(item)).join(", ")}</small>
              <small>{text("Denied")}: {enablementPreflight.denied_actions.map((item) => text(item)).join(", ")}</small>
            </div>
          ) : null}
          {reviewReceipt ? (
            <div className="retrieval-contract" data-testid="source-enablement-review-receipt">
              <span>{text("Source enablement review recorded")}</span>
              <strong>{text(reviewReceipt.approval.review_state)}</strong>
              <small>{text("Snapshot")}: {reviewReceipt.snapshot.id}</small>
              <small>{text("Audit event")}: {reviewReceipt.audit_event.id}</small>
              <small>{text("Saga")}: {reviewReceipt.saga.id} / {text(reviewReceipt.saga.state)}</small>
            </div>
          ) : null}
          {healthPreflight ? (
            <div className="retrieval-contract" data-testid="source-health-preflight-result">
              <span>{text("Source health preflight")}</span>
              <strong>{text(healthPreflight.state)}</strong>
              <small>{healthPreflight.source_id}</small>
              <em>
                {text("enabled")}: {text(healthPreflight.enabled ? "true" : "false")}; {text("configured URL")}: {text(healthPreflight.configured_url_present ? "true" : "false")}; {text("network started")}: {text(healthPreflight.network_started ? "true" : "false")}
              </em>
              <small>{text("Blockers")}: {healthPreflight.blockers.map(text).join(", ") || text("none")}</small>
            </div>
          ) : null}
          {healthReceipt ? (
            <div className="retrieval-contract" data-testid="source-health-receipt">
              <span>{text("Source health check recorded")}</span>
              <strong>{text(healthReceipt.state)}</strong>
              <small>HTTP {healthReceipt.status_code} / {healthReceipt.response_bytes} bytes</small>
              <small>{text("Quarantined observation")}: {healthReceipt.observation.id}</small>
              <small>{text("Snapshot")}: {healthReceipt.snapshot.id}</small>
              <small>{text("Audit event")}: {healthReceipt.audit_event.id}</small>
              <small>{text("Saga")}: {healthReceipt.saga.id} / {text(healthReceipt.saga.state)}</small>
            </div>
          ) : null}
        </>
      ) : (
        <p className="empty-state">{text("Data source registry preview has not been loaded yet.")}</p>
      )}
    </section>
  );
}
