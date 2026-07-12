import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  DeviceSyncImportApplyPreflight,
  DeviceSyncImportPreview,
  DeviceSyncImportReceipt,
  DeviceSyncPackage,
  DeviceSyncState,
  RelayPreview,
} from "../types";

type UseDeviceSyncOptions = {
  loadMemory: () => Promise<unknown>;
  loadZhishuMaintenanceFindings: () => Promise<unknown>;
  loadZhishuRelations: () => Promise<unknown>;
  refreshProductionOverview: () => Promise<unknown>;
  setActivity: (message: string) => void;
  text: (value: string | null | undefined) => string;
};

export function useDeviceSync({
  loadMemory,
  loadZhishuMaintenanceFindings,
  loadZhishuRelations,
  refreshProductionOverview,
  setActivity,
  text,
}: UseDeviceSyncOptions) {
  const [deviceSyncState, setDeviceSyncState] = useState<DeviceSyncState | null>(null);
  const [deviceSyncPackage, setDeviceSyncPackage] = useState<DeviceSyncPackage | null>(null);
  const [deviceSyncPackageJson, setDeviceSyncPackageJson] = useState("");
  const [deviceSyncImportPreview, setDeviceSyncImportPreview] =
    useState<DeviceSyncImportPreview | null>(null);
  const [deviceSyncImportApplyPreflight, setDeviceSyncImportApplyPreflight] =
    useState<DeviceSyncImportApplyPreflight | null>(null);
  const [deviceSyncImportReceipt, setDeviceSyncImportReceipt] =
    useState<DeviceSyncImportReceipt | null>(null);
  const [relayPreview, setRelayPreview] = useState<RelayPreview | null>(null);
  const [isExportingDeviceSync, setIsExportingDeviceSync] = useState(false);
  const [isPreflightingDeviceSyncImport, setIsPreflightingDeviceSyncImport] = useState(false);
  const [isPreviewingDeviceSyncImport, setIsPreviewingDeviceSyncImport] = useState(false);
  const [isImportingDeviceSync, setIsImportingDeviceSync] = useState(false);

  async function loadDeviceSyncState() {
    try {
      const state = await invoke<DeviceSyncState>("get_device_sync_state");
      setDeviceSyncState(state);
      return state;
    } catch {
      setDeviceSyncState(null);
      return null;
    }
  }

  async function exportDeviceSyncPackage() {
    setIsExportingDeviceSync(true);
    try {
      const syncPackage = await invoke<DeviceSyncPackage>("export_device_sync_package");
      setDeviceSyncPackage(syncPackage);
      setDeviceSyncPackageJson(JSON.stringify(syncPackage, null, 2));
      await loadDeviceSyncState();
      setActivity("Device sync package exported locally.");
    } catch {
      setActivity("Device sync package could not be exported.");
    } finally {
      setIsExportingDeviceSync(false);
    }
  }

  async function previewDeviceSyncImport() {
    setIsPreviewingDeviceSyncImport(true);
    try {
      const preview = await invoke<DeviceSyncImportPreview>("preview_device_sync_import", {
        raw: deviceSyncPackageJson,
      });
      setDeviceSyncImportPreview(preview);
      setActivity(`Device sync import preview: ${preview.state}.`);
    } catch {
      setActivity("Device sync package preview was rejected.");
    } finally {
      setIsPreviewingDeviceSyncImport(false);
    }
  }

  async function preflightDeviceSyncImportApply() {
    const allowReplace = !!deviceSyncImportPreview?.requires_explicit_replace;
    setIsPreflightingDeviceSyncImport(true);
    try {
      const preflight = await invoke<DeviceSyncImportApplyPreflight>(
        "preflight_device_sync_import_apply",
        {
          raw: deviceSyncPackageJson,
          allowReplace,
        },
      );
      setDeviceSyncImportApplyPreflight(preflight);
      setActivity(
        `Device sync import apply preflight: ${preflight.state}, ${preflight.blockers.length} blockers.`,
      );
    } catch {
      setActivity("Device sync import apply preflight was rejected.");
    } finally {
      setIsPreflightingDeviceSyncImport(false);
    }
  }

  async function importDeviceSyncPackage() {
    const allowReplace = !!deviceSyncImportPreview?.requires_explicit_replace;
    if (
      allowReplace &&
      !window.confirm(text("This package will replace a non-empty local Zhishu repository. Continue?"))
    ) {
      return;
    }

    setIsImportingDeviceSync(true);
    try {
      const receipt = await invoke<DeviceSyncImportReceipt>("import_device_sync_package", {
        raw: deviceSyncPackageJson,
        allowReplace,
      });
      setDeviceSyncImportReceipt(receipt);
      setDeviceSyncState(receipt.state);
      await Promise.all([
        loadMemory(),
        loadZhishuRelations(),
        loadZhishuMaintenanceFindings(),
        refreshProductionOverview(),
      ]);
      setActivity(`Device sync import completed: ${receipt.preview.state}.`);
    } catch {
      setActivity("Device sync import was blocked or failed.");
    } finally {
      setIsImportingDeviceSync(false);
    }
  }

  async function previewSyncRelay() {
    try {
      const preview = await invoke<RelayPreview>("preview_sync_relay");
      setRelayPreview(preview);
      setActivity(`Sync relay dry-run: ${preview.state}; no network upload started.`);
    } catch {
      setActivity("Sync relay preview could not be created.");
    }
  }

  return {
    deviceSyncImportApplyPreflight,
    deviceSyncImportPreview,
    deviceSyncImportReceipt,
    deviceSyncPackage,
    deviceSyncPackageJson,
    deviceSyncState,
    exportDeviceSyncPackage,
    importDeviceSyncPackage,
    isExportingDeviceSync,
    isPreflightingDeviceSyncImport,
    isImportingDeviceSync,
    isPreviewingDeviceSyncImport,
    loadDeviceSyncState,
    preflightDeviceSyncImportApply,
    previewDeviceSyncImport,
    previewSyncRelay,
    relayPreview,
    setDeviceSyncPackageJson,
  };
}
