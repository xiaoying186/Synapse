import type { ExecutionRecord, PlanPreview } from "../types";
import { useI18n } from "../i18n";

type ExecutionPanelProps = {
  executionRecord: ExecutionRecord | null;
  plan: PlanPreview | null;
};

export function ExecutionPanel({ executionRecord, plan }: ExecutionPanelProps) {
  const { text } = useI18n();

  if (!plan) {
    return null;
  }

  return (
    <section className="panel execution-panel">
      <div className="panel-heading">
        <p className="eyebrow">{text("Execution preview")}</p>
        <h3>{text(plan.execution_preview.strategy)}</h3>
      </div>
      <div className="span-list">
        <div className="driver-receipt">
          <span>{text(plan.driver_receipt.mode)}</span>
          <strong>{plan.driver_receipt.accepted_steps} {text("accepted steps")}</strong>
          {plan.driver_receipt.blocked_reason && <em>{text(plan.driver_receipt.blocked_reason)}</em>}
        </div>
        {executionRecord && (
          <div className="queue-record">
            <span>{text(executionRecord.driver_mode)}</span>
            <strong>{text(executionRecord.state)}</strong>
            <small>{executionRecord.id}</small>
            <em>{text(executionRecord.route)}</em>
          </div>
        )}
        {plan.execution_preview.spans.map((span) => (
          <div className="span-item" key={span.id}>
            <span>{span.id}</span>
            <strong>{span.label}</strong>
            <b>{text(span.status)}</b>
            <small>{text(span.lane)}</small>
            {span.compensation && <em>{text(span.compensation)}</em>}
          </div>
        ))}
      </div>
    </section>
  );
}
