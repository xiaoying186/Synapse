import type { ContextBudgetPreview } from "../types";
import { useI18n } from "../i18n";

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
  const { text } = useI18n();

  return (
    <section className="panel context-budget-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Context budget")}</p>
          <h3>{text("Evidence-preserving package preview")}</h3>
        </div>
        <strong>{text(preview?.decision_state ?? "local-only")}</strong>
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
          placeholder={text("Paste context snippets separated by blank lines")}
        />
        <button type="submit" disabled={isPreviewing}>
          {isPreviewing ? text("Budgeting") : text("Preview budget")}
        </button>
      </form>
      {preview && (
        <div className="retrieval-contract">
          <span>
            {preview.allocated_chars} / {preview.max_context_chars} {text("chars")}
          </span>
          <strong>{text(preview.task_kind)}</strong>
          <p>
            {text("Original")} {preview.original_chars} {text("chars")} / {text("evidence")}{" "}
            {text(preview.preserve_evidence ? "preserved" : "not preserved")}
          </p>
          <div className="policy-tiers">
            {preview.gates.map((gate) => (
              <span key={gate}>{text(gate)}</span>
            ))}
          </div>
          <div className="source-gate-list">
            {preview.decisions.map((decision) => (
              <article className="source-gate-item" key={decision.item_id}>
                <div>
                  <span>{text(decision.source_type)}</span>
                  <strong>{decision.title}</strong>
                </div>
                <b>{text(decision.decision)}</b>
                <small>
                  {decision.allocated_chars} / {decision.original_chars}
                </small>
                <small>
                  {text("evidence")}: {text(decision.evidence_state)} / sha256{" "}
                  {decision.source_sha256.slice(0, 12)}
                </small>
                {decision.sensitive_markers.length > 0 && (
                  <small>{text("review")}: {decision.sensitive_markers.map(text).join(", ")}</small>
                )}
                <em>{text(decision.reason)}</em>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
