type InspirationPanelProps = {
  draft: string;
  isCapturing: boolean;
  onCapture: () => void;
  onDraftChange: (value: string) => void;
  onTagsChange: (value: string) => void;
  tags: string;
};

export function InspirationPanel({
  draft,
  isCapturing,
  onCapture,
  onDraftChange,
  onTagsChange,
  tags,
}: InspirationPanelProps) {
  return (
    <section className="panel inspiration-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">L0 Memory</p>
          <h3>Inspiration capture</h3>
        </div>
      </div>
      <form
        className="inspiration-form"
        onSubmit={(event) => {
          event.preventDefault();
          onCapture();
        }}
      >
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.currentTarget.value)}
          placeholder="Drop a raw idea, pattern, question, or monetization hint"
        />
        <input
          value={tags}
          onChange={(event) => onTagsChange(event.currentTarget.value)}
          placeholder="tags, separated, by commas"
        />
        <button type="submit" disabled={isCapturing}>
          {isCapturing ? "Saving" : "Capture"}
        </button>
      </form>
    </section>
  );
}
