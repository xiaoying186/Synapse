import { displayFrequency } from "../format";
import { useI18n } from "../i18n";
import type {
  ProviderArtifactAdmissionReviewReceipt,
  ProviderArtifactZhishuAdmissionPreflight,
  ProviderArtifactZhishuCandidateReceipt,
  TaskArtifactRecord,
  TaskRunRecord,
} from "../types";

type TaskRunPanelProps = {
  artifacts: TaskArtifactRecord[];
  creatingProviderArtifactZhishuCandidateId: string | null;
  executingRunId: string | null;
  isTicking: boolean;
  onArchive: (runId: string) => void;
  onCancel: (runId: string) => void;
  onCreateProviderArtifactZhishuCandidate: (artifactId: string) => void;
  onExecute: (runId: string) => void;
  onPreflightProviderArtifactZhishuAdmission: (artifactId: string) => void;
  onPromoteArtifact: (artifactId: string) => void;
  onReviewProviderArtifactZhishuAdmission: (artifactId: string, decision: string) => void;
  onSchedulerTick: () => void;
  onReview: (runId: string, approved: boolean) => void;
  preflightingProviderArtifactZhishuId: string | null;
  promotingArtifactId: string | null;
  promotedArtifactIds: string[];
  providerArtifactAdmissionReviewReceipt: ProviderArtifactAdmissionReviewReceipt | null;
  providerArtifactZhishuAdmissionPreflight: ProviderArtifactZhishuAdmissionPreflight | null;
  providerArtifactZhishuCandidateReceipt: ProviderArtifactZhishuCandidateReceipt | null;
  records: TaskRunRecord[];
  reviewingProviderArtifactZhishuId: string | null;
  reviewingRunId: string | null;
  updatingRunId: string | null;
};

