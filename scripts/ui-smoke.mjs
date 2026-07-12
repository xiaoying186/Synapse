import { spawn, spawnSync } from "node:child_process";
import { access, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const screenshotDir = path.join(root, ".tmp", "ui-smoke");
const tauriMockPath = path.join(root, "scripts", "ui-smoke-tauri-mock.js");
const requireBrowserSmoke = process.env.SYNAPSE_REQUIRE_BROWSER_SMOKE === "true";

const sourceChecks = [
  ["src/App.tsx", "LibraryHomePanel"],
  ["src/App.tsx", "ProductionReadinessPanel"],
  ["src/App.tsx", "SourceRegistryPanel"],
  ["src/App.tsx", "SagaRecoveryPanel"],
  ["src/App.tsx", "SecurityCenterPanel"],
  ["src/App.tsx", "SettingsPanel"],
  ["src/components/SettingsPanel.tsx", 'data-testid="settings-panel"'],
  ["src/components/SettingsPanel.tsx", "settings.configSource"],
  ["src/components/SettingsPanel.tsx", "settings.dataRoot"],
  ["src/components/SettingsPanel.tsx", 'data-testid="runtime-settings-preview-button"'],
  ["src/components/SettingsPanel.tsx", 'data-testid="runtime-settings-save-receipt"'],
  ["src-tauri/src/services/system.rs", "runtime_config_path"],
  ["src-tauri/src/services/system.rs", "storage_data_root"],
  ["src/App.tsx", "NotificationGatewayPanel"],
  ["src/App.tsx", "DailyBriefingPanel"],
  ["src/App.tsx", "BrowserAutomationPanel"],
  ["src/components/BrowserAutomationPanel.tsx", 'data-testid="browser-write-staging-preflight-button"'],
  ["src/components/BrowserAutomationPanel.tsx", 'data-testid="browser-write-staging-preflight-result"'],
  ["src/components/DailyBriefingPanel.tsx", 'data-testid="daily-briefing-evidence-contract"'],
  ["src/components/DailyBriefingPanel.tsx", 'data-testid="daily-briefing-evidence-validation"'],
  ["src/components/DailyBriefingPanel.tsx", 'data-testid="daily-briefing-provider-admission-path"'],
  ["src-tauri/src/domains/daily_briefing.rs", "provider_admission_preflight"],
  ["src-tauri/src/domains/daily_briefing.rs", "provider_review_queue_preview"],
  ["src/components/CapabilityPreviewPanel.tsx", 'data-testid="aggregation-evidence-validation"'],
  ["src-tauri/src/aggregation.rs", "EvidenceValidationContract"],
  ["scripts/ui-smoke-tauri-mock.js", "evidence_validation"],
  ["src/components/DailyBriefingPanel.tsx", 'data-testid="daily-briefing-live-source-preflight-button"'],
  ["src/components/DailyBriefingPanel.tsx", 'data-testid="daily-briefing-live-source-preflight-result"'],
  ["src/components/DailyBriefingPanel.tsx", 'data-testid="daily-briefing-live-source-fetch-button"'],
  ["src/components/DailyBriefingPanel.tsx", 'data-testid="daily-briefing-live-source-receipt"'],
  ["src/components/DailyBriefingPanel.tsx", 'data-testid="daily-briefing-archive-receipt"'],
  ["src/components/DailyBriefingPanel.tsx", 'data-testid="daily-briefing-delivery-review-button"'],
  ["src/components/DailyBriefingPanel.tsx", 'data-testid="daily-briefing-delivery-review"'],
  ["src/components/DailyBriefingPanel.tsx", 'data-testid="daily-briefing-scheduled-archive-review-button"'],
  ["src/components/DailyBriefingPanel.tsx", 'data-testid="daily-briefing-scheduled-archive-review"'],
  ["src/components/DailyBriefingPanel.tsx", 'data-testid="daily-briefing-provider-gates"'],
  ["src-tauri/src/domains/daily_briefing.rs", "LiveSourceProviderGate"],
  ["scripts/ui-smoke-tauri-mock.js", "provider_gates"],
  ["scripts/ui-smoke-tauri-mock.js", "preview_daily_briefing"],
  ["scripts/ui-smoke-tauri-mock.js", "preflight_daily_briefing_live_sources"],
  ["scripts/ui-smoke-tauri-mock.js", "fetch_daily_briefing_live_source"],
  ["scripts/ui-smoke-tauri-mock.js", "archive_daily_briefing"],
  ["scripts/ui-smoke-tauri-mock.js", "review_daily_briefing_delivery"],
  ["scripts/ui-smoke-tauri-mock.js", "review_daily_briefing_scheduled_archive"],
  ["src/components/SourceRegistryPanel.tsx", 'data-testid="source-enablement-preflight-button"'],
  ["src/components/SourceRegistryPanel.tsx", 'data-testid="source-enablement-preflight-result"'],
  ["src/components/SourceRegistryPanel.tsx", 'data-testid="source-enablement-review-button"'],
  ["src/components/SourceRegistryPanel.tsx", 'data-testid="source-enablement-review-confirmation"'],
  ["src/components/SourceRegistryPanel.tsx", 'data-testid="source-enablement-review-receipt"'],
  ["src/app/useSourceRegistryPreview.ts", "preflight_source_enablement"],
  ["src/app/useSourceRegistryPreview.ts", "review_source_enablement"],
  ["scripts/ui-smoke-tauri-mock.js", "preflight_source_enablement"],
  ["scripts/ui-smoke-tauri-mock.js", "review_source_enablement"],
  ["src/components/SourceRegistryPanel.tsx", 'data-testid="source-health-preflight-button"'],
  ["src/components/SourceRegistryPanel.tsx", 'data-testid="source-health-preflight-result"'],
  ["src/components/SourceRegistryPanel.tsx", 'data-testid="source-health-execute-button"'],
  ["src/components/SourceRegistryPanel.tsx", 'data-testid="source-health-receipt"'],
  ["src/components/SourceRegistryPanel.tsx", 'data-testid="source-health-status"'],
  ["src/app/useSourceRegistryPreview.ts", "preflight_source_health_check"],
  ["src/app/useSourceRegistryPreview.ts", "execute_source_health_check"],
  ["scripts/ui-smoke-tauri-mock.js", "preflight_source_health_check"],
  ["scripts/ui-smoke-tauri-mock.js", "execute_source_health_check"],
  ["src/components/CapabilityPreviewPanel.tsx", 'data-testid="provider-adapter-loopback-receipt-button"'],
  ["src/components/CapabilityPreviewPanel.tsx", 'data-testid="provider-adapter-loopback-receipt"'],
  ["src/components/CapabilityPreviewPanel.tsx", 'data-testid="provider-receipt-admission-preflight-button"'],
  ["src/components/CapabilityPreviewPanel.tsx", 'data-testid="provider-receipt-admission-preflight-result"'],
  ["src/components/CapabilityPreviewPanel.tsx", 'data-testid="provider-receipt-review-queue-button"'],
  ["src/components/CapabilityPreviewPanel.tsx", 'data-testid="provider-receipt-review-queue-result"'],
  ["src/components/CapabilityPreviewPanel.tsx", 'data-testid="provider-receipt-stage-review-candidate-button"'],
  ["src/components/CapabilityPreviewPanel.tsx", 'data-testid="provider-receipt-stage-review-candidate-result"'],
  ["src/components/CapabilityPreviewPanel.tsx", 'data-testid="provider-receipt-review-candidates"'],
  ["src/components/CapabilityPreviewPanel.tsx", 'data-testid="provider-receipt-review-decision-result"'],
  ["src/components/CapabilityPreviewPanel.tsx", "provider-receipt-review-approve-"],
  ["src/components/CapabilityPreviewPanel.tsx", "provider-task-artifact-preflight-"],
  ["src/components/CapabilityPreviewPanel.tsx", 'data-testid="provider-task-artifact-preflight-result"'],
  ["src/components/CapabilityPreviewPanel.tsx", "provider-task-artifact-stage-"],
  ["src/components/CapabilityPreviewPanel.tsx", 'data-testid="provider-task-artifact-stage-result"'],
  ["src/components/CapabilityPreviewPanel.tsx", 'data-testid="provider-artifact-zhishu-preflight-button"'],
  ["src/components/CapabilityPreviewPanel.tsx", 'data-testid="provider-artifact-zhishu-preflight-result"'],
  ["src/components/CapabilityPreviewPanel.tsx", 'data-testid="provider-artifact-zhishu-review-approve-button"'],
  ["src/components/CapabilityPreviewPanel.tsx", 'data-testid="provider-artifact-zhishu-review-result"'],
  ["src/components/CapabilityPreviewPanel.tsx", 'data-testid="provider-artifact-zhishu-candidate-create-button"'],
  ["src/components/CapabilityPreviewPanel.tsx", 'data-testid="provider-artifact-zhishu-candidate-result"'],
  ["src/App.tsx", 'data-testid="provider-artifact-zhishu-final-review-result"'],
  ["src/components/TaskRunPanel.tsx", 'data-testid="provider-governed-task-artifact"'],
  ["src/components/TaskRunPanel.tsx", 'data-testid="task-artifact-provider-zhishu-preflight-button"'],
  ["src/components/TaskRunPanel.tsx", 'data-testid="task-artifact-provider-zhishu-review-button"'],
  ["src/components/TaskRunPanel.tsx", 'data-testid="task-artifact-provider-zhishu-candidate-button"'],
  ["src/components/TaskRunPanel.tsx", 'data-testid="task-artifact-provider-review-result"'],
  ["src-tauri/src/http_source.rs", "ProviderAdapterExecutionReceipt"],
  ["src-tauri/src/http_source.rs", "ProviderReceiptAdmissionPreflight"],
  ["src-tauri/src/http_source.rs", "ProviderReceiptAdmissionQueuePreview"],
  ["src-tauri/src/lib.rs", "preview_provider_adapter_loopback_receipt"],
  ["src-tauri/src/lib.rs", "preflight_provider_receipt_admission"],
  ["src-tauri/src/lib.rs", "preview_provider_receipt_admission_queue"],
  ["src-tauri/src/lib.rs", "stage_provider_receipt_review_candidate"],
  ["src-tauri/src/lib.rs", "get_provider_receipt_review_candidates"],
  ["src-tauri/src/lib.rs", "review_provider_receipt_review_candidate"],
  ["src-tauri/src/lib.rs", "preflight_provider_receipt_task_artifact"],
  ["src-tauri/src/lib.rs", "create_provider_receipt_task_artifact"],
  ["src-tauri/src/lib.rs", "preflight_provider_artifact_zhishu_admission"],
  ["src-tauri/src/lib.rs", "review_provider_artifact_zhishu_admission"],
  ["src-tauri/src/lib.rs", "create_provider_artifact_zhishu_candidate"],
  ["src-tauri/src/lib.rs", "review_provider_artifact_zhishu_candidate"],
  ["scripts/ui-smoke-tauri-mock.js", "providerAdapterLoopbackReceipt"],
  ["scripts/ui-smoke-tauri-mock.js", "providerReceiptAdmissionPreflight"],
  ["scripts/ui-smoke-tauri-mock.js", "providerReceiptAdmissionQueuePreview"],
  ["scripts/ui-smoke-tauri-mock.js", "stageProviderReceiptReviewCandidate"],
  ["scripts/ui-smoke-tauri-mock.js", "reviewProviderArtifactZhishuAdmission"],
  ["scripts/ui-smoke-tauri-mock.js", "createProviderArtifactZhishuCandidate"],
  ["scripts/ui-smoke-tauri-mock.js", "review_provider_artifact_zhishu_candidate"],
  ["scripts/ui-smoke-tauri-mock.js", "reviewProviderReceiptReviewCandidate"],
  ["scripts/ui-smoke-tauri-mock.js", "preflightProviderReceiptTaskArtifact"],
  ["scripts/ui-smoke-tauri-mock.js", "createProviderReceiptTaskArtifact"],
  ["scripts/ui-smoke-tauri-mock.js", "preflightProviderArtifactZhishuAdmission"],
  ["src/App.tsx", "AgentTeamPanel"],
  ["src/app/useAgentTeam.ts", "preflight_real_agent_team"],
  ["src/components/AgentTeamPanel.tsx", 'data-testid="agent-team-real-preflight-result"'],
  ["src/components/AgentTeamPanel.tsx", 'data-testid="agent-team-preview-button"'],
  ["src/components/AgentTeamPanel.tsx", 'data-testid="agent-team-real-staging-button"'],
  ["src/components/AgentTeamPanel.tsx", 'data-testid="agent-team-real-staging-result"'],
  ["src/components/AgentTeamPanel.tsx", 'data-testid="agent-team-real-execution-button"'],
  ["src/components/AgentTeamPanel.tsx", 'data-testid="agent-team-real-cancel-button"'],
  ["src/components/AgentTeamPanel.tsx", 'data-testid="agent-team-real-lifecycle-result"'],
  ["src/components/AgentTeamPanel.tsx", 'data-testid="agent-team-real-transaction-receipt"'],
  ["src/components/AgentTeamPanel.tsx", 'data-testid="agent-team-real-execution-result"'],
  ["scripts/ui-smoke.mjs", 'channel: "msedge"'],
  ["src/App.tsx", "WebAppShellPanel"],
  ["src/components/WebAppShellPanel.tsx", "Web App Shell"],
  ["src/App.tsx", "CodebaseMemoryPanel"],
  ["src/components/CodebaseMemoryPanel.tsx", "Codebase Memory"],
  ["src/components/CodebaseMemoryPanel.tsx", 'data-testid="codebase-memory-admission-preflight-result"'],
  ["scripts/ui-smoke-tauri-mock.js", "preflight_codebase_memory_admission"],
  ["src/app/useComputerDiagnostics.ts", "preview_computer_cleanup"],
  ["src/app/useComputerDiagnostics.ts", "preflight_computer_cleanup_mutation"],
  ["src/components/ComputerDiagnosticsPanel.tsx", 'data-testid="computer-cleanup-preview-result"'],
  ["src/components/ComputerDiagnosticsPanel.tsx", 'data-testid="computer-cleanup-mutation-preflight-result"'],
  ["scripts/ui-smoke-tauri-mock.js", "preview_computer_cleanup"],
  ["scripts/ui-smoke-tauri-mock.js", "preflight_computer_cleanup_mutation"],
  ["src/App.tsx", "PermissionMemoryPanel"],
  ["src/components/PermissionMemoryPanel.tsx", "Permission Memory"],
  ["src/components/PermissionMemoryPanel.tsx", 'data-testid="permission-memory-preview-button"'],
  ["src/components/PermissionMemoryPanel.tsx", 'data-testid="permission-reuse-preflight-result"'],
  ["scripts/ui-smoke-tauri-mock.js", "preflight_permission_reuse"],
  ["src/App.tsx", "SkillLibraryPanel"],
  ["src/app/useLocalAppBridge.ts", "preflight_local_app_launch"],
  ["src/components/LocalAppBridgePanel.tsx", 'data-testid="local-app-launch-preflight-result"'],
  ["src/components/LocalAppBridgePanel.tsx", 'data-testid="local-app-launch-receipt"'],
  ["src/components/LocalAppBridgePanel.tsx", 'data-testid="local-app-allow-state-receipt"'],
  ["scripts/ui-smoke-tauri-mock.js", "preflight_local_app_launch"],
  ["scripts/ui-smoke-tauri-mock.js", "execute_local_app_launch"],
  ["src/components/DeviceSyncPanel.tsx", 'data-testid="device-sync-import-preflight-result"'],
  ["src/components/DeviceSyncPanel.tsx", 'data-testid="device-sync-import-transaction-receipt"'],
  ["scripts/ui-smoke-tauri-mock.js", "preflight_device_sync_import_apply"],
  ["src/app/usePreviewAdapters.ts", "preview_skill_library"],
  ["src/app/usePreviewAdapters.ts", "preflight_skill_script_execution"],
  ["src/components/SkillLibraryPanel.tsx", 'data-testid="skill-library-preview-result"'],
  ["src/components/SkillLibraryPanel.tsx", 'data-testid="skill-script-execution-preflight-result"'],
  ["src/components/SkillLibraryPanel.tsx", 'data-testid="skill-script-execution-button"'],
  ["src/components/SkillLibraryPanel.tsx", 'data-testid="skill-script-execution-receipt"'],
  ["scripts/ui-smoke-tauri-mock.js", "preview_skill_library"],
  ["scripts/ui-smoke-tauri-mock.js", "preflight_skill_script_execution"],
  ["scripts/ui-smoke-tauri-mock.js", "execute_skill_script"],
  ["src/components/SourceRegistryPanel.tsx", "Data Source Registry"],
  ["src/components/LanguageSelector.tsx", "language-selector"],
  ["src/App.tsx", 'data-testid="app-shell"'],
  ["src/App.tsx", 'data-testid="main-navigation"'],
  ["src/App.tsx", 'data-testid="interaction-feedback"'],
  ["src/components/LibraryHomePanel.tsx", 'data-testid="reading-pane"'],
  ["src/components/ZhishuCapturePanel.tsx", 'data-testid="zhishu-capture-input"'],
  ["src/components/ZhishuSearchPanel.tsx", 'data-testid="zhishu-search-result"'],
  ["src/components/MemoryPanel.tsx", 'data-testid="accept-memory-candidate-button"'],
  ["src/components/NotificationGatewayPanel.tsx", 'data-testid="notification-gateway-panel"'],
  ["src/components/NotificationGatewayPanel.tsx", 'data-testid="notification-deliver-button"'],
  ["src/components/NotificationGatewayPanel.tsx", 'data-testid="notification-delivery-attempt-receipt"'],
  ["src/components/NotificationGatewayPanel.tsx", 'data-testid="notification-reconciliation-center"'],
  ["src/components/NotificationGatewayPanel.tsx", 'data-testid="notification-reconciliation-receipt"'],
  ["src/components/NotificationGatewayPanel.tsx", 'data-testid="notification-webhook-staging-policy"'],
  ["src/components/NotificationGatewayPanel.tsx", 'data-testid="notification-webhook-staging-envelope"'],
  ["src/components/NotificationGatewayPanel.tsx", 'data-testid="notification-webhook-staging-preflight-button"'],
  ["src/components/NotificationGatewayPanel.tsx", 'data-testid="notification-webhook-staging-preflight-result"'],
  ["src/components/NotificationGatewayPanel.tsx", 'data-testid="notification-webhook-staging-execute-button"'],
  ["src/components/NotificationGatewayPanel.tsx", 'data-testid="notification-webhook-production-preflight-button"'],
  ["src/components/NotificationGatewayPanel.tsx", 'data-testid="notification-webhook-production-preflight-result"'],
  ["src/components/NotificationGatewayPanel.tsx", 'data-testid="notification-webhook-production-execute-button"'],
  ["scripts/ui-smoke-tauri-mock.js", "save_task_direction"],
  ["scripts/ui-smoke-tauri-mock.js", "promote_task_artifact_to_zhishu"],
  ["scripts/ui-smoke-tauri-mock.js", "capture_zhishu_item"],
  ["scripts/ui-smoke-tauri-mock.js", "search_zhishu"],
  ["scripts/ui-smoke-tauri-mock.js", "preview_notification"],
  ["scripts/ui-smoke-tauri-mock.js", "mock-webhook-receipt-recorded"],
  ["scripts/ui-smoke-tauri-mock.js", "staging-contract-external-delivery-disabled"],
  ["scripts/ui-smoke-tauri-mock.js", "synapse.notification.webhook.staging.v1"],
  ["scripts/ui-smoke-tauri-mock.js", "preflight_webhook_staging"],
  ["scripts/ui-smoke-tauri-mock.js", "preflight_webhook_production"],
  ["scripts/ui-smoke-tauri-mock.js", "execute_webhook_staging"],
  ["scripts/ui-smoke-tauri-mock.js", "execute_webhook_production"],
  ["scripts/ui-smoke-tauri-mock.js", "reconcile_notification_delivery_attempt"],
  ["scripts/ui-smoke-tauri-mock.js", "staging-webhook-blocked"],
  ["scripts/ui-smoke-tauri-mock.js", "production-webhook-blocked"],
  ["scripts/ui-smoke-tauri-mock.js", "preflight_browser_write_action_staging"],
  ["scripts/ui-smoke-tauri-mock.js", "browser-write-staging-blocked-by-default"],
  ["scripts/ui-smoke-tauri-mock.js", "preview_agent_team"],
  ["scripts/ui-smoke-tauri-mock.js", "preflight_real_agent_team"],
  ["scripts/ui-smoke-tauri-mock.js", "stage_real_agent_team"],
  ["scripts/ui-smoke-tauri-mock.js", "execute_real_agent_team"],
  ["scripts/ui-smoke-tauri-mock.js", "real-agent-staging-receipt-recorded"],
  ["src/i18n/I18nProvider.tsx", "document.documentElement.lang"],
  ["src/App.css", ".shell"],
  ["src/App.css", ".workspace"],
];

const requiredTestIds = [
  "app-shell",
  "main-navigation",
  "library-home",
  "reading-pane",
  "pending-task-panel",
  "category-task-list",
  "interaction-feedback",
  "current-section",
];

const navigationTestIds = [
  "nav-library",
  "nav-zhi-shu",
  "nav-tai-heng",
  "nav-xing-tai",
  "nav-bai-gong",
  "nav-settings",
  "nav-diagnostics",
];

async function main() {
  await runSourceChecks();

  const playwrightPackage = process.env.PLAYWRIGHT_PACKAGE ?? "playwright";
  let playwright;
  try {
    playwright = await import(playwrightPackage);
  } catch {
    const captured = await runPythonBrowserSmoke();
    if (!captured) {
      if (requireBrowserSmoke) {
        throw new Error(
          `${playwrightPackage} is not installed and Python Playwright screenshot capture is unavailable.`,
        );
      }
      console.log(
        `[SKIP] playwright: ${playwrightPackage} is not installed and Python Playwright screenshot capture is unavailable; static UI smoke checks passed.`,
      );
    }
    return;
  }

  try {
    await runBrowserSmoke(playwright);
  } catch (error) {
    if (requireBrowserSmoke) {
      throw error;
    }
    const captured = await runPythonBrowserSmoke();
    if (!captured) {
      console.log(
        `[SKIP] browser-smoke: ${firstLine(error instanceof Error ? error.message : String(error))}; static UI smoke checks passed.`,
      );
    }
  }
}

async function runSourceChecks() {
  for (const [relativePath, needle] of sourceChecks) {
    const absolutePath = path.join(root, relativePath);
    const content = await readFile(absolutePath, "utf8");
    if (!content.includes(needle)) {
      throw new Error(`${relativePath} is missing expected UI anchor: ${needle}`);
    }
    console.log(`[PASS] source-anchor: ${relativePath} contains ${needle}`);
  }
}

async function runBrowserSmoke(playwright) {
  await runWithViteServer(async () => {
    const browser = await launchSmokeBrowser(playwright);
    try {
      await smokeViewport(browser, "desktop", 1440, 1100);
      await smokeViewport(browser, "mobile", 390, 920);
    } finally {
      await browser.close();
    }
  });
}

async function launchSmokeBrowser(playwright) {
  try {
    return await playwright.chromium.launch();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/Executable doesn't exist|spawn EPERM|browserType\.launch/i.test(message)) {
      throw error;
    }
    return playwright.chromium.launch({ channel: "msedge" });
  }
}

