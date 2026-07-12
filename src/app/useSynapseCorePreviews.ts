import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ExecutorContractPreview,
  MemoryItem,
  SynthesisPromotionReceipt,
  SynthesisPreview,
} from "../types";

type UseSynapseCorePreviewsOptions = {
  refreshProductionOverview: () => Promise<unknown>;
  setActivity: (message: string) => void;
};

export function useSynapseCorePreviews({
  refreshProductionOverview,
  setActivity,
}: UseSynapseCorePreviewsOptions) {
  const [executorContractPreview, setExecutorContractPreview] =
    useState<ExecutorContractPreview | null>(null);
  const [isLoadingExecutorContract, setIsLoadingExecutorContract] = useState(false);
  const [isLoadingSynthesis, setIsLoadingSynthesis] = useState(false);
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([]);
  const [promotingSynthesisCandidateId, setPromotingSynthesisCandidateId] = useState<
    string | null
  >(null);
  const [synthesisPreview, setSynthesisPreview] = useState<SynthesisPreview | null>(null);

  async function loadMemory() {
    try {
      const records = await invoke<MemoryItem[]>("get_recent_memory_items");
      setMemoryItems(records);
      return records;
    } catch {
      setMemoryItems([]);
      return [];
    }
  }

  function upsertMemoryItem(item: MemoryItem) {
    setMemoryItems((items) => [
      item,
      ...items.filter((existing) => existing.id !== item.id),
    ]);
  }

  async function loadExecutorContractPreview() {
    setIsLoadingExecutorContract(true);

    try {
      const preview = await invoke<ExecutorContractPreview>("preview_executor_contract");
      setExecutorContractPreview(preview);
      return preview;
    } catch {
      setExecutorContractPreview(null);
      return null;
    } finally {
      setIsLoadingExecutorContract(false);
    }
  }

  async function loadSynthesisPreview() {
    setIsLoadingSynthesis(true);

    try {
      const preview = await invoke<SynthesisPreview>("preview_synthesis");
      setSynthesisPreview(preview);
      return preview;
    } catch {
      setSynthesisPreview(null);
      return null;
    } finally {
      setIsLoadingSynthesis(false);
    }
  }

  async function promoteSynthesisCandidate(
    candidateId: string,
    candidateKind: "summary" | "association",
  ) {
    setPromotingSynthesisCandidateId(candidateId);

    try {
      const receipt = await invoke<SynthesisPromotionReceipt>("promote_synthesis_candidate", {
        candidateId,
        candidateKind,
      });
      await Promise.all([loadMemory(), loadSynthesisPreview(), refreshProductionOverview()]);
      setActivity(
        `Promoted ${receipt.candidate_kind} after ${receipt.admission_gate}; wrote ${receipt.promoted_memory_item.item_type} into ${receipt.promoted_memory_item.scope}.`,
      );
    } catch {
      setActivity("Synthesis candidate could not be promoted.");
    } finally {
      setPromotingSynthesisCandidateId(null);
    }
  }

  return {
    executorContractPreview,
    isLoadingExecutorContract,
    isLoadingSynthesis,
    loadExecutorContractPreview,
    loadMemory,
    loadSynthesisPreview,
    memoryItems,
    promoteSynthesisCandidate,
    promotingSynthesisCandidateId,
    synthesisPreview,
    upsertMemoryItem,
  };
}
