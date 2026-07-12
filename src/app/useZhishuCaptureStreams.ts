import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { MemoryItem } from "../types";

type UseZhishuCaptureStreamsOptions = {
  loadMemory: () => Promise<unknown>;
  loadSynthesisPreview: () => Promise<unknown>;
  refreshProductionOverview: () => Promise<unknown>;
  setActivity: (message: string) => void;
};

function parseTags(tags: string) {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function useZhishuCaptureStreams({
  loadMemory,
  loadSynthesisPreview,
  refreshProductionOverview,
  setActivity,
}: UseZhishuCaptureStreamsOptions) {
  const [experienceDraft, setExperienceDraft] = useState("");
  const [experienceTags, setExperienceTags] = useState("");
  const [experienceType, setExperienceType] = useState("success");
  const [inspirationDraft, setInspirationDraft] = useState("");
  const [inspirationTags, setInspirationTags] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSavingExperience, setIsSavingExperience] = useState(false);

  async function captureInspiration() {
    const content = inspirationDraft.trim();

    if (!content) {
      setActivity("Capture a fragment first, then Synapse can place it into L0 memory.");
      return;
    }

    setIsCapturing(true);

    try {
      const item = await invoke<MemoryItem>("capture_inspiration", {
        content,
        tags: parseTags(inspirationTags),
      });
      await Promise.all([loadMemory(), loadSynthesisPreview(), refreshProductionOverview()]);
      setInspirationDraft("");
      setInspirationTags("");
      setActivity(`Captured inspiration into ${item.scope} as ${item.level} memory.`);
    } catch {
      setActivity("Inspiration could not be captured.");
    } finally {
      setIsCapturing(false);
    }
  }

  async function captureExperience() {
    const content = experienceDraft.trim();

    if (!content) {
      setActivity("Record the experience first, then Synapse can place it into L1 memory.");
      return;
    }

    setIsSavingExperience(true);

    try {
      const item = await invoke<MemoryItem>("capture_experience", {
        content,
        tags: parseTags(experienceTags),
        experienceType,
      });
      await Promise.all([loadMemory(), loadSynthesisPreview(), refreshProductionOverview()]);
      setExperienceDraft("");
      setExperienceTags("");
      setExperienceType("success");
      setActivity(`Captured ${item.item_type} into ${item.scope}.`);
    } catch {
      setActivity("Experience record could not be captured.");
    } finally {
      setIsSavingExperience(false);
    }
  }

  return {
    captureExperience,
    captureInspiration,
    experienceDraft,
    experienceTags,
    experienceType,
    inspirationDraft,
    inspirationTags,
    isCapturing,
    isSavingExperience,
    setExperienceDraft,
    setExperienceTags,
    setExperienceType,
    setInspirationDraft,
    setInspirationTags,
  };
}
