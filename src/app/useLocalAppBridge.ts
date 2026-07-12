import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  LocalAppDescriptor,
  LocalAppAllowStateReceipt,
  LocalAppLaunchPreflight,
  LocalAppLaunchPreview,
  LocalAppLaunchReceipt,
  LocalAppLaunchRequest,
} from "../types";

type UseLocalAppBridgeOptions = {
  loadTaskArtifacts: () => Promise<unknown>;
  refreshProductionOverview: () => Promise<unknown>;
  setActivity: (message: string) => void;
};

export function useLocalAppBridge({
  loadTaskArtifacts,
  refreshProductionOverview,
  setActivity,
}: UseLocalAppBridgeOptions) {
  const [isExecutingLocalApp, setIsExecutingLocalApp] = useState(false);
  const [isPreflightingLocalApp, setIsPreflightingLocalApp] = useState(false);
  const [isPreviewingLocalApp, setIsPreviewingLocalApp] = useState(false);
  const [localAppLaunchPreflight, setLocalAppLaunchPreflight] =
    useState<LocalAppLaunchPreflight | null>(null);
  const [localAppLaunchPreview, setLocalAppLaunchPreview] =
    useState<LocalAppLaunchPreview | null>(null);
  const [localAppLaunchReceipt, setLocalAppLaunchReceipt] =
    useState<LocalAppLaunchReceipt | null>(null);
  const [localAppAllowStateReceipt, setLocalAppAllowStateReceipt] =
    useState<LocalAppAllowStateReceipt | null>(null);
  const [localApps, setLocalApps] = useState<LocalAppDescriptor[]>([]);
  const [updatingLocalAppId, setUpdatingLocalAppId] = useState<string | null>(null);

  async function loadLocalApps() {
    try {
      const records = await invoke<LocalAppDescriptor[]>("get_local_apps");
      setLocalApps(records);
      return records;
    } catch {
      setLocalApps([]);
      return [];
    }
  }

  async function setLocalAppAllowState(
    appId: string,
    allowState: "allowed" | "blocked",
  ) {
    setUpdatingLocalAppId(appId);
    try {
      const receipt = await invoke<LocalAppAllowStateReceipt>("set_local_app_allow_state", {
        appId,
        allowState,
      });
      setLocalApps(receipt.apps);
      setLocalAppAllowStateReceipt(receipt);
      setLocalAppLaunchPreview(null);
      setActivity(`Local application ${appId} marked ${allowState}.`);
    } catch {
      setActivity("Local application allow state could not be updated.");
    } finally {
      setUpdatingLocalAppId(null);
    }
  }

  async function previewLocalAppLaunch(request: LocalAppLaunchRequest) {
    setIsPreviewingLocalApp(true);
    try {
      const preview = await invoke<LocalAppLaunchPreview>("preview_local_app_launch", {
        request,
      });
      setLocalAppLaunchPreview(preview);
      setActivity(`Local app launch preview: ${preview.state}.`);
    } catch {
      setActivity("Local app launch preview was rejected.");
    } finally {
      setIsPreviewingLocalApp(false);
    }
  }

  async function preflightLocalAppLaunch(request: LocalAppLaunchRequest) {
    setIsPreflightingLocalApp(true);
    try {
      const preflight = await invoke<LocalAppLaunchPreflight>("preflight_local_app_launch", {
        request,
      });
      setLocalAppLaunchPreflight(preflight);
      setActivity(
        `Local app launch preflight: ${preflight.state}, ${preflight.blockers.length} blockers.`,
      );
    } catch {
      setActivity("Local app launch preflight was rejected.");
    } finally {
      setIsPreflightingLocalApp(false);
    }
  }

  async function executeLocalAppLaunch(request: LocalAppLaunchRequest) {
    if (
      !window.confirm(
        "Launch this approved local application without arguments or session-data access?",
      )
    ) {
      return;
    }
    setIsExecutingLocalApp(true);
    try {
      const receipt = await invoke<LocalAppLaunchReceipt>("execute_local_app_launch", {
        request,
        approved: true,
      });
      setLocalAppLaunchReceipt(receipt);
      await Promise.all([loadTaskArtifacts(), refreshProductionOverview()]);
      setActivity(`Local application launched as process ${receipt.process_id}.`);
    } catch {
      setActivity("Local application launch was blocked or failed.");
    } finally {
      setIsExecutingLocalApp(false);
    }
  }

  return {
    executeLocalAppLaunch,
    isExecutingLocalApp,
    isPreflightingLocalApp,
    isPreviewingLocalApp,
    loadLocalApps,
    localAppLaunchPreflight,
    localAppAllowStateReceipt,
    localAppLaunchPreview,
    localAppLaunchReceipt,
    localApps,
    preflightLocalAppLaunch,
    previewLocalAppLaunch,
    setLocalAppAllowState,
    updatingLocalAppId,
  };
}