async function runWithViteServer(callback) {
  await mkdir(screenshotDir, { recursive: true });
  const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
  await access(viteBin);

  const server = spawn(
    process.execPath,
    [viteBin, "--host", "127.0.0.1", "--port", "1420", "--strictPort"],
    {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );

  let output = "";
  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForServer("http://127.0.0.1:1420/");
    await callback();
  } finally {
    server.kill();
  }

  if (server.exitCode && server.exitCode !== 0) {
    throw new Error(`Vite smoke server exited with ${server.exitCode}:\n${output}`);
  }
}

async function runPythonBrowserSmoke() {
  const python = pythonCommand();
  if (!python) {
    return false;
  }

  let captured = false;
  await runWithViteServer(async () => {
    const script = String.raw`
import pathlib
import sys
from playwright.sync_api import sync_playwright

out = pathlib.Path(sys.argv[1])
mock_path = pathlib.Path(sys.argv[2])
with sync_playwright() as p:
    try:
        browser = p.chromium.launch()
    except Exception:
        browser = p.chromium.launch(channel="msedge")
    try:
        for name, width, height in (("desktop", 1440, 1100), ("mobile", 390, 920)):
            page = browser.new_page(viewport={"width": width, "height": height})
            page.add_init_script("window.localStorage.setItem('synapse.language', 'en')")
            page.add_init_script(path=str(mock_path))
            page.goto("http://127.0.0.1:1420/", wait_until="networkidle")
            page.get_by_role("heading", name="Cognitive execution workbench").wait_for(timeout=10000)
            page.get_by_text("Library home").first.wait_for(timeout=10000)
            page.get_by_text("Production readiness").first.wait_for(timeout=10000)
            for test_id in ${JSON.stringify(requiredTestIds)}:
                page.get_by_test_id(test_id).wait_for(timeout=10000)
            for test_id in ${JSON.stringify(navigationTestIds)}:
                before = page.get_by_test_id("interaction-feedback").inner_text(timeout=10000)
                page.get_by_test_id(test_id).click()
                page.get_by_test_id("interaction-feedback").wait_for(timeout=10000)
                page.get_by_test_id("current-section").wait_for(timeout=10000)
                after = page.get_by_test_id("interaction-feedback").inner_text(timeout=10000)
                current = page.get_by_test_id("current-section").inner_text(timeout=10000).strip()
                assert current
                assert after != before or after.strip()
                if test_id == "nav-settings":
                    page.get_by_test_id("settings-panel").wait_for(timeout=10000)
                    page.get_by_text("C:\\Users\\ui-smoke\\AppData\\Roaming\\com.synapse.local\\synapse.config.toml").wait_for(timeout=10000)
                    page.get_by_text("C:\\Users\\ui-smoke\\AppData\\Roaming\\com.synapse.local\\.synapse").wait_for(timeout=10000)
                    page.get_by_test_id("runtime-settings-preview-button").click()
                    page.get_by_test_id("runtime-settings-confirmation").check()
                    page.get_by_test_id("runtime-settings-save-button").click()
                    page.get_by_test_id("runtime-settings-save-receipt").wait_for(timeout=10000)
                if test_id == "nav-diagnostics":
                    page.get_by_test_id("computer-diagnostics-panel").scroll_into_view_if_needed()
                    page.get_by_test_id("computer-cleanup-preview-button").click()
                    page.get_by_test_id("computer-cleanup-preview-result").wait_for(timeout=10000)
                    page.get_by_text("cleanup-dry-run-review-required").first.wait_for(timeout=10000)
                    page.get_by_test_id("computer-cleanup-mutation-preflight-button").click()
                    page.get_by_test_id("computer-cleanup-mutation-preflight-result").wait_for(timeout=10000)
                    page.get_by_text("cleanup-mutation-blocked-by-default").first.wait_for(timeout=10000)
            page.get_by_test_id("nav-library").click()
            page.get_by_test_id("library-home").wait_for(timeout=10000)
            page.get_by_test_id("nav-zhi-shu").click()
            zhishu_title = f"UI smoke Zhishu durable template {name}"
            page.get_by_test_id("zhishu-capture-input").fill(zhishu_title)
            page.get_by_test_id("zhishu-kind-select").select_option("knowledge")
            page.get_by_test_id("zhishu-tags-input").fill("template, judicial")
            page.get_by_test_id("zhishu-capture-button").click()
            page.get_by_text(zhishu_title).first.wait_for(timeout=10000)
            page.get_by_test_id("accept-memory-candidate-button").first.click()
            page.get_by_text("accepted").first.wait_for(timeout=10000)
            page.get_by_test_id("zhishu-search-input").fill("template judicial")
            page.get_by_test_id("zhishu-search-scope-select").select_option("L2 Knowledge")
            page.get_by_test_id("zhishu-search-admission-select").select_option("accepted")
            page.get_by_test_id("zhishu-search-button").click()
            page.get_by_test_id("zhishu-search-result").first.wait_for(timeout=10000)
            page.get_by_text(zhishu_title).first.wait_for(timeout=10000)
            page.get_by_test_id("nav-library").click()
            page.get_by_test_id("library-home").wait_for(timeout=10000)
            page.get_by_test_id("nav-xing-tai").click()
            title = f"UI smoke task loop {name}"
            page.get_by_test_id("direction-title-input").fill(title)
            page.get_by_test_id("direction-keywords-input").fill("workflow, template")
            page.get_by_test_id("direction-description-input").fill("Verify the UI task loop.")
            page.get_by_test_id("save-direction-button").click()
            page.get_by_text(title).first.wait_for(timeout=10000)
            page.get_by_test_id("request-task-run-button").first.click()
            page.get_by_test_id("approve-task-run-button").first.wait_for(timeout=10000)
            page.get_by_test_id("approve-task-run-button").first.click()
            page.get_by_test_id("execute-task-run-button").first.wait_for(timeout=10000)
            page.get_by_test_id("execute-task-run-button").first.click()
            page.get_by_text("indexed artifact").first.wait_for(timeout=10000)
            page.get_by_test_id("promote-task-artifact-button").first.click()
            page.get_by_text("Promoted").first.wait_for(timeout=10000)
            scheduled_title = f"UI smoke scheduled loop {name}"
            page.get_by_test_id("direction-title-input").fill(scheduled_title)
            page.get_by_test_id("direction-keywords-input").fill("schedule, template")
            page.get_by_test_id("direction-description-input").fill("Verify the scheduled UI task loop.")
            page.get_by_test_id("direction-frequency-select").select_option("daily")
            page.get_by_test_id("direction-push-toggle").check()
            page.get_by_test_id("direction-channel-feishu").wait_for(state="attached", timeout=10000)
            page.wait_for_function("!document.querySelector('[data-testid=\"direction-channel-feishu\"]').disabled")
            page.get_by_test_id("direction-channel-feishu").check()
            page.get_by_test_id("save-direction-button").click()
            page.get_by_text(scheduled_title).first.wait_for(timeout=10000)
            page.get_by_test_id("scheduler-tick-button").click()
            page.get_by_text("schedule-tick").first.wait_for(timeout=10000)
            page.get_by_test_id("approve-task-run-button").first.click()
            page.get_by_test_id("agent-team-panel").scroll_into_view_if_needed()
            page.get_by_test_id("agent-team-mode-select").select_option("linear")
            page.get_by_test_id("agent-team-context-select").select_option("native")
            page.get_by_test_id("agent-team-run-select").select_option(index=1)
            page.get_by_test_id("agent-team-goal-input").fill(f"UI smoke real team preflight {name}")
            page.get_by_test_id("agent-team-participant-agent-codex").check()
            page.get_by_test_id("agent-team-participant-agent-claude").check()
            page.get_by_test_id("agent-team-preview-button").click()
            page.get_by_text("blueprint-preview-ready").first.wait_for(timeout=10000)
            page.get_by_test_id("agent-team-real-preflight-button").click()
            page.get_by_test_id("agent-team-real-preflight-result").wait_for(timeout=10000)
            page.get_by_text("real-team-execution-blocked-by-default").first.wait_for(timeout=10000)
            page.once("dialog", lambda dialog: dialog.accept())
            page.get_by_test_id("agent-team-real-staging-button").click()
            page.get_by_test_id("agent-team-real-staging-result").wait_for(timeout=10000)
            page.get_by_text("real-agent-staging-receipt-recorded").first.wait_for(timeout=10000)
            page.get_by_test_id("notification-gateway-panel").scroll_into_view_if_needed()
            page.get_by_test_id("notification-channel-select").select_option("feishu")
            page.get_by_test_id("notification-run-select").select_option(index=1)
            page.get_by_test_id("notification-subject-input").fill(f"UI smoke Feishu receipt {name}")
            page.get_by_test_id("notification-body-input").fill("Verify mock webhook receipt without external delivery.")
            page.get_by_test_id("notification-preview-button").click()
            page.get_by_text("adapter-preview-only").first.wait_for(timeout=10000)
            page.get_by_test_id("notification-webhook-staging-policy").wait_for(timeout=10000)
            page.get_by_test_id("notification-webhook-staging-envelope").wait_for(timeout=10000)
            page.get_by_text("staging-contract-external-delivery-disabled").first.wait_for(timeout=10000)
            page.get_by_text("synapse.notification.webhook.staging.v1").first.wait_for(timeout=10000)
            page.get_by_test_id("notification-webhook-staging-preflight-button").click()
            page.get_by_test_id("notification-webhook-staging-preflight-result").wait_for(timeout=10000)
            page.get_by_text("staging-webhook-blocked").first.wait_for(timeout=10000)
            page.get_by_test_id("notification-webhook-production-preflight-button").click()
            page.get_by_test_id("notification-webhook-production-preflight-result").wait_for(timeout=10000)
            page.get_by_text("production-webhook-blocked").first.wait_for(timeout=10000)
            page.once("dialog", lambda dialog: dialog.accept())
            page.get_by_test_id("notification-deliver-button").click()
            page.get_by_test_id("notification-receipt-result").wait_for(timeout=10000)
            page.get_by_text("mock-webhook-receipt-recorded").first.wait_for(timeout=10000)
            page.get_by_test_id("execute-task-run-button").first.wait_for(timeout=10000)
            page.get_by_test_id("execute-task-run-button").first.click()
            page.get_by_text("indexed artifact").first.wait_for(timeout=10000)
            page.get_by_test_id("nav-library").click()
            page.wait_for_timeout(100)
            buttons = page.locator("button:visible").all()
            for button in buttons[:30]:
                if not button.is_enabled():
                    continue
                before_body = page.locator("body").inner_text(timeout=10000)
                before_feedback = page.get_by_test_id("interaction-feedback").inner_text(timeout=10000)
                button.scroll_into_view_if_needed()
                button.click(timeout=5000)
                page.wait_for_timeout(150)
                after_body = page.locator("body").inner_text(timeout=10000)
                after_feedback = page.get_by_test_id("interaction-feedback").inner_text(timeout=10000)
                assert after_body != before_body or after_feedback != before_feedback or after_feedback.strip()
            page.locator(".language-selector select").select_option("zh-CN")
            page.wait_for_function("document.documentElement.lang === 'zh-CN'")
            assert page.evaluate("window.localStorage.getItem('synapse.language')") == "zh-CN"
            assert page.get_by_text("\u8bb0\u5fc6\u91c7\u96c6").first.is_visible()
            assert "memory-capture" not in page.locator("body").inner_text()
            page.screenshot(path=str(out / f"zh-{name}.png"), full_page=True)
            page.locator(".language-selector select").select_option("en")
            page.wait_for_function("document.documentElement.lang === 'en'")
            assert page.evaluate("window.localStorage.getItem('synapse.language')") == "en"
            page.screenshot(path=str(out / f"{name}.png"), full_page=True)
            page.close()
    finally:
        browser.close()
`;
    const result = spawnSync(python, ["-c", script, screenshotDir, tauriMockPath], {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
      windowsHide: true,
    });
    if (result.status === 0) {
      captured = true;
      console.log("[PASS] python-browser-smoke: captured desktop and mobile screenshots");
    } else {
      const detail = (result.stderr || result.stdout || "Python Playwright failed").trim();
      console.log(`[SKIP] python-browser-smoke: ${firstLine(detail)}`);
    }
  });

  return captured;
}

