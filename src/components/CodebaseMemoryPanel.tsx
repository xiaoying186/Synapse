import type { CodebaseMemoryPreview } from "../types";

type CodebaseMemoryPanelProps = {
  isPreviewing: boolean;
  onPreview: () => void;
  preview: CodebaseMemoryPreview | null;
};

export function CodebaseMemoryPanel({
  isPreviewing,
  onPreview,
  preview,
}: CodebaseMemoryPanelProps) {
  return (
    <section className="panel codebase-memory-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Codebase Memory</p>
          <h3>CodeGraph structural adapter preview</h3>
        </div>
        <button type="button" onClick={onPreview} disabled={isPreviewing}>
          {isPreviewing ? "Previewing" : "Preview"}
        </button>
      </div>
      {preview && (
        <div className="retrieval-contract">
          <span>{preview.state}</span>
          <strong>{preview.adapter_mode}</strong>
          <p>{preview.index_root}</p>
          <small>
            index: {preview.index_present ? "available" : "not initialized"} /
            process started: {preview.process_started ? "true" : "false"} /
            scanned: {preview.repository_scanned ? "true" : "false"} /
            ingested: {preview.file_content_ingested ? "true" : "false"}
          </small>
          <div className="policy-tiers">
            {preview.gates.map((gate) => (
              <span key={gate}>{gate}</span>
            ))}
          </div>
          <small>Denied: {preview.denied_actions.join(", ")}</small>
          <div className="source-gate-list">
            {preview.sources.map((source) => (
              <article className="source-gate-item" key={source.id}>
                <div>
                  <span>{source.state}</span>
                  <strong>{source.label}</strong>
                </div>
                <b>{source.scope}</b>
                <small>{source.path}</small>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
