import { useState } from "react";
import { useI18n } from "../i18n";
import type {
  CleanupDryRunPreview,
  CleanupMutationPreflight,
  ComputerDiagnosticReport,
  TaskRunRecord,
} from "../types";

type ComputerDiagnosticsPanelProps = {
  cleanupMutationPreflight: CleanupMutationPreflight | null;
  isArchiving: boolean;
  isPreflightingCleanupMutation: boolean;
  isPreviewingCleanup: boolean;
  isPreviewing: boolean;
  onArchive: (runId: string) => void;
  onPreflightCleanupMutation: () => void;
  onPreviewCleanup: () => void;
  onPreview: () => void;
  cleanupPreview: CleanupDryRunPreview | null;
  report: ComputerDiagnosticReport | null;
  runs: TaskRunRecord[];
};

export function ComputerDiagnosticsPanel({
  cleanupMutationPreflight,
  isArchiving,
  isPreflightingCleanupMutation,
  isPreviewingCleanup,
  isPreviewing,
  onArchive,
  onPreflightCleanupMutation,
  onPreviewCleanup,
  onPreview,
  cleanupPreview,
  report,
  runs,
}: ComputerDiagnosticsPanelProps) {
  const { text } = useI18n();
  const [runId, setRunId] = useState("");
  const approvedRuns = runs.filter(
    (run) =>
      run.lifecycle_state === "approved" &&
      run.approval_state === "approved" &&
      run.execution_state === "approved-not-started",
  );

  return (
    <section className="panel computer-diagnostics-panel" data-testid="computer-diagnostics-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Computer assistant")}</p>
          <h3>{text("Read-only diagnostics")}</h3>
        </div>
        <div className="panel-actions">
          <button type="button" onClick={onPreview} disabled={isPreviewing}>
            {isPreviewing ? text("Inspecting") : text("Run inspection")}
          </button>
          <button
            type="button"
            data-testid="computer-cleanup-preview-button"
            onClick={onPreviewCleanup}
            disabled={isPreviewingCleanup}
          >
            {isPreviewingCleanup ? text("Previewing cleanup") : text("Preview safe cleanup")}
          </button>
          <button
            type="button"
            data-testid="computer-cleanup-mutation-preflight-button"
            onClick={onPreflightCleanupMutation}
            disabled={isPreflightingCleanupMutation}
          >
            {isPreflightingCleanupMutation
              ? text("Checking cleanup execution")
              : text("Check real cleanup gates")}
          </button>
        </div>
      </div>
      {cleanupMutationPreflight && (
        <div className="retrieval-contract" data-testid="computer-cleanup-mutation-preflight-result">
          <span>{text(cleanupMutationPreflight.state)}</span>
          <strong>
            {text("Real cleanup is blocked by default")} / {cleanupMutationPreflight.candidate_count}{" "}
            {text("candidates")}
          </strong>
          <p>
            {text("restore point required")}:{" "}
            {text(cleanupMutationPreflight.restore_point_required ? "yes" : "no")} /{" "}
            {text("restore point available")}:{" "}
            {text(cleanupMutationPreflight.restore_point_available ? "yes" : "no")}
          </p>
          <p>
            {text("approval required")}:{" "}
            {text(cleanupMutationPreflight.explicit_approval_required ? "yes" : "no")} /{" "}
            {text("audit required")}: {text(cleanupMutationPreflight.audit_required ? "yes" : "no")} /{" "}
            {text("rollback plan required")}:{" "}
            {text(cleanupMutationPreflight.rollback_plan_required ? "yes" : "no")}
          </p>
          <div className="policy-tiers">
            {cleanupMutationPreflight.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
          <small>
            {text("Blockers")}: {cleanupMutationPreflight.blockers.map((blocker) => text(blocker)).join(", ")}
          </small>
          <small>
            {text("Denied")}: {cleanupMutationPreflight.denied_actions.map((action) => text(action)).join(", ")}
          </small>
        </div>
      )}
      {cleanupPreview && (
        <div className="retrieval-contract" data-testid="computer-cleanup-preview-result">
          <span>{text(cleanupPreview.state)}</span>
          <strong>
            {cleanupPreview.candidate_count} {text("candidates")} / {text("deleted")}:{" "}
            {cleanupPreview.deleted_bytes}
          </strong>
          <p>
            {text("restore point required")}: {text(cleanupPreview.requires_restore_point ? "yes" : "no")} /{" "}
            {text("approval required")}: {text(cleanupPreview.requires_explicit_approval ? "yes" : "no")}
          </p>
          <div className="policy-tiers">
            {cleanupPreview.safety_boundary.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
          <div className="diagnostic-check-list">
            {cleanupPreview.candidates.map((candidate) => (
              <article className="diagnostic-check" key={candidate.id}>
                <div>
                  <span>{text(candidate.label)}</span>
                  <strong>{candidate.path_preview}</strong>
                  <small>{text(candidate.action_policy)} / {text(candidate.confidence)}</small>
                </div>
                <b>{text(candidate.location_kind)}</b>
              </article>
            ))}
          </div>
          <small>
            {text("Denied")}: {cleanupPreview.denied_actions.map((action) => text(action)).join(", ")}
          </small>
        </div>
      )}
      {report && (
        <>
          <strong>{text(report.overall_state)}</strong>
          <div className="retrieval-contract">
            <span>{text(report.system_profile.snapshot_kind)}</span>
            <strong>
              {report.system_profile.os} / {report.system_profile.architecture}
            </strong>
            <p>
              {text(report.system_profile.context_policy)} / {text(report.system_profile.persistence_policy)}
            </p>
            <div className="policy-tiers">
              {report.system_profile.safety_boundary.map((gate) => (
                <span key={gate}>{text(gate)}</span>
              ))}
            </div>
            <small>
              {text("Denied")}: {report.system_profile.denied_fields.join(", ")}
            </small>
          </div>
          <div className="diagnostic-check-list">
            {report.checks.map((check) => (
              <article className="diagnostic-check" key={check.id}>
                <div>
                  <span>{text(check.label)}</span>
                  <strong>{text(check.evidence)}</strong>
                  <small>{text(check.recommendation)}</small>
                </div>
                <b>{text(check.state)}</b>
              </article>
            ))}
          </div>
          <div className="daily-briefing-archive">
            <select
              value={runId}
              onChange={(event) => setRunId(event.target.value)}
              disabled={isArchiving}
            >
              <option value="">{text("Archive with approved Task Run")}</option>
              {approvedRuns.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.task_direction_title} / {run.id}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={isArchiving || !runId}
              onClick={() => onArchive(runId)}
            >
              {isArchiving ? text("Archiving") : text("Archive report")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
