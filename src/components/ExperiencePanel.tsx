type ExperiencePanelProps = {
  draft: string;
  isSaving: boolean;
  onCapture: () => void;
  onDraftChange: (value: string) => void;
  onTagsChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  tags: string;
  type: string;
};

export function ExperiencePanel({
  draft,
  isSaving,
  onCapture,
  onDraftChange,
  onTagsChange,
  onTypeChange,
  tags,
  type,
}: ExperiencePanelProps) {
  return (
    <section className="panel experience-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Experience</p>
          <h3>Reuse and avoidance</h3>
        </div>
      </div>
      <form
        className="experience-form"
        onSubmit={(event) => {
          event.preventDefault();
          onCapture();
        }}
      >
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.currentTarget.value)}
          placeholder="Record a reusable success, caution, allow rule, or deny rule"
        />
        <select value={type} onChange={(event) => onTypeChange(event.currentTarget.value)}>
          <option value="success">Success</option>
          <option value="failure">Avoid</option>
          <option value="allow">Allow / Whitelist</option>
          <option value="deny">Deny / Blacklist</option>
        </select>
        <input
          value={tags}
          onChange={(event) => onTagsChange(event.currentTarget.value)}
          placeholder="tags, separated, by commas"
        />
        <button type="submit" disabled={isSaving}>
          {isSaving ? "Saving" : "Save"}
        </button>
      </form>
    </section>
  );
}
