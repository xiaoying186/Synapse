import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ProtectedSnapshotRollbackReceipt, SnapshotRecord } from "../types";

type UseProtectedSnapshotRollbackOptions = {
  loadArsenalPreview: () => Promise<unknown>;
  loadAuditEvents: () => Promise<unknown>;
  loadExecutorContractPreview: () => Promise<unknown>;
  loadProtectedSnapshots: () => Promise<unknown>;
  loadTaskDirections: () => Promise<unknown>;
  loadTaskSchedulePreviews: () => Promise<unknown>;
  refreshProductionOverview: () => Promise<unknown>;
  setActivity: (message: string) => void;
};

export function useTaihengProtectedSnapshots() {
  const [protectedSnapshots, setProtectedSnapshots] = useState<SnapshotRecord[]>([]);

  async function loadProtectedSnapshots() {
    try {
      const records = await invoke<SnapshotRecord[]>("get_object_snapshots", {
        objectType: null,
        objectId: null,
        limit: 12,
      });
      setProtectedSnapshots(records);
      return records;
    } catch {
      setProtectedSnapshots([]);
      return [];
    }
  }

  return {
    loadProtectedSnapshots,
    protectedSnapshots,
  };
}

export function useProtectedSnapshotRollback({
  loadArsenalPreview,
  loadAuditEvents,
  loadExecutorContractPreview,
  loadProtectedSnapshots,
  loadTaskDirections,
  loadTaskSchedulePreviews,
  refreshProductionOverview,
  setActivity,
}: UseProtectedSnapshotRollbackOptions) {
  const [rollingBackProtectedSnapshotId, setRollingBackProtectedSnapshotId] = useState<
    string | null
  >(null);

  async function rollbackProtectedSnapshot(snapshotId: string) {
    const approved = window.confirm(
      "Restore this protected snapshot? Current state will be protected first.",
    );
    if (!approved) {
      return;
    }
    setRollingBackProtectedSnapshotId(snapshotId);
    try {
      const receipt = await invoke<ProtectedSnapshotRollbackReceipt>(
        "rollback_protected_snapshot",
        { snapshotId },
      );
      await Promise.all([
        loadTaskDirections(),
        loadTaskSchedulePreviews(),
        loadExecutorContractPreview(),
        loadArsenalPreview(),
        loadProtectedSnapshots(),
        loadAuditEvents(),
        refreshProductionOverview(),
      ]);
      setActivity(
        `Restored ${receipt.object_type} ${receipt.object_id} to ${receipt.restored_state}.`,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setActivity(
        detail && detail !== "[object Object]"
          ? `Protected snapshot could not be restored: ${detail}`
          : "Protected snapshot could not be restored.",
      );
    } finally {
      setRollingBackProtectedSnapshotId(null);
    }
  }

  return {
    rollbackProtectedSnapshot,
    rollingBackProtectedSnapshotId,
  };
}
