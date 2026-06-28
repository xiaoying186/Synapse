import { useState } from "react";
import type { ComputerDiagnosticReport, TaskRunRecord } from "../types";

type ComputerDiagnosticsPanelProps = {
  isArchiving: boolean;
  isPreviewing: boolean;
  onArchive: (runId: string) => void;
  onPreview: () => void;
  report: ComputerDiagnosticReport | null;
  runs: TaskRunRecord[];
};

export function ComputerDiagnosticsPanel({
  isArchiving,
  isPreviewing,
  onArchive,
  onPreview,
  report,
  runs,
}: ComputerDiagnosticsPanelProps) {
  const [runId, setRunId] = useState("");
  const approvedRuns = runs.filter(
    (run) =>
      run.lifecycle_state === "approved" &&
      run.approval_state === "approved" &&
      run.execution_state === "approved-not-started",
  );

  return (
    <section className="panel computer-diagnostics-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Computer assistant</p>
          <h3>Read-only diagnostics</h3>
        </div>
        <button type="button" onClick={onPreview} disabled={isPreviewing}>
          {isPreviewing ? "Inspecting" : "Run inspection"}
        </button>
      </div>
      {report && (
        <>
          <strong>{report.overall_state}</strong>
          <div className="retrieval-contract">
            <span>{report.system_profile.snapshot_kind}</span>
            <strong>
              {report.system_profile.os} / {report.system_profile.architecture}
            </strong>
            <p>
              {report.system_profile.context_policy} / {report.system_profile.persistence_policy}
            </p>
            <div className="policy-tiers">
              {report.system_profile.safety_boundary.map((gate) => (
                <span key={gate}>{gate}</span>
              ))}
            </div>
            <small>
              Denied: {report.system_profile.denied_fields.join(", ")}
            </small>
          </div>
          <div className="diagnostic-check-list">
            {report.checks.map((check) => (
              <article className="diagnostic-check" key={check.id}>
                <div>
                  <span>{check.label}</span>
                  <strong>{check.evidence}</strong>
                  <small>{check.recommendation}</small>
                </div>
                <b>{check.state}</b>
              </article>
            ))}
          </div>
          <div className="daily-briefing-archive">
            <select
              value={runId}
              onChange={(event) => setRunId(event.target.value)}
              disabled={isArchiving}
            >
              <option value="">Archive with approved Task Run</option>
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
              {isArchiving ? "Archiving" : "Archive report"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
