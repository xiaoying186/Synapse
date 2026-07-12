import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  AggregationPreview,
  HttpSourceReceipt,
  SourceHealthReport,
  SourceImportReceipt,
  SourceObservationRecord,
} from "../types";

type UseSourceAggregationOptions = {
  setActivity: (message: string) => void;
};

export function useSourceAggregation({ setActivity }: UseSourceAggregationOptions) {
  const [aggregationOnlineEnabled, setAggregationOnlineEnabled] = useState(false);
  const [aggregationPreview, setAggregationPreview] = useState<AggregationPreview | null>(null);
  const [aggregationQuery, setAggregationQuery] = useState("");
  const [httpSourceReceipt, setHttpSourceReceipt] = useState<HttpSourceReceipt | null>(null);
  const [isFetchingHttpSource, setIsFetchingHttpSource] = useState(false);
  const [isImportingSources, setIsImportingSources] = useState(false);
  const [isLoadingSourceHealth, setIsLoadingSourceHealth] = useState(false);
  const [isPreviewingAggregation, setIsPreviewingAggregation] = useState(false);
  const [sourceHealthReport, setSourceHealthReport] = useState<SourceHealthReport | null>(null);
  const [sourceImportContent, setSourceImportContent] = useState("");
  const [sourceImportFormat, setSourceImportFormat] = useState("json");
  const [sourceImportReceipt, setSourceImportReceipt] = useState<SourceImportReceipt | null>(null);
  const [sourceObservationHistory, setSourceObservationHistory] = useState<SourceObservationRecord[]>([]);

  async function loadSourceObservationHistory() {
    try {
      const records = await invoke<SourceObservationRecord[]>("get_source_observation_history", {
        sourceId: null,
        limit: 30,
      });
      setSourceObservationHistory(records);
      return records;
    } catch {
      setSourceObservationHistory([]);
      return [];
    }
  }

  async function loadSourceHealthReport() {
    setIsLoadingSourceHealth(true);
    try {
      const report = await invoke<SourceHealthReport>("get_source_health_report", {
        limit: 200,
      });
      setSourceHealthReport(report);
      return report;
    } catch {
      setSourceHealthReport(null);
      return null;
    } finally {
      setIsLoadingSourceHealth(false);
    }
  }

  async function importSourceObservations() {
    setIsImportingSources(true);

    try {
      const receipt = await invoke<SourceImportReceipt>("import_source_observations", {
        format: sourceImportFormat,
        content: sourceImportContent,
      });
      setSourceImportReceipt(receipt);
      await loadSourceObservationHistory();
      await loadSourceHealthReport();
      setActivity(
        `Imported ${receipt.imported_count} quarantined source observation${
          receipt.imported_count === 1 ? "" : "s"
        }.`,
      );
    } catch {
      setActivity("Source observations could not be imported.");
    } finally {
      setIsImportingSources(false);
    }
  }

  async function fetchConfiguredHttpSource() {
    setIsFetchingHttpSource(true);

    try {
      const receipt = await invoke<HttpSourceReceipt>("fetch_configured_http_source");
      setHttpSourceReceipt(receipt);
      await loadSourceObservationHistory();
      await loadSourceHealthReport();
      setActivity(
        `Fetched ${receipt.observation.source_id} as quarantined read-only evidence.`,
      );
    } catch {
      setActivity("Configured HTTP source could not be fetched or is not enabled.");
    } finally {
      setIsFetchingHttpSource(false);
    }
  }

  async function previewAggregation() {
    const query = aggregationQuery.trim();

    if (!query) {
      setActivity("Enter a query before previewing information sources.");
      return;
    }

    setIsPreviewingAggregation(true);

    try {
      const preview = await invoke<AggregationPreview>("preview_information_aggregation", {
        query,
        onlineEnabled: aggregationOnlineEnabled,
      });
      setAggregationPreview(preview);
      await loadSourceObservationHistory();
      await loadSourceHealthReport();
      setActivity(`Information source preview: ${preview.retrieval_state}.`);
    } catch {
      setActivity("Information aggregation preview is unavailable.");
    } finally {
      setIsPreviewingAggregation(false);
    }
  }

  return {
    aggregationOnlineEnabled,
    aggregationPreview,
    aggregationQuery,
    fetchConfiguredHttpSource,
    httpSourceReceipt,
    importSourceObservations,
    isFetchingHttpSource,
    isImportingSources,
    isLoadingSourceHealth,
    isPreviewingAggregation,
    loadSourceHealthReport,
    loadSourceObservationHistory,
    previewAggregation,
    setAggregationOnlineEnabled,
    setAggregationQuery,
    setSourceImportContent,
    setSourceImportFormat,
    sourceHealthReport,
    sourceImportContent,
    sourceImportFormat,
    sourceImportReceipt,
    sourceObservationHistory,
  };
}
