import type { PlanPreview } from "../types";
import { useI18n } from "../i18n";

type TracePanelProps = {
  activity: string;
  plan: PlanPreview | null;
};

export function TracePanel({ activity, plan }: TracePanelProps) {
  const { text } = useI18n();

  return (
    <div className="panel">
      <div className="panel-heading">
        <p className="eyebrow">{text("Trace")}</p>
        <h3>{text("Current activity")}</h3>
      </div>
      <p className="activity">{text(activity)}</p>
      {plan && (
        <div className="plan-summary">
          <div>
            <span>{text("Intent")}</span>
            <strong>{plan.intent}</strong>
          </div>
          <div>
            <span>{text("Risk")}</span>
            <strong>{text(plan.risk)}</strong>
          </div>
          <div>
            <span>{text("Sandbox")}</span>
            <strong>{text(plan.constraints.sandbox)}</strong>
          </div>
          <div>
            <span>{text("Route")}</span>
            <strong>{text(plan.route)}</strong>
          </div>
          <div>
            <span>{text("Audit")}</span>
            <strong>{text(plan.audit_required ? "Required" : "Optional")}</strong>
          </div>
          <div>
            <span>{text("Mode lock")}</span>
            <strong>{text(plan.constraints.mode_lock_auto ? "Auto" : "Manual")}</strong>
          </div>
          <div>
            <span>{text("Driver")}</span>
            <strong>{text(plan.driver_receipt.mode)}</strong>
          </div>
          <div>
            <span>{text("Readiness")}</span>
            <strong>{text(plan.driver_receipt.status)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
