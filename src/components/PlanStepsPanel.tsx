import type { PlanPreview, SystemStatus } from "../types";
import { useI18n } from "../i18n";

type PlanStepsPanelProps = {
  plan: PlanPreview | null;
  status: SystemStatus | null;
};

function contextRefClassName(value: string) {
  if (value.startsWith("Avoidance")) {
    return "context-ref context-ref-avoidance";
  }
  if (value.startsWith("Success")) {
    return "context-ref context-ref-success";
  }

  return "context-ref";
}

export function PlanStepsPanel({ plan, status }: PlanStepsPanelProps) {
  const { text } = useI18n();
  const displayedItems = plan?.steps ?? status?.memory_scopes ?? ["L0 Session", "L1 Working", "L2 Knowledge"];

  return (
    <div className="panel">
      <div className="panel-heading">
        <p className="eyebrow">{text("Plan")}</p>
        <h3>{text("Materialized steps")}</h3>
      </div>
      <div className="scope-list">
        {displayedItems.map((item) => (
          <span key={item}>{text(item)}</span>
        ))}
      </div>
      {plan && (
        <div className="context-refs">
          <p className="eyebrow">{text("Context references")}</p>
          {plan.context_refs.map((item) => (
            <span className={contextRefClassName(item)} key={item}>
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
