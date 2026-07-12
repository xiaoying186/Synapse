import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  RuntimeSettingsPreview,
  RuntimeSettingsUpdateReceipt,
  RuntimeSettingsUpdateRequest,
} from "../types";

type UseRuntimeSettingsOptions = {
  loadSystemStatus: () => Promise<unknown>;
  setActivity: (message: string) => void;
};

export function useRuntimeSettings({ loadSystemStatus, setActivity }: UseRuntimeSettingsOptions) {
  const [isLoadingRuntimeSettings, setIsLoadingRuntimeSettings] = useState(false);
  const [isSavingRuntimeSettings, setIsSavingRuntimeSettings] = useState(false);
  const [runtimeSettingsPreview, setRuntimeSettingsPreview] =
    useState<RuntimeSettingsPreview | null>(null);
  const [runtimeSettingsReceipt, setRuntimeSettingsReceipt] =
    useState<RuntimeSettingsUpdateReceipt | null>(null);

  async function loadRuntimeSettings() {
    setIsLoadingRuntimeSettings(true);
    try {
      const preview = await invoke<RuntimeSettingsPreview>("preview_runtime_settings");
      setRuntimeSettingsPreview(preview);
      return preview;
    } catch {
      setRuntimeSettingsPreview(null);
      return null;
    } finally {
      setIsLoadingRuntimeSettings(false);
    }
  }

  async function preflightRuntimeSettings(request: RuntimeSettingsUpdateRequest) {
    setIsLoadingRuntimeSettings(true);
    try {
      const preview = await invoke<RuntimeSettingsPreview>("preflight_runtime_settings_update", {
        request: { ...request, confirmed: false },
      });
      setRuntimeSettingsPreview(preview);
      return preview;
    } catch {
      return null;
    } finally {
      setIsLoadingRuntimeSettings(false);
    }
  }

  async function saveRuntimeSettings(request: RuntimeSettingsUpdateRequest) {
    setIsSavingRuntimeSettings(true);
    try {
      const receipt = await invoke<RuntimeSettingsUpdateReceipt>("update_runtime_settings", {
        request: { ...request, confirmed: true },
      });
      setRuntimeSettingsReceipt(receipt);
      await Promise.all([loadRuntimeSettings(), loadSystemStatus()]);
      setActivity("Runtime settings were saved locally. Restart Synapse before they take effect.");
      return receipt;
    } catch {
      setRuntimeSettingsReceipt(null);
      setActivity("Runtime settings could not be saved. Review the low-risk settings fields.");
      return null;
    } finally {
      setIsSavingRuntimeSettings(false);
    }
  }

  return {
    isLoadingRuntimeSettings,
    isSavingRuntimeSettings,
    loadRuntimeSettings,
    preflightRuntimeSettings,
    runtimeSettingsPreview,
    runtimeSettingsReceipt,
    saveRuntimeSettings,
  };
}
