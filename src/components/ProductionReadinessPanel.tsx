import type { ProductionReadinessPreview } from "../types";
import { useI18n } from "../i18n";

type ProductionReadinessPanelProps = {
  isRefreshing: boolean;
  onRefresh: () => void;
  preview: ProductionReadinessPreview | null;
};

export function ProductionReadinessPanel({
  isRefreshing,
  onRefresh,
  preview,
}: ProductionReadinessPanelProps) {
  const { t, text } = useI18n();

  return (
    <section className="panel production-readiness-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{t("production.eyebrow")}</p>
          <h3>{t("production.title")}</h3>
        </div>
        <button type="button" onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? t("production.checking") : t("production.check")}
        </button>
      </div>

      {preview ? (
        <>
          <div className="retrieval-contract">
            <span>{text(preview.state)}</span>
            <strong>{text(preview.summary)}</strong>
            <div className="policy-tiers">
              {preview.gates.map((gate) => (
                <span key={gate}>{text(gate)}</span>
              ))}
            </div>
          </div>

          <div className="source-gate-list">
            {preview.checks.map((check) => (
              <article className="source-gate-item" key={check.id}>
                <div>
                  <span>{text(check.severity)}</span>
                  <strong>{text(check.label)}</strong>
                </div>
                <b>{text(check.state)}</b>
                <small>{text(check.detail)}</small>
                {check.remediation && <em>{t("production.fix")}: {text(check.remediation)}</em>}
              </article>
            ))}
          </div>
        </>
      ) : (
        <p className="empty-state">{t("production.empty")}</p>
      )}
    </section>
  );
}