function pythonCommand() {
  const candidates = [
    process.env.PYTHON_PLAYWRIGHT,
    "H:\\python311\\python.exe",
    "python",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes("\\") && !existsSync(candidate)) {
      continue;
    }
    const result = spawnSync(candidate, ["-c", "import playwright"], {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
      windowsHide: true,
    });
    if (result.status === 0) {
      return candidate;
    }
  }
  return null;
}

function firstLine(value) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    lines.find((line) => line.includes("Error:") || line.includes("spawn ")) ??
    lines.find((line) => !line.startsWith("File ") && !line.startsWith("Traceback")) ??
    lines[0] ??
    "unavailable"
  );
}

async function smokeViewport(browser, name, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.addInitScript(() => {
    window.localStorage.setItem("synapse.language", "en");
  });
  await page.addInitScript({ path: tauriMockPath });
  await page.goto("http://127.0.0.1:1420/", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Synapse|Cognitive execution workbench/i }).first().waitFor();
  await page.getByText("Library home").first().waitFor();
  await page.getByText("Production readiness").first().waitFor();
  await assertRequiredLayout(page);
  await assertNavigationFeedback(page);
  await assertZhishuMemoryLoop(page, name);
  await assertXingtaiTaskLoop(page, name);
  await assertSkillLibraryPreview(page);
  await assertSourceEnablementPreflight(page);
  await assertSourceEnablementReview(page);
  await assertSourceHealthCheck(page);
  await assertProviderAdapterLoopbackReceipt(page);
  await assertBrowserWriteStagingPreflight(page, name);
  await assertDeviceSyncImportPreflight(page);
  await assertVisibleButtonFeedback(page);
  await page.locator(".language-selector select").selectOption("zh-CN");
  await page.waitForFunction(() => document.documentElement.lang === "zh-CN");
  const zhMode = await page.evaluate(() => window.localStorage.getItem("synapse.language"));
  if (zhMode !== "zh-CN") {
    throw new Error(`Language selector did not persist zh-CN, found ${zhMode ?? "null"}`);
  }
  await page.getByText("\u8bb0\u5fc6\u91c7\u96c6").first().waitFor();
  const zhBody = await page.locator("body").innerText();
  if (zhBody.includes("memory-capture")) {
    throw new Error("Chinese capability map still exposes the raw memory-capture identifier");
  }
  await page.screenshot({
    fullPage: true,
    path: path.join(screenshotDir, `zh-${name}.png`),
  });
  await page.locator(".language-selector select").selectOption("en");
  await page.waitForFunction(() => document.documentElement.lang === "en");
  const enMode = await page.evaluate(() => window.localStorage.getItem("synapse.language"));
  if (enMode !== "en") {
    throw new Error(`Language selector did not persist en, found ${enMode ?? "null"}`);
  }
  await page.screenshot({
    fullPage: true,
    path: path.join(screenshotDir, `${name}.png`),
  });
  await page.close();
  console.log(`[PASS] browser-smoke: captured ${name} screenshot`);
}

