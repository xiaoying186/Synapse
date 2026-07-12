import type { SagaRecoveryPreview } from "../types";
import { useI18n } from "../i18n";

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
  const { text } = useI18n();

  return (
    <section className="panel saga-recovery-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Saga recovery")}</p>
          <h3>{text("Manual recovery review")}</h3>
        </div>
        <button type="button" onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? text("Checking") : text("Refresh")}
        </button>
      </div>

      {preview ? (
        <>
          <div className="retrieval-contract">
            <span>{text(preview.state)}</span>
            <strong>{preview.active_count} {text("active or failed transaction(s)")}</strong>
            <div className="policy-tiers">
              {preview.gates.map((gate) => (
                <span key={gate}>{text(gate)}</span>
              ))}
            </div>
          </div>

          <div className="source-gate-list">
            {preview.items.length === 0 && (
              <span className="empty-state">{text("No Saga transactions require recovery review.")}</span>
            )}
            {preview.items.map((item) => (
              <article className="source-gate-item" key={item.saga.id}>
                <div>
                  <span>{text(item.saga.kind)}</span>
                  <strong>{item.saga.target_id}</strong>
                </div>
                <b>{text(item.recovery_state)}</b>
                <small>
                  {text(item.recommended_action)} / {item.saga.id}
                </small>
                <em>{text(item.detail)}</em>
                <div className="memory-actions">
                  <button
                    type="button"
                    disabled={recordingSagaId === item.saga.id}
                    onClick={() => onRecordReview(item.saga.id, "reviewed")}
                  >
                    {text("Record reviewed")}
                  </button>
                  <button
                    type="button"
                    disabled={recordingSagaId === item.saga.id}
                    onClick={() => onRecordReview(item.saga.id, "deferred")}
                  >
                    {text("Defer")}
                  </button>
                  {item.saga.state === "failed" && (
                    <button
                      type="button"
                      disabled={recordingSagaId === item.saga.id}
                      onClick={() => onRecordReview(item.saga.id, "recovered-externally")}
                    >
                      {text("Mark resolved")}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <p className="empty-state">{text("Saga recovery preview is waiting for local data.")}</p>
      )}
    </section>
  );
}
