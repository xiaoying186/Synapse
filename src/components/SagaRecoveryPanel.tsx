import type { SagaRecoveryPreview } from "../types";

type SagaRecoveryPanelProps = {
  isRefreshing: boolean;
  recordingSagaId: string | null;
  onRefresh: () => void;
  onRecordReview: (
    sagaId: string,
    decision: "reviewed" | "deferred" | "recovered-externally",
  ) => void;
  preview: SagaRecoveryPreview | null;
};

export function SagaRecoveryPanel({
  isRefreshing,
  recordingSagaId,
  onRefresh,
  onRecordReview,
  preview,
}: SagaRecoveryPanelProps) {
  return (
    <section className="panel saga-recovery-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Saga recovery</p>
          <h3>Manual recovery review</h3>
        </div>
        <button type="button" onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? "Checking" : "Refresh"}
        </button>
      </div>

      {preview ? (
        <>
          <div className="retrieval-contract">
            <span>{preview.state}</span>
            <strong>{preview.active_count} active or failed transaction(s)</strong>
            <div className="policy-tiers">
              {preview.gates.map((gate) => (
                <span key={gate}>{gate}</span>
              ))}
            </div>
          </div>

          <div className="source-gate-list">
            {preview.items.length === 0 && (
              <span className="empty-state">No Saga transactions require recovery review.</span>
            )}
            {preview.items.map((item) => (
              <article className="source-gate-item" key={item.saga.id}>
                <div>
                  <span>{item.saga.kind}</span>
                  <strong>{item.saga.target_id}</strong>
                </div>
                <b>{item.recovery_state}</b>
                <small>
                  {item.recommended_action} / {item.saga.id}
                </small>
                <em>{item.detail}</em>
                <div className="memory-actions">
                  <button
                    type="button"
                    disabled={recordingSagaId === item.saga.id}
                    onClick={() => onRecordReview(item.saga.id, "reviewed")}
                  >
                    Record reviewed
                  </button>
                  <button
                    type="button"
                    disabled={recordingSagaId === item.saga.id}
                    onClick={() => onRecordReview(item.saga.id, "deferred")}
                  >
                    Defer
                  </button>
                  {item.saga.state === "failed" && (
                    <button
                      type="button"
                      disabled={recordingSagaId === item.saga.id}
                      onClick={() => onRecordReview(item.saga.id, "recovered-externally")}
                    >
                      Mark resolved
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <p className="empty-state">Saga recovery preview is waiting for local data.</p>
      )}
    </section>
  );
}
