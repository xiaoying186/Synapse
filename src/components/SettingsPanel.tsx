import { useEffect, useState } from "react";
import type {
  RuntimeSettingsPreview,
  RuntimeSettingsUpdateReceipt,
  RuntimeSettingsUpdateRequest,
  SystemStatus,
} from "../types";
import { useI18n } from "../i18n";

type SettingsPanelProps = {
  status: SystemStatus | null;
  isLoadingRuntimeSettings: boolean;
  isSavingRuntimeSettings: boolean;
  onPreflightRuntimeSettings: (request: RuntimeSettingsUpdateRequest) => void;
  onSaveRuntimeSettings: (request: RuntimeSettingsUpdateRequest) => void;
  runtimeSettingsPreview: RuntimeSettingsPreview | null;
  runtimeSettingsReceipt: RuntimeSettingsUpdateReceipt | null;
};

const SAFETY_CAPABILITIES = [
  "agent-harness",
  "push-delivery",
  "real-network",
  "tool-execution",
  "scheduler-loop",
  "device-sync",
];

export function SettingsPanel({
  status,
  isLoadingRuntimeSettings,
  isSavingRuntimeSettings,
  onPreflightRuntimeSettings,
  onSaveRuntimeSettings,
  runtimeSettingsPreview,
  runtimeSettingsReceipt,
}: SettingsPanelProps) {
  const { t, text } = useI18n();
  const [draft, setDraft] = useState<RuntimeSettingsUpdateRequest | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const safetyCapabilities =
    status?.capabilities.filter((capability) => SAFETY_CAPABILITIES.includes(capability.name)) ??
    [];

  useEffect(() => {
    if (!runtimeSettingsPreview) {
      return;
    }
    setDraft({
      mode: runtimeSettingsPreview.mode,
      storage_data_dir: runtimeSettingsPreview.storage_data_dir,
      scheduler_background_loop_enabled: runtimeSettingsPreview.scheduler_background_loop_enabled,
      scheduler_poll_interval_seconds: runtimeSettingsPreview.scheduler_poll_interval_seconds,
      confirmed: false,
    });
    setConfirmed(false);
  }, [runtimeSettingsPreview]);

  return (
    <section className="panel settings-panel" data-testid="settings-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{text("Settings")}</p>
          <h3>{text("Runtime and safety gates")}</h3>
        </div>
        <strong>{text(status?.config_warnings.length ? "review-required" : "ready-local")}</strong>
      </div>

      <div className="settings-grid">
        <article>
          <span>{text("Mode")}</span>
          <strong>{status?.mode ?? text("Loading")}</strong>
          <small>{text("Execution level")}: {status?.execution_level ?? "..."}</small>
        </article>
        <article>
          <span>{text("Sandbox")}</span>
          <strong>{status?.sandbox ?? "..."}</strong>
          <small>{text("Step timeout")}: {status?.step_timeout_seconds ?? "..."}s</small>
        </article>
        <article>
          <span>{text("Step budget")}</span>
          <strong>{status?.max_steps ?? "..."}</strong>
          <small>{text("Failure strategy")}: {text(status?.failure_strategy ?? "...")}</small>
        </article>
        <article>
          <span>{t("settings.configSource")}</span>
          <strong>{status?.runtime_config_path ?? "..."}</strong>
          <small>{t("settings.readOnly")}</small>
        </article>
        <article>
          <span>{t("settings.dataRoot")}</span>
          <strong>{status?.storage_data_root ?? "..."}</strong>
          <small>{t("settings.readOnly")}</small>
        </article>
      </div>

      {status && status.config_warnings.length > 0 ? (
        <div className="warning-list">
          {status.config_warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : (
        <p className="empty-state">{text("Runtime config parsed without warnings.")}</p>
      )}

      <div className="source-gate-list">
        {safetyCapabilities.map((capability) => (
          <article className="source-gate-item" key={capability.name}>
            <div>
              <span>{text(capability.name)}</span>
              <strong>{text(capability.state)}</strong>
            </div>
            <small>{text(capability.detail)}</small>
          </article>
        ))}
      </div>

      {draft && runtimeSettingsPreview ? (
        <form
          className="settings-editor"
          onSubmit={(event) => {
            event.preventDefault();
            onPreflightRuntimeSettings(draft);
          }}
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{t("settings.editable.eyebrow")}</p>
              <h3>{t("settings.editable.title")}</h3>
            </div>
            <strong>{text(runtimeSettingsPreview.state)}</strong>
          </div>
          <div className="settings-grid">
            <label>
              <span>{t("settings.mode")}</span>
              <select
                value={draft.mode}
                onChange={(event) => setDraft({ ...draft, mode: event.currentTarget.value })}
              >
                <option value="lite">Lite</option>
                <option value="pro">Pro</option>
              </select>
            </label>
            <label>
              <span>{t("settings.storageDir")}</span>
              <input
                value={draft.storage_data_dir}
                placeholder="E:\\Synapse\\.synapse"
                onChange={(event) =>
                  setDraft({ ...draft, storage_data_dir: event.currentTarget.value })
                }
              />
            </label>
            <label>
              <span>{t("settings.schedulerInterval")}</span>
              <input
                type="number"
                min="1"
                max="86400"
                value={draft.scheduler_poll_interval_seconds}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    scheduler_poll_interval_seconds: Number(event.currentTarget.value),
                  })
                }
              />
            </label>
          </div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={draft.scheduler_background_loop_enabled}
              onChange={(event) =>
                setDraft({ ...draft, scheduler_background_loop_enabled: event.currentTarget.checked })
              }
            />
            <span>{t("settings.schedulerEnabled")}</span>
          </label>
          <p className="empty-state">{t("settings.restartRequired")}</p>
          <div className="policy-tiers">
            {runtimeSettingsPreview.blocked_fields.map((field) => (
              <span key={field}>{field}</span>
            ))}
          </div>
          <div className="settings-actions">
            <button
              type="submit"
              data-testid="runtime-settings-preview-button"
              disabled={isLoadingRuntimeSettings || isSavingRuntimeSettings}
            >
              {isLoadingRuntimeSettings ? t("settings.previewing") : t("settings.preview")}
            </button>
            <label className="settings-confirmation">
              <input
                type="checkbox"
                data-testid="runtime-settings-confirmation"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.currentTarget.checked)}
              />
              <span>{t("settings.confirm")}</span>
            </label>
            <button
              type="button"
              data-testid="runtime-settings-save-button"
              disabled={!confirmed || isSavingRuntimeSettings || isLoadingRuntimeSettings}
              onClick={() => onSaveRuntimeSettings({ ...draft, confirmed })}
            >
              {isSavingRuntimeSettings ? t("settings.saving") : t("settings.save")}
            </button>
          </div>
          {runtimeSettingsReceipt ? (
            <div className="retrieval-contract" data-testid="runtime-settings-save-receipt">
              <span>{text(runtimeSettingsReceipt.state)}</span>
              <strong>{t("settings.saved")}</strong>
              <small>{runtimeSettingsReceipt.backup_path}</small>
            </div>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
