import type { PlanPreview } from "../types";
import { useI18n } from "../i18n";

type PolicyPanelProps = {
  plan: PlanPreview | null;
};

export function PolicyPanel({ plan }: PolicyPanelProps) {
  const { text } = useI18n();

  if (!plan?.policy_preview) {
    return null;
  }

  const policy = plan.policy_preview;

  return (
    <section className="panel policy-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Permission policy")}</p>
          <h3>{text(policy.decision)}</h3>
        </div>
        <strong>{text(policy.permission_level)}</strong>
      </div>

      <div className="policy-summary">
        <div>
          <span>{text("Review")}</span>
          <b>{text(policy.requires_review ? "Required" : "Optional")}</b>
        </div>
        <div>
          <span>{text("Approval")}</span>
          <b>{text(policy.requires_explicit_approval ? "Explicit" : "Not required")}</b>
        </div>
      </div>

      <div className="policy-tiers">
        {policy.action_tiers.map((tier) => (
          <span key={tier}>{text(tier)}</span>
        ))}
      </div>

      <div className="policy-gates">
        {policy.gates.map((gate) => (
          <div className="policy-gate" key={gate.name}>
            <span>{text(gate.name)}</span>
            <b>{text(gate.status)}</b>
            <p>{text(gate.detail)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
