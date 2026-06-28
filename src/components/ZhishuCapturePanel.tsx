type ZhishuCapturePanelProps = {
  draft: string;
  isSaving: boolean;
  kind: string;
  onCapture: () => void;
  onDraftChange: (value: string) => void;
  onKindChange: (value: string) => void;
  onTagsChange: (value: string) => void;
  tags: string;
};

export function ZhishuCapturePanel({
  draft,
  isSaving,
  kind,
  onCapture,
  onDraftChange,
  onKindChange,
  onTagsChange,
  tags,
}: ZhishuCapturePanelProps) {
  return (
    <section className="panel zhishu-capture-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Zhishu</p>
          <h3>Knowledge candidate</h3>
        </div>
      </div>
      <form
        className="zhishu-form"
        onSubmit={(event) => {
          event.preventDefault();
          onCapture();
        }}
      >
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.currentTarget.value)}
          placeholder="Capture a knowledge item, rule, skill flow, or script interface"
        />
        <select value={kind} onChange={(event) => onKindChange(event.currentTarget.value)}>
          <option value="knowledge">Knowledge</option>
          <option value="reference">Reference</option>
          <option value="rule">Rule</option>
          <option value="skill">Skill</option>
          <option value="skill-flow">Skill flow</option>
          <option value="script-interface">Script interface</option>
        </select>
        <input
          value={tags}
          onChange={(event) => onTagsChange(event.currentTarget.value)}
          placeholder="tags, separated, by commas"
        />
        <button type="submit" disabled={isSaving}>
          {isSaving ? "Saving" : "Capture"}
        </button>
      </form>
    </section>
  );
}
