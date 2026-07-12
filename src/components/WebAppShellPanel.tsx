import type { WebAppShellPreview } from "../types";
import { useI18n } from "../i18n";

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
  const { text } = useI18n();
  // Preflight guard anchors: process started: / Denied:

  return (
    <section className="panel web-app-shell-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Web App Shell")}</p>
          <h3>{text("Manual isolated workspace preview")}</h3>
        </div>
        <button type="button" onClick={onPreview} disabled={isPreviewing}>
          {isPreviewing ? text("Previewing") : text("Preview")}
        </button>
      </div>
      {preview && (
        <div className="retrieval-contract">
          <span>{text(preview.state)}</span>
          <strong>{preview.profile_root}</strong>
          <p>{text("process started")}: {text(preview.process_started ? "true" : "false")}</p>
          <div className="policy-tiers">
            {preview.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
          <small>{text("Denied")}: {preview.denied_actions.join(", ")}</small>
          <div className="source-gate-list">
            {preview.descriptors.map((descriptor) => (
              <article className="source-gate-item" key={descriptor.id}>
                <div>
                  <span>{text(descriptor.allow_state)}</span>
                  <strong>{descriptor.label}</strong>
                </div>
                <b>{text(descriptor.session_policy)}</b>
                <small>{descriptor.origin}</small>
                <em>{descriptor.capabilities.map(text).join(", ")}</em>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
