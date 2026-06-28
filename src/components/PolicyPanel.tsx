import type { PlanPreview } from "../types";

type PolicyPanelProps = {
  plan: PlanPreview | null;
};

export function PolicyPanel({ plan }: PolicyPanelProps) {
  if (!plan?.policy_preview) {
    return null;
  }

  const policy = plan.policy_preview;

  return (
    <section className="panel policy-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Permission policy</p>
          <h3>{policy.decision}</h3>
        </div>
        <strong>{policy.permission_level}</strong>
      </div>

      <div className="policy-summary">
        <div>
          <span>Review</span>
          <b>{policy.requires_review ? "Required" : "Optional"}</b>
        </div>
        <div>
          <span>Approval</span>
          <b>{policy.requires_explicit_approval ? "Explicit" : "Not required"}</b>
        </div>
      </div>

      <div className="policy-tiers">
        {policy.action_tiers.map((tier) => (
          <span key={tier}>{tier}</span>
        ))}
      </div>

      <div className="policy-gates">
        {policy.gates.map((gate) => (
          <div className="policy-gate" key={gate.name}>
            <span>{gate.name}</span>
            <b>{gate.status}</b>
            <p>{gate.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
