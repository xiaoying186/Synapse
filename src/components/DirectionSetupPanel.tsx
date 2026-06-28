type DirectionSetupPanelProps = {
  description: string;
  frequency: string;
  isSaving: boolean;
  keywords: string;
  onDescriptionChange: (value: string) => void;
  onFrequencyChange: (value: string) => void;
  onKeywordsChange: (value: string) => void;
  onOnlineEnabledChange: (value: boolean) => void;
  onOutputTemplateChange: (value: string) => void;
  onPriorityChange: (value: number) => void;
  onPushChannelToggle: (channel: string, checked: boolean) => void;
  onPushEnabledChange: (value: boolean) => void;
  onSave: () => void;
  onTitleChange: (value: string) => void;
  onlineEnabled: boolean;
  outputTemplate: string;
  priority: number;
  pushChannels: string[];
  pushEnabled: boolean;
  title: string;
};

const PUSH_CHANNELS = [
  { label: "Email", value: "email" },
  { label: "Feishu", value: "feishu" },
  { label: "WeChat", value: "wechat" },
];

export function DirectionSetupPanel({
  description,
  frequency,
  isSaving,
  keywords,
  onDescriptionChange,
  onFrequencyChange,
  onKeywordsChange,
  onOnlineEnabledChange,
  onOutputTemplateChange,
  onPriorityChange,
  onPushChannelToggle,
  onPushEnabledChange,
  onSave,
  onTitleChange,
  onlineEnabled,
  outputTemplate,
  priority,
  pushChannels,
  pushEnabled,
  title,
}: DirectionSetupPanelProps) {
  return (
    <section className="panel task-center-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Task Center</p>
          <h3>Direction setup</h3>
        </div>
      </div>
      <form
        className="direction-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <input
          value={title}
          onChange={(event) => onTitleChange(event.currentTarget.value)}
          placeholder="Direction name"
        />
        <input
          value={keywords}
          onChange={(event) => onKeywordsChange(event.currentTarget.value)}
          placeholder="keywords, separated, by commas"
        />
        <textarea
          value={description}
          onChange={(event) => onDescriptionChange(event.currentTarget.value)}
          placeholder="What should Synapse preferentially look for?"
        />
        <label className="direction-option">
          <span>Frequency</span>
          <select value={frequency} onChange={(event) => onFrequencyChange(event.currentTarget.value)}>
            <option value="manual">Manual</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="custom:6h">Every 6h</option>
            <option value="custom:12h">Every 12h</option>
            <option value="custom:2d">Every 2d</option>
          </select>
        </label>
        <label className="direction-option">
          <span>Template</span>
          <select value={outputTemplate} onChange={(event) => onOutputTemplateChange(event.currentTarget.value)}>
            <option value="auto">Auto</option>
            <option value="brief">Brief</option>
            <option value="report">Report</option>
            <option value="checklist">Checklist</option>
            <option value="opportunity">Opportunity brief</option>
          </select>
        </label>
        <label className="priority-control">
          <span>Priority</span>
          <input
            min={1}
            max={5}
            type="number"
            value={priority}
            onChange={(event) => onPriorityChange(Number(event.currentTarget.value))}
          />
        </label>
        <label className="online-toggle">
          <input
            checked={onlineEnabled}
            type="checkbox"
            onChange={(event) => onOnlineEnabledChange(event.currentTarget.checked)}
          />
          <span>Online</span>
        </label>
        <label className="online-toggle">
          <input
            checked={pushEnabled}
            type="checkbox"
            onChange={(event) => onPushEnabledChange(event.currentTarget.checked)}
          />
          <span>Push</span>
        </label>
        <div className="direction-option">
          <span>Channels</span>
          <div className="direction-channel-options">
            {PUSH_CHANNELS.map((channel) => (
              <label className="online-toggle" key={channel.value}>
                <input
                  checked={pushChannels.includes(channel.value)}
                  disabled={!pushEnabled}
                  type="checkbox"
                  onChange={(event) => onPushChannelToggle(channel.value, event.currentTarget.checked)}
                />
                <span>{channel.label}</span>
              </label>
            ))}
          </div>
        </div>
        <button type="submit" disabled={isSaving}>
          {isSaving ? "Saving" : "Save"}
        </button>
      </form>
    </section>
  );
}