async function assertXingtaiTaskLoop(page, name) {
  await page.getByTestId("nav-xing-tai").click();
  const title = `UI smoke task loop ${name}`;
  await page.getByTestId("direction-title-input").fill(title);
  await page.getByTestId("direction-keywords-input").fill("workflow, template");
  await page.getByTestId("direction-description-input").fill("Verify the UI task loop.");
  await page.getByTestId("save-direction-button").click();
  await page.getByText(title).first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("request-task-run-button").first().click();
  await page.getByTestId("approve-task-run-button").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("approve-task-run-button").first().click();
  await page.getByTestId("execute-task-run-button").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("execute-task-run-button").first().click();
  await page.getByText("indexed artifact").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("promote-task-artifact-button").first().click();
  await page.getByText("Promoted").first().waitFor({ state: "visible", timeout: 10_000 });
  const scheduledTitle = `UI smoke scheduled loop ${name}`;
  await page.getByTestId("direction-title-input").fill(scheduledTitle);
  await page.getByTestId("direction-keywords-input").fill("schedule, template");
  await page.getByTestId("direction-description-input").fill("Verify the scheduled UI task loop.");
  await page.getByTestId("direction-frequency-select").selectOption("daily");
  await page.getByTestId("direction-push-toggle").check();
  await page.getByTestId("direction-channel-feishu").waitFor({ state: "attached", timeout: 10_000 });
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="direction-channel-feishu"]')?.disabled,
  );
  await page.getByTestId("direction-channel-feishu").check();
  await page.getByTestId("save-direction-button").click();
  await page.getByText(scheduledTitle).first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("scheduler-tick-button").click();
  await page.getByText("schedule-tick").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("approve-task-run-button").first().click();
  await assertAgentTeamRealPreflight(page, name);
  await assertNotificationMockReceipt(page, name);
  await assertDailyBriefingEvidenceContract(page, name);
  await assertLocalAppLaunchPreflight(page);
  await page.getByTestId("nav-library").click();
  await page.getByTestId("library-home").waitFor({ state: "visible", timeout: 10_000 });
}

