import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  NotificationPreview,
  NotificationDeliveryAttempt,
  NotificationDeliveryReconciliationReceipt,
  NotificationReceipt,
  NotificationRequest,
  WebhookProductionPreflight,
  WebhookStagingPreflight,
} from "../types";

type UseNotificationGatewayOptions = {
  loadTaskArtifacts: () => Promise<unknown>;
  refreshProductionOverview: () => Promise<unknown>;
  setActivity: (message: string) => void;
  text: (value: string | null | undefined) => string;
};

export function useNotificationGateway({
  loadTaskArtifacts,
  refreshProductionOverview,
  setActivity,
  text,
}: UseNotificationGatewayOptions) {
  const [isDeliveringNotification, setIsDeliveringNotification] = useState(false);
  const [isExecutingWebhookProduction, setIsExecutingWebhookProduction] = useState(false);
  const [isExecutingWebhookStaging, setIsExecutingWebhookStaging] = useState(false);
  const [isPreflightingWebhookProduction, setIsPreflightingWebhookProduction] = useState(false);
  const [isPreviewingNotification, setIsPreviewingNotification] = useState(false);
  const [isPreflightingWebhookStaging, setIsPreflightingWebhookStaging] = useState(false);
  const [notificationPreview, setNotificationPreview] = useState<NotificationPreview | null>(null);
  const [notificationReceipt, setNotificationReceipt] = useState<NotificationReceipt | null>(null);
  const [notificationDeliveryAttempts, setNotificationDeliveryAttempts] = useState<NotificationDeliveryAttempt[]>([]);
  const [notificationReconciliationReceipt, setNotificationReconciliationReceipt] = useState<NotificationDeliveryReconciliationReceipt | null>(null);
  const [reconcilingNotificationAttemptId, setReconcilingNotificationAttemptId] = useState<string | null>(null);
  const [webhookProductionPreflight, setWebhookProductionPreflight] =
    useState<WebhookProductionPreflight | null>(null);
  const [webhookStagingPreflight, setWebhookStagingPreflight] = useState<WebhookStagingPreflight | null>(null);

  async function loadNotificationDeliveryAttempts() {
    try {
      const attempts = await invoke<NotificationDeliveryAttempt[]>("get_notification_delivery_attempts");
      setNotificationDeliveryAttempts(attempts);
      return attempts;
    } catch {
      setNotificationDeliveryAttempts([]);
      return [];
    }
  }

  async function reconcileNotificationDeliveryAttempt(attemptId: string, decision: "confirmed-delivered" | "confirmed-not-delivered") {
    const confirmed = window.confirm(text(
      decision === "confirmed-delivered"
        ? "Confirm that the provider delivered this notification? This decision blocks retry."
        : "Confirm that the provider did not deliver this notification? This decision allows a controlled retry.",
    ));
    if (!confirmed) return;
    setReconcilingNotificationAttemptId(attemptId);
    try {
      const receipt = await invoke<NotificationDeliveryReconciliationReceipt>("reconcile_notification_delivery_attempt", { attemptId, decision });
      setNotificationReconciliationReceipt(receipt);
      await Promise.all([loadNotificationDeliveryAttempts(), refreshProductionOverview()]);
      setActivity(`Notification delivery attempt reconciled as ${receipt.decision}.`);
    } catch {
      setActivity("Notification delivery attempt reconciliation failed.");
    } finally {
      setReconcilingNotificationAttemptId(null);
    }
  }

  async function previewNotification(request: NotificationRequest) {
    setIsPreviewingNotification(true);
    try {
      const preview = await invoke<NotificationPreview>("preview_notification", { request });
      setNotificationPreview(preview);
      setActivity(`Notification preview: ${preview.state}.`);
    } catch {
      setActivity("Notification preview was rejected.");
    } finally {
      setIsPreviewingNotification(false);
    }
  }

  async function deliverNotification(request: NotificationRequest) {
    const isEmail = request.channel === "email";
    const confirmed = window.confirm(
      isEmail
        ? text("Send this message through the configured SMTP server and record a delivery receipt?")
        : text("Record a mock webhook receipt without starting external delivery?"),
    );

    if (!confirmed) {
      return;
    }

    setIsDeliveringNotification(true);
    try {
      const receipt = await invoke<NotificationReceipt>("execute_email_notification", {
        request,
        approved: true,
      });
      setNotificationReceipt(receipt);
      await Promise.all([loadTaskArtifacts(), refreshProductionOverview()]);
      setActivity(
        isEmail
          ? `Email delivery receipt recorded as ${receipt.artifact.id}.`
          : `${request.channel} mock webhook receipt recorded as ${receipt.artifact.id}.`,
      );
    } catch {
      setActivity(
        isEmail ? "Email delivery was blocked or failed." : "Notification mock webhook was blocked or failed.",
      );
    } finally {
      setIsDeliveringNotification(false);
    }
  }

  async function preflightWebhookStaging(request: NotificationRequest) {
    setIsPreflightingWebhookStaging(true);
    try {
      const preflight = await invoke<WebhookStagingPreflight>("preflight_webhook_staging", { request });
      setWebhookStagingPreflight(preflight);
      setActivity(`Webhook staging preflight: ${preflight.state}.`);
    } catch {
      setActivity("Webhook staging preflight was rejected.");
    } finally {
      setIsPreflightingWebhookStaging(false);
    }
  }

  async function preflightWebhookProduction(request: NotificationRequest) {
    setIsPreflightingWebhookProduction(true);
    try {
      const preflight = await invoke<WebhookProductionPreflight>("preflight_webhook_production", { request });
      setWebhookProductionPreflight(preflight);
      setActivity(`Webhook production preflight: ${preflight.state}.`);
    } catch {
      setActivity("Webhook production preflight was rejected.");
    } finally {
      setIsPreflightingWebhookProduction(false);
    }
  }

  async function executeWebhookStaging(request: NotificationRequest) {
    const confirmed = window.confirm(
      text("Send this message to the configured loopback staging webhook and record a receipt?"),
    );
    if (!confirmed) {
      return;
    }

    setIsExecutingWebhookStaging(true);
    try {
      const receipt = await invoke<NotificationReceipt>("execute_webhook_staging", {
        request,
        approved: true,
      });
      setNotificationReceipt(receipt);
      await Promise.all([loadTaskArtifacts(), refreshProductionOverview()]);
      setActivity(`${request.channel} staging webhook receipt recorded as ${receipt.artifact.id}.`);
    } catch {
      setActivity("Webhook staging delivery was blocked or failed.");
    } finally {
      setIsExecutingWebhookStaging(false);
    }
  }

  async function executeWebhookProduction(request: NotificationRequest) {
    const confirmed = window.confirm(
      text("Send this message to the configured production Feishu or WeChat webhook and record a receipt?"),
    );
    if (!confirmed) {
      return;
    }

    setIsExecutingWebhookProduction(true);
    try {
      const receipt = await invoke<NotificationReceipt>("execute_webhook_production", {
        request,
        approved: true,
      });
      setNotificationReceipt(receipt);
      await Promise.all([loadTaskArtifacts(), refreshProductionOverview()]);
      setActivity(`${request.channel} production webhook receipt recorded as ${receipt.artifact.id}.`);
    } catch {
      setActivity("Webhook production delivery was blocked or failed.");
    } finally {
      setIsExecutingWebhookProduction(false);
    }
  }

  return {
    deliverNotification,
    executeWebhookProduction,
    executeWebhookStaging,
    isDeliveringNotification,
    isExecutingWebhookProduction,
    isExecutingWebhookStaging,
    isPreflightingWebhookProduction,
    isPreflightingWebhookStaging,
    isPreviewingNotification,
    loadNotificationDeliveryAttempts,
    notificationDeliveryAttempts,
    notificationPreview,
    notificationReconciliationReceipt,
    notificationReceipt,
    preflightWebhookProduction,
    preflightWebhookStaging,
    previewNotification,
    reconcileNotificationDeliveryAttempt,
    reconcilingNotificationAttemptId,
    webhookProductionPreflight,
    webhookStagingPreflight,
  };
}
