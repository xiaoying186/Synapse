import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  AgentTeamExecutionReceipt,
  AgentTeamPreview,
  AgentTeamRealExecutionReceipt,
  AgentTeamRealExecutionPreflight,
  AgentTeamRealStagingReceipt,
  AgentTeamRequest,
} from "../types";

type UseAgentTeamOptions = {
  loadTaskArtifacts: () => Promise<unknown>;
  refreshProductionOverview: () => Promise<unknown>;
  setActivity: (message: string) => void;
  text: (value: string | null | undefined) => string;
};

export function useAgentTeam({
  loadTaskArtifacts,
  refreshProductionOverview,
  setActivity,
  text,
}: UseAgentTeamOptions) {
  const [agentTeamPreview, setAgentTeamPreview] = useState<AgentTeamPreview | null>(null);
  const [agentTeamReceipt, setAgentTeamReceipt] = useState<AgentTeamExecutionReceipt | null>(null);
  const [realAgentTeamPreflight, setRealAgentTeamPreflight] =
    useState<AgentTeamRealExecutionPreflight | null>(null);
  const [realAgentTeamStagingReceipt, setRealAgentTeamStagingReceipt] =
    useState<AgentTeamRealStagingReceipt | null>(null);
  const [realAgentTeamExecutionReceipt, setRealAgentTeamExecutionReceipt] =
    useState<AgentTeamRealExecutionReceipt | null>(null);
  const [isPreviewingAgentTeam, setIsPreviewingAgentTeam] = useState(false);
  const [isExecutingAgentTeam, setIsExecutingAgentTeam] = useState(false);
  const [isPreflightingRealAgentTeam, setIsPreflightingRealAgentTeam] = useState(false);
  const [isStagingRealAgentTeam, setIsStagingRealAgentTeam] = useState(false);
  const [isExecutingRealAgentTeam, setIsExecutingRealAgentTeam] = useState(false);
  const [isCancellingRealAgentTeam, setIsCancellingRealAgentTeam] = useState(false);

  async function previewAgentTeam(request: AgentTeamRequest) {
    setIsPreviewingAgentTeam(true);
    try {
      const preview = await invoke<AgentTeamPreview>("preview_agent_team", { request });
      setAgentTeamPreview(preview);
      setActivity(
        `Agent team ${preview.team_mode} graph: ${preview.estimated_agent_calls} bounded calls.`,
      );
    } catch {
      setActivity("Agent team preview was rejected.");
    } finally {
      setIsPreviewingAgentTeam(false);
    }
  }

  async function executeFakeAgentTeam(request: AgentTeamRequest) {
    if (!window.confirm(text("Execute this team with the local fake-agent harness and quarantine outputs?"))) {
      return;
    }
    setIsExecutingAgentTeam(true);
    try {
      const receipt = await invoke<AgentTeamExecutionReceipt>("execute_fake_agent_team", {
        request,
        approved: true,
      });
      setAgentTeamReceipt(receipt);
      await Promise.all([loadTaskArtifacts(), refreshProductionOverview()]);
      setActivity(`Fake Agent team receipt recorded as ${receipt.artifact.id}.`);
    } catch {
      setActivity("Fake Agent team execution was blocked or failed.");
    } finally {
      setIsExecutingAgentTeam(false);
    }
  }

  async function preflightRealAgentTeam(request: AgentTeamRequest) {
    setIsPreflightingRealAgentTeam(true);
    try {
      const preflight = await invoke<AgentTeamRealExecutionPreflight>("preflight_real_agent_team", {
        request,
      });
      setRealAgentTeamPreflight(preflight);
      setActivity(
        `Real Agent team preflight: ${preflight.state}; ${preflight.blocked_step_count} blocked steps.`,
      );
    } catch {
      setActivity("Real Agent team preflight was blocked or failed.");
    } finally {
      setIsPreflightingRealAgentTeam(false);
    }
  }

  async function stageRealAgentTeam(request: AgentTeamRequest) {
    if (!window.confirm(text("Record a real Agent team staging receipt without starting processes?"))) {
      return;
    }
    setIsStagingRealAgentTeam(true);
    try {
      const receipt = await invoke<AgentTeamRealStagingReceipt>("stage_real_agent_team", {
        request,
        approved: true,
      });
      setRealAgentTeamStagingReceipt(receipt);
      await Promise.all([loadTaskArtifacts(), refreshProductionOverview()]);
      setActivity(`Real Agent team staging receipt recorded as ${receipt.artifact.id}.`);
    } catch {
      setActivity("Real Agent team staging was blocked or failed.");
    } finally {
      setIsStagingRealAgentTeam(false);
    }
  }

  async function executeRealAgentTeam(request: AgentTeamRequest) {
    if (!window.confirm(text("Execute this real Agent team with guarded local processes?"))) {
      return;
    }
    setIsExecutingRealAgentTeam(true);
    try {
      const receipt = await invoke<AgentTeamRealExecutionReceipt>("execute_real_agent_team", {
        request,
        approved: true,
      });
      setRealAgentTeamExecutionReceipt(receipt);
      await Promise.all([loadTaskArtifacts(), refreshProductionOverview()]);
      setActivity(`Real Agent team execution receipt recorded as ${receipt.artifact.id}.`);
    } catch {
      setActivity("Real Agent team execution was blocked or failed.");
    } finally {
      setIsExecutingRealAgentTeam(false);
    }
  }

  async function cancelRealAgentTeam(runId: string) {
    setIsCancellingRealAgentTeam(true);
    try {
      const requested = await invoke<boolean>("cancel_real_agent_team", { runId });
      setActivity(requested ? "Real Agent team cancellation requested." : "No active real Agent team execution was found.");
    } catch {
      setActivity("Real Agent team cancellation request failed.");
    } finally {
      setIsCancellingRealAgentTeam(false);
    }
  }

  return {
    agentTeamPreview,
    agentTeamReceipt,
    executeFakeAgentTeam,
    cancelRealAgentTeam,
    executeRealAgentTeam,
    isExecutingAgentTeam,
    isExecutingRealAgentTeam,
    isCancellingRealAgentTeam,
    isPreflightingRealAgentTeam,
    isPreviewingAgentTeam,
    isStagingRealAgentTeam,
    preflightRealAgentTeam,
    previewAgentTeam,
    realAgentTeamPreflight,
    realAgentTeamExecutionReceipt,
    realAgentTeamStagingReceipt,
    stageRealAgentTeam,
  };
}