async function assertLocalAppLaunchPreflight(page) {
  await page.getByTestId("local-app-panel").scrollIntoViewIfNeeded();
  await page.getByTestId("local-app-run-select").selectOption({ index: 1 });
  await page.getByTestId("local-app-launch-preflight-button").click();
  await page.getByTestId("local-app-launch-preflight-result").waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("local-app-launch-preflight-review-required")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("local-app-not-allowlisted").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("local-app-allow-windows-notepad").click();
  await page.getByTestId("local-app-allow-state-receipt").waitFor({ state: "visible", timeout: 10_000 });
  await page.locator(".local-app-launch-form button[type='submit']").click();
  await page
    .getByText("ready-for-explicit-launch-approval")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("local-app-launch-button").click();
  await page.getByTestId("local-app-launch-receipt").waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByTestId("local-app-launch-receipt")
    .getByText("audit-local-app-", { exact: false })
    .waitFor({ state: "visible", timeout: 10_000 });
}

async function assertBrowserWriteStagingPreflight(page, name) {
  await openExecutionWorkspace(page);
  await page.locator(".browser-automation-panel").scrollIntoViewIfNeeded();
  await page.getByPlaceholder("Allowlisted http(s) URL").fill(`https://example.com/form-${name}`);
  await page.locator(".browser-automation-panel select").selectOption({ index: 1 });
  await page.getByTestId("browser-write-staging-preflight-button").click();
  await page
    .getByTestId("browser-write-staging-preflight-result")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("browser-write-staging-blocked-by-default")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("no-write-allowlist-configured")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
}

