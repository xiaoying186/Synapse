import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  LibraryHomePreview,
  ProductionReadinessPreview,
  SagaRecoveryPreview,
  SagaRecoveryReviewReceipt,
} from "../types";

type UseProductionOverviewOptions = {
  loadAuditEvents: () => Promise<unknown>;
  setActivity: (message: string) => void;
};

export function useProductionOverview({
  loadAuditEvents,
  setActivity,
}: UseProductionOverviewOptions) {
  const [libraryHomePreview, setLibraryHomePreview] = useState<LibraryHomePreview | null>(null);
  const [productionReadinessPreview, setProductionReadinessPreview] =
    useState<ProductionReadinessPreview | null>(null);
  const [sagaRecoveryPreview, setSagaRecoveryPreview] = useState<SagaRecoveryPreview | null>(null);
  const [isRefreshingLibraryHome, setIsRefreshingLibraryHome] = useState(false);
  const [isRefreshingProductionReadiness, setIsRefreshingProductionReadiness] = useState(false);
  const [isRefreshingSagaRecovery, setIsRefreshingSagaRecovery] = useState(false);
  const [recordingSagaRecoveryId, setRecordingSagaRecoveryId] = useState<string | null>(null);

  async function loadLibraryHomePreview() {
    setIsRefreshingLibraryHome(true);
    try {
      const preview = await invoke<LibraryHomePreview>("preview_library_home");
      setLibraryHomePreview(preview);
      return preview;
    } catch {
      setLibraryHomePreview(null);
      return null;
    } finally {
      setIsRefreshingLibraryHome(false);
    }
  }

  async function loadProductionReadinessPreview() {
    setIsRefreshingProductionReadiness(true);
    try {
      const preview = await invoke<ProductionReadinessPreview>("preview_production_readiness");
      setProductionReadinessPreview(preview);
      return preview;
    } catch {
      setProductionReadinessPreview(null);
      return null;
    } finally {
      setIsRefreshingProductionReadiness(false);
    }
  }

  async function loadSagaRecoveryPreview() {
    setIsRefreshingSagaRecovery(true);
    try {
      const preview = await invoke<SagaRecoveryPreview>("preview_saga_recovery");
      setSagaRecoveryPreview(preview);
      return preview;
    } catch {
      setSagaRecoveryPreview(null);
      return null;
    } finally {
      setIsRefreshingSagaRecovery(false);
    }
  }

  async function refreshProductionOverview() {
    await Promise.all([
      loadLibraryHomePreview(),
      loadProductionReadinessPreview(),
      loadSagaRecoveryPreview(),
    ]);
  }

  async function recordSagaRecoveryReview(
    sagaId: string,
    decision: "reviewed" | "deferred" | "recovered-externally",
  ) {
    const note = window.prompt(
      `Record Saga recovery as ${decision}. Add a short note for the audit trail:`,
      "",
    );
    if (note === null) {
      return;
    }
    setRecordingSagaRecoveryId(sagaId);
    try {
      const receipt = await invoke<SagaRecoveryReviewReceipt>("record_saga_recovery_review", {
        request: {
          saga_id: sagaId,
          decision,
          note,
        },
      });
      await Promise.all([loadAuditEvents(), refreshProductionOverview()]);
      setActivity(
        receipt.state_changed
          ? `Saga recovery review recorded as ${receipt.decision}; saga marked ${receipt.saga.state}.`
          : `Saga recovery review recorded as ${receipt.decision}; saga state unchanged.`,
      );
    } catch {
      setActivity("Saga recovery review could not be recorded.");
    } finally {
      setRecordingSagaRecoveryId(null);
    }
  }

  return {
    isRefreshingLibraryHome,
    isRefreshingProductionReadiness,
    isRefreshingSagaRecovery,
    libraryHomePreview,
    loadLibraryHomePreview,
    loadProductionReadinessPreview,
    loadSagaRecoveryPreview,
    productionReadinessPreview,
    recordSagaRecoveryReview,
    recordingSagaRecoveryId,
    refreshProductionOverview,
    sagaRecoveryPreview,
  };
}
