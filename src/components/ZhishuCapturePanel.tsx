import { useI18n } from "../i18n";

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
  const { text } = useI18n();

  return (
    <section className="panel zhishu-capture-panel" data-testid="zhishu-capture-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Zhishu")}</p>
          <h3>{text("Knowledge candidate")}</h3>
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
          data-testid="zhishu-capture-input"
          value={draft}
          onChange={(event) => onDraftChange(event.currentTarget.value)}
          placeholder={text("Capture a knowledge item, rule, skill flow, or script interface")}
        />
        <select
          data-testid="zhishu-kind-select"
          value={kind}
          onChange={(event) => onKindChange(event.currentTarget.value)}
        >
          <option value="knowledge">{text("Knowledge")}</option>
          <option value="reference">{text("Reference")}</option>
          <option value="rule">{text("Rule")}</option>
          <option value="skill">{text("Skill")}</option>
          <option value="skill-flow">{text("Skill flow")}</option>
          <option value="script-interface">{text("Script interface")}</option>
        </select>
        <input
          data-testid="zhishu-tags-input"
          value={tags}
          onChange={(event) => onTagsChange(event.currentTarget.value)}
          placeholder={text("tags, separated, by commas")}
        />
        <button type="submit" data-testid="zhishu-capture-button" disabled={isSaving}>
          {isSaving ? text("Saving") : text("Capture")}
        </button>
      </form>
    </section>
  );
}