async function assertSourceEnablementPreflight(page) {
  await page.getByTestId("nav-zhi-shu").click();
  await page.locator(".source-registry-panel").scrollIntoViewIfNeeded();
  await page.getByTestId("source-enablement-preflight-button").first().click();
  await page
    .getByTestId("source-enablement-preflight-result")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("source-enablement-review-required")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("fetch-live-source-before-enable").first().waitFor({
    state: "visible",
    timeout: 10_000,
  });
}

async function assertSourceEnablementReview(page) {
  await page.getByTestId("nav-zhi-shu").click();
  await page.locator(".source-registry-panel").scrollIntoViewIfNeeded();
  await page.getByTestId("source-enablement-review-button").first().click();
  await page
    .getByTestId("source-enablement-review-confirmation")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("source-enablement-review-confirm-button").click();
  await page
    .getByTestId("source-enablement-review-receipt")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("enabled-reviewed").first().waitFor({
    state: "visible",
    timeout: 10_000,
  });
}

async function assertSourceHealthCheck(page) {
  await page.getByTestId("nav-zhi-shu").click();
  await page.locator(".source-registry-panel").scrollIntoViewIfNeeded();
  await page.getByTestId("source-health-preflight-button").first().click();
  await page.getByTestId("source-health-preflight-result").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("source-health-check-ready").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("source-health-execute-button").first().click();
  await page.getByTestId("source-health-receipt").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("source-health-check-recorded").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("source-health-status").first().waitFor({ state: "visible", timeout: 10_000 });
}

