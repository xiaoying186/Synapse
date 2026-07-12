import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ContextBudgetPreview } from "../types";

type UseContextBudgetPreviewOptions = {
  setActivity: (message: string) => void;
};

export function useContextBudgetPreview({ setActivity }: UseContextBudgetPreviewOptions) {
  const [contextBudgetDraft, setContextBudgetDraft] = useState("");
  const [contextBudgetPreview, setContextBudgetPreview] =
    useState<ContextBudgetPreview | null>(null);
  const [isPreviewingContextBudget, setIsPreviewingContextBudget] = useState(false);

  async function previewContextBudget() {
    const snippets = contextBudgetDraft
      .split(/\n\s*\n/)
      .map((snippet) => snippet.trim())
      .filter(Boolean);
    if (snippets.length === 0) {
      setActivity("Paste at least one context snippet before previewing the budget.");
      return;
    }
    setIsPreviewingContextBudget(true);
    try {
      const preview = await invoke<ContextBudgetPreview>("preview_context_budget", {
        request: {
          task_kind: "manual-context-package",
          max_context_chars: 12000,
          preserve_evidence: true,
          items: snippets.map((content, index) => ({
            id: `snippet-${index + 1}`,
            source_type: "manual-note",
            title: `Snippet ${index + 1}`,
            content,
            evidence_refs: [`draft:${index + 1}`],
            risk_level: "medium",
          })),
        },
      });
      setContextBudgetPreview(preview);
      setActivity(`Context budget preview: ${preview.decision_state}.`);
    } catch {
      setActivity("Context budget preview was rejected.");
    } finally {
      setIsPreviewingContextBudget(false);
    }
  }

  return {
    contextBudgetDraft,
    contextBudgetPreview,
    isPreviewingContextBudget,
    previewContextBudget,
    setContextBudgetDraft,
  };
}
