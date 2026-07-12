import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ExecutionRecord, PlanPreview, PlanRecord, ReviewReceipt } from "../types";

type PlanHistorySelection = {
  executionRecord: ExecutionRecord | null;
  plan: PlanPreview;
  planId: string;
  reviewReceipt: ReviewReceipt | null;
};

type UsePlanWorkflowOptions = {
  setActivity: (message: string) => void;
};

export function usePlanWorkflow({ setActivity }: UsePlanWorkflowOptions) {
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [executionRecord, setExecutionRecord] = useState<ExecutionRecord | null>(null);
  const [history, setHistory] = useState<PlanRecord[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [plan, setPlan] = useState<PlanPreview | null>(null);
  const [reviewReceipt, setReviewReceipt] = useState<ReviewReceipt | null>(null);

  async function loadHistory(restoreLatest = false) {
    try {
      const records = await invoke<PlanRecord[]>("get_recent_plans");
      setHistory(records);

      if (restoreLatest && records[0]) {
        setPlan(records[0].preview);
        setActivePlanId(records[0].id);
        setReviewReceipt(records[0].review_receipt ?? null);
        setExecutionRecord(records[0].execution_record ?? null);
        setActivity(`Restored ${records.length} saved plan${records.length === 1 ? "" : "s"}.`);
      }

      return records;
    } catch {
      setHistory([]);
      return [];
    }
  }

  async function submitIntent() {
    const intent = draft.trim();

    if (!intent) {
      setActivity("Write a goal first, then Synapse can turn it into an executable plan.");
      return;
    }

    setIsSubmitting(true);

    try {
      const preview = await invoke<PlanPreview>("submit_intent", { intent });
      setPlan(preview);
      setReviewReceipt(null);
      setExecutionRecord(null);
      const records = await loadHistory();
      setActivePlanId(records[0]?.id ?? null);
      setActivity(`Materialized ${preview.steps.length} executable steps with ${preview.risk} risk.`);
      setDraft("");
    } catch {
      setActivity("Plan materialization failed. Confirm the Tauri backend command is available.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function clearHistory() {
    try {
      await invoke("clear_plan_history");
      setHistory([]);
      setPlan(null);
      setActivePlanId(null);
      setReviewReceipt(null);
      setExecutionRecord(null);
      setActivity("Saved plan history cleared.");
    } catch {
      setActivity("Plan history could not be cleared.");
    }
  }

  async function reviewCurrentPlan(approved: boolean) {
    if (!plan) {
      return;
    }

    setIsReviewing(true);

    try {
      const receipt = await invoke<ReviewReceipt>("review_plan", {
        preview: plan,
        approved,
        planId: activePlanId,
      });
      setReviewReceipt(receipt);
      const records = await loadHistory();
      const activeRecord = records.find((record) => record.id === activePlanId);
      setExecutionRecord(activeRecord?.execution_record ?? null);
      setActivity(`${receipt.decision}: ${receipt.execution_state}.`);
    } catch {
      setActivity("Audit review could not be recorded.");
    } finally {
      setIsReviewing(false);
    }
  }

  function selectHistory(selection: PlanHistorySelection) {
    setPlan(selection.plan);
    setActivePlanId(selection.planId);
    setReviewReceipt(selection.reviewReceipt);
    setExecutionRecord(selection.executionRecord);
  }

  return {
    activePlanId,
    clearHistory,
    draft,
    executionRecord,
    history,
    isReviewing,
    isSubmitting,
    loadHistory,
    plan,
    reviewCurrentPlan,
    reviewReceipt,
    selectHistory,
    setDraft,
    submitIntent,
  };
}
