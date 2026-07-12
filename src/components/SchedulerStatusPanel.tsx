import type { SchedulerStatus } from "../types";
import { useI18n } from "../i18n";

type SchedulerStatusPanelProps = {
  status?: SchedulerStatus;
};

export function SchedulerStatusPanel({ status }: SchedulerStatusPanelProps) {
  const { text } = useI18n();

  if (!status) {
    return null;
  }

  return (
    <section className="panel scheduler-status-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Scheduler safety")}</p>
          <h3>{text("Background loop")}</h3>
        </div>
        <strong>{text(status.background_loop_state)}</strong>
      </div>
      <div className="scheduler-status-body">
        <div>
          <span>{text("Manual tick")}</span>
          <strong>{text(status.manual_tick_state)}</strong>
          <p>{text(status.detail)}</p>
          {status.lease_owner && <small>{text("owner")}: {status.lease_owner}</small>}
          {status.lease_expires_at_ms && (
            <small>{text("lease expires")}: {new Date(status.lease_expires_at_ms).toLocaleString()}</small>
          )}
          {status.last_tick_at_ms && (
            <small>{text("last tick")}: {new Date(status.last_tick_at_ms).toLocaleString()}</small>
          )}
          {(status.consecutive_failures ?? 0) > 0 && (
            <small>
              {text("failures")}: {status.consecutive_failures}
              {status.last_error ? ` / ${status.last_error}` : ""}
            </small>
          )}
        </div>
        <div className="policy-tiers">
          {status.required_gates.map((gate) => (
            <span key={gate}>{text(gate)}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
