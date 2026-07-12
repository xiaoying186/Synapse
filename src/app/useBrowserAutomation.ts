import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  BrowserInspectionPreview,
  BrowserInspectionReceipt,
  BrowserInspectionRequest,
  BrowserWriteActionStagingPreflight,
} from "../types";

type UseBrowserAutomationOptions = {
  loadExecutorContractPreview: () => Promise<unknown>;
  loadTaskArtifacts: () => Promise<unknown>;
  loadTaskRunRecords: () => Promise<unknown>;
  refreshProductionOverview: () => Promise<unknown>;
  setActivity: (message: string) => void;
};

export function useBrowserAutomation({
  loadExecutorContractPreview,
  loadTaskArtifacts,
  loadTaskRunRecords,
  refreshProductionOverview,
  setActivity,
}: UseBrowserAutomationOptions) {
  const [browserInspectionPreview, setBrowserInspectionPreview] =
    useState<BrowserInspectionPreview | null>(null);
  const [browserInspectionReceipt, setBrowserInspectionReceipt] =
    useState<BrowserInspectionReceipt | null>(null);
  const [browserWriteStagingPreflight, setBrowserWriteStagingPreflight] =
    useState<BrowserWriteActionStagingPreflight | null>(null);
  const [isPreviewingBrowserInspection, setIsPreviewingBrowserInspection] = useState(false);
  const [isPreflightingBrowserWriteStaging, setIsPreflightingBrowserWriteStaging] =
    useState(false);
  const [isExecutingBrowserInspection, setIsExecutingBrowserInspection] = useState(false);

  async function previewBrowserInspection(request: BrowserInspectionRequest) {
    setIsPreviewingBrowserInspection(true);
    try {
      const preview = await invoke<BrowserInspectionPreview>("preview_browser_inspection", {
        request,
      });
      setBrowserInspectionPreview(preview);
      setActivity(`Browser inspection preview: ${preview.state}.`);
    } catch {
      setActivity("Browser inspection preview was rejected.");
    } finally {
      setIsPreviewingBrowserInspection(false);
    }
  }

  async function preflightBrowserWriteStaging(request: BrowserInspectionRequest) {
    setIsPreflightingBrowserWriteStaging(true);
    try {
      const preflight = await invoke<BrowserWriteActionStagingPreflight>(
        "preflight_browser_write_action_staging",
        { request },
      );
      setBrowserWriteStagingPreflight(preflight);
      setActivity(
        `Browser write staging preflight: ${preflight.state}; no web mutation started.`,
      );
    } catch {
      setActivity("Browser write staging preflight was blocked or failed.");
    } finally {
      setIsPreflightingBrowserWriteStaging(false);
    }
  }

  async function executeBrowserInspection(request: BrowserInspectionRequest) {
    if (
      !window.confirm(
        "Open this allowlisted URL in a headless, read-only Playwright context and quarantine the result?",
      )
    ) {
      return;
    }
    setIsExecutingBrowserInspection(true);
    try {
      const receipt = await invoke<BrowserInspectionReceipt>("execute_browser_inspection", {
        request,
        approved: true,
      });
      setBrowserInspectionReceipt(receipt);
      await Promise.all([
        loadTaskRunRecords(),
        loadTaskArtifacts(),
        loadExecutorContractPreview(),
        refreshProductionOverview(),
      ]);
      setActivity(`Browser inspection quarantined as ${receipt.artifact.id}.`);
    } catch {
      setActivity("Browser inspection was blocked, timed out, or failed.");
    } finally {
      setIsExecutingBrowserInspection(false);
    }
  }

  return {
    browserInspectionPreview,
    browserInspectionReceipt,
    browserWriteStagingPreflight,
    executeBrowserInspection,
    isExecutingBrowserInspection,
    isPreflightingBrowserWriteStaging,
    isPreviewingBrowserInspection,
    preflightBrowserWriteStaging,
    previewBrowserInspection,
  };
}
