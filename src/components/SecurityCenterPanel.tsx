import type { AuditEventRecord, CapabilityStatus, SnapshotRecord } from "../types";
import { useI18n } from "../i18n";

type SecurityCenterPanelProps = {
  auditEvents: AuditEventRecord[];
  capabilities: CapabilityStatus[];
  isRefreshing: boolean;
  onRefresh: () => void;
  onRollbackSnapshot: (snapshotId: string) => void;
  rollingBackSnapshotId: string | null;
  snapshots: SnapshotRecord[];
};

const guardedStates = new Set([
  "guarded",
  "guarded-local",
  "email-guarded",
  "dry-run",
  "preview-only",
]);

export function SecurityCenterPanel({
  auditEvents,
  capabilities,
  isRefreshing,
  onRefresh,
  onRollbackSnapshot,
  rollingBackSnapshotId,
  snapshots,
}: SecurityCenterPanelProps) {
  const { text } = useI18n();
  const guardedCapabilities = capabilities.filter((capability) =>
    guardedStates.has(capability.state),
  );
  const blockedCapabilities = capabilities.filter((capability) =>
    ["disabled", "blocked", "not-configured"].some((state) => capability.state.includes(state)),
  );
  const recentHighRiskEvents = auditEvents.filter((event) =>
    ["high", "external", "durable", "destructive", "network", "agent", "browser"].some((term) =>
      event.risk_level.toLowerCase().includes(term),
    ),
  );

  return (
    <section className="panel security-center-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Security center")}</p>
          <h3>{text("Evidence and gates")}</h3>
        </div>
        <button type="button" onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? text("Refreshing") : text("Refresh")}
        </button>
      </div>

      <div className="security-center-summary">
        <article>
          <span>{text("Guarded capabilities")}</span>
          <strong>{guardedCapabilities.length}</strong>
        </article>
        <article>
          <span>{text("Blocked boundaries")}</span>
          <strong>{blockedCapabilities.length}</strong>
        </article>
        <article>
          <span>{text("Recent audit events")}</span>
          <strong>{auditEvents.length}</strong>
        </article>
        <article>
          <span>{text("Restore points")}</span>
          <strong>{snapshots.length}</strong>
        </article>
      </div>

      <div className="security-center-grid">
        <div className="security-center-list">
          <p className="eyebrow">{text("Recent evidence")}</p>
          {auditEvents.length === 0 ? (
            <span className="empty-state">{text("No durable audit events yet.")}</span>
          ) : (
            auditEvents.slice(0, 6).map((event) => (
              <article className="security-event" key={event.id}>
                <div>
                  <strong>{event.action}</strong>
                  <span>
                    {event.target_type} / {event.target_id}
                  </span>
                </div>
                <b>{text(event.decision)}</b>
                <small>
                  {text(event.risk_level)} · {text("input")} {event.input_hash}
                </small>
              </article>
            ))
          )}
        </div>

        <div className="security-center-list">
          <p className="eyebrow">{text("Guarded gates")}</p>
          {guardedCapabilities.slice(0, 6).map((capability) => (
            <article className="security-capability" key={capability.name}>
              <div>
                <strong>{text(capability.name)}</strong>
                <span>{text(capability.detail)}</span>
              </div>
              <b>{text(capability.state)}</b>
            </article>
          ))}
        </div>

        <div className="security-center-list">
          <p className="eyebrow">{text("Recovery surface")}</p>
          {snapshots.length === 0 ? (
            <span className="empty-state">{text("No restore points yet.")}</span>
          ) : (
            snapshots.slice(0, 4).map((snapshot) => (
              <article className="security-snapshot" key={snapshot.id}>
                <div>
                  <strong>{snapshot.object_id}</strong>
                  <span>
                    {text(snapshot.object_type)} / {text(snapshot.reason)}
                  </span>
                </div>
                <b>v{snapshot.version}</b>
                {snapshot.object_type !== "zhishu-item" && (
                  <button
                    type="button"
                    onClick={() => onRollbackSnapshot(snapshot.id)}
                    disabled={rollingBackSnapshotId === snapshot.id}
                  >
                    {rollingBackSnapshotId === snapshot.id ? text("Restoring") : text("Restore")}
                  </button>
                )}
              </article>
            ))
          )}
        </div>

        <div className="security-center-list">
          <p className="eyebrow">{text("High-risk trail")}</p>
          {recentHighRiskEvents.length === 0 ? (
            <span className="empty-state">{text("No high-risk audit trail in the current window.")}</span>
          ) : (
            recentHighRiskEvents.slice(0, 4).map((event) => (
              <article className="security-event" key={`risk-${event.id}`}>
                <div>
                  <strong>{text(event.risk_level)}</strong>
                  <span>{event.action}</span>
                </div>
                <b>{text(event.decision)}</b>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
