import type { ContextBudgetPreview } from "../types";

type ContextBudgetPanelProps = {
  draft: string;
  isPreviewing: boolean;
  onDraftChange: (value: string) => void;
  onPreview: () => void;
  preview: ContextBudgetPreview | null;
};

export function ContextBudgetPanel({
  draft,
  isPreviewing,
  onDraftChange,
  onPreview,
  preview,
}: ContextBudgetPanelProps) {
  return (
    <section className="panel context-budget-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Context budget</p>
          <h3>Evidence-preserving package preview</h3>
        </div>
        <strong>{preview?.decision_state ?? "local-only"}</strong>
      </div>
      <form
        className="capability-form source-import-form"
        onSubmit={(event) => {
          event.preventDefault();
          onPreview();
        }}
      >
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.currentTarget.value)}
          placeholder="Paste context snippets separated by blank lines"
        />
        <button type="submit" disabled={isPreviewing}>
          {isPreviewing ? "Budgeting" : "Preview budget"}
        </button>
      </form>
      {preview && (
        <div className="retrieval-contract">
          <span>
            {preview.allocated_chars} / {preview.max_context_chars} chars
          </span>
          <strong>{preview.task_kind}</strong>
          <p>
            Original {preview.original_chars} chars / evidence{" "}
            {preview.preserve_evidence ? "preserved" : "not preserved"}
          </p>
          <div className="policy-tiers">
            {preview.gates.map((gate) => (
              <span key={gate}>{gate}</span>
            ))}
          </div>
          <div className="source-gate-list">
            {preview.decisions.map((decision) => (
              <article className="source-gate-item" key={decision.item_id}>
                <div>
                  <span>{decision.source_type}</span>
                  <strong>{decision.title}</strong>
                </div>
                <b>{decision.decision}</b>
                <small>
                  {decision.allocated_chars} / {decision.original_chars}
                </small>
                <small>
                  evidence: {decision.evidence_state} / sha256{" "}
                  {decision.source_sha256.slice(0, 12)}
                </small>
                {decision.sensitive_markers.length > 0 && (
                  <small>review: {decision.sensitive_markers.join(", ")}</small>
                )}
                <em>{decision.reason}</em>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
