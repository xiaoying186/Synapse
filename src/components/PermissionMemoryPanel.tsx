import type { PermissionMemoryPreview, PermissionReusePreflight } from "../types";
import { useI18n } from "../i18n";

type PermissionMemoryPanelProps = {
  isPreflightingReuse: boolean;
  isPreviewing: boolean;
  onPreflightReuse: (candidateId: string, requestedAction: string) => void;
  onPreview: () => void;
  preview: PermissionMemoryPreview | null;
  reusePreflight: PermissionReusePreflight | null;
};

export function PermissionMemoryPanel({
  isPreflightingReuse,
  isPreviewing,
  onPreflightReuse,
  onPreview,
  preview,
  reusePreflight,
}: PermissionMemoryPanelProps) {
  const { text } = useI18n();
  // Preflight guard anchors: auto grants permissions: / Never auto-reuse:
  const candidateId = preview?.candidates[0]?.id ?? "pm-local-readonly-code-context";

  return (
    <section className="panel permission-memory-panel" data-testid="permission-memory-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Permission Memory")}</p>
          <h3>{text("Reusable approval candidate preview")}</h3>
        </div>
        <div className="panel-actions">
          <button
            type="button"
            data-testid="permission-memory-preview-button"
            onClick={onPreview}
            disabled={isPreviewing}
          >
            {isPreviewing ? text("Previewing") : text("Preview")}
          </button>
          <button
            type="button"
            data-testid="permission-reuse-preflight-button"
            onClick={() => onPreflightReuse(candidateId, "trade-or-financial-action")}
            disabled={isPreflightingReuse}
          >
            {isPreflightingReuse
              ? text("Checking permission reuse")
              : text("Check permission reuse gates")}
          </button>
        </div>
      </div>
      {reusePreflight && (
        <div className="retrieval-contract" data-testid="permission-reuse-preflight-result">
          <span>{text(reusePreflight.state)}</span>
          <strong>
            {text("auto grant started")}: {text(reusePreflight.auto_grant_started ? "true" : "false")} /{" "}
            {text("permission reused")}: {text(reusePreflight.permission_reused ? "true" : "false")}
          </strong>
          <p>
            {text("durable policy write started")}:{" "}
            {text(reusePreflight.durable_policy_write_started ? "true" : "false")} /{" "}
            {text("high risk blocked")}: {text(reusePreflight.high_risk_blocked ? "true" : "false")}
          </p>
          <div className="policy-tiers">
            {reusePreflight.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
          <small>
            {text("Blockers")}: {reusePreflight.blockers.map((blocker) => text(blocker)).join(", ")}
          </small>
          <small>
            {text("Denied")}: {reusePreflight.denied_actions.map((action) => text(action)).join(", ")}
          </small>
        </div>
      )}
      {preview && (
        <div className="retrieval-contract">
          <span>{text(preview.state)}</span>
          <strong>
            {text("auto grants permissions")}: {text(preview.auto_grants_permissions ? "true" : "false")}
          </strong>
          <div className="policy-tiers">
            {preview.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
          <small>{text("Never auto-reuse")}: {preview.non_reusable_risks.map(text).join(", ")}</small>
          <div className="source-gate-list">
            {preview.candidates.map((candidate) => (
              <article className="source-gate-item" key={candidate.id}>
                <div>
                  <span>{text(candidate.reuse_state)}</span>
                  <strong>{text(candidate.action_pattern)}</strong>
                </div>
                <b>{text(candidate.permission_level)}</b>
                <small>
                  {text(candidate.scope)} / {text(candidate.tool_scope)} / {text("expires")}:{" "}
                  {candidate.expires_after}
                </small>
                <em>
                  {text("revoked")}: {text(candidate.revoked ? "true" : "false")} / {text("audit")}:{" "}
                  {candidate.audit_ref} / {text("conditions")}:{" "}
                  {candidate.reuse_conditions.map(text).join(", ")}
                </em>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
