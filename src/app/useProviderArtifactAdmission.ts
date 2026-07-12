import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  MemoryItem,
  ProviderAdapterExecutionReceipt,
  ProviderArtifactAdmissionReviewReceipt,
  ProviderArtifactZhishuAdmissionPreflight,
  ProviderArtifactZhishuCandidateReceipt,
  ProviderReceiptAdmissionPreflight,
  ProviderReceiptAdmissionQueuePreview,
  ProviderReceiptReviewCandidate,
  ProviderReceiptReviewDecisionReceipt,
  ProviderReceiptReviewQueueReceipt,
  ProviderReceiptTaskArtifactPreflight,
  ProviderReceiptTaskArtifactReceipt,
} from "../types";

type UseProviderArtifactAdmissionOptions = {
  loadAuditEvents: () => Promise<unknown>;
  loadTaskArtifacts: () => Promise<unknown>;
  refreshProductionOverview: () => Promise<unknown>;
  setActivity: (message: string) => void;
  upsertMemoryItem: (item: MemoryItem) => void;
};

export function useProviderArtifactAdmission({
  loadAuditEvents,
  loadTaskArtifacts,
  refreshProductionOverview,
  setActivity,
  upsertMemoryItem,
}: UseProviderArtifactAdmissionOptions) {
  const [providerAdapterReceipt, setProviderAdapterReceipt] =
    useState<ProviderAdapterExecutionReceipt | null>(null);
  const [providerReceiptAdmissionPreflight, setProviderReceiptAdmissionPreflight] =
    useState<ProviderReceiptAdmissionPreflight | null>(null);
  const [providerReceiptAdmissionQueuePreview, setProviderReceiptAdmissionQueuePreview] =
    useState<ProviderReceiptAdmissionQueuePreview | null>(null);
  const [providerReceiptReviewQueueReceipt, setProviderReceiptReviewQueueReceipt] =
    useState<ProviderReceiptReviewQueueReceipt | null>(null);
  const [providerReceiptReviewDecisionReceipt, setProviderReceiptReviewDecisionReceipt] =
    useState<ProviderReceiptReviewDecisionReceipt | null>(null);
  const [providerReceiptTaskArtifactPreflight, setProviderReceiptTaskArtifactPreflight] =
    useState<ProviderReceiptTaskArtifactPreflight | null>(null);
  const [providerReceiptTaskArtifactReceipt, setProviderReceiptTaskArtifactReceipt] =
    useState<ProviderReceiptTaskArtifactReceipt | null>(null);
  const [providerArtifactZhishuAdmissionPreflight, setProviderArtifactZhishuAdmissionPreflight] =
    useState<ProviderArtifactZhishuAdmissionPreflight | null>(null);
  const [providerArtifactAdmissionReviewReceipt, setProviderArtifactAdmissionReviewReceipt] =
    useState<ProviderArtifactAdmissionReviewReceipt | null>(null);
  const [providerArtifactZhishuCandidateReceipt, setProviderArtifactZhishuCandidateReceipt] =
    useState<ProviderArtifactZhishuCandidateReceipt | null>(null);
  const [providerReceiptReviewCandidates, setProviderReceiptReviewCandidates] = useState<
    ProviderReceiptReviewCandidate[]
  >([]);
  const [isPreviewingProviderAdapterReceipt, setIsPreviewingProviderAdapterReceipt] = useState(false);
  const [isPreflightingProviderReceiptAdmission, setIsPreflightingProviderReceiptAdmission] =
    useState(false);
  const [isPreviewingProviderReceiptAdmissionQueue, setIsPreviewingProviderReceiptAdmissionQueue] =
    useState(false);
  const [isStagingProviderReceiptReviewCandidate, setIsStagingProviderReceiptReviewCandidate] =
    useState(false);
  const [reviewingProviderReceiptCandidateId, setReviewingProviderReceiptCandidateId] =
    useState<string | null>(null);
  const [preflightingProviderTaskArtifactCandidateId, setPreflightingProviderTaskArtifactCandidateId] =
    useState<string | null>(null);
  const [creatingProviderTaskArtifactCandidateId, setCreatingProviderTaskArtifactCandidateId] =
    useState<string | null>(null);
  const [preflightingProviderArtifactZhishuId, setPreflightingProviderArtifactZhishuId] =
    useState<string | null>(null);
  const [reviewingProviderArtifactZhishuId, setReviewingProviderArtifactZhishuId] =
    useState<string | null>(null);
  const [creatingProviderArtifactZhishuCandidateId, setCreatingProviderArtifactZhishuCandidateId] =
    useState<string | null>(null);

  async function previewProviderAdapterLoopbackReceipt() {
    setIsPreviewingProviderAdapterReceipt(true);

    try {
      const receipt = await invoke<ProviderAdapterExecutionReceipt>(
        "preview_provider_adapter_loopback_receipt",
      );
      setProviderAdapterReceipt(receipt);
      setActivity(`Provider adapter loopback receipt recorded for ${receipt.provider_id}.`);
    } catch {
      setActivity("Provider adapter loopback receipt could not be generated.");
    } finally {
      setIsPreviewingProviderAdapterReceipt(false);
    }
  }

  async function preflightProviderReceiptAdmission() {
    if (!providerAdapterReceipt) {
      setActivity("Generate a provider adapter receipt before admission preflight.");
      return;
    }

    setIsPreflightingProviderReceiptAdmission(true);
    try {
      const preflight = await invoke<ProviderReceiptAdmissionPreflight>(
        "preflight_provider_receipt_admission",
        { receipt: providerAdapterReceipt },
      );
      setProviderReceiptAdmissionPreflight(preflight);
      setActivity(`Provider receipt admission preflight: ${preflight.state}.`);
    } catch {
      setActivity("Provider receipt admission preflight could not be generated.");
    } finally {
      setIsPreflightingProviderReceiptAdmission(false);
    }
  }

  async function previewProviderReceiptAdmissionQueue() {
    if (!providerAdapterReceipt) {
      setActivity("Generate a provider adapter receipt before queue preview.");
      return;
    }

    setIsPreviewingProviderReceiptAdmissionQueue(true);
    try {
      const preview = await invoke<ProviderReceiptAdmissionQueuePreview>(
        "preview_provider_receipt_admission_queue",
        { receipt: providerAdapterReceipt },
      );
      setProviderReceiptAdmissionQueuePreview(preview);
      setActivity(`Provider receipt review queue preview: ${preview.state}.`);
    } catch {
      setActivity("Provider receipt review queue preview could not be generated.");
    } finally {
      setIsPreviewingProviderReceiptAdmissionQueue(false);
    }
  }

  async function loadProviderReceiptReviewCandidates() {
    try {
      const candidates = await invoke<ProviderReceiptReviewCandidate[]>(
        "get_provider_receipt_review_candidates",
        { limit: 20 },
      );
      setProviderReceiptReviewCandidates(candidates);
    } catch {
      setActivity("Provider receipt review candidates could not be loaded.");
    }
  }

  async function stageProviderReceiptReviewCandidate() {
    if (!providerAdapterReceipt) {
      setActivity("Generate a provider adapter receipt before staging review candidate.");
      return;
    }

    setIsStagingProviderReceiptReviewCandidate(true);
    try {
      const receipt = await invoke<ProviderReceiptReviewQueueReceipt>(
        "stage_provider_receipt_review_candidate",
        { receipt: providerAdapterReceipt },
      );
      setProviderReceiptReviewQueueReceipt(receipt);
      await loadProviderReceiptReviewCandidates();
      await loadAuditEvents();
      await refreshProductionOverview();
      setActivity(`Provider receipt review candidate staged: ${receipt.state}.`);
    } catch {
      setActivity("Provider receipt review candidate could not be staged.");
    } finally {
      setIsStagingProviderReceiptReviewCandidate(false);
    }
  }

  async function reviewProviderReceiptReviewCandidate(candidateId: string, decision: string) {
    setReviewingProviderReceiptCandidateId(candidateId);
    try {
      const receipt = await invoke<ProviderReceiptReviewDecisionReceipt>(
        "review_provider_receipt_review_candidate",
        { candidateId, decision },
      );
      setProviderReceiptReviewDecisionReceipt(receipt);
      await loadProviderReceiptReviewCandidates();
      await loadAuditEvents();
      await refreshProductionOverview();
      setActivity(`Provider receipt review decision recorded: ${receipt.state}.`);
    } catch {
      setActivity("Provider receipt review decision could not be recorded.");
    } finally {
      setReviewingProviderReceiptCandidateId(null);
    }
  }

  async function preflightProviderReceiptTaskArtifact(candidateId: string) {
    setPreflightingProviderTaskArtifactCandidateId(candidateId);
    try {
      const preflight = await invoke<ProviderReceiptTaskArtifactPreflight>(
        "preflight_provider_receipt_task_artifact",
        { candidateId },
      );
      setProviderReceiptTaskArtifactPreflight(preflight);
      setActivity(`Provider task artifact preflight: ${preflight.state}.`);
    } catch {
      setActivity("Provider task artifact preflight could not be generated.");
    } finally {
      setPreflightingProviderTaskArtifactCandidateId(null);
    }
  }

  async function createProviderReceiptTaskArtifact(candidateId: string) {
    setCreatingProviderTaskArtifactCandidateId(candidateId);
    try {
      const receipt = await invoke<ProviderReceiptTaskArtifactReceipt>(
        "create_provider_receipt_task_artifact",
        { candidateId },
      );
      setProviderReceiptTaskArtifactReceipt(receipt);
      await Promise.all([
        loadProviderReceiptReviewCandidates(),
        loadTaskArtifacts(),
        loadAuditEvents(),
        refreshProductionOverview(),
      ]);
      setActivity(`Provider task artifact staged: ${receipt.state}.`);
    } catch {
      setActivity("Provider task artifact could not be staged.");
    } finally {
      setCreatingProviderTaskArtifactCandidateId(null);
    }
  }

  async function preflightProviderArtifactZhishuAdmission(artifactId: string) {
    setPreflightingProviderArtifactZhishuId(artifactId);
    try {
      const preflight = await invoke<ProviderArtifactZhishuAdmissionPreflight>(
        "preflight_provider_artifact_zhishu_admission",
        { artifactId },
      );
      setProviderArtifactZhishuAdmissionPreflight(preflight);
      setActivity(`Provider artifact Zhishu admission preflight: ${preflight.state}.`);
    } catch {
      setActivity("Provider artifact Zhishu admission preflight could not be generated.");
    } finally {
      setPreflightingProviderArtifactZhishuId(null);
    }
  }

  async function reviewProviderArtifactZhishuAdmission(artifactId: string, decision: string) {
    setReviewingProviderArtifactZhishuId(artifactId);
    try {
      const receipt = await invoke<ProviderArtifactAdmissionReviewReceipt>(
        "review_provider_artifact_zhishu_admission",
        { artifactId, decision },
      );
      setProviderArtifactAdmissionReviewReceipt(receipt);
      setActivity(`Provider artifact Zhishu admission review: ${receipt.review.review_state}.`);
    } catch {
      setActivity("Provider artifact Zhishu admission review failed.");
    } finally {
      setReviewingProviderArtifactZhishuId(null);
    }
  }

  async function createProviderArtifactZhishuCandidate(artifactId: string) {
    setCreatingProviderArtifactZhishuCandidateId(artifactId);
    try {
      const receipt = await invoke<ProviderArtifactZhishuCandidateReceipt>(
        "create_provider_artifact_zhishu_candidate",
        { artifactId },
      );
      setProviderArtifactZhishuCandidateReceipt(receipt);
      upsertMemoryItem(receipt.memory_item);
      setActivity(`Provider artifact Zhishu candidate created: ${receipt.memory_item.id}.`);
    } catch {
      setActivity("Provider artifact Zhishu candidate could not be created.");
    } finally {
      setCreatingProviderArtifactZhishuCandidateId(null);
    }
  }

  return {
    createProviderArtifactZhishuCandidate,
    createProviderReceiptTaskArtifact,
    creatingProviderArtifactZhishuCandidateId,
    creatingProviderTaskArtifactCandidateId,
    isPreflightingProviderReceiptAdmission,
    isPreviewingProviderAdapterReceipt,
    isPreviewingProviderReceiptAdmissionQueue,
    isStagingProviderReceiptReviewCandidate,
    loadProviderReceiptReviewCandidates,
    preflightProviderArtifactZhishuAdmission,
    preflightProviderReceiptAdmission,
    preflightProviderReceiptTaskArtifact,
    preflightingProviderArtifactZhishuId,
    preflightingProviderTaskArtifactCandidateId,
    previewProviderAdapterLoopbackReceipt,
    previewProviderReceiptAdmissionQueue,
    providerAdapterReceipt,
    providerArtifactAdmissionReviewReceipt,
    providerArtifactZhishuAdmissionPreflight,
    providerArtifactZhishuCandidateReceipt,
    providerReceiptAdmissionPreflight,
    providerReceiptAdmissionQueuePreview,
    providerReceiptReviewCandidates,
    providerReceiptReviewDecisionReceipt,
    providerReceiptReviewQueueReceipt,
    providerReceiptTaskArtifactPreflight,
    providerReceiptTaskArtifactReceipt,
    reviewProviderArtifactZhishuAdmission,
    reviewProviderReceiptReviewCandidate,
    reviewingProviderArtifactZhishuId,
    reviewingProviderReceiptCandidateId,
    stageProviderReceiptReviewCandidate,
  };
}
