import type { WebAppShellPreview } from "../types";

type WebAppShellPanelProps = {
  isPreviewing: boolean;
  onPreview: () => void;
  preview: WebAppShellPreview | null;
};

export function WebAppShellPanel({
  isPreviewing,
  onPreview,
  preview,
}: WebAppShellPanelProps) {
  return (
    <section className="panel web-app-shell-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Web App Shell</p>
          <h3>Manual isolated workspace preview</h3>
        </div>
        <button type="button" onClick={onPreview} disabled={isPreviewing}>
          {isPreviewing ? "Previewing" : "Preview"}
        </button>
      </div>
      {preview && (
        <div className="retrieval-contract">
          <span>{preview.state}</span>
          <strong>{preview.profile_root}</strong>
          <p>process started: {preview.process_started ? "true" : "false"}</p>
          <div className="policy-tiers">
            {preview.gates.map((gate) => (
              <span key={gate}>{gate}</span>
            ))}
          </div>
          <small>Denied: {preview.denied_actions.join(", ")}</small>
          <div className="source-gate-list">
            {preview.descriptors.map((descriptor) => (
              <article className="source-gate-item" key={descriptor.id}>
                <div>
                  <span>{descriptor.allow_state}</span>
                  <strong>{descriptor.label}</strong>
                </div>
                <b>{descriptor.session_policy}</b>
                <small>{descriptor.origin}</small>
                <em>{descriptor.capabilities.join(", ")}</em>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
