import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AuditEventRecord, SnapshotRecord, SystemStatus } from "../types";

type UseTaihengRuntimeOptions = {
  setActivity: (message: string) => void;
};

export function useTaihengRuntime({ setActivity }: UseTaihengRuntimeOptions) {
  const [auditEvents, setAuditEvents] = useState<AuditEventRecord[]>([]);
  const [isRefreshingSecurityCenter, setIsRefreshingSecurityCenter] = useState(false);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [zhishuSnapshots, setZhishuSnapshots] = useState<SnapshotRecord[]>([]);

  async function loadSystemStatus() {
    try {
      const nextStatus = await invoke<SystemStatus>("get_system_status");
      setStatus(nextStatus);
      return nextStatus;
    } catch {
      setActivity("Kernel status is unavailable. Confirm the Tauri backend is running.");
      return null;
    }
  }

  async function loadAuditEvents() {
    try {
      const records = await invoke<AuditEventRecord[]>("get_audit_events", {
        targetType: null,
        targetId: null,
        limit: 24,
      });
      setAuditEvents(records);
      return records;
    } catch {
      setAuditEvents([]);
      return [];
    }
  }

  async function loadZhishuSnapshots() {
    try {
      const records = await invoke<SnapshotRecord[]>("get_object_snapshots", {
        objectType: "zhishu-item",
        objectId: null,
        limit: 8,
      });
      setZhishuSnapshots(records);
      return records;
    } catch {
      setZhishuSnapshots([]);
      return [];
    }
  }

  async function refreshSecurityCenter() {
    setIsRefreshingSecurityCenter(true);
    try {
      await Promise.all([loadSystemStatus(), loadAuditEvents(), loadZhishuSnapshots()]);
      setActivity("Security center refreshed.");
    } catch {
      setActivity("Security center refresh failed.");
    } finally {
      setIsRefreshingSecurityCenter(false);
    }
  }

  return {
    auditEvents,
    isRefreshingSecurityCenter,
    loadAuditEvents,
    loadSystemStatus,
    loadZhishuSnapshots,
    refreshSecurityCenter,
    status,
    zhishuSnapshots,
  };
}
