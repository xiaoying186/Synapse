import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  MemoryItem,
  MemoryRollbackReceipt,
  ProviderArtifactZhishuFinalReviewReceipt,
} from "../types";

type ReviewDecision = "accepted" | "rejected";

type UseZhishuAdmissionReviewOptions = {
  loadMemory: () => Promise<unknown>;
  loadSynthesisPreview: () => Promise<unknown>;
  loadTaskCandidates: () => Promise<unknown>;
  loadZhishuSnapshots: () => Promise<unknown>;
  memoryItems: MemoryItem[];
  refreshProductionOverview: () => Promise<unknown>;
  setActivity: (message: string) => void;
};

export function useZhishuAdmissionReview({
  loadMemory,
  loadSynthesisPreview,
  loadTaskCandidates,
  loadZhishuSnapshots,
  memoryItems,
  refreshProductionOverview,
  setActivity,
}: UseZhishuAdmissionReviewOptions) {
  const [providerArtifactZhishuFinalReviewReceipt, setProviderArtifactZhishuFinalReviewReceipt] =
    useState<ProviderArtifactZhishuFinalReviewReceipt | null>(null);
  const [reviewingMemoryItemId, setReviewingMemoryItemId] = useState<string | null>(null);
  const [rollingBackSnapshotId, setRollingBackSnapshotId] = useState<string | null>(null);

  async function reviewMemoryItem(memoryId: string, decision: ReviewDecision) {
    setReviewingMemoryItemId(memoryId);

    try {
      const currentItem = memoryItems.find((item) => item.id === memoryId);
      const isProviderArtifactCandidate =
        currentItem?.source === "provider-artifact-review" &&
        currentItem.level === "candidate" &&
        currentItem.admission_state === "candidate";
      let item: MemoryItem;
      if (isProviderArtifactCandidate) {
        const receipt = await invoke<ProviderArtifactZhishuFinalReviewReceipt>(
          "review_provider_artifact_zhishu_candidate",
          { memoryId, decision },
        );
        setProviderArtifactZhishuFinalReviewReceipt(receipt);
        item = receipt.memory_item;
      } else {
        item = await invoke<MemoryItem>("review_memory_item", {
          memoryId,
          decision,
        });
      }
      await Promise.all([
        loadMemory(),
        loadZhishuSnapshots(),
        loadTaskCandidates(),
        loadSynthesisPreview(),
        refreshProductionOverview(),
      ]);
      setActivity(`Memory item ${item.admission_state ?? item.verification}: ${item.item_type}.`);
    } catch {
      setActivity("Memory item could not be reviewed.");
    } finally {
      setReviewingMemoryItemId(null);
    }
  }

  async function rollbackZhishuSnapshot(snapshotId: string) {
    setRollingBackSnapshotId(snapshotId);

    try {
      const receipt = await invoke<MemoryRollbackReceipt>("rollback_zhishu_snapshot", {
        snapshotId,
      });
      await Promise.all([
        loadMemory(),
        loadZhishuSnapshots(),
        loadTaskCandidates(),
        loadSynthesisPreview(),
        refreshProductionOverview(),
      ]);
      setActivity(
        `Restored ${receipt.restored_item.item_type} from snapshot v${receipt.source_snapshot.version}.`,
      );
    } catch {
      setActivity("Zhishu restore point could not be restored safely.");
    } finally {
      setRollingBackSnapshotId(null);
    }
  }

  return {
    providerArtifactZhishuFinalReviewReceipt,
    reviewMemoryItem,
    reviewingMemoryItemId,
    rollbackZhishuSnapshot,
    rollingBackSnapshotId,
  };
}
