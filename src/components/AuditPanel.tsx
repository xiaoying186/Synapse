import type { PlanPreview, ReviewReceipt } from "../types";
import { useI18n } from "../i18n";

type AuditPanelProps = {
  isReviewing: boolean;
  onReviewPlan: (approved: boolean) => void;
  plan: PlanPreview | null;
  reviewReceipt: ReviewReceipt | null;
};

export function AuditPanel({ isReviewing, onReviewPlan, plan, reviewReceipt }: AuditPanelProps) {
  const { text } = useI18n();

  if (!plan) {
    return null;
  }

  return (
    <section className="panel audit-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Cognitive audit")}</p>
          <h3>{text(reviewReceipt?.decision ?? plan.audit_report.decision)}</h3>
        </div>
      </div>

      <div className="audit-grid">
        {plan.audit_report.stages.map((stage) => (
          <div className="audit-stage" key={`${stage.name}-${stage.scope}`}>
            <div>
              <span>{text(stage.scope)}</span>
              <strong>{text(stage.name)}</strong>
            </div>
            <b>{text(stage.status)}</b>
            <p>{text(stage.detail)}</p>
          </div>
        ))}
      </div>

      {plan.audit_report.promotable_facts.length > 0 && (
        <div className="facts-list">
          <p className="eyebrow">{text("Promotable facts")}</p>
          {plan.audit_report.promotable_facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </div>
      )}

      {plan.audit_required && (
        <div className="review-gate">
          <div>
            <span>{text("Review state")}</span>
            <strong>{text(reviewReceipt?.execution_state ?? "waiting-for-review")}</strong>
            {reviewReceipt && <p>{text(reviewReceipt.detail)}</p>}
          </div>
          <div className="review-actions">
            <button type="button" onClick={() => onReviewPlan(true)} disabled={isReviewing}>
              {text("Approve")}
            </button>
            <button type="button" onClick={() => onReviewPlan(false)} disabled={isReviewing}>
              {text("Reject")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
