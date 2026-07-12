import { useState } from "react";
import { useI18n } from "../i18n";
import type {
  DailyBriefingArchiveReceipt,
  DailyBriefingDeliveryReview,
  DailyBriefingLiveSourceStagingPreflight,
  DailyBriefingLiveSourceReceipt,
  DailyBriefingPreview,
  DailyBriefingScheduledArchiveReview,
  DailyBriefingTemplate,
  TaskRunRecord,
} from "../types";

type DailyBriefingPanelProps = {
  archiveReceipt: DailyBriefingArchiveReceipt | null;
  isArchiving: boolean;
  isReviewingDelivery: boolean;
  isFetchingLiveSource: boolean;
  isPreflightingLiveSources: boolean;
  isPreviewing: boolean;
  isReviewingScheduledArchive: boolean;
  onArchive: (runId: string, template: DailyBriefingTemplate) => void;
  onReviewDelivery: (artifactId: string) => void;
  onFetchLiveSource: (runId: string, template: DailyBriefingTemplate) => void;
  onPreflightLiveSources: (template: DailyBriefingTemplate) => void;
  onPreview: (template: DailyBriefingTemplate) => void;
  onReviewScheduledArchive: () => void;
  liveSourceReceipt: DailyBriefingLiveSourceReceipt | null;
  liveSourcePreflight: DailyBriefingLiveSourceStagingPreflight | null;
  preview: DailyBriefingPreview | null;
  deliveryReview: DailyBriefingDeliveryReview | null;
  scheduledArchiveReview: DailyBriefingScheduledArchiveReview | null;
  runs: TaskRunRecord[];
};

