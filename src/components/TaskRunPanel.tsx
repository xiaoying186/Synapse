import { displayFrequency } from "../format";
import type { TaskArtifactRecord, TaskRunRecord } from "../types";

type TaskRunPanelProps = {
  artifacts: TaskArtifactRecord[];
  executingRunId: string | null;
  isTicking: boolean;
  onArchive: (runId: string) => void;
  onCancel: (runId: string) => void;
  onExecute: (runId: string) => void;
  onPromoteArtifact: (artifactId: string) => void;
  onSchedulerTick: () => void;
  onReview: (runId: string, approved: boolean) => void;
  promotingArtifactId: string | null;
  promotedArtifactIds: string[];
  records: TaskRunRecord[];
  reviewingRunId: string | null;
  updatingRunId: string | null;
};

export function TaskRunPanel({
  artifacts,
  executingRunId,
  isTicking,
  onArchive,
  onCancel,
  onExecute,
  onPromoteArtifact,
  onReview,
  onSchedulerTick,
  promotingArtifactId,
  promotedArtifactIds,
  records,
  reviewingRunId,
  updatingRunId,
}: TaskRunPanelProps) {
  function displayKind(record: TaskRunRecord) {
    return record.trigger_kind === "candidate-deepen" ? "candidate deepen" : record.trigger_kind;
  }

  function executeLabel(record: TaskRunRecord) {
    if (executingRunId === record.id) {
      return record.trigger_kind === "candidate-deepen" ? "Deepening" : "Executing";
    }

    return record.trigger_kind === "candidate-deepen" ? "Execute deepen" : "Execute local";
  }

  return (
    <section className="panel task-run-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Task runs</p>
          <h3>Approval queue</h3>
        </div>
        <button className="text-action" type="button" onClick={onSchedulerTick} disabled={isTicking}>
          {isTicking ? "Scanning" : "Scheduler tick"}
        </button>
      </div>
      <div className="task-run-list">
        {records.length === 0 && <span className="empty-state">No task run requests yet.</span>}
        {records.map((record) => (
          <article className="task-run-item" key={record.id}>
            {(() => {
              const runArtifacts = artifacts.filter((artifact) => artifact.run_id === record.id);
              return runArtifacts.length > 0 ? (
                <div className="task-run-result">
                  <span>{runArtifacts.length} indexed artifact{runArtifacts.length === 1 ? "" : "s"}</span>
                  <div className="artifact-action-list">
                    {runArtifacts.slice(0, 3).map((artifact) => (
                      <button
                        type="button"
                        key={artifact.id}
                        onClick={() => onPromoteArtifact(artifact.id)}
                        disabled={
                          promotingArtifactId === artifact.id || promotedArtifactIds.includes(artifact.id)
                        }
                      >
                        {promotingArtifactId === artifact.id
                          ? "Promoting"
                          : promotedArtifactIds.includes(artifact.id)
                            ? "Promoted"
                          : `Promote ${artifact.reference_id}`}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}
            <div>
              <span>{displayKind(record)}</span>
              <strong>{record.task_direction_title}</strong>
              <p>{record.detail}</p>
            </div>
            <b>{record.lifecycle_state ?? record.execution_state}</b>
            <b>{record.approval_state}</b>
            <small>{record.execution_state}</small>
            <em>
              {displayFrequency(record.schedule_frequency)} / {record.output_template} /{" "}
              {record.online_enabled ? "online" : "local"} /{" "}
              {record.push_enabled
                ? `push: ${(record.push_channels ?? []).join(", ") || "configured"}`
                : "no push"}
            </em>
            {record.source_candidate_id && <small>source candidate: {record.source_candidate_id}</small>}
            {record.idempotency_key && <small>run key: {record.idempotency_key}</small>}
            {(record.generated_candidate_ids.length > 0 || record.completed_at_ms) && (
              <div className="task-run-result">
                <span>
                  {record.generated_candidate_ids.length} generated
                  {record.completed_at_ms ? ` / completed ${new Date(record.completed_at_ms).toLocaleString()}` : ""}
                </span>
                {record.generated_candidate_ids.length > 0 && (
                  <small>{record.generated_candidate_ids.slice(0, 3).join(", ")}</small>
                )}
              </div>
            )}
            {record.started_at_ms && !record.completed_at_ms && !record.failed_at_ms && (
              <small>started {new Date(record.started_at_ms).toLocaleString()}</small>
            )}
            {record.failed_at_ms && (
              <div className="task-run-result">
                <span>failed {new Date(record.failed_at_ms).toLocaleString()}</span>
                {record.error_summary && <small>{record.error_summary}</small>}
              </div>
            )}
            {record.approval_state === "waiting-approval" && (
              <div className="task-run-actions">
                <button
                  type="button"
                  onClick={() => onReview(record.id, true)}
                  disabled={reviewingRunId === record.id}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => onReview(record.id, false)}
                  disabled={reviewingRunId === record.id}
                >
                  Reject
                </button>
              </div>
            )}
            {record.approval_state === "approved" &&
              record.execution_state === "approved-not-started" &&
              !record.online_enabled && (
                <div className="task-run-actions">
                  <button
                    type="button"
                    onClick={() => onExecute(record.id)}
                    disabled={executingRunId === record.id}
                  >
                    {executeLabel(record)}
                  </button>
                </div>
              )}
            {["awaiting-approval", "approved", "failed"].includes(
              record.lifecycle_state ?? "",
            ) && (
              <div className="task-run-actions">
                <button
                  type="button"
                  onClick={() => onCancel(record.id)}
                  disabled={updatingRunId === record.id}
                >
                  Cancel
                </button>
              </div>
            )}
            {["blocked", "succeeded", "failed", "cancelled"].includes(
              record.lifecycle_state ?? "",
            ) && (
              <div className="task-run-actions">
                <button
                  type="button"
                  onClick={() => onArchive(record.id)}
                  disabled={updatingRunId === record.id}
                >
                  Archive
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
