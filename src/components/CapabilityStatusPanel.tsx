import type { CapabilityStatus } from "../types";
import { useI18n } from "../i18n";

type CapabilityStatusPanelProps = {
  capabilities: CapabilityStatus[];
};

export function CapabilityStatusPanel({ capabilities }: CapabilityStatusPanelProps) {
  const { t } = useI18n();

  if (capabilities.length === 0) {
    return null;
  }

  return (
    <section className="panel capability-status-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{t("capability.eyebrow")}</p>
          <h3>{t("capability.title")}</h3>
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
