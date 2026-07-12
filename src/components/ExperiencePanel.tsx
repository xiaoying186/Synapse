import { useI18n } from "../i18n";

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
  const { text } = useI18n();

  return (
    <section className="panel experience-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Experience")}</p>
          <h3>{text("Reuse and avoidance")}</h3>
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
          placeholder={text("Record a reusable success, caution, allow rule, or deny rule")}
        />
        <select value={type} onChange={(event) => onTypeChange(event.currentTarget.value)}>
          <option value="success">{text("Success")}</option>
          <option value="failure">{text("Avoid")}</option>
          <option value="allow">{text("Allow / Whitelist")}</option>
          <option value="deny">{text("Deny / Blacklist")}</option>
        </select>
        <input
          value={tags}
          onChange={(event) => onTagsChange(event.currentTarget.value)}
          placeholder={text("tags, separated, by commas")}
        />
        <button type="submit" disabled={isSaving}>
          {isSaving ? text("Saving") : text("Save")}
        </button>
      </form>
    </section>
  );
}