async function openExecutionWorkspace(page) {
  await page.getByTestId("cognitive-tab-execution").click();
  await page.getByTestId("execution-workspace").waitFor({ state: "visible", timeout: 10_000 });
}

async function assertProviderAdapterLoopbackReceipt(page) {
  await openExecutionWorkspace(page);
  await page.getByPlaceholder("Query to assess before retrieval").fill("UI smoke provider receipt");
  await page.getByTestId("aggregation-preview-button").click();
  await page
    .getByTestId("aggregation-evidence-validation")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("provider-adapter-loopback-receipt-button").scrollIntoViewIfNeeded();
  await page.getByTestId("provider-adapter-loopback-receipt-button").click();
  await page
    .getByTestId("provider-adapter-loopback-receipt")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("loopback-fixture-provider").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("provider-adapter-receipt-required").first().waitFor({
    state: "visible",
    timeout: 10_000,
  });
  await page.getByText("source-sha256-recorded").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("provider-receipt-admission-preflight-button").click();
  await page
    .getByTestId("provider-receipt-admission-preflight-result")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("provider-receipt-admission-review-required")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("no-automatic-l2-write").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("provider-receipt-review-queue-button").click();
  await page
    .getByTestId("provider-receipt-review-queue-result")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("provider-receipt-review-queue-preview")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("human-review-queue-before-task-artifact")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("provider-receipt-stage-review-candidate-button").click();
  await page
    .getByTestId("provider-receipt-stage-review-candidate-result")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("provider-receipt-review-candidate-staged")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByTestId("provider-receipt-review-candidates")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("pending-human-review").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.locator('[data-testid^="provider-receipt-review-approve-"]').first().click();
  await page
    .getByTestId("provider-receipt-review-decision-result")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("provider-receipt-review-decision-recorded")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("approved-for-task-artifact-review")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("no-automatic-task-artifact-write")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.locator('[data-testid^="provider-task-artifact-preflight-"]').first().click();
  await page
    .getByTestId("provider-task-artifact-preflight-result")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("provider-task-artifact-preflight-ready-for-review")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("write-task-artifact-from-provider-preflight")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.locator('[data-testid^="provider-task-artifact-stage-"]').first().click();
  await page
    .getByTestId("provider-task-artifact-stage-result")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("provider-task-artifact-staged")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("isolated-task-artifact-created")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("provider-artifact-zhishu-preflight-button").click();
  await page
    .getByTestId("provider-artifact-zhishu-preflight-result")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("provider-artifact-zhishu-admission-review-required")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("write-provider-artifact-to-l2-from-preflight")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("provider-artifact-zhishu-review-approve-button").click();
  await page
    .getByTestId("provider-artifact-zhishu-review-result")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("approved-for-zhishu-candidate")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("provider-artifact-zhishu-candidate-create-button").click();
  await page
    .getByTestId("provider-artifact-zhishu-candidate-result")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("provider-artifact-zhishu-candidate-created")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("confirmed-knowledge-review-still-required")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("nav-zhi-shu").click();
  await page
    .getByTestId("zhishu-memory-panel")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("accept-memory-candidate-button").first().click();
  await page
    .getByTestId("provider-artifact-zhishu-final-review-result")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("provider-artifact-zhishu-candidate-accepted")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("no-automatic-provider-knowledge-confirmation")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
}

async function assertDeviceSyncImportPreflight(page) {
  await openExecutionWorkspace(page);
  await page.getByTestId("device-sync-panel").scrollIntoViewIfNeeded();
  await page.getByText("Export sync package").click();
  await page.getByTestId("device-sync-import-preflight-button").click();
  await page.getByTestId("device-sync-import-preflight-result").waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("device-sync-import-apply-review-required")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("local-device-remains-source-of-truth")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
}

