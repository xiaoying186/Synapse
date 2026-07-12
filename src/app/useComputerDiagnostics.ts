import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  CleanupDryRunPreview,
  CleanupMutationPreflight,
  ComputerDiagnosticArchiveReceipt,
  ComputerDiagnosticReport,
} from "../types";

type UseComputerDiagnosticsOptions = {
  loadTaskArtifacts: () => Promise<unknown>;
  loadTaskRunRecords: () => Promise<unknown>;
  refreshProductionOverview: () => Promise<unknown>;
  setActivity: (message: string) => void;
};

export function useComputerDiagnostics({
  loadTaskArtifacts,
  loadTaskRunRecords,
  refreshProductionOverview,
  setActivity,
}: UseComputerDiagnosticsOptions) {
  const [cleanupPreview, setCleanupPreview] = useState<CleanupDryRunPreview | null>(null);
  const [cleanupMutationPreflight, setCleanupMutationPreflight] =
    useState<CleanupMutationPreflight | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isPreflightingCleanupMutation, setIsPreflightingCleanupMutation] = useState(false);
  const [isPreviewingCleanup, setIsPreviewingCleanup] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [report, setReport] = useState<ComputerDiagnosticReport | null>(null);

  async function previewDiagnostics() {
    setIsPreviewing(true);
    try {
      const nextReport = await invoke<ComputerDiagnosticReport>("preview_computer_diagnostics");
      setReport(nextReport);
      setActivity(`Computer diagnostic completed: ${nextReport.overall_state}.`);
    } catch {
      setActivity("Computer diagnostics could not be completed.");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function archiveDiagnostics(runId: string) {
    setIsArchiving(true);
    try {
      const receipt = await invoke<ComputerDiagnosticArchiveReceipt>("archive_computer_diagnostics", {
        runId,
      });
      setReport(receipt.report);
      await Promise.all([loadTaskRunRecords(), loadTaskArtifacts(), refreshProductionOverview()]);
      setActivity(`Computer diagnostic archived as ${receipt.artifact.reference_id}.`);
    } catch {
      setActivity("Computer diagnostic archival was blocked or failed.");
    } finally {
      setIsArchiving(false);
    }
  }

  async function previewCleanup() {
    setIsPreviewingCleanup(true);
    try {
      const preview = await invoke<CleanupDryRunPreview>("preview_computer_cleanup");
      setCleanupPreview(preview);
      setActivity(
        `Computer cleanup dry-run: ${preview.candidate_count} candidates, ${preview.deleted_bytes} bytes deleted.`,
      );
    } catch {
      setActivity("Computer cleanup dry-run could not be completed.");
    } finally {
      setIsPreviewingCleanup(false);
    }
  }

  async function preflightCleanupMutation() {
    setIsPreflightingCleanupMutation(true);
    try {
      const preflight = await invoke<CleanupMutationPreflight>("preflight_computer_cleanup_mutation");
      setCleanupMutationPreflight(preflight);
      setActivity(
        `Computer cleanup mutation preflight: ${preflight.state}, ${preflight.blockers.length} blockers.`,
      );
    } catch {
      setActivity("Computer cleanup mutation preflight could not be completed.");
    } finally {
      setIsPreflightingCleanupMutation(false);
    }
  }

  return {
    archiveDiagnostics,
    cleanupMutationPreflight,
    cleanupPreview,
    isArchiving,
    isPreflightingCleanupMutation,
    isPreviewing,
    isPreviewingCleanup,
    preflightCleanupMutation,
    previewCleanup,
    previewDiagnostics,
    report,
  };
}
