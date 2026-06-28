import type { ProductionReadinessPreview } from "../types";

type ProductionReadinessPanelProps = {
  isRefreshing: boolean;
  onRefresh: () => void;
  preview: ProductionReadinessPreview | null;
};

export function ProductionReadinessPanel({
  isRefreshing,
  onRefresh,
  preview,
}: ProductionReadinessPanelProps) {
  return (
    <section className="panel production-readiness-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Production readiness</p>
          <h3>0.0.0 local-first gate check</h3>
        </div>
        <button type="button" onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? "Checking" : "Check"}
        </button>
      </div>

      {preview ? (
        <>
          <div className="retrieval-contract">
            <span>{preview.state}</span>
            <strong>{preview.summary}</strong>
            <div className="policy-tiers">
              {preview.gates.map((gate) => (
                <span key={gate}>{gate}</span>
              ))}
            </div>
          </div>

          <div className="source-gate-list">
            {preview.checks.map((check) => (
              <article className="source-gate-item" key={check.id}>
                <div>
                  <span>{check.severity}</span>
                  <strong>{check.label}</strong>
                </div>
                <b>{check.state}</b>
                <small>{check.detail}</small>
                {check.remediation && <em>Fix: {check.remediation}</em>}
              </article>
            ))}
          </div>
        </>
      ) : (
        <p className="empty-state">Production readiness has not been checked yet.</p>
      )}
    </section>
  );
}
