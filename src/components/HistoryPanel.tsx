import type { ExecutionRecord, PlanPreview, PlanRecord, ReviewReceipt } from "../types";
import { useI18n } from "../i18n";

type HistoryPanelProps = {
  activePlanId: string | null;
  history: PlanRecord[];
  onClear: () => void;
  onSelect: (selection: {
    executionRecord: ExecutionRecord | null;
    plan: PlanPreview;
    planId: string;
    reviewReceipt: ReviewReceipt | null;
  }) => void;
};

export function HistoryPanel({ activePlanId, history, onClear, onSelect }: HistoryPanelProps) {
  const { text } = useI18n();

  if (history.length === 0) {
    return null;
  }

  return (
    <section className="panel history-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Decision trace")}</p>
          <h3>{text("Recent plans")}</h3>
        </div>
        <button className="text-action" type="button" onClick={onClear}>
          {text("Clear")}
        </button>
      </div>
      <div className="history-list">
        {history.map((record) => (
          <button
            className={record.id === activePlanId ? "history-item active" : "history-item"}
            key={record.id}
            type="button"
            onClick={() =>
              onSelect({
                executionRecord: record.execution_record ?? null,
                plan: record.preview,
                planId: record.id,
                reviewReceipt: record.review_receipt ?? null,
              })
            }
          >
            <span>{text(record.preview.risk)}</span>
            <strong>{record.preview.intent}</strong>
            <small>{text(record.preview.audit_report.decision)}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
