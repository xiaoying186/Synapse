import type { SchedulerStatus } from "../types";

type SchedulerStatusPanelProps = {
  status?: SchedulerStatus;
};

export function SchedulerStatusPanel({ status }: SchedulerStatusPanelProps) {
  if (!status) {
    return null;
  }

  return (
    <section className="panel scheduler-status-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Scheduler safety</p>
          <h3>Background loop</h3>
        </div>
        <strong>{status.background_loop_state}</strong>
      </div>
      <div className="scheduler-status-body">
        <div>
          <span>Manual tick</span>
          <strong>{status.manual_tick_state}</strong>
          <p>{status.detail}</p>
          {status.lease_owner && <small>owner: {status.lease_owner}</small>}
          {status.lease_expires_at_ms && (
            <small>lease expires: {new Date(status.lease_expires_at_ms).toLocaleString()}</small>
          )}
          {status.last_tick_at_ms && (
            <small>last tick: {new Date(status.last_tick_at_ms).toLocaleString()}</small>
          )}
          {(status.consecutive_failures ?? 0) > 0 && (
            <small>
              failures: {status.consecutive_failures}
              {status.last_error ? ` / ${status.last_error}` : ""}
            </small>
          )}
        </div>
        <div className="policy-tiers">
          {status.required_gates.map((gate) => (
            <span key={gate}>{gate}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
