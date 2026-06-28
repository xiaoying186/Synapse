import type { ExecutorContractPreview } from "../types";

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
  return (
    <section className="panel executor-contract-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Executor contract</p>
          <h3>{preview?.executor_state ?? "Dry-run"}</h3>
        </div>
        <button className="text-action" type="button" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? "Checking" : "Refresh"}
        </button>
      </div>

      {!preview && <span className="empty-state">No executor contract preview yet.</span>}
      {preview && (
        <div className="executor-contract-body">
          <p>{preview.detail}</p>
          <div className="policy-tiers">
            {preview.required_gates.map((gate) => (
              <span key={gate}>{gate}</span>
            ))}
          </div>
          <div className="executor-run-list">
            {preview.run_previews.length === 0 && (
              <span className="empty-state">No task runs to check yet.</span>
            )}
            {preview.run_previews.map((run) => (
              <article className="executor-run-item" key={run.run_id}>
                <div>
                  <span>{run.lane}</span>
                  <strong>{run.task_direction_title}</strong>
                  {run.blocked_reason && <p>{run.blocked_reason}</p>}
                </div>
                <b>{run.readiness}</b>
                <small>{run.run_id}</small>
                {run.push_enabled && (
                  <small>push: {(run.push_channels ?? []).join(", ") || "configured"}</small>
                )}
                {run.gates.length > 0 && (
                  <div className="executor-run-gates">
                    {run.gates.map((gate) => (
                      <span key={`${run.run_id}-${gate}`}>{gate}</span>
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