export function DailyBriefingPanel({
  archiveReceipt,
  isArchiving,
  isReviewingDelivery,
  isFetchingLiveSource,
  isPreflightingLiveSources,
  isPreviewing,
  isReviewingScheduledArchive,
  liveSourcePreflight,
  liveSourceReceipt,
  onArchive,
  onReviewDelivery,
  onFetchLiveSource,
  onPreflightLiveSources,
  onPreview,
  onReviewScheduledArchive,
  preview,
  deliveryReview,
  scheduledArchiveReview,
  runs,
}: DailyBriefingPanelProps) {
  const { text } = useI18n();
  const [title, setTitle] = useState("Daily intelligence brief");
  const [query, setQuery] = useState("");
  const [sections, setSections] = useState(
    "Key developments\nRisks and uncertainty\nSuggested follow-ups",
  );
  const [onlineEnabled, setOnlineEnabled] = useState(false);
  const [runId, setRunId] = useState("");
  const approvedRuns = runs.filter(
    (run) =>
      run.lifecycle_state === "approved" &&
      run.approval_state === "approved" &&
      run.execution_state === "approved-not-started",
  );
  const template = (): DailyBriefingTemplate => ({
    title,
    query,
    sections: sections.split("\n").map((value) => value.trim()).filter(Boolean),
    online_enabled: onlineEnabled,
  });

  return (
    <section className="panel daily-briefing-panel" data-testid="daily-briefing-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Domain pilot")}</p>
          <h3>{text("Daily briefing")}</h3>
        </div>
        <strong>{text(preview?.archive_gate ?? "not previewed")}</strong>
      </div>
      <div className="daily-briefing-form">
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={text("Briefing topic or monitoring query")}
        />
        <textarea
          value={sections}
          onChange={(event) => setSections(event.target.value)}
          placeholder={text("One section per line")}
        />
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={onlineEnabled}
            onChange={(event) => setOnlineEnabled(event.target.checked)}
          />
          <span>{text("Request online evidence")}</span>
        </label>
        <button type="button" disabled={isPreviewing || !query.trim()} onClick={() => onPreview(template())}>
          {isPreviewing ? text("Previewing") : text("Preview briefing")}
        </button>
        <button
          type="button"
          data-testid="daily-briefing-live-source-preflight-button"
          disabled={isPreflightingLiveSources || !query.trim()}
          onClick={() => onPreflightLiveSources(template())}
        >
          {isPreflightingLiveSources ? text("Checking") : text("Live source staging preflight")}
        </button>
        <button
          type="button"
          data-testid="daily-briefing-live-source-fetch-button"
          disabled={
            isFetchingLiveSource ||
            !runId ||
            !onlineEnabled ||
            liveSourcePreflight?.state !== "live-source-staging-ready"
          }
          onClick={() => onFetchLiveSource(runId, template())}
        >
          {isFetchingLiveSource ? text("Fetching") : text("Fetch configured live sources")}
        </button>
      </div>
      {liveSourcePreflight && (
        <div
          className="retrieval-contract"
          data-testid="daily-briefing-live-source-preflight-result"
        >
          <span>{text("Live source staging")}</span>
          <strong>{text(liveSourcePreflight.state)}</strong>
          <p>
            {text("network started")}:{" "}
            {text(liveSourcePreflight.external_network_started ? "true" : "false")} /{" "}
            {text("durable Zhishu write")}:{" "}
            {text(liveSourcePreflight.durable_zhishu_write ? "true" : "false")}
          </p>
          <p>
            {text("required cross-checks")}: {liveSourcePreflight.required_cross_checks} /{" "}
            {text("quarantine")}:{" "}
            {text(liveSourcePreflight.source_quarantine_required ? "true" : "false")}
          </p>
          <p>
            {text("configured source URL")}:{" "}
            {text(liveSourcePreflight.configured_source_url_present ? "present" : "missing")} /{" "}
            {text("configured sources")}: {liveSourcePreflight.configured_source_count} /{" "}
            {text("external gate")}: {text(liveSourcePreflight.gate_enabled ? "enabled" : "disabled")}
          </p>
          <div className="policy-tiers">
            {liveSourcePreflight.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
          <div className="source-gate-list" data-testid="daily-briefing-provider-gates">
            {liveSourcePreflight.provider_gates.map((provider) => (
              <article className="source-gate-item" key={provider.provider_id}>
                <div>
                  <span>{provider.provider_id}</span>
                  <strong>{text(provider.allow_state)}</strong>
                </div>
                <b>{text(provider.provider_kind)}</b>
                <small>
                  {text("credential policy")}: {text(provider.credential_policy)} /{" "}
                  {text("network policy")}: {text(provider.network_policy)}
                </small>
                <small>
                  {text("audit policy")}: {text(provider.audit_policy)} /{" "}
                  {text("quarantine")}: {text(provider.quarantine_policy)}
                </small>
                <em>
                  {text("approval")}: {text(provider.required_approval)} /{" "}
                  {text("network started")}: {text(provider.external_network_started ? "true" : "false")}
                </em>
              </article>
            ))}
          </div>
          <small>
            {text("Blocked")}: {liveSourcePreflight.blockers.map((blocker) => text(blocker)).join(", ")}
          </small>
        </div>
      )}
      {liveSourceReceipt && (
        <div className="retrieval-contract" data-testid="daily-briefing-live-source-receipt">
          <span>{text("Live source receipt")}</span>
          <strong>
            {liveSourceReceipt.http_receipts.length} {text("sources")} /{" "}
            {text(liveSourceReceipt.evidence_validation.cross_check_state)}
          </strong>
          <p>
            {text("network started")}:{" "}
            {text(liveSourceReceipt.external_network_started ? "true" : "false")} /{" "}
            {text("durable Zhishu write")}:{" "}
            {text(liveSourceReceipt.durable_zhishu_write ? "true" : "false")} /{" "}
            {text("automatic delivery started")}:{" "}
            {text(liveSourceReceipt.automatic_delivery_started ? "true" : "false")}
          </p>
          <p>
            {text("artifact")}: {liveSourceReceipt.artifact.id} / {text("summary allowed")}: {" "}
            {text(liveSourceReceipt.evidence_validation.summary_allowed ? "true" : "false")}
          </p>
          <small>{text("Snapshot")}: {liveSourceReceipt.snapshot.id}</small>
          <small>{text("Audit event")}: {liveSourceReceipt.audit_event.id}</small>
          <small>{text("Saga")}: {liveSourceReceipt.saga.id} / {text(liveSourceReceipt.saga.state)}</small>
          {liveSourceReceipt.http_receipts.map((receipt) => (
            <small key={receipt.provider_receipt.receipt_id}>
              {text("source")}: {receipt.observation.source_id} / {text("bytes")}: {receipt.response_bytes} /{" "}
              {text("source hash")}: {receipt.provider_receipt.source_sha256.slice(0, 16)}...
            </small>
          ))}
          <div className="policy-tiers">
            {liveSourceReceipt.evidence_validation.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
        </div>
      )}
      {preview && (
        <>
          <div className="retrieval-contract" data-testid="daily-briefing-evidence-contract">
            <span>{text("Evidence contract")}</span>
            <strong>
              {preview.evidence_contract.source_count} {text("sources")} /{" "}
              {preview.evidence_contract.quarantined_source_count} {text("quarantined")}
            </strong>
            <p>
              {text("required cross-checks")}: {preview.evidence_contract.required_cross_checks} /{" "}
              {text("confidence")}: {Math.round(preview.evidence_contract.confidence_score * 100)}%
            </p>
            <p>
              {text("external delivery started")}:{" "}
              {text(preview.evidence_contract.external_delivery_started ? "true" : "false")} /{" "}
              {text("durable Zhishu write")}:{" "}
              {text(preview.evidence_contract.durable_zhishu_write ? "true" : "false")}
            </p>
            <div className="policy-tiers">
              {preview.evidence_contract.gates.map((gate) => (
                <span key={gate}>{text(gate)}</span>
              ))}
            </div>
            <small>
              {text("Denied")}: {preview.evidence_contract.denied_actions.map((action) => text(action)).join(", ")}
            </small>
          </div>
          <div className="retrieval-contract" data-testid="daily-briefing-evidence-validation">
            <span>{text("Evidence validation")}</span>
            <strong>
              {text(preview.evidence_contract.evidence_validation.cross_check_state)} /{" "}
              {text(preview.evidence_contract.evidence_validation.admission_decision)}
            </strong>
            <p>
              {text("summary allowed")}:{" "}
              {text(preview.evidence_contract.evidence_validation.summary_allowed ? "true" : "false")} /{" "}
              {text("durable write allowed")}:{" "}
              {text(preview.evidence_contract.evidence_validation.durable_write_allowed ? "true" : "false")}
            </p>
            <div className="policy-tiers">
              {preview.evidence_contract.evidence_validation.gates.map((gate) => (
                <span key={gate}>{text(gate)}</span>
              ))}
            </div>
            {preview.evidence_contract.evidence_validation.blockers.length > 0 && (
              <small>
                {text("Blocked")}:{" "}
                {preview.evidence_contract.evidence_validation.blockers.map((blocker) => text(blocker)).join(", ")}
              </small>
            )}
          </div>
          <div className="retrieval-contract" data-testid="daily-briefing-provider-admission-path">
            <span>{text("Provider admission path")}</span>
            <strong>
              {text(preview.evidence_contract.provider_admission_preflight.state)} /{" "}
              {text(preview.evidence_contract.provider_review_queue_preview.state)}
            </strong>
            <p>
              {preview.evidence_contract.provider_receipt.provider_id} /{" "}
              {preview.evidence_contract.provider_receipt.source_sha256.slice(0, 16)}
            </p>
            <small>
              {text("task artifact write started")}:{" "}
              {text(
                preview.evidence_contract.provider_admission_preflight.task_artifact_write_started
                  ? "true"
                  : "false",
              )}{" "}
              / {text("durable Zhishu write")}:{" "}
              {text(
                preview.evidence_contract.provider_admission_preflight.durable_zhishu_write_started
                  ? "true"
                  : "false",
              )}
            </small>
            <div className="policy-tiers">
              {preview.evidence_contract.provider_review_queue_preview.gates.map((gate) => (
                <span key={gate}>{text(gate)}</span>
              ))}
            </div>
          </div>
          <pre className="daily-briefing-preview">{preview.rendered_markdown}</pre>
        </>
      )}
      <div className="daily-briefing-archive">
        <button
          type="button"
          data-testid="daily-briefing-scheduled-archive-review-button"
          disabled={isReviewingScheduledArchive}
          onClick={onReviewScheduledArchive}
        >
          {isReviewingScheduledArchive ? text("Reviewing") : text("Review scheduled archives")}
        </button>
        <select value={runId} onChange={(event) => setRunId(event.target.value)}>
          <option value="">{text("Select approved Task Run")}</option>
          {approvedRuns.map((run) => (
            <option key={run.id} value={run.id}>
              {run.task_direction_title} / {run.id}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={isArchiving || !runId || !preview || preview.archive_gate !== "reviewable"}
          onClick={() => onArchive(runId, template())}
        >
          {isArchiving ? text("Archiving") : text("Archive to run")}
        </button>
      </div>
      {scheduledArchiveReview ? (
        <div className="retrieval-contract" data-testid="daily-briefing-scheduled-archive-review">
          <span>{text("Scheduled archive review")}</span>
          <strong>{text(scheduledArchiveReview.state)}</strong>
          <p>
            {text("ready")}: {scheduledArchiveReview.eligible_run_ids.length} / {text("awaiting approval")}: {" "}
            {scheduledArchiveReview.pending_approval_run_ids.length} / {text("blocked")}: {" "}
            {scheduledArchiveReview.blocked_run_ids.length}
          </p>
          <small>
            {text("automatic archive started")}: {" "}
            {text(scheduledArchiveReview.automatic_archive_started ? "true" : "false")} / {text("network started")}: {" "}
            {text(scheduledArchiveReview.external_network_started ? "true" : "false")}
          </small>
          <div className="policy-tiers">
            {scheduledArchiveReview.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
        </div>
      ) : null}
      {archiveReceipt ? (
        <div className="retrieval-contract" data-testid="daily-briefing-archive-receipt">
          <span>{text("Daily briefing archive recorded")}</span>
          <strong>{archiveReceipt.artifact.reference_id}</strong>
          <small>{text("observations")}: {archiveReceipt.observations.length}</small>
          <small>{text("Snapshot")}: {archiveReceipt.snapshot.id}</small>
          <small>{text("Audit event")}: {archiveReceipt.audit_event.id}</small>
          <small>{text("Saga")}: {archiveReceipt.saga.id} / {text(archiveReceipt.saga.state)}</small>
          <button
            type="button"
            data-testid="daily-briefing-delivery-review-button"
            disabled={isReviewingDelivery}
            onClick={() => onReviewDelivery(archiveReceipt.artifact.id)}
          >
            {isReviewingDelivery ? text("Reviewing") : text("Review briefing delivery")}
          </button>
        </div>
      ) : null}
      {deliveryReview ? (
        <div className="retrieval-contract" data-testid="daily-briefing-delivery-review">
          <span>{text("Briefing delivery review")}</span>
          <strong>{text(deliveryReview.state)}</strong>
          <p>{text("channel previews")}: {deliveryReview.notification_previews.length}</p>
          <small>{text("delivery started")}: {text(deliveryReview.delivery_started ? "true" : "false")}</small>
          <div className="policy-tiers">
            {deliveryReview.gates.map((gate) => <span key={gate}>{text(gate)}</span>)}
          </div>
        </div>
      ) : null}
    </section>
  );
}
