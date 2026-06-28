import type { PlanPreview, ReviewReceipt } from "../types";

type AuditPanelProps = {
  isReviewing: boolean;
  onReviewPlan: (approved: boolean) => void;
  plan: PlanPreview | null;
  reviewReceipt: ReviewReceipt | null;
};

export function AuditPanel({ isReviewing, onReviewPlan, plan, reviewReceipt }: AuditPanelProps) {
  if (!plan) {
    return null;
  }

  return (
    <section className="panel audit-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Cognitive audit</p>
          <h3>{reviewReceipt?.decision ?? plan.audit_report.decision}</h3>
        </div>
      </div>

      <div className="audit-grid">
        {plan.audit_report.stages.map((stage) => (
          <div className="audit-stage" key={`${stage.name}-${stage.scope}`}>
            <div>
              <span>{stage.scope}</span>
              <strong>{stage.name}</strong>
            </div>
            <b>{stage.status}</b>
            <p>{stage.detail}</p>
          </div>
        ))}
      </div>

      {plan.audit_report.promotable_facts.length > 0 && (
        <div className="facts-list">
          <p className="eyebrow">Promotable facts</p>
          {plan.audit_report.promotable_facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </div>
      )}

      {plan.audit_required && (
        <div className="review-gate">
          <div>
            <span>Review state</span>
            <strong>{reviewReceipt?.execution_state ?? "waiting-for-review"}</strong>
            {reviewReceipt && <p>{reviewReceipt.detail}</p>}
          </div>
          <div className="review-actions">
            <button type="button" onClick={() => onReviewPlan(true)} disabled={isReviewing}>
              Approve
            </button>
            <button type="button" onClick={() => onReviewPlan(false)} disabled={isReviewing}>
              Reject
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
