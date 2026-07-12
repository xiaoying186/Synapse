import type { CodebaseMemoryAdmissionPreflight, CodebaseMemoryPreview } from "../types";
import { useI18n } from "../i18n";

type CodebaseMemoryPanelProps = {
  admissionPreflight: CodebaseMemoryAdmissionPreflight | null;
  isPreflightingAdmission: boolean;
  isPreviewing: boolean;
  onPreflightAdmission: (sourceId: string) => void;
  onPreview: () => void;
  preview: CodebaseMemoryPreview | null;
};

export function CodebaseMemoryPanel({
  admissionPreflight,
  isPreflightingAdmission,
  isPreviewing,
  onPreflightAdmission,
  onPreview,
  preview,
}: CodebaseMemoryPanelProps) {
  const { text } = useI18n();
  // Preflight guard anchors: process started: / Denied:
  const sourceId = preview?.sources[0]?.id ?? "codegraph-index";

  return (
    <section className="panel codebase-memory-panel" data-testid="codebase-memory-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Codebase Memory")}</p>
          <h3>{text("CodeGraph structural adapter preview")}</h3>
        </div>
        <div className="panel-actions">
          <button
            type="button"
            data-testid="codebase-memory-preview-button"
            onClick={onPreview}
            disabled={isPreviewing}
          >
            {isPreviewing ? text("Previewing") : text("Preview")}
          </button>
          <button
            type="button"
            data-testid="codebase-memory-admission-preflight-button"
            onClick={() => onPreflightAdmission(sourceId)}
            disabled={isPreflightingAdmission}
          >
            {isPreflightingAdmission
              ? text("Checking admission")
              : text("Check admission gates")}
          </button>
        </div>
      </div>
      {admissionPreflight && (
        <div className="retrieval-contract" data-testid="codebase-memory-admission-preflight-result">
          <span>{text(admissionPreflight.state)}</span>
          <strong>
            {text("L2 write started")}: {text(admissionPreflight.l2_write_started ? "true" : "false")}
          </strong>
          <p>
            {text("process started")}: {text(admissionPreflight.process_started ? "true" : "false")} /{" "}
            {text("scanned")}: {text(admissionPreflight.repository_scanned ? "true" : "false")} /{" "}
            {text("ingested")}: {text(admissionPreflight.file_content_ingested ? "true" : "false")}
          </p>
          <div className="policy-tiers">
            {admissionPreflight.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
          <small>
            {text("Blockers")}: {admissionPreflight.blockers.map((blocker) => text(blocker)).join(", ")}
          </small>
          <small>
            {text("Denied")}: {admissionPreflight.denied_actions.map((action) => text(action)).join(", ")}
          </small>
        </div>
      )}
      {preview && (
        <div className="retrieval-contract">
          <span>{text(preview.state)}</span>
          <strong>{text(preview.adapter_mode)}</strong>
          <p>{preview.index_root}</p>
          <small>
            {text("index")}: {text(preview.index_present ? "available" : "not initialized")} /
            {text("process started")}: {text(preview.process_started ? "true" : "false")} /
            {text("scanned")}: {text(preview.repository_scanned ? "true" : "false")} /
            {text("ingested")}: {text(preview.file_content_ingested ? "true" : "false")}
          </small>
          <div className="policy-tiers">
            {preview.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
          <small>{text("Denied")}: {preview.denied_actions.join(", ")}</small>
          <div className="source-gate-list">
            {preview.sources.map((source) => (
              <article className="source-gate-item" key={source.id}>
                <div>
                  <span>{text(source.state)}</span>
                  <strong>{source.label}</strong>
                </div>
                <b>{text(source.scope)}</b>
                <small>{source.path}</small>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
