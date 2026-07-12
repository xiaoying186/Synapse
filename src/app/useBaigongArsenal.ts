import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AdapterExecutionReceipt, ArsenalPreview } from "../types";

type UseBaigongArsenalOptions = {
  loadAuditEvents: () => Promise<unknown>;
  loadProtectedSnapshots: () => Promise<unknown>;
  loadTaskArtifacts: () => Promise<unknown>;
  refreshProductionOverview: () => Promise<unknown>;
  setActivity: (message: string) => void;
};

export function useBaigongArsenal({
  loadAuditEvents,
  loadProtectedSnapshots,
  loadTaskArtifacts,
  refreshProductionOverview,
  setActivity,
}: UseBaigongArsenalOptions) {
  const [arsenalPreview, setArsenalPreview] = useState<ArsenalPreview | null>(null);
  const [isLoadingArsenal, setIsLoadingArsenal] = useState(false);
  const [isRunningMockAdapter, setIsRunningMockAdapter] = useState(false);
  const [mockAdapterInput, setMockAdapterInput] = useState("");
  const [mockAdapterReceipt, setMockAdapterReceipt] =
    useState<AdapterExecutionReceipt | null>(null);
  const [mockAdapterRunId, setMockAdapterRunId] = useState("");
  const [updatingToolId, setUpdatingToolId] = useState<string | null>(null);

  async function loadArsenalPreview() {
    setIsLoadingArsenal(true);

    try {
      const preview = await invoke<ArsenalPreview>("preview_arsenal_registry");
      setArsenalPreview(preview);
      return preview;
    } catch {
      setArsenalPreview(null);
      return null;
    } finally {
      setIsLoadingArsenal(false);
    }
  }

  async function setToolAllowState(toolId: string, allowState: "allowed" | "blocked") {
    setUpdatingToolId(toolId);

    try {
      const preview = await invoke<ArsenalPreview>("set_arsenal_tool_allow_state", {
        toolId,
        allowState,
      });
      setArsenalPreview(preview);
      await Promise.all([loadProtectedSnapshots(), loadAuditEvents(), refreshProductionOverview()]);
      setActivity(`Arsenal tool ${toolId} marked ${allowState}; execution is still disabled.`);
    } catch {
      setActivity("Arsenal allowlist could not be updated.");
    } finally {
      setUpdatingToolId(null);
    }
  }

  async function runMockAdapter(approved: boolean) {
    setIsRunningMockAdapter(true);

    try {
      const command = approved ? "execute_mock_adapter" : "dry_run_mock_adapter";
      const receipt = await invoke<AdapterExecutionReceipt>(command, {
        runId: mockAdapterRunId,
        input: mockAdapterInput,
        ...(approved ? { approved: true } : {}),
      });
      setMockAdapterReceipt(receipt);
      if (receipt.artifact) {
        await Promise.all([loadTaskArtifacts(), refreshProductionOverview()]);
      }
      setActivity(
        `Mock adapter ${receipt.execution_mode} ${receipt.state}: ${receipt.output_summary}`,
      );
    } catch {
      setActivity(
        approved
          ? "Mock adapter execution was blocked or failed."
          : "Mock adapter dry-run could not be created.",
      );
    } finally {
      setIsRunningMockAdapter(false);
    }
  }

  return {
    arsenalPreview,
    isLoadingArsenal,
    isRunningMockAdapter,
    loadArsenalPreview,
    mockAdapterInput,
    mockAdapterReceipt,
    mockAdapterRunId,
    runMockAdapter,
    setMockAdapterInput,
    setMockAdapterRunId,
    setToolAllowState,
    updatingToolId,
  };
}
