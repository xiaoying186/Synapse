import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  DailyBriefingArchiveReceipt,
  DailyBriefingDeliveryReview,
  DailyBriefingLiveSourceStagingPreflight,
  DailyBriefingLiveSourceReceipt,
  DailyBriefingPreview,
  DailyBriefingScheduledArchiveReview,
  DailyBriefingTemplate,
} from "../types";

type UseDailyBriefingOptions = {
  loadTaskArtifacts: () => Promise<unknown>;
  loadTaskRunRecords: () => Promise<unknown>;
  refreshProductionOverview: () => Promise<unknown>;
  setActivity: (message: string) => void;
  text: (value: string | null | undefined) => string;
};

export function useDailyBriefing({
  loadTaskArtifacts,
  loadTaskRunRecords,
  refreshProductionOverview,
  setActivity,
  text,
}: UseDailyBriefingOptions) {
  const [dailyBriefingPreview, setDailyBriefingPreview] =
    useState<DailyBriefingPreview | null>(null);
  const [dailyBriefingArchiveReceipt, setDailyBriefingArchiveReceipt] =
    useState<DailyBriefingArchiveReceipt | null>(null);
  const [dailyBriefingDeliveryReview, setDailyBriefingDeliveryReview] =
    useState<DailyBriefingDeliveryReview | null>(null);
  const [dailyBriefingLiveSourcePreflight, setDailyBriefingLiveSourcePreflight] =
    useState<DailyBriefingLiveSourceStagingPreflight | null>(null);
  const [dailyBriefingLiveSourceReceipt, setDailyBriefingLiveSourceReceipt] =
    useState<DailyBriefingLiveSourceReceipt | null>(null);
  const [dailyBriefingScheduledArchiveReview, setDailyBriefingScheduledArchiveReview] =
    useState<DailyBriefingScheduledArchiveReview | null>(null);
  const [isPreviewingDailyBriefing, setIsPreviewingDailyBriefing] = useState(false);
  const [isPreflightingDailyBriefingLiveSources, setIsPreflightingDailyBriefingLiveSources] =
    useState(false);
  const [isArchivingDailyBriefing, setIsArchivingDailyBriefing] = useState(false);
  const [isReviewingDailyBriefingDelivery, setIsReviewingDailyBriefingDelivery] =
    useState(false);

  async function reviewDailyBriefingDelivery(artifactId: string) {
    setIsReviewingDailyBriefingDelivery(true);
    try {
      const review = await invoke<DailyBriefingDeliveryReview>("review_daily_briefing_delivery", {
        artifactId,
      });
      setDailyBriefingDeliveryReview(review);
      setActivity(`Daily Briefing delivery review: ${review.notification_previews.length} channel previews; no delivery started.`);
    } catch {
      setActivity("Daily Briefing delivery review was blocked or failed.");
    } finally {
      setIsReviewingDailyBriefingDelivery(false);
    }
  }
  const [isFetchingDailyBriefingLiveSource, setIsFetchingDailyBriefingLiveSource] =
    useState(false);
  const [isReviewingScheduledArchive, setIsReviewingScheduledArchive] = useState(false);

  async function reviewScheduledDailyBriefingArchive() {
    setIsReviewingScheduledArchive(true);
    try {
      const review = await invoke<DailyBriefingScheduledArchiveReview>(
        "review_daily_briefing_scheduled_archive",
      );
      setDailyBriefingScheduledArchiveReview(review);
      setActivity(
        `Scheduled Daily Briefing archive review: ${review.eligible_run_ids.length} ready, ${review.pending_approval_run_ids.length} awaiting approval.`,
      );
    } catch {
      setActivity("Scheduled Daily Briefing archive review was blocked or failed.");
    } finally {
      setIsReviewingScheduledArchive(false);
    }
  }

  async function previewDailyBriefing(template: DailyBriefingTemplate) {
    setIsPreviewingDailyBriefing(true);
    try {
      const preview = await invoke<DailyBriefingPreview>("preview_daily_briefing", {
        template,
      });
      setDailyBriefingPreview(preview);
      setActivity(
        `Daily briefing preview is ${preview.archive_gate} at ${Math.round(
          preview.aggregation.confidence.score * 100,
        )}% confidence.`,
      );
    } catch {
      setActivity("Daily briefing preview could not be generated.");
    } finally {
      setIsPreviewingDailyBriefing(false);
    }
  }

  async function preflightDailyBriefingLiveSources(template: DailyBriefingTemplate) {
    setIsPreflightingDailyBriefingLiveSources(true);
    try {
      const preflight = await invoke<DailyBriefingLiveSourceStagingPreflight>(
        "preflight_daily_briefing_live_sources",
        { template },
      );
      setDailyBriefingLiveSourcePreflight(preflight);
      setActivity(
        `Daily briefing live-source staging preflight: ${preflight.state}; no network started.`,
      );
    } catch {
      setActivity("Daily briefing live-source staging preflight was blocked or failed.");
    } finally {
      setIsPreflightingDailyBriefingLiveSources(false);
    }
  }

  async function archiveDailyBriefing(runId: string, template: DailyBriefingTemplate) {
    setIsArchivingDailyBriefing(true);
    try {
      const receipt = await invoke<DailyBriefingArchiveReceipt>("archive_daily_briefing", {
        runId,
        template,
      });
      setDailyBriefingPreview(receipt.preview);
      setDailyBriefingArchiveReceipt(receipt);
      await Promise.all([loadTaskRunRecords(), loadTaskArtifacts(), refreshProductionOverview()]);
      setActivity(`Daily briefing archived as ${receipt.artifact.reference_id}.`);
    } catch {
      setActivity("Daily briefing archival was blocked or failed.");
    } finally {
      setIsArchivingDailyBriefing(false);
    }
  }

  async function fetchDailyBriefingLiveSource(runId: string, template: DailyBriefingTemplate) {
    if (!window.confirm(text("Fetch configured live JSON sources and record a quarantined cross-check receipt?"))) {
      return;
    }
    setIsFetchingDailyBriefingLiveSource(true);
    try {
      const receipt = await invoke<DailyBriefingLiveSourceReceipt>(
        "fetch_daily_briefing_live_source",
        { runId, template, approved: true },
      );
      setDailyBriefingLiveSourceReceipt(receipt);
      await Promise.all([loadTaskArtifacts(), refreshProductionOverview()]);
      setActivity(
        `Daily briefing live-source cross-check receipt recorded as ${receipt.artifact.id}: ${receipt.evidence_validation.cross_check_state}.`,
      );
    } catch {
      setActivity("Daily briefing live source fetch was blocked or failed.");
    } finally {
      setIsFetchingDailyBriefingLiveSource(false);
    }
  }

  return {
    archiveDailyBriefing,
    dailyBriefingArchiveReceipt,
    dailyBriefingDeliveryReview,
    dailyBriefingLiveSourceReceipt,
    dailyBriefingLiveSourcePreflight,
    dailyBriefingScheduledArchiveReview,
    dailyBriefingPreview,
    isArchivingDailyBriefing,
    isReviewingDailyBriefingDelivery,
    isFetchingDailyBriefingLiveSource,
    isPreflightingDailyBriefingLiveSources,
    isReviewingScheduledArchive,
    isPreviewingDailyBriefing,
    preflightDailyBriefingLiveSources,
    previewDailyBriefing,
    reviewDailyBriefingDelivery,
    reviewScheduledDailyBriefingArchive,
    fetchDailyBriefingLiveSource,
  };
}