export function TaskRunPanel({
  artifacts,
  creatingProviderArtifactZhishuCandidateId,
  executingRunId,
  isTicking,
  onArchive,
  onCancel,
  onCreateProviderArtifactZhishuCandidate,
  onExecute,
  onPreflightProviderArtifactZhishuAdmission,
  onPromoteArtifact,
  onReviewProviderArtifactZhishuAdmission,
  onReview,
  onSchedulerTick,
  preflightingProviderArtifactZhishuId,
  promotingArtifactId,
  promotedArtifactIds,
  providerArtifactAdmissionReviewReceipt,
  providerArtifactZhishuAdmissionPreflight,
  providerArtifactZhishuCandidateReceipt,
  records,
  reviewingProviderArtifactZhishuId,
  reviewingRunId,
  updatingRunId,
}: TaskRunPanelProps) {
  const { text } = useI18n();

  function displayKind(record: TaskRunRecord) {
    return record.trigger_kind === "candidate-deepen" ? "candidate deepen" : record.trigger_kind;
  }

  function executeLabel(record: TaskRunRecord) {
    if (executingRunId === record.id) {
      return record.trigger_kind === "candidate-deepen" ? "Deepening" : "Executing";
    }

    return record.trigger_kind === "candidate-deepen" ? "Execute deepen" : "Execute local";
  }

  function isProviderGovernedArtifact(artifact: TaskArtifactRecord) {
    return (
      artifact.artifact_type === "provider-receipt-evidence" ||
      artifact.metadata.provider_artifact_admission_required === true
    );
  }

  return (
    <section className="panel task-run-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Task runs")}</p>
          <h3>{text("Approval queue")}</h3>
        </div>
        <button
          className="text-action"
          type="button"
          data-testid="scheduler-tick-button"
          onClick={onSchedulerTick}
          disabled={isTicking}
        >
          {isTicking ? text("Scanning") : text("Scheduler tick")}
        </button>
      </div>
      <div className="task-run-list">
        {records.length === 0 && <span className="empty-state">{text("No task run requests yet.")}</span>}
        {records.map((record) => (
          <article className="task-run-item" data-testid="task-run-item" key={record.id}>
            {(() => {
              const runArtifacts = artifacts.filter((artifact) => artifact.run_id === record.id);
              return runArtifacts.length > 0 ? (
                <div className="task-run-result">
                  <span>{runArtifacts.length} {text(runArtifacts.length === 1 ? "indexed artifact" : "indexed artifacts")}</span>
                  <div className="artifact-action-list">
                    {runArtifacts.slice(0, 3).map((artifact) => {
                      const providerGoverned = isProviderGovernedArtifact(artifact);
                      const preflightVisible =
                        providerArtifactZhishuAdmissionPreflight?.artifact_id === artifact.id;
                      const reviewVisible =
                        providerArtifactAdmissionReviewReceipt?.review.artifact_id === artifact.id;
                      const candidateVisible =
                        providerArtifactZhishuCandidateReceipt?.artifact.id === artifact.id;

                      return providerGoverned ? (
                        <div
                          className="artifact-review-card"
                          data-testid="provider-governed-task-artifact"
                          key={artifact.id}
                        >
                          <small>
                            {text("Provider-governed evidence")}: {artifact.reference_id}
                          </small>
                          <div className="artifact-action-row">
                            <button
                              type="button"
                              data-testid="task-artifact-provider-zhishu-preflight-button"
                              onClick={() => onPreflightProviderArtifactZhishuAdmission(artifact.id)}
                              disabled={preflightingProviderArtifactZhishuId === artifact.id}
                            >
                              {preflightingProviderArtifactZhishuId === artifact.id
                                ? text("Preflighting")
                                : text("Provider Zhishu preflight")}
                            </button>
                            <button
                              type="button"
                              data-testid="task-artifact-provider-zhishu-review-button"
                              onClick={() => onReviewProviderArtifactZhishuAdmission(artifact.id, "approved")}
                              disabled={reviewingProviderArtifactZhishuId === artifact.id}
                            >
                              {reviewingProviderArtifactZhishuId === artifact.id
                                ? text("Reviewing")
                                : text("Approve provider review")}
                            </button>
                            <button
                              type="button"
                              data-testid="task-artifact-provider-zhishu-candidate-button"
                              onClick={() => onCreateProviderArtifactZhishuCandidate(artifact.id)}
                              disabled={creatingProviderArtifactZhishuCandidateId === artifact.id}
                            >
                              {creatingProviderArtifactZhishuCandidateId === artifact.id
                                ? text("Creating")
                                : text("Create Zhishu candidate")}
                            </button>
                          </div>
                          {(preflightVisible || reviewVisible || candidateVisible) && (
                            <div
                              className="artifact-review-result"
                              data-testid="task-artifact-provider-review-result"
                            >
                              {preflightVisible && (
                                <span>{text(providerArtifactZhishuAdmissionPreflight.state)}</span>
                              )}
                              {reviewVisible && (
                                <span>{text(providerArtifactAdmissionReviewReceipt.review.review_state)}</span>
                              )}
                              {candidateVisible && (
                                <span>{text(providerArtifactZhishuCandidateReceipt.state)}</span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          data-testid="promote-task-artifact-button"
                          key={artifact.id}
                          onClick={() => onPromoteArtifact(artifact.id)}
                          disabled={
                            promotingArtifactId === artifact.id || promotedArtifactIds.includes(artifact.id)
                          }
                        >
                          {promotingArtifactId === artifact.id
                            ? text("Promoting")
                            : promotedArtifactIds.includes(artifact.id)
                              ? text("Promoted")
                            : `${text("Promote")} ${artifact.reference_id}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null;
            })()}
            <div>
              <span>{text(displayKind(record))}</span>
              <strong>{record.task_direction_title}</strong>
              <p>{record.detail}</p>
            </div>
            <b>{text(record.lifecycle_state ?? record.execution_state)}</b>
            <b>{text(record.approval_state)}</b>
            <small>{text(record.execution_state)}</small>
            <em>
              {text(displayFrequency(record.schedule_frequency))} / {text(record.output_template)} /{" "}
              {text(record.online_enabled ? "online" : "local")} /{" "}
              {record.push_enabled
                ? `${text("push")}: ${(record.push_channels ?? []).join(", ") || text("configured")}`
                : text("no push")}
            </em>
            {record.source_candidate_id && <small>{text("source candidate")}: {record.source_candidate_id}</small>}
            {record.idempotency_key && <small>{text("run key")}: {record.idempotency_key}</small>}
            {(record.generated_candidate_ids.length > 0 || record.completed_at_ms) && (
              <div className="task-run-result">
                <span>
                  {record.generated_candidate_ids.length} {text("generated")}
                  {record.completed_at_ms ? ` / ${text("completed")} ${new Date(record.completed_at_ms).toLocaleString()}` : ""}
                </span>
                {record.generated_candidate_ids.length > 0 && (
                  <small>{record.generated_candidate_ids.slice(0, 3).join(", ")}</small>
                )}
              </div>
            )}
            {record.started_at_ms && !record.completed_at_ms && !record.failed_at_ms && (
              <small>{text("started")} {new Date(record.started_at_ms).toLocaleString()}</small>
            )}
            {record.failed_at_ms && (
              <div className="task-run-result">
                <span>{text("failed")} {new Date(record.failed_at_ms).toLocaleString()}</span>
                {record.error_summary && <small>{record.error_summary}</small>}
              </div>
            )}
            {record.approval_state === "waiting-approval" && (
              <div className="task-run-actions">
                <button
                  type="button"
                  data-testid="approve-task-run-button"
                  onClick={() => onReview(record.id, true)}
                  disabled={reviewingRunId === record.id}
                >
                  {text("Approve")}
                </button>
                <button
                  type="button"
                  onClick={() => onReview(record.id, false)}
                  disabled={reviewingRunId === record.id}
                >
                  {text("Reject")}
                </button>
              </div>
            )}
            {record.approval_state === "approved" &&
              record.execution_state === "approved-not-started" &&
              !record.online_enabled && (
                <div className="task-run-actions">
                  <button
                    type="button"
                    data-testid="execute-task-run-button"
                    onClick={() => onExecute(record.id)}
                    disabled={executingRunId === record.id}
                  >
                    {text(executeLabel(record))}
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
                  {text("Cancel")}
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
                  {text("Archive")}
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
