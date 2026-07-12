import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SourceEnablementPreflight, SourceEnablementReviewReceipt, SourceHealthCheckPreflight, SourceHealthCheckReceipt, SourceRegistryPreview } from "../types";

export function useSourceRegistryPreview() {
  const [sourceRegistryPreview, setSourceRegistryPreview] =
    useState<SourceRegistryPreview | null>(null);
  const [sourceEnablementPreflight, setSourceEnablementPreflight] =
    useState<SourceEnablementPreflight | null>(null);
  const [isLoadingSourceRegistry, setIsLoadingSourceRegistry] = useState(false);
  const [isPreflightingSourceEnablement, setIsPreflightingSourceEnablement] = useState(false);
  const [isReviewingSourceEnablement, setIsReviewingSourceEnablement] = useState(false);
  const [sourceEnablementReviewReceipt, setSourceEnablementReviewReceipt] =
    useState<SourceEnablementReviewReceipt | null>(null);
  const [sourceHealthCheckPreflight, setSourceHealthCheckPreflight] = useState<SourceHealthCheckPreflight | null>(null);
  const [sourceHealthCheckReceipt, setSourceHealthCheckReceipt] = useState<SourceHealthCheckReceipt | null>(null);
  const [isCheckingSourceHealth, setIsCheckingSourceHealth] = useState(false);

  async function loadSourceRegistryPreview() {
    setIsLoadingSourceRegistry(true);

    try {
      const preview = await invoke<SourceRegistryPreview>("preview_source_registry");
      setSourceRegistryPreview(preview);
      return preview;
    } catch {
      setSourceRegistryPreview(null);
      return null;
    } finally {
      setIsLoadingSourceRegistry(false);
    }
  }

  async function reviewSourceEnablement(sourceId: string, enabled: boolean) {
    setIsReviewingSourceEnablement(true);
    try {
      const receipt = await invoke<SourceEnablementReviewReceipt>("review_source_enablement", { sourceId, enabled });
      setSourceEnablementReviewReceipt(receipt);
      await loadSourceRegistryPreview();
      return receipt;
    } catch {
      setSourceEnablementReviewReceipt(null);
      return null;
    } finally {
      setIsReviewingSourceEnablement(false);
    }
  }

  async function preflightSourceEnablement(sourceId: string) {
    setIsPreflightingSourceEnablement(true);

    try {
      const preflight = await invoke<SourceEnablementPreflight>("preflight_source_enablement", {
        sourceId,
      });
      setSourceEnablementPreflight(preflight);
      return preflight;
    } catch {
      setSourceEnablementPreflight(null);
      return null;
    } finally {
      setIsPreflightingSourceEnablement(false);
    }
  }

  async function preflightSourceHealthCheck(sourceId: string) {
    setIsCheckingSourceHealth(true);
    try {
      const result = await invoke<SourceHealthCheckPreflight>("preflight_source_health_check", {
        request: { source_id: sourceId, approved: true },
      });
      setSourceHealthCheckPreflight(result);
      return result;
    } catch {
      setSourceHealthCheckPreflight(null);
      return null;
    } finally {
      setIsCheckingSourceHealth(false);
    }
  }

  async function executeSourceHealthCheck(sourceId: string) {
    setIsCheckingSourceHealth(true);
    try {
      const receipt = await invoke<SourceHealthCheckReceipt>("execute_source_health_check", {
        request: { source_id: sourceId, approved: true },
      });
      setSourceHealthCheckReceipt(receipt);
      return receipt;
    } catch {
      setSourceHealthCheckReceipt(null);
      return null;
    } finally {
      setIsCheckingSourceHealth(false);
    }
  }

  return {
    isLoadingSourceRegistry,
    isCheckingSourceHealth,
    isPreflightingSourceEnablement,
    isReviewingSourceEnablement,
    loadSourceRegistryPreview,
    preflightSourceEnablement,
    preflightSourceHealthCheck,
    executeSourceHealthCheck,
    reviewSourceEnablement,
    sourceEnablementPreflight,
    sourceEnablementReviewReceipt,
    sourceHealthCheckPreflight,
    sourceHealthCheckReceipt,
    sourceRegistryPreview,
  };
}