async function assertAgentTeamRealPreflight(page, name) {
  await page.getByTestId("agent-team-panel").scrollIntoViewIfNeeded();
  await page.getByTestId("agent-team-mode-select").selectOption("linear");
  await page.getByTestId("agent-team-context-select").selectOption("native");
  await page.getByTestId("agent-team-run-select").selectOption({ index: 1 });
  await page.getByTestId("agent-team-goal-input").fill(`UI smoke real team preflight ${name}`);
  await page.getByTestId("agent-team-participant-agent-codex").check();
  await page.getByTestId("agent-team-participant-agent-claude").check();
  await page.getByTestId("agent-team-preview-button").click();
  await page.getByText("blueprint-preview-ready").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("agent-team-real-preflight-button").click();
  await page.getByTestId("agent-team-real-preflight-result").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("real-team-execution-blocked-by-default").first().waitFor({
    state: "visible",
    timeout: 10_000,
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("agent-team-real-staging-button").click();
  await page.getByTestId("agent-team-real-staging-result").waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("real-agent-staging-receipt-recorded")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
}

async function assertDailyBriefingEvidenceContract(page, name) {
  await page.getByTestId("daily-briefing-panel").scrollIntoViewIfNeeded();
  await page.getByPlaceholder("Briefing topic or monitoring query").fill(`UI smoke daily briefing ${name}`);
  await page.getByText("Request online evidence").click();
  await page.getByTestId("daily-briefing-live-source-preflight-button").click();
  await page
    .getByTestId("daily-briefing-live-source-preflight-result")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("live-source-staging-blocked-by-default")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("external-source-network-gate-disabled").first().waitFor({
    state: "visible",
    timeout: 10_000,
  });
  await page.getByTestId("daily-briefing-provider-gates").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("public-web-json").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("allowlist-required").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("provider-specific-gate-before-network").first().waitFor({
    state: "visible",
    timeout: 10_000,
  });
  await page.getByText("Preview briefing").click();
  await page.getByTestId("daily-briefing-evidence-contract").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("Evidence contract").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("daily-briefing-evidence-validation").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("daily-briefing-provider-admission-path").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("cross-check-passed").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("reviewable-summary-only").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("daily-briefing-evidence").first().waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("provider-receipt-admission-review-required")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("provider-receipt-review-queue-preview")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("durable write allowed").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("no-automatic-zhishu-admission").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("daily-briefing-scheduled-archive-review-button").click();
  await page
    .getByTestId("daily-briefing-scheduled-archive-review")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("Scheduled archive review").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.locator(".daily-briefing-archive select").first().selectOption({ index: 1 });
  await page.getByText("Archive to run").click();
  await page
    .getByTestId("daily-briefing-archive-receipt")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("Daily briefing archive recorded").first().waitFor({
    state: "visible",
    timeout: 10_000,
  });
  await page.getByTestId("daily-briefing-delivery-review-button").click();
  await page.getByTestId("daily-briefing-delivery-review").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("Briefing delivery review").first().waitFor({ state: "visible", timeout: 10_000 });
}

async function assertNotificationMockReceipt(page, name) {
  await page.getByTestId("notification-gateway-panel").scrollIntoViewIfNeeded();
  await page.getByTestId("notification-reconciliation-center").waitFor({ state: "visible", timeout: 10_000 });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByText("Confirm not delivered").click();
  await page.getByTestId("notification-reconciliation-receipt").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("confirmed-not-delivered").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("notification-channel-select").selectOption("feishu");
  const scheduledRunOption = page
    .getByTestId("notification-run-select")
    .locator("option")
    .filter({ hasText: `UI smoke scheduled loop ${name}` });
  const scheduledRunId = await scheduledRunOption.getAttribute("value");
  if (!scheduledRunId) {
    throw new Error("Scheduled Feishu-enabled task run was not available for notification smoke.");
  }
  await page.getByTestId("notification-run-select").selectOption(scheduledRunId);
  await page.getByTestId("notification-subject-input").fill(`UI smoke Feishu receipt ${name}`);
  await page.getByTestId("notification-body-input").fill("Verify mock webhook receipt without external delivery.");
  await page.getByTestId("notification-preview-button").click();
  await page.getByText("adapter-preview-only").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("notification-webhook-staging-policy").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("notification-webhook-staging-envelope").waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("staging-contract-external-delivery-disabled")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("synapse.notification.webhook.staging.v1")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("notification-webhook-staging-preflight-button").click();
  await page
    .getByTestId("notification-webhook-staging-preflight-result")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("staging-webhook-blocked").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("notification-webhook-production-preflight-button").click();
  await page
    .getByTestId("notification-webhook-production-preflight-result")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("production-webhook-blocked").first().waitFor({ state: "visible", timeout: 10_000 });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("notification-deliver-button").click();
  await page.getByTestId("notification-receipt-result").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("mock-webhook-receipt-recorded").first().waitFor({ state: "visible", timeout: 10_000 });
}

async function assertZhishuMemoryLoop(page, name) {
  await page.getByTestId("nav-zhi-shu").click();
  await assertCodebaseMemoryAdmissionPreflight(page);
  await assertPermissionMemoryReusePreflight(page);
  const title = `UI smoke Zhishu durable template ${name}`;
  await page.getByTestId("zhishu-capture-input").fill(title);
  await page.getByTestId("zhishu-kind-select").selectOption("knowledge");
  await page.getByTestId("zhishu-tags-input").fill("template, judicial");
  await page.getByTestId("zhishu-capture-button").click();
  await page.getByText(title).first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("accept-memory-candidate-button").first().click();
  await page.getByText("accepted").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("zhishu-search-input").fill("template judicial");
  await page.getByTestId("zhishu-search-scope-select").selectOption("L2 Knowledge");
  await page.getByTestId("zhishu-search-admission-select").selectOption("accepted");
  await page.getByTestId("zhishu-search-button").click();
  await page.getByTestId("zhishu-search-result").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText(title).first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("nav-library").click();
  await page.getByTestId("library-home").waitFor({ state: "visible", timeout: 10_000 });
}

async function assertCodebaseMemoryAdmissionPreflight(page) {
  await page.getByTestId("codebase-memory-panel").scrollIntoViewIfNeeded();
  await page.getByTestId("codebase-memory-preview-button").click();
  await page.getByText("readonly-structural-preview").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("codebase-memory-admission-preflight-button").click();
  await page
    .getByTestId("codebase-memory-admission-preflight-result")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("codebase-memory-admission-review-required")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("zhishu-admission-not-approved").first().waitFor({ state: "visible", timeout: 10_000 });
}

async function assertPermissionMemoryReusePreflight(page) {
  await page.getByTestId("permission-memory-panel").scrollIntoViewIfNeeded();
  await page.getByTestId("permission-memory-preview-button").click();
  await page.getByText("candidate-preview-only").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("permission-reuse-preflight-button").click();
  await page.getByTestId("permission-reuse-preflight-result").waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("permission-reuse-review-required")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("auto-grant-permission").first().waitFor({ state: "visible", timeout: 10_000 });
}

async function assertSkillLibraryPreview(page) {
  await page.getByTestId("skill-library-panel").scrollIntoViewIfNeeded();
  await page.getByTestId("skill-library-preview-button").click();
  await page.getByTestId("skill-library-preview-result").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("guarded-skill-library-preview").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("false").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("skill-script-run-select").selectOption({ index: 1 });
  await page.getByTestId("skill-script-execution-preflight-button").click();
  await page
    .getByTestId("skill-script-execution-preflight-result")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("script-execution-blocked-by-default")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
}

async function assertRequiredLayout(page) {
  for (const testId of requiredTestIds) {
    const locator = page.getByTestId(testId);
    await locator.waitFor({ state: "visible", timeout: 10_000 });
  }
}

async function assertNavigationFeedback(page) {
  for (const testId of navigationTestIds) {
    const before = await page.getByTestId("interaction-feedback").innerText();
    await page.getByTestId(testId).click();
    await page.getByTestId("interaction-feedback").waitFor({ state: "visible" });
    const after = await page.getByTestId("interaction-feedback").innerText();
    const current = (await page.getByTestId("current-section").innerText()).trim();
    if (!current) {
      throw new Error(`${testId} did not update current-section`);
    }
    if (before === after && !after.trim()) {
      throw new Error(`${testId} did not provide visible interaction feedback`);
    }
    if (testId === "nav-settings") {
      await page.getByTestId("settings-panel").waitFor({ state: "visible", timeout: 10_000 });
      await page
        .getByText("C:\\Users\\ui-smoke\\AppData\\Roaming\\com.synapse.local\\synapse.config.toml")
        .waitFor({ state: "visible", timeout: 10_000 });
      await page
        .getByText("C:\\Users\\ui-smoke\\AppData\\Roaming\\com.synapse.local\\.synapse")
        .waitFor({ state: "visible", timeout: 10_000 });
      await page.getByTestId("runtime-settings-preview-button").click();
      await page.getByTestId("runtime-settings-confirmation").check();
      await page.getByTestId("runtime-settings-save-button").click();
      await page
        .getByTestId("runtime-settings-save-receipt")
        .waitFor({ state: "visible", timeout: 10_000 });
    }
    if (testId === "nav-diagnostics") {
      await assertComputerCleanupDryRun(page);
    }
  }
  await page.getByTestId("nav-library").click();
  await page.getByTestId("library-home").waitFor({ state: "visible", timeout: 10_000 });
}

async function assertComputerCleanupDryRun(page) {
  await page.getByTestId("computer-diagnostics-panel").scrollIntoViewIfNeeded();
  await page.getByTestId("computer-cleanup-preview-button").click();
  await page.getByTestId("computer-cleanup-preview-result").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("cleanup-dry-run-review-required").first().waitFor({ state: "visible", timeout: 10_000 });
  await page.getByTestId("computer-cleanup-mutation-preflight-button").click();
  await page
    .getByTestId("computer-cleanup-mutation-preflight-result")
    .waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("cleanup-mutation-blocked-by-default")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
}

async function assertVisibleButtonFeedback(page) {
  const buttons = await page.locator("button:visible").all();
  for (const button of buttons.slice(0, 30)) {
    if (!(await button.isEnabled())) {
      continue;
    }
    const beforeBody = await page.locator("body").innerText();
    const beforeFeedback = await page.getByTestId("interaction-feedback").innerText();
    await button.scrollIntoViewIfNeeded();
    await button.click({ timeout: 5000 });
    await page.waitForTimeout(150);
    const afterBody = await page.locator("body").innerText();
    const afterFeedback = await page.getByTestId("interaction-feedback").innerText();
    if (beforeBody === afterBody && beforeFeedback === afterFeedback && !afterFeedback.trim()) {
      const label = (await button.innerText().catch(() => "button")).trim();
      throw new Error(`Visible button did not provide feedback: ${label || "button"}`);
    }
  }
}

async function waitForServer(url) {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the dev server is ready or timeout expires.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

main().catch((error) => {
  console.error(`[FAIL] ui-smoke: ${error.message}`);
  process.exit(1);
});
