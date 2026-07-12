import { useI18n } from "../i18n";

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
  const { text } = useI18n();

  return (
    <section className="panel task-center-panel" data-testid="task-direction-setup">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Task Center")}</p>
          <h3>{text("Direction setup")}</h3>
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
          data-testid="direction-title-input"
          value={title}
          onChange={(event) => onTitleChange(event.currentTarget.value)}
          placeholder={text("Direction name")}
        />
        <input
          data-testid="direction-keywords-input"
          value={keywords}
          onChange={(event) => onKeywordsChange(event.currentTarget.value)}
          placeholder={text("keywords, separated, by commas")}
        />
        <textarea
          data-testid="direction-description-input"
          value={description}
          onChange={(event) => onDescriptionChange(event.currentTarget.value)}
          placeholder={text("What should Synapse preferentially look for?")}
        />
        <label className="direction-option">
          <span>{text("Frequency")}</span>
          <select
            data-testid="direction-frequency-select"
            value={frequency}
            onChange={(event) => onFrequencyChange(event.currentTarget.value)}
          >
            <option value="manual">{text("Manual")}</option>
            <option value="daily">{text("Daily")}</option>
            <option value="weekly">{text("Weekly")}</option>
            <option value="custom:6h">{text("Every 6h")}</option>
            <option value="custom:12h">{text("Every 12h")}</option>
            <option value="custom:2d">{text("Every 2d")}</option>
          </select>
        </label>
        <label className="direction-option">
          <span>{text("Template")}</span>
          <select value={outputTemplate} onChange={(event) => onOutputTemplateChange(event.currentTarget.value)}>
            <option value="auto">{text("Auto")}</option>
            <option value="brief">{text("Brief")}</option>
            <option value="report">{text("Report")}</option>
            <option value="checklist">{text("Checklist")}</option>
            <option value="opportunity">{text("Opportunity brief")}</option>
          </select>
        </label>
        <label className="priority-control">
          <span>{text("Priority")}</span>
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
          <span>{text("Online")}</span>
        </label>
        <label className="online-toggle">
          <input
            data-testid="direction-push-toggle"
            checked={pushEnabled}
            type="checkbox"
            onChange={(event) => onPushEnabledChange(event.currentTarget.checked)}
          />
          <span>{text("Push")}</span>
        </label>
        <div className="direction-option direction-channels">
          <span>{text("Channels")}</span>
          <div className="direction-channel-options">
            {PUSH_CHANNELS.map((channel) => (
              <label className="online-toggle" key={channel.value}>
                <input
                  data-testid={`direction-channel-${channel.value}`}
                  checked={pushChannels.includes(channel.value)}
                  disabled={!pushEnabled}
                  type="checkbox"
                  onChange={(event) => onPushChannelToggle(channel.value, event.currentTarget.checked)}
                />
                <span>{text(channel.label)}</span>
              </label>
            ))}
          </div>
        </div>
        <button type="submit" data-testid="save-direction-button" disabled={isSaving}>
          {isSaving ? text("Saving") : text("Save")}
        </button>
      </form>
    </section>
  );
}
