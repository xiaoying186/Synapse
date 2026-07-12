import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ArtifactPromotionReceipt,
  TaskArtifactRecord,
  TaskCandidate,
  TaskCandidateReview,
  TaskDirection,
  TaskRunExecutionReceipt,
  TaskRunRecord,
  TaskSchedulerTick,
  TaskSchedulePreview,
} from "../types";

type CandidateDecision = "accepted" | "rejected" | "deepen";
type RunStateAction = "cancel" | "archive";

type UseXingtaiTaskLoopOptions = {
  loadAuditEvents: () => Promise<unknown>;
  loadExecutorContractPreview: () => Promise<unknown>;
  loadMemory: () => Promise<unknown>;
  loadProtectedSnapshots: () => Promise<unknown>;
  loadSynthesisPreview: () => Promise<unknown>;
  loadZhishuSnapshots: () => Promise<unknown>;
  refreshProductionOverview: () => Promise<unknown>;
  setActivity: (message: string) => void;
};

export function useXingtaiTaskLoop({
  loadAuditEvents,
  loadExecutorContractPreview,
  loadMemory,
  loadProtectedSnapshots,
  loadSynthesisPreview,
  loadZhishuSnapshots,
  refreshProductionOverview,
  setActivity,
}: UseXingtaiTaskLoopOptions) {
  const [directionDescription, setDirectionDescription] = useState("");
  const [directionFrequency, setDirectionFrequency] = useState("manual");
  const [directionKeywords, setDirectionKeywords] = useState("");
  const [directionOnlineEnabled, setDirectionOnlineEnabled] = useState(false);
  const [directionOutputTemplate, setDirectionOutputTemplate] = useState("auto");
  const [directionPriority, setDirectionPriority] = useState(3);
  const [directionPushChannels, setDirectionPushChannels] = useState<string[]>(["email"]);
  const [directionPushEnabled, setDirectionPushEnabled] = useState(false);
  const [directionTitle, setDirectionTitle] = useState("");
  const [executingRunId, setExecutingRunId] = useState<string | null>(null);
  const [isMiningTasks, setIsMiningTasks] = useState(false);
  const [isSavingDirection, setIsSavingDirection] = useState(false);
  const [isTickingScheduler, setIsTickingScheduler] = useState(false);
  const [promotingArtifactId, setPromotingArtifactId] = useState<string | null>(null);
  const [requestingRunDirectionId, setRequestingRunDirectionId] = useState<string | null>(null);
  const [reviewingCandidateId, setReviewingCandidateId] = useState<string | null>(null);
  const [reviewingRunId, setReviewingRunId] = useState<string | null>(null);
  const [taskArtifacts, setTaskArtifacts] = useState<TaskArtifactRecord[]>([]);
  const [taskCandidates, setTaskCandidates] = useState<TaskCandidate[]>([]);
  const [taskDirections, setTaskDirections] = useState<TaskDirection[]>([]);
  const [taskRunRecords, setTaskRunRecords] = useState<TaskRunRecord[]>([]);
  const [taskSchedulePreviews, setTaskSchedulePreviews] = useState<TaskSchedulePreview[]>([]);
  const [updatingDirectionId, setUpdatingDirectionId] = useState<string | null>(null);
  const [updatingRunId, setUpdatingRunId] = useState<string | null>(null);

  async function loadTaskDirections() {
    try {
      const records = await invoke<TaskDirection[]>("get_task_directions");
      setTaskDirections(records);
      return records;
    } catch {
      setTaskDirections([]);
      return [];
    }
  }

  async function loadTaskSchedulePreviews() {
    try {
      const records = await invoke<TaskSchedulePreview[]>("get_task_schedule_previews");
      setTaskSchedulePreviews(records);
      return records;
    } catch {
      setTaskSchedulePreviews([]);
      return [];
    }
  }

  async function loadTaskCandidates() {
    try {
      const records = await invoke<TaskCandidate[]>("get_task_candidates");
      setTaskCandidates(records);
      return records;
    } catch {
      setTaskCandidates([]);
      return [];
    }
  }

  async function loadTaskRunRecords() {
    try {
      const records = await invoke<TaskRunRecord[]>("get_task_run_records");
      setTaskRunRecords(records);
      return records;
    } catch {
      setTaskRunRecords([]);
      return [];
    }
  }

  async function loadTaskArtifacts() {
    try {
      const records = await invoke<TaskArtifactRecord[]>("get_task_artifacts", {
        runId: null,
        limit: 50,
      });
      setTaskArtifacts(records);
      return records;
    } catch {
      setTaskArtifacts([]);
      return [];
    }
  }

  function toggleDirectionPushChannel(channel: string, checked: boolean) {
    setDirectionPushChannels((channels) => {
      if (checked) {
        return channels.includes(channel) ? channels : [...channels, channel];
      }
      return channels.filter((item) => item !== channel);
    });
  }

  async function saveTaskDirection() {
    const title = directionTitle.trim();

    if (!title) {
      setActivity("Name a task direction before saving it.");
      return;
    }

    const keywords = directionKeywords
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean);

    if (directionPushEnabled && directionPushChannels.length === 0) {
      setActivity("Choose at least one push channel before saving this direction.");
      return;
    }

    setIsSavingDirection(true);

    try {
      const direction = await invoke<TaskDirection>("save_task_direction", {
        title,
        description: directionDescription,
        priority: directionPriority,
        keywords,
        scheduleFrequency: directionFrequency,
        onlineEnabled: directionOnlineEnabled,
        pushEnabled: directionPushEnabled,
        pushChannels: directionPushEnabled ? directionPushChannels : [],
        outputTemplate: directionOutputTemplate,
      });
      await loadTaskDirections();
      await loadTaskSchedulePreviews();
      setDirectionTitle("");
      setDirectionDescription("");
      setDirectionKeywords("");
      setDirectionPriority(3);
      setDirectionFrequency("manual");
      setDirectionOnlineEnabled(false);
      setDirectionPushEnabled(false);
      setDirectionPushChannels(["email"]);
      setDirectionOutputTemplate("auto");
      setActivity(`Task direction saved: ${direction.title}.`);
    } catch {
      setActivity("Task direction could not be saved.");
    } finally {
      setIsSavingDirection(false);
    }
  }

  async function generateTaskCandidates() {
    setIsMiningTasks(true);

    try {
      const candidates = await invoke<TaskCandidate[]>("generate_task_candidates");
      await loadTaskCandidates();
      await loadSynthesisPreview();
      setActivity(
        `Generated ${candidates.length} task candidate${candidates.length === 1 ? "" : "s"}.`,
      );
    } catch {
      setActivity("Task candidates could not be generated.");
    } finally {
      setIsMiningTasks(false);
    }
  }

  async function setTaskDirectionActive(directionId: string, active: boolean) {
    setUpdatingDirectionId(directionId);

    try {
      const direction = await invoke<TaskDirection>("set_task_direction_active", {
        directionId,
        active,
      });
      await loadTaskDirections();
      await loadTaskSchedulePreviews();
      await Promise.all([
        loadExecutorContractPreview(),
        loadProtectedSnapshots(),
        loadAuditEvents(),
        refreshProductionOverview(),
      ]);
      setActivity(`Task direction ${direction.active ? "enabled" : "disabled"}: ${direction.title}.`);
    } catch {
      setActivity("Task direction active state could not be updated.");
    } finally {
      setUpdatingDirectionId(null);
    }
  }

  async function requestTaskRun(directionId: string) {
    setRequestingRunDirectionId(directionId);

    try {
      const record = await invoke<TaskRunRecord>("request_task_run", { directionId });
      await loadTaskRunRecords();
      await loadExecutorContractPreview();
      setActivity(
        `Task run ready in review queue for ${record.task_direction_title}: ${record.approval_state}.`,
      );
    } catch {
      setActivity("Task run request could not be recorded.");
    } finally {
      setRequestingRunDirectionId(null);
    }
  }

  async function reviewTaskRun(runId: string, approved: boolean) {
    setReviewingRunId(runId);

    try {
      const record = await invoke<TaskRunRecord>("review_task_run", { runId, approved });
      await loadTaskRunRecords();
      await loadExecutorContractPreview();
      setActivity(`Task run ${record.approval_state}: ${record.execution_state}.`);
    } catch {
      setActivity("Task run review could not be saved.");
    } finally {
      setReviewingRunId(null);
    }
  }

  async function runSchedulerTick() {
    setIsTickingScheduler(true);

    try {
      const tick = await invoke<TaskSchedulerTick>("task_scheduler_tick");
      await loadTaskRunRecords();
      await loadTaskSchedulePreviews();
      await loadExecutorContractPreview();
      const pushRunCount = tick.created_runs.filter((run) => run.push_enabled).length;
      setActivity(
        `Scheduler tick recorded ${tick.created_run_count} run${tick.created_run_count === 1 ? "" : "s"} and skipped ${tick.skipped_run_count}.${pushRunCount > 0 ? ` ${pushRunCount} push-gated.` : ""}`,
      );
    } catch {
      setActivity("Task scheduler tick could not be recorded.");
    } finally {
      setIsTickingScheduler(false);
    }
  }

  async function executeTaskRun(runId: string) {
    setExecutingRunId(runId);

    try {
      const receipt = await invoke<TaskRunExecutionReceipt>("execute_task_run", { runId });
      await loadTaskRunRecords();
      await Promise.all([
        loadTaskCandidates(),
        loadTaskArtifacts(),
        loadExecutorContractPreview(),
        loadSynthesisPreview(),
        refreshProductionOverview(),
      ]);
      const actionLabel =
        receipt.run.trigger_kind === "candidate-deepen" ? "Local deepening" : "Local executor";
      setActivity(
        `${actionLabel} ${receipt.run.execution_state}: ${receipt.generated_candidates.length} candidate${receipt.generated_candidates.length === 1 ? "" : "s"}.`,
      );
    } catch {
      await loadTaskRunRecords();
      await loadExecutorContractPreview();
      setActivity("Task run could not be executed locally.");
    } finally {
      setExecutingRunId(null);
    }
  }

  async function updateTaskRunState(runId: string, action: RunStateAction) {
    setUpdatingRunId(runId);

    try {
      const command = action === "cancel" ? "cancel_task_run" : "archive_task_run";
      const run = await invoke<TaskRunRecord>(command, { runId });
      await loadTaskRunRecords();
      await loadTaskSchedulePreviews();
      await loadExecutorContractPreview();
      setActivity(`Task run ${run.lifecycle_state ?? run.execution_state}.`);
    } catch {
      setActivity(`Task run could not be ${action === "cancel" ? "cancelled" : "archived"}.`);
    } finally {
      setUpdatingRunId(null);
    }
  }

  async function promoteTaskArtifact(artifactId: string) {
    setPromotingArtifactId(artifactId);
    try {
      const receipt = await invoke<ArtifactPromotionReceipt>("promote_task_artifact_to_zhishu", {
        artifactId,
        itemKind: "knowledge",
      });
      await Promise.all([
        loadMemory(),
        loadTaskArtifacts(),
        loadAuditEvents(),
        loadZhishuSnapshots(),
        loadProtectedSnapshots(),
        refreshProductionOverview(),
      ]);
      setActivity(
        `Promoted ${receipt.artifact.reference_id} into Zhishu candidate ${receipt.memory_item.id}.`,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setActivity(
        detail && detail !== "[object Object]"
          ? `Task artifact could not be promoted into Zhishu: ${detail}`
          : "Task artifact could not be promoted into Zhishu.",
      );
    } finally {
      setPromotingArtifactId(null);
    }
  }

  async function reviewTaskCandidate(candidateId: string, decision: CandidateDecision) {
    setReviewingCandidateId(candidateId);

    try {
      const review = await invoke<TaskCandidateReview>("review_task_candidate", {
        candidateId,
        decision,
      });
      await loadTaskCandidates();
      if (review.follow_up_run) {
        await loadTaskRunRecords();
        await loadExecutorContractPreview();
      }
      if (review.promoted_memory_item) {
        await Promise.all([loadMemory(), refreshProductionOverview()]);
      }
      await loadSynthesisPreview();
      setActivity(
        review.follow_up_run
          ? `Task candidate ${review.candidate.status}; follow-up run is waiting for approval.`
          : `Task candidate ${review.candidate.status}.`,
      );
    } catch {
      setActivity("Task candidate review could not be saved.");
    } finally {
      setReviewingCandidateId(null);
    }
  }

  return {
    directionDescription,
    directionFrequency,
    directionKeywords,
    directionOnlineEnabled,
    directionOutputTemplate,
    directionPriority,
    directionPushChannels,
    directionPushEnabled,
    directionTitle,
    executeTaskRun,
    executingRunId,
    generateTaskCandidates,
    isMiningTasks,
    isSavingDirection,
    isTickingScheduler,
    loadTaskArtifacts,
    loadTaskCandidates,
    loadTaskDirections,
    loadTaskRunRecords,
    loadTaskSchedulePreviews,
    promoteTaskArtifact,
    promotingArtifactId,
    requestTaskRun,
    requestingRunDirectionId,
    reviewTaskCandidate,
    reviewTaskRun,
    reviewingCandidateId,
    reviewingRunId,
    runSchedulerTick,
    saveTaskDirection,
    setDirectionDescription,
    setDirectionFrequency,
    setDirectionKeywords,
    setDirectionOnlineEnabled,
    setDirectionOutputTemplate,
    setDirectionPriority,
    setDirectionPushEnabled,
    setDirectionTitle,
    setTaskDirectionActive,
    taskArtifacts,
    taskCandidates,
    taskDirections,
    taskRunRecords,
    taskSchedulePreviews,
    toggleDirectionPushChannel,
    updateTaskRunState,
    updatingDirectionId,
    updatingRunId,
  };
}
