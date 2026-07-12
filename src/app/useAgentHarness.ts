import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  AgentAdapterSmokeReport,
  AgentDryRunReceipt,
  AgentDryRunRequest,
  AgentExecutionReceipt,
  RealAgentExecutionPreflight,
} from "../types";

type UseAgentHarnessOptions = {
  loadExecutorContractPreview: () => Promise<unknown>;
  loadTaskArtifacts: () => Promise<unknown>;
  loadTaskRunRecords: () => Promise<unknown>;
  refreshProductionOverview: () => Promise<unknown>;
  setActivity: (message: string) => void;
};

export function useAgentHarness({
  loadExecutorContractPreview,
  loadTaskArtifacts,
  loadTaskRunRecords,
  refreshProductionOverview,
  setActivity,
}: UseAgentHarnessOptions) {
  const [agentAdapterSmokeReport, setAgentAdapterSmokeReport] =
    useState<AgentAdapterSmokeReport | null>(null);
  const [agentDryRunReceipt, setAgentDryRunReceipt] =
    useState<AgentDryRunReceipt | null>(null);
  const [agentExecutionReceipt, setAgentExecutionReceipt] =
    useState<AgentExecutionReceipt | null>(null);
  const [isExecutingCodexAgent, setIsExecutingCodexAgent] = useState(false);
  const [isPreflightingRealAgent, setIsPreflightingRealAgent] = useState(false);
  const [isRunningAgentHarness, setIsRunningAgentHarness] = useState(false);
  const [isSmokingAgentAdapters, setIsSmokingAgentAdapters] = useState(false);
  const [realAgentPreflight, setRealAgentPreflight] =
    useState<RealAgentExecutionPreflight | null>(null);

  async function dryRunAgentHarness(request: AgentDryRunRequest) {
    setIsRunningAgentHarness(true);
    try {
      const receipt = await invoke<AgentDryRunReceipt>("dry_run_agent_harness", {
        request,
      });
      setAgentDryRunReceipt(receipt);
      setActivity(
        `Agent Harness ${receipt.mode} preview: ${receipt.state}; no process was started.`,
      );
    } catch {
      setActivity("Agent Harness dry-run could not be created.");
    } finally {
      setIsRunningAgentHarness(false);
    }
  }

  async function executeCodexAgent(request: AgentDryRunRequest) {
    if (
      !window.confirm(
        "Run Codex CLI in ephemeral, read-only sandbox mode and quarantine its output?",
      )
    ) {
      return;
    }
    setIsExecutingCodexAgent(true);
    try {
      const receipt = await invoke<AgentExecutionReceipt>("execute_codex_agent", {
        request,
        approved: true,
      });
      setAgentExecutionReceipt(receipt);
      await Promise.all([
        loadTaskRunRecords(),
        loadTaskArtifacts(),
        loadExecutorContractPreview(),
        refreshProductionOverview(),
      ]);
      setActivity(`Codex execution completed; output quarantined as ${receipt.artifact.id}.`);
    } catch {
      setActivity("Codex execution was blocked, timed out, or failed.");
    } finally {
      setIsExecutingCodexAgent(false);
    }
  }

  async function smokeAgentAdapters() {
    setIsSmokingAgentAdapters(true);
    try {
      const report = await invoke<AgentAdapterSmokeReport>("smoke_agent_adapters");
      setAgentAdapterSmokeReport(report);
      setActivity(
        `Agent adapter smoke: ${report.detected_count}/${report.agent_count} detected; no process started.`,
      );
    } catch {
      setActivity("Agent adapter smoke check is unavailable.");
    } finally {
      setIsSmokingAgentAdapters(false);
    }
  }

  async function preflightRealAgentExecution(request: AgentDryRunRequest) {
    setIsPreflightingRealAgent(true);
    try {
      const report = await invoke<RealAgentExecutionPreflight>("preflight_real_agent_execution", {
        request,
      });
      setRealAgentPreflight(report);
      setAgentDryRunReceipt(report.dry_run);
      setActivity(
        `Real Agent preflight: ${report.state}; ${report.blockers.length} blocker(s); no process started.`,
      );
    } catch {
      setActivity("Real Agent execution preflight is unavailable.");
    } finally {
      setIsPreflightingRealAgent(false);
    }
  }

  return {
    agentAdapterSmokeReport,
    agentDryRunReceipt,
    agentExecutionReceipt,
    dryRunAgentHarness,
    executeCodexAgent,
    isExecutingCodexAgent,
    isPreflightingRealAgent,
    isRunningAgentHarness,
    isSmokingAgentAdapters,
    preflightRealAgentExecution,
    realAgentPreflight,
    smokeAgentAdapters,
  };
}
