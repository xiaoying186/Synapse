import type { ExecutorContractPreview } from "../types";
import { useI18n } from "../i18n";

type ExecutorContractPanelProps = {
  isLoading: boolean;
  onRefresh: () => void;
  preview: ExecutorContractPreview | null;
};

export function ExecutorContractPanel({
  isLoading,
  onRefresh,
  preview,
}: ExecutorContractPanelProps) {
  const { text } = useI18n();

  return (
    <section className="panel executor-contract-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Executor contract")}</p>
          <h3>{text(preview?.executor_state ?? "Dry-run")}</h3>
        </div>
        <button className="text-action" type="button" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? text("Checking") : text("Refresh")}
        </button>
      </div>

      {!preview && <span className="empty-state">{text("No executor contract preview yet.")}</span>}
      {preview && (
        <div className="executor-contract-body">
          <p>{text(preview.detail)}</p>
          <div className="policy-tiers">
            {preview.required_gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
          <div className="executor-run-list">
            {preview.run_previews.length === 0 && (
              <span className="empty-state">{text("No task runs to check yet.")}</span>
            )}
            {preview.run_previews.map((run) => (
              <article className="executor-run-item" key={run.run_id}>
                <div>
                  <span>{text(run.lane)}</span>
                  <strong>{run.task_direction_title}</strong>
                  {run.blocked_reason && <p>{text(run.blocked_reason)}</p>}
                </div>
                <b>{text(run.readiness)}</b>
                <small>{run.run_id}</small>
                {run.push_enabled && (
                  <small>{text("push")}: {(run.push_channels ?? []).join(", ") || text("configured")}</small>
                )}
                {run.gates.length > 0 && (
                  <div className="executor-run-gates">
                    {run.gates.map((gate) => (
                      <span key={`${run.run_id}-${gate}`}>{text(gate)}</span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
