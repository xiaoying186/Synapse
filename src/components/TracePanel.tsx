import type { PlanPreview } from "../types";

type TracePanelProps = {
  activity: string;
  plan: PlanPreview | null;
};

export function TracePanel({ activity, plan }: TracePanelProps) {
  return (
    <div className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Trace</p>
        <h3>Current activity</h3>
      </div>
      <p className="activity">{activity}</p>
      {plan && (
        <div className="plan-summary">
          <div>
            <span>Intent</span>
            <strong>{plan.intent}</strong>
          </div>
          <div>
            <span>Risk</span>
            <strong>{plan.risk}</strong>
          </div>
          <div>
            <span>Sandbox</span>
            <strong>{plan.constraints.sandbox}</strong>
          </div>
          <div>
            <span>Route</span>
            <strong>{plan.route}</strong>
          </div>
          <div>
            <span>Audit</span>
            <strong>{plan.audit_required ? "Required" : "Optional"}</strong>
          </div>
          <div>
            <span>Mode lock</span>
            <strong>{plan.constraints.mode_lock_auto ? "Auto" : "Manual"}</strong>
          </div>
          <div>
            <span>Driver</span>
            <strong>{plan.driver_receipt.mode}</strong>
          </div>
          <div>
            <span>Readiness</span>
            <strong>{plan.driver_receipt.status}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
