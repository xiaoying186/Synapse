import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { QuantArchiveReceipt, QuantResearchReport, StrategyConfig } from "../types";

type UseQuantLabOptions = {
  loadTaskArtifacts: () => Promise<unknown>;
  loadTaskRunRecords: () => Promise<unknown>;
  refreshProductionOverview: () => Promise<unknown>;
  setActivity: (message: string) => void;
};

export function useQuantLab({
  loadTaskArtifacts,
  loadTaskRunRecords,
  refreshProductionOverview,
  setActivity,
}: UseQuantLabOptions) {
  const [isArchivingQuant, setIsArchivingQuant] = useState(false);
  const [isResearchingQuant, setIsResearchingQuant] = useState(false);
  const [quantResearchReport, setQuantResearchReport] = useState<QuantResearchReport | null>(null);

  async function previewQuantResearch(csv: string, config: StrategyConfig) {
    setIsResearchingQuant(true);
    try {
      const report = await invoke<QuantResearchReport>("preview_quant_research", {
        csv,
        config,
      });
      setQuantResearchReport(report);
      setActivity(`Quant research completed with state ${report.state}.`);
    } catch {
      setActivity("Quant research input was rejected or could not be simulated.");
    } finally {
      setIsResearchingQuant(false);
    }
  }

  async function archiveQuantResearch(runId: string, csv: string, config: StrategyConfig) {
    setIsArchivingQuant(true);
    try {
      const receipt = await invoke<QuantArchiveReceipt>("archive_quant_research", {
        runId,
        csv,
        config,
      });
      setQuantResearchReport(receipt.report);
      await Promise.all([loadTaskRunRecords(), loadTaskArtifacts(), refreshProductionOverview()]);
      setActivity(`Quant research archived as ${receipt.artifact.reference_id}.`);
    } catch {
      setActivity("Quant research archival was blocked or failed.");
    } finally {
      setIsArchivingQuant(false);
    }
  }

  return {
    archiveQuantResearch,
    isArchivingQuant,
    isResearchingQuant,
    previewQuantResearch,
    quantResearchReport,
  };
}
