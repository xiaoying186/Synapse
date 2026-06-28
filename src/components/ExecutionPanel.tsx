import type { ExecutionRecord, PlanPreview } from "../types";

type ExecutionPanelProps = {
  executionRecord: ExecutionRecord | null;
  plan: PlanPreview | null;
};

export function ExecutionPanel({ executionRecord, plan }: ExecutionPanelProps) {
  if (!plan) {
    return null;
  }

  return (
    <section className="panel execution-panel">
      <div className="panel-heading">
        <p className="eyebrow">Execution preview</p>
        <h3>{plan.execution_preview.strategy}</h3>
      </div>
      <div className="span-list">
        <div className="driver-receipt">
          <span>{plan.driver_receipt.mode}</span>
          <strong>{plan.driver_receipt.accepted_steps} accepted steps</strong>
          {plan.driver_receipt.blocked_reason && <em>{plan.driver_receipt.blocked_reason}</em>}
        </div>
        {executionRecord && (
          <div className="queue-record">
            <span>{executionRecord.driver_mode}</span>
            <strong>{executionRecord.state}</strong>
            <small>{executionRecord.id}</small>
            <em>{executionRecord.route}</em>
          </div>
        )}
        {plan.execution_preview.spans.map((span) => (
          <div className="span-item" key={span.id}>
            <span>{span.id}</span>
            <strong>{span.label}</strong>
            <b>{span.status}</b>
            <small>{span.lane}</small>
            {span.compensation && <em>{span.compensation}</em>}
          </div>
        ))}
      </div>
    </section>
  );
}
