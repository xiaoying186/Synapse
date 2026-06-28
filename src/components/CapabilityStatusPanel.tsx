import type { CapabilityStatus } from "../types";

type CapabilityStatusPanelProps = {
  capabilities: CapabilityStatus[];
};

export function CapabilityStatusPanel({ capabilities }: CapabilityStatusPanelProps) {
  if (capabilities.length === 0) {
    return null;
  }

  return (
    <section className="panel capability-status-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Runtime capability</p>
          <h3>Availability map</h3>
        </div>
      </div>
      <div className="capability-status-list">
        {capabilities.map((capability) => (
          <article className="capability-status-item" key={capability.name}>
            <div>
              <span>{capability.name}</span>
              <strong>{capability.detail}</strong>
            </div>
            <b>{capability.state}</b>
          </article>
        ))}
      </div>
    </section>
  );
}
