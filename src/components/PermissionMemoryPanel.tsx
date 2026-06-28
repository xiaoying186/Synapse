import type { PermissionMemoryPreview } from "../types";

type PermissionMemoryPanelProps = {
  isPreviewing: boolean;
  onPreview: () => void;
  preview: PermissionMemoryPreview | null;
};

export function PermissionMemoryPanel({
  isPreviewing,
  onPreview,
  preview,
}: PermissionMemoryPanelProps) {
  return (
    <section className="panel permission-memory-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Permission Memory</p>
          <h3>Reusable approval candidate preview</h3>
        </div>
        <button type="button" onClick={onPreview} disabled={isPreviewing}>
          {isPreviewing ? "Previewing" : "Preview"}
        </button>
      </div>
      {preview && (
        <div className="retrieval-contract">
          <span>{preview.state}</span>
          <strong>
            auto grants permissions: {preview.auto_grants_permissions ? "true" : "false"}
          </strong>
          <div className="policy-tiers">
            {preview.gates.map((gate) => (
              <span key={gate}>{gate}</span>
            ))}
          </div>
          <small>Never auto-reuse: {preview.non_reusable_risks.join(", ")}</small>
          <div className="source-gate-list">
            {preview.candidates.map((candidate) => (
              <article className="source-gate-item" key={candidate.id}>
                <div>
                  <span>{candidate.reuse_state}</span>
                  <strong>{candidate.action_pattern}</strong>
                </div>
                <b>{candidate.permission_level}</b>
                <small>
                  {candidate.scope} / {candidate.tool_scope} / expires:{" "}
                  {candidate.expires_after}
                </small>
                <em>
                  revoked: {candidate.revoked ? "true" : "false"} / audit:{" "}
                  {candidate.audit_ref} / conditions:{" "}
                  {candidate.reuse_conditions.join(", ")}
                </em>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
