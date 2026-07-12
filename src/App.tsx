import { useEffect, useState } from "react";
import { AgentHarnessPanel } from "./components/AgentHarnessPanel";
import { AgentTeamPanel } from "./components/AgentTeamPanel";
import { CapabilityPreviewPanel } from "./components/CapabilityPreviewPanel";
import { DailyBriefingPanel } from "./components/DailyBriefingPanel";
import { NotificationGatewayPanel } from "./components/NotificationGatewayPanel";
import { AuditPanel } from "./components/AuditPanel";
import { LocalAppBridgePanel } from "./components/LocalAppBridgePanel";
import { DeviceSyncPanel } from "./components/DeviceSyncPanel";
import { BrowserAutomationPanel } from "./components/BrowserAutomationPanel";
import { CapabilityStatusPanel } from "./components/CapabilityStatusPanel";
import { CandidatePanel } from "./components/CandidatePanel";
import { ContextBudgetPanel } from "./components/ContextBudgetPanel";
import { DirectionListPanel } from "./components/DirectionListPanel";
import { DirectionSetupPanel } from "./components/DirectionSetupPanel";
import { ComputerDiagnosticsPanel } from "./components/ComputerDiagnosticsPanel";
import { WebAppShellPanel } from "./components/WebAppShellPanel";
import { CodebaseMemoryPanel } from "./components/CodebaseMemoryPanel";
import { PermissionMemoryPanel } from "./components/PermissionMemoryPanel";
import { QuantLabPanel } from "./components/QuantLabPanel";
import { ExecutionPanel } from "./components/ExecutionPanel";
import { ExecutorContractPanel } from "./components/ExecutorContractPanel";
import { ExperiencePanel } from "./components/ExperiencePanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { InspirationPanel } from "./components/InspirationPanel";
import { LibraryHomePanel } from "./components/LibraryHomePanel";
import { MemoryPanel } from "./components/MemoryPanel";
import { PlanStepsPanel } from "./components/PlanStepsPanel";
import { PolicyPanel } from "./components/PolicyPanel";
import { ProductionReadinessPanel } from "./components/ProductionReadinessPanel";
import { SchedulerStatusPanel } from "./components/SchedulerStatusPanel";
import { SecurityCenterPanel } from "./components/SecurityCenterPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { SagaRecoveryPanel } from "./components/SagaRecoveryPanel";
import { SkillLibraryPanel } from "./components/SkillLibraryPanel";
import { SourceRegistryPanel } from "./components/SourceRegistryPanel";
import { SynthesisPanel } from "./components/SynthesisPanel";
import { TaskRunPanel } from "./components/TaskRunPanel";
import { TracePanel } from "./components/TracePanel";
import { ZhishuCapturePanel } from "./components/ZhishuCapturePanel";
import { ZhishuSearchPanel } from "./components/ZhishuSearchPanel";
import { LanguageSelector } from "./components/LanguageSelector";
import { useActivityLog } from "./app/useActivityLog";
import { useAgentHarness } from "./app/useAgentHarness";
import { useAgentTeam } from "./app/useAgentTeam";
import { useBaigongArsenal } from "./app/useBaigongArsenal";
import { useBrowserAutomation } from "./app/useBrowserAutomation";
import { useComputerDiagnostics } from "./app/useComputerDiagnostics";
import { useContextBudgetPreview } from "./app/useContextBudgetPreview";
import { useDailyBriefing } from "./app/useDailyBriefing";
import { useDeviceSync } from "./app/useDeviceSync";
import { useLocalAppBridge } from "./app/useLocalAppBridge";
import { useNotificationGateway } from "./app/useNotificationGateway";
import { usePlanWorkflow } from "./app/usePlanWorkflow";
import { usePreviewAdapters } from "./app/usePreviewAdapters";
import { useProviderArtifactAdmission } from "./app/useProviderArtifactAdmission";
import { useProductionOverview } from "./app/useProductionOverview";
import { useQuantLab } from "./app/useQuantLab";
import { useSourceAggregation } from "./app/useSourceAggregation";
import { useSourceRegistryPreview } from "./app/useSourceRegistryPreview";
import { useSynapseCorePreviews } from "./app/useSynapseCorePreviews";
import {
  useProtectedSnapshotRollback,
  useTaihengProtectedSnapshots,
} from "./app/useTaihengProtectedSnapshots";
import { useTaihengRuntime } from "./app/useTaihengRuntime";
import { useRuntimeSettings } from "./app/useRuntimeSettings";
import { useXingtaiTaskLoop } from "./app/useXingtaiTaskLoop";
import { useZhishuAdmissionReview } from "./app/useZhishuAdmissionReview";
import { useZhishuCaptureStreams } from "./app/useZhishuCaptureStreams";
import { useZhishuKnowledge } from "./app/useZhishuKnowledge";
import { useI18n } from "./i18n";
import "./App.css";


function App() {
  const { t, text } = useI18n();
  const appVersion = import.meta.env.VITE_SYNAPSE_VERSION || "0.0.0";
  const { activity, setActivity } = useActivityLog(t("activity.waiting"));
  const [activeCognitiveView, setActiveCognitiveView] = useState<
    "knowledge" | "thinking" | "execution"
  >("knowledge");
  const [activeProductSection, setActiveProductSection] = useState("library");
  const {
    auditEvents,
    isRefreshingSecurityCenter,
    loadAuditEvents,
    loadSystemStatus,
    loadZhishuSnapshots,
    refreshSecurityCenter,
    status,
    zhishuSnapshots,
  } = useTaihengRuntime({ setActivity });
  const {
    isLoadingRuntimeSettings,
    isSavingRuntimeSettings,
    loadRuntimeSettings,
    preflightRuntimeSettings,
    runtimeSettingsPreview,
    runtimeSettingsReceipt,
    saveRuntimeSettings,
  } = useRuntimeSettings({ loadSystemStatus, setActivity });
  const {
    activePlanId,
    clearHistory,
    draft,
    executionRecord,
    history,
    isReviewing,
    isSubmitting,
    loadHistory,
    plan,
    reviewCurrentPlan,
    reviewReceipt,
    selectHistory,
    setDraft,
    submitIntent,
  } = usePlanWorkflow({ setActivity });
  const {
    codebaseMemoryPreview,
    codebaseMemoryAdmissionPreflight,
    isPreflightingCodebaseMemoryAdmission,
    isPreviewingCodebaseMemory,
    isPreflightingPermissionReuse,
    isPreflightingSkillScript,
    isExecutingSkillScript,
    isPreviewingPermissionMemory,
    isPreviewingSkillLibrary,
    isPreviewingWebAppShell,
    permissionMemoryPreview,
    permissionReusePreflight,
    preflightPermissionReuse,
    preflightCodebaseMemoryAdmission,
    previewCodebaseMemory,
    previewPermissionMemory,
    previewSkillLibrary,
    previewWebAppShell,
    preflightSkillScriptExecution,
    executeSkillScript,
    skillLibraryPreview,
    skillScriptExecutionPreflight,
    skillScriptExecutionReceipt,
    webAppShellPreview,
  } = usePreviewAdapters({ setActivity, text });
  const {
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
  } = useProductionOverview({ loadAuditEvents, setActivity });
  const {
    executorContractPreview,
    isLoadingExecutorContract,
    isLoadingSynthesis,
    loadExecutorContractPreview,
    loadMemory,
    loadSynthesisPreview,
    memoryItems,
    promoteSynthesisCandidate,
    promotingSynthesisCandidateId,
    synthesisPreview,
    upsertMemoryItem,
  } = useSynapseCorePreviews({
    refreshProductionOverview,
    setActivity,
  });
  const { loadProtectedSnapshots, protectedSnapshots } = useTaihengProtectedSnapshots();
  const {
    directionDescription,
    directionFrequency,
    directionKeywords,
    directionOnlineEnabled,
    directionOutputTemplate,
    directionPriority,
    directionPushChannels,
    directionPushEnabled,
    directionTitle,
    executeTaskRun,
    executingRunId,
    generateTaskCandidates,
    isMiningTasks,
    isSavingDirection,
    isTickingScheduler,
    loadTaskArtifacts,
    loadTaskCandidates,
    loadTaskDirections,
    loadTaskRunRecords,
    loadTaskSchedulePreviews,
    promoteTaskArtifact,
    promotingArtifactId,
    requestTaskRun,
    requestingRunDirectionId,
    reviewTaskCandidate,
    reviewTaskRun,
    reviewingCandidateId,
    reviewingRunId,
    runSchedulerTick,
    saveTaskDirection,
    setDirectionDescription,
    setDirectionFrequency,
    setDirectionKeywords,
    setDirectionOnlineEnabled,
    setDirectionOutputTemplate,
    setDirectionPriority,
    setDirectionPushEnabled,
    setDirectionTitle,
    setTaskDirectionActive,
    taskArtifacts,
    taskCandidates,
    taskDirections,
    taskRunRecords,
    taskSchedulePreviews,
    toggleDirectionPushChannel,
    updateTaskRunState,
    updatingDirectionId,
    updatingRunId,
  } = useXingtaiTaskLoop({
    loadAuditEvents,
    loadExecutorContractPreview,
    loadMemory,
    loadProtectedSnapshots,
    loadSynthesisPreview,
    loadZhishuSnapshots,
    refreshProductionOverview,
    setActivity,
  });
  const {
    archiveQuantResearch,
    isArchivingQuant,
    isResearchingQuant,
    previewQuantResearch,
    quantResearchReport,
  } = useQuantLab({
    loadTaskArtifacts,
    loadTaskRunRecords,
    refreshProductionOverview,
    setActivity,
  });
  const {
    arsenalPreview,
    isLoadingArsenal,
    isRunningMockAdapter,
    loadArsenalPreview,
    mockAdapterInput,
    mockAdapterReceipt,
    mockAdapterRunId,
    runMockAdapter,
    setMockAdapterInput,
    setMockAdapterRunId,
    setToolAllowState,
    updatingToolId,
  } = useBaigongArsenal({
    loadAuditEvents,
    loadProtectedSnapshots,
    loadTaskArtifacts,
    refreshProductionOverview,
    setActivity,
  });
  const {
    rollbackProtectedSnapshot,
    rollingBackProtectedSnapshotId,
  } = useProtectedSnapshotRollback({
    loadArsenalPreview,
    loadAuditEvents,
    loadExecutorContractPreview,
    loadProtectedSnapshots,
    loadTaskDirections,
    loadTaskSchedulePreviews,
    refreshProductionOverview,
    setActivity,
  });
  const {
    contextBudgetDraft,
    contextBudgetPreview,
    isPreviewingContextBudget,
    previewContextBudget,
    setContextBudgetDraft,
  } = useContextBudgetPreview({ setActivity });
  const {
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
  } = useZhishuCaptureStreams({
    loadMemory,
    loadSynthesisPreview,
    refreshProductionOverview,
    setActivity,
  });
  const {
    providerArtifactZhishuFinalReviewReceipt,
    reviewMemoryItem,
    reviewingMemoryItemId,
    rollbackZhishuSnapshot,
    rollingBackSnapshotId,
  } = useZhishuAdmissionReview({
    loadMemory,
    loadSynthesisPreview,
    loadTaskCandidates,
    loadZhishuSnapshots,
    memoryItems,
    refreshProductionOverview,
    setActivity,
  });
  const {
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
  } = useNotificationGateway({
    loadTaskArtifacts,
    refreshProductionOverview,
    setActivity,
    text,
  });
  const {
    agentTeamPreview,
    agentTeamReceipt,
    cancelRealAgentTeam,
    executeFakeAgentTeam,
    executeRealAgentTeam,
    isExecutingAgentTeam,
    isExecutingRealAgentTeam,
    isCancellingRealAgentTeam,
    isPreflightingRealAgentTeam,
    isPreviewingAgentTeam,
    isStagingRealAgentTeam,
    preflightRealAgentTeam,
    previewAgentTeam,
    realAgentTeamPreflight,
    realAgentTeamExecutionReceipt,
    realAgentTeamStagingReceipt,
    stageRealAgentTeam,
  } = useAgentTeam({
    loadTaskArtifacts,
    refreshProductionOverview,
    setActivity,
    text,
  });
  const {
    agentAdapterSmokeReport,
    agentDryRunReceipt,
    agentExecutionReceipt,
    dryRunAgentHarness,
    executeCodexAgent,
    isExecutingCodexAgent,
    isPreflightingRealAgent,
    isRunningAgentHarness,
    isSmokingAgentAdapters,
    preflightRealAgentExecution,
    realAgentPreflight,
    smokeAgentAdapters,
  } = useAgentHarness({
    loadExecutorContractPreview,
    loadTaskArtifacts,
    loadTaskRunRecords,
    refreshProductionOverview,
    setActivity,
  });
  const {
    captureZhishuItem,
    exportZhishuRepository,
    generateZhishuRelations,
    importZhishuRepository,
    isGeneratingZhishuRelations,
    isImportingZhishuRepository,
    isSavingZhishu,
    isScanningZhishuMaintenance,
    isSearchingZhishu,
    loadZhishuMaintenanceFindings,
    loadZhishuRelations,
    reviewZhishuMaintenanceFinding,
    reviewZhishuRelation,
    reviewingMaintenanceFindingId,
    reviewingRelationId,
    scanZhishuMaintenance,
    searchZhishu,
    setZhishuDraft,
    setZhishuKind,
    setZhishuRepositoryBundle,
    setZhishuSearchQuery,
    setZhishuTags,
    zhishuDraft,
    zhishuKind,
    zhishuMaintenanceFindings,
    zhishuRelations,
    zhishuRepositoryBundle,
    zhishuRepositoryImportReceipt,
    zhishuSearchQuery,
    zhishuSearchResponse,
    zhishuTags,
  } = useZhishuKnowledge({
    loadMemory,
    loadSynthesisPreview,
    refreshProductionOverview,
    setActivity,
  });
  const {
    deviceSyncImportApplyPreflight,
    deviceSyncImportPreview,
    deviceSyncImportReceipt,
    deviceSyncPackage,
    deviceSyncPackageJson,
    deviceSyncState,
    exportDeviceSyncPackage,
    importDeviceSyncPackage,
    isExportingDeviceSync,
    isPreflightingDeviceSyncImport,
    isImportingDeviceSync,
    isPreviewingDeviceSyncImport,
    loadDeviceSyncState,
    preflightDeviceSyncImportApply,
    previewDeviceSyncImport,
    previewSyncRelay,
    relayPreview,
    setDeviceSyncPackageJson,
  } = useDeviceSync({
    loadMemory,
    loadZhishuMaintenanceFindings,
    loadZhishuRelations,
    refreshProductionOverview,
    setActivity,
    text,
  });
  const {
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
    fetchDailyBriefingLiveSource,
    preflightDailyBriefingLiveSources,
    previewDailyBriefing,
    reviewDailyBriefingDelivery,
    reviewScheduledDailyBriefingArchive,
  } = useDailyBriefing({
    loadTaskArtifacts,
    loadTaskRunRecords,
    refreshProductionOverview,
    setActivity,
    text,
  });
  const {
    browserInspectionPreview,
    browserInspectionReceipt,
    browserWriteStagingPreflight,
    executeBrowserInspection,
    isExecutingBrowserInspection,
    isPreflightingBrowserWriteStaging,
    isPreviewingBrowserInspection,
    preflightBrowserWriteStaging,
    previewBrowserInspection,
  } = useBrowserAutomation({
    loadExecutorContractPreview,
    loadTaskArtifacts,
    loadTaskRunRecords,
    refreshProductionOverview,
    setActivity,
  });
  const {
    executeLocalAppLaunch,
    isExecutingLocalApp,
    isPreflightingLocalApp,
    isPreviewingLocalApp,
    loadLocalApps,
    localAppLaunchPreflight,
    localAppAllowStateReceipt,
    localAppLaunchPreview,
    localAppLaunchReceipt,
    localApps,
    preflightLocalAppLaunch,
    previewLocalAppLaunch,
    setLocalAppAllowState,
    updatingLocalAppId,
  } = useLocalAppBridge({
    loadTaskArtifacts,
    refreshProductionOverview,
    setActivity,
  });
  const {
    archiveDiagnostics: archiveComputerDiagnostics,
    cleanupMutationPreflight: computerCleanupMutationPreflight,
    cleanupPreview: computerCleanupPreview,
    isArchiving: isArchivingComputerDiagnostics,
    isPreflightingCleanupMutation: isPreflightingComputerCleanupMutation,
    isPreviewing: isPreviewingComputerDiagnostics,
    isPreviewingCleanup: isPreviewingComputerCleanup,
    preflightCleanupMutation: preflightComputerCleanupMutation,
    previewCleanup: previewComputerCleanup,
    previewDiagnostics: previewComputerDiagnostics,
    report: computerDiagnosticReport,
  } = useComputerDiagnostics({
    loadTaskArtifacts,
    loadTaskRunRecords,
    refreshProductionOverview,
    setActivity,
  });
  const {
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
  } = useSourceAggregation({ setActivity });
  const {
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
  } = useSourceRegistryPreview();
  const {
    createProviderArtifactZhishuCandidate,
    createProviderReceiptTaskArtifact,
    creatingProviderArtifactZhishuCandidateId,
    creatingProviderTaskArtifactCandidateId,
    isPreflightingProviderReceiptAdmission,
    isPreviewingProviderAdapterReceipt,
    isPreviewingProviderReceiptAdmissionQueue,
    isStagingProviderReceiptReviewCandidate,
    preflightProviderArtifactZhishuAdmission,
    preflightProviderReceiptAdmission,
    preflightProviderReceiptTaskArtifact,
    preflightingProviderArtifactZhishuId,
    preflightingProviderTaskArtifactCandidateId,
    previewProviderAdapterLoopbackReceipt,
    previewProviderReceiptAdmissionQueue,
    providerAdapterReceipt,
    providerArtifactAdmissionReviewReceipt,
    providerArtifactZhishuAdmissionPreflight,
    providerArtifactZhishuCandidateReceipt,
    providerReceiptAdmissionPreflight,
    providerReceiptAdmissionQueuePreview,
    providerReceiptReviewCandidates,
    providerReceiptReviewDecisionReceipt,
    providerReceiptReviewQueueReceipt,
    providerReceiptTaskArtifactPreflight,
    providerReceiptTaskArtifactReceipt,
    reviewProviderArtifactZhishuAdmission,
    reviewProviderReceiptReviewCandidate,
    reviewingProviderArtifactZhishuId,
    reviewingProviderReceiptCandidateId,
    stageProviderReceiptReviewCandidate,
  } = useProviderArtifactAdmission({
    loadAuditEvents,
    loadTaskArtifacts,
    refreshProductionOverview,
    setActivity,
    upsertMemoryItem,
  });

  useEffect(() => {
    loadSystemStatus();
    loadRuntimeSettings();
    loadHistory(true);
    loadAuditEvents();
    loadMemory();
    loadZhishuRelations();
    loadZhishuMaintenanceFindings();
    loadZhishuSnapshots();
    loadProtectedSnapshots();
    loadTaskDirections();
    loadTaskSchedulePreviews();
    loadTaskCandidates();
    loadTaskRunRecords();
    loadTaskArtifacts();
    loadExecutorContractPreview();
    loadArsenalPreview();
    loadLocalApps();
    loadNotificationDeliveryAttempts();
    loadDeviceSyncState();
    loadSourceObservationHistory();
    loadSourceHealthReport();
    loadSourceRegistryPreview();
    loadSynthesisPreview();
    loadLibraryHomePreview();
    loadProductionReadinessPreview();
    loadSagaRecoveryPreview();
  }, []);

  const productNavigation = [
    {
      id: "library",
      label: text("Library Home"),
      view: "knowledge" as const,
      feedback: text("Library Home is open."),
    },
    {
      id: "zhi-shu",
      label: text("Zhishu"),
      view: "knowledge" as const,
      feedback: text("Zhishu knowledge and memory workspace is open."),
    },
    {
      id: "tai-heng",
      label: text("Taiheng"),
      view: "thinking" as const,
      feedback: text("Taiheng governance, audit, and permission gates are open."),
    },
    {
      id: "xing-tai",
      label: text("Xingtai"),
      view: "execution" as const,
      feedback: text("Xingtai task and schedule workspace is open."),
    },
    {
      id: "bai-gong",
      label: text("Baigong"),
      view: "execution" as const,
      feedback: text("Baigong tools and automation workspace is open."),
    },
    {
      id: "settings",
      label: text("Settings"),
      view: "thinking" as const,
      feedback: text("Runtime settings and safety gates are open."),
    },
    {
      id: "diagnostics",
      label: text("Logs / diagnostics"),
      view: "execution" as const,
      feedback: text("Logs and diagnostics are available through the activity stream and diagnostics panels."),
    },
  ];
  const currentProductSection =
    productNavigation.find((item) => item.id === activeProductSection) ?? productNavigation[0];

  function openProductSection(section: (typeof productNavigation)[number]) {
    setActiveProductSection(section.id);
    setActiveCognitiveView(section.view);
    setActivity(section.feedback);
  }

  return (
    <main className="shell cognitive-shell" data-testid="app-shell">
      <header className="topbar cognitive-topbar">
        <div>
          <p className="eyebrow">{t("topbar.eyebrow")}</p>
          <h2>{t("topbar.title")}</h2>
        </div>
        <div className="topbar-status-grid">
          <div className="status-pill">{status?.sandbox ?? "..."}</div>
          <div className="topbar-chip">
            <span>{t("cognitive.modelStatus")}</span>
            <strong>{status?.mode ?? t("mode.loading")}</strong>
          </div>
          <div className="topbar-chip">
            <span>{t("cognitive.tokenBudget")}</span>
            <strong>{status?.max_steps ?? "..."} {t("overview.steps")}</strong>
          </div>
        </div>
      </header>

      <aside className="sidebar cognitive-sidebar">
        <div>
          <p className="eyebrow">Synapse {appVersion}</p>
          <h1>{status?.app_name ?? t("app.nameFallback")}</h1>
        </div>

        <nav className="nav" aria-label={t("nav.primary")} data-testid="main-navigation">
          {productNavigation.map((section) => (
            <button
              className={activeProductSection === section.id ? "nav-item active" : "nav-item"}
              data-testid={`nav-${section.id}`}
              key={section.id}
              type="button"
              onClick={() => openProductSection(section)}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div className="current-section-card" data-testid="current-section">
          <span>{text("Current section")}</span>
          <strong>{currentProductSection.label}</strong>
        </div>

        <section className="knowledge-tree" aria-label={t("cognitive.knowledgeTree")}>
          <p className="eyebrow">{t("cognitive.knowledgeTree")}</p>
          <div className="knowledge-node active">
            <strong>{t("terms.zhishu")}</strong>
            <span>{memoryItems.length} {t("cognitive.items")}</span>
          </div>
          <div className="knowledge-node">
            <strong>{t("terms.xingtai")}</strong>
            <span>{taskDirections.length} {t("cognitive.directions")}</span>
          </div>
          <div className="knowledge-node">
            <strong>{t("terms.baigong")}</strong>
            <span>{arsenalPreview?.tools.length ?? 0} {t("cognitive.tools")}</span>
          </div>
          <div className="knowledge-node">
            <strong>{t("terms.taiheng")}</strong>
            <span>{auditEvents.length} {t("cognitive.auditEvents")}</span>
          </div>
        </section>

        <div className="mode-panel">
          <span>{t("mode.current")}</span>
          <strong>{status?.mode ?? t("mode.loading")}</strong>
          <small>{status?.instance_id ?? "synapse-local"}</small>
        </div>
        <LanguageSelector />
      </aside>

      <section className="workspace cognitive-workspace" aria-label={t("app.workspaceAria")}>
        <section className="overview cognitive-overview" aria-label={t("overview.aria")}>
          <div className="metric">
            <span>{t("overview.executionLevel")}</span>
            <strong>{status?.execution_level ?? "..."}</strong>
          </div>
          <div className="metric">
            <span>{t("overview.memoryIsolation")}</span>
            <strong>{status?.memory_scopes.length ?? 0} {t("overview.layers")}</strong>
          </div>
          <div className="metric">
            <span>{t("overview.stepBudget")}</span>
            <strong>{status?.max_steps ?? "..."} {t("overview.steps")}</strong>
          </div>
          <div className={status?.config_warnings.length ? "metric warning" : "metric"}>
            <span>{t("overview.configHealth")}</span>
            <strong>{status?.config_warnings.length ? t("overview.configWarnings") : t("overview.configClean")}</strong>
          </div>
        </section>

        {status && status.config_warnings.length > 0 && (
          <section className="panel warning-panel cognitive-warning">
            <div className="panel-heading">
              <p className="eyebrow">{t("runtimeConfig.eyebrow")}</p>
              <h3>{t("runtimeConfig.warnings")}</h3>
            </div>
            <div className="warning-list">
              {status.config_warnings.map((warning) => (
                <span key={warning}>{warning}</span>
              ))}
            </div>
          </section>
        )}

        <section className="cognitive-ide-grid">
          <section className="cognitive-main" aria-label={t("cognitive.mainWorkspace")}>
            <div className="cognitive-tabs" role="tablist" aria-label={t("cognitive.viewTabs")}>
              {(["knowledge", "thinking", "execution"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  role="tab"
                  data-testid={`cognitive-tab-${view}`}
                  aria-selected={activeCognitiveView === view}
                  className={activeCognitiveView === view ? "cognitive-tab active" : "cognitive-tab"}
                  onClick={() => setActiveCognitiveView(view)}
                >
                  <strong>{t(`cognitive.${view}`)}</strong>
                  <span>{t(`cognitive.${view}Hint`)}</span>
                </button>
              ))}
            </div>

            {activeCognitiveView === "knowledge" && (
              <section className="cognitive-view">
                <LibraryHomePanel
                  isRefreshing={isRefreshingLibraryHome}
                  onRefresh={refreshProductionOverview}
                  preview={libraryHomePreview}
                />
                <section className="memory-grid">
                  <InspirationPanel
                    draft={inspirationDraft}
                    isCapturing={isCapturing}
                    onCapture={captureInspiration}
                    onDraftChange={setInspirationDraft}
                    onTagsChange={setInspirationTags}
                    tags={inspirationTags}
                  />
                  <ExperiencePanel
                    draft={experienceDraft}
                    isSaving={isSavingExperience}
                    onCapture={captureExperience}
                    onDraftChange={setExperienceDraft}
                    onTagsChange={setExperienceTags}
                    onTypeChange={setExperienceType}
                    tags={experienceTags}
                    type={experienceType}
                  />
                  <ZhishuCapturePanel
                    draft={zhishuDraft}
                    isSaving={isSavingZhishu}
                    kind={zhishuKind}
                    onCapture={captureZhishuItem}
                    onDraftChange={setZhishuDraft}
                    onKindChange={setZhishuKind}
                    onTagsChange={setZhishuTags}
                    tags={zhishuTags}
                  />
                  <MemoryPanel
                    items={memoryItems}
                    onRollback={rollbackZhishuSnapshot}
                    onReview={reviewMemoryItem}
                    rollingBackSnapshotId={rollingBackSnapshotId}
                    reviewingItemId={reviewingMemoryItemId}
                    snapshots={zhishuSnapshots}
                  />
                  {providerArtifactZhishuFinalReviewReceipt && (
                    <div
                      className="retrieval-contract"
                      data-testid="provider-artifact-zhishu-final-review-result"
                    >
                      <span>{text("Provider artifact Zhishu final review")}</span>
                      <strong>{text(providerArtifactZhishuFinalReviewReceipt.state)}</strong>
                      <p>
                        {providerArtifactZhishuFinalReviewReceipt.memory_item.id} /{" "}
                        {text(
                          providerArtifactZhishuFinalReviewReceipt.memory_item.admission_state ??
                            providerArtifactZhishuFinalReviewReceipt.memory_item.verification,
                        )}
                      </p>
                      <small>
                        {text("confirmed knowledge write")}:{" "}
                        {text(
                          providerArtifactZhishuFinalReviewReceipt.confirmed_knowledge_write_started
                            ? "true"
                            : "false",
                        )}
                      </small>
                      <div className="policy-tiers">
                        {providerArtifactZhishuFinalReviewReceipt.gates.map((gate) => (
                          <span key={gate}>{text(gate)}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <ZhishuSearchPanel
                    isGeneratingRelations={isGeneratingZhishuRelations}
                    isImportingRepository={isImportingZhishuRepository}
                    isScanningMaintenance={isScanningZhishuMaintenance}
                    isSearching={isSearchingZhishu}
                    maintenanceFindings={zhishuMaintenanceFindings}
                    onGenerateRelations={generateZhishuRelations}
                    onExportRepository={exportZhishuRepository}
                    onImportRepository={importZhishuRepository}
                    onQueryChange={setZhishuSearchQuery}
                    onReviewMaintenanceFinding={reviewZhishuMaintenanceFinding}
                    onReviewRelation={reviewZhishuRelation}
                    onScanMaintenance={scanZhishuMaintenance}
                    onSearch={searchZhishu}
                    onRepositoryBundleChange={setZhishuRepositoryBundle}
                    query={zhishuSearchQuery}
                    repositoryBundle={zhishuRepositoryBundle}
                    repositoryImportReceipt={zhishuRepositoryImportReceipt}
                    relations={zhishuRelations}
                    response={zhishuSearchResponse}
                    reviewingMaintenanceFindingId={reviewingMaintenanceFindingId}
                    reviewingRelationId={reviewingRelationId}
                  />
                </section>
                <SourceRegistryPanel
                  enablementPreflight={sourceEnablementPreflight}
                  isPreflightingEnablement={isPreflightingSourceEnablement}
                  isReviewingEnablement={isReviewingSourceEnablement}
                  isRefreshing={isLoadingSourceRegistry}
                  isCheckingHealth={isCheckingSourceHealth}
                  healthPreflight={sourceHealthCheckPreflight}
                  healthReceipt={sourceHealthCheckReceipt}
                  onPreflightHealth={preflightSourceHealthCheck}
                  onExecuteHealth={executeSourceHealthCheck}
                  onPreflightEnablement={preflightSourceEnablement}
                  onReviewEnablement={reviewSourceEnablement}
                  onRefresh={loadSourceRegistryPreview}
                  preview={sourceRegistryPreview}
                  reviewReceipt={sourceEnablementReviewReceipt}
                />
                <CodebaseMemoryPanel
                  admissionPreflight={codebaseMemoryAdmissionPreflight}
                  isPreflightingAdmission={isPreflightingCodebaseMemoryAdmission}
                  isPreviewing={isPreviewingCodebaseMemory}
                  onPreflightAdmission={preflightCodebaseMemoryAdmission}
                  onPreview={previewCodebaseMemory}
                  preview={codebaseMemoryPreview}
                />
                <PermissionMemoryPanel
                  isPreflightingReuse={isPreflightingPermissionReuse}
                  isPreviewing={isPreviewingPermissionMemory}
                  onPreflightReuse={preflightPermissionReuse}
                  onPreview={previewPermissionMemory}
                  preview={permissionMemoryPreview}
                  reusePreflight={permissionReusePreflight}
                />
                <SkillLibraryPanel
                  isExecutingScript={isExecutingSkillScript}
                  isPreflightingScript={isPreflightingSkillScript}
                  isPreviewing={isPreviewingSkillLibrary}
                  onPreflightScript={preflightSkillScriptExecution}
                  onExecuteScript={executeSkillScript}
                  onPreview={previewSkillLibrary}
                  preview={skillLibraryPreview}
                  scriptPreflight={skillScriptExecutionPreflight}
                  scriptReceipt={skillScriptExecutionReceipt}
                  runs={taskRunRecords}
                />
              </section>
            )}

            {activeCognitiveView === "thinking" && (
              <section className="cognitive-view">
                {activeProductSection === "settings" && (
                  <SettingsPanel
                    isLoadingRuntimeSettings={isLoadingRuntimeSettings}
                    isSavingRuntimeSettings={isSavingRuntimeSettings}
                    onPreflightRuntimeSettings={preflightRuntimeSettings}
                    onSaveRuntimeSettings={saveRuntimeSettings}
                    runtimeSettingsPreview={runtimeSettingsPreview}
                    runtimeSettingsReceipt={runtimeSettingsReceipt}
                    status={status}
                  />
                )}
                <section className="panel intent-panel">
                  <div className="panel-heading">
                    <p className="eyebrow">{t("intent.eyebrow")}</p>
                    <h3>{t("intent.title")}</h3>
                  </div>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      submitIntent();
                    }}
                  >
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.currentTarget.value)}
                      placeholder={t("intent.placeholder")}
                    />
                    <button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? t("intent.working") : t("intent.submit")}
                    </button>
                  </form>
                </section>
                <section className="content-grid">
                  <TracePanel activity={activity} plan={plan} />
                  <PlanStepsPanel plan={plan} status={status} />
                </section>
                <CandidatePanel
                  candidates={taskCandidates}
                  onReview={reviewTaskCandidate}
                  reviewingCandidateId={reviewingCandidateId}
                />
                <SynthesisPanel
                  isLoading={isLoadingSynthesis}
                  onPromote={promoteSynthesisCandidate}
                  onRefresh={loadSynthesisPreview}
                  preview={synthesisPreview}
                  promotingCandidateId={promotingSynthesisCandidateId}
                />
                <PolicyPanel plan={plan} />
                <ContextBudgetPanel
                  draft={contextBudgetDraft}
                  isPreviewing={isPreviewingContextBudget}
                  onDraftChange={setContextBudgetDraft}
                  onPreview={previewContextBudget}
                  preview={contextBudgetPreview}
                />
                <AuditPanel
                  isReviewing={isReviewing}
                  onReviewPlan={reviewCurrentPlan}
                  plan={plan}
                  reviewReceipt={reviewReceipt}
                />
                <HistoryPanel
                  activePlanId={activePlanId}
                  history={history}
                  onClear={clearHistory}
                  onSelect={selectHistory}
                />
              </section>
            )}

            {activeCognitiveView === "execution" && (
              <section className="cognitive-view" data-testid="execution-workspace">
                <section className="task-center-grid">
                  <DirectionSetupPanel
                    description={directionDescription}
                    frequency={directionFrequency}
                    isSaving={isSavingDirection}
                    keywords={directionKeywords}
                    onDescriptionChange={setDirectionDescription}
                    onFrequencyChange={setDirectionFrequency}
                    onKeywordsChange={setDirectionKeywords}
                    onOnlineEnabledChange={setDirectionOnlineEnabled}
                    onOutputTemplateChange={setDirectionOutputTemplate}
                    onPriorityChange={setDirectionPriority}
                    onPushChannelToggle={toggleDirectionPushChannel}
                    onPushEnabledChange={setDirectionPushEnabled}
                    onSave={saveTaskDirection}
                    onTitleChange={setDirectionTitle}
                    onlineEnabled={directionOnlineEnabled}
                    outputTemplate={directionOutputTemplate}
                    priority={directionPriority}
                    pushChannels={directionPushChannels}
                    pushEnabled={directionPushEnabled}
                    title={directionTitle}
                  />
                  <DirectionListPanel
                    directions={taskDirections}
                    isMining={isMiningTasks}
                    onMine={generateTaskCandidates}
                    onRequestRun={requestTaskRun}
                    onSetActive={setTaskDirectionActive}
                    requestingDirectionId={requestingRunDirectionId}
                    schedulePreviews={taskSchedulePreviews}
                    updatingDirectionId={updatingDirectionId}
                  />
                </section>
                <TaskRunPanel
                  artifacts={taskArtifacts}
                  creatingProviderArtifactZhishuCandidateId={creatingProviderArtifactZhishuCandidateId}
                  executingRunId={executingRunId}
                  isTicking={isTickingScheduler}
                  onArchive={(runId) => updateTaskRunState(runId, "archive")}
                  onCancel={(runId) => updateTaskRunState(runId, "cancel")}
                  onCreateProviderArtifactZhishuCandidate={createProviderArtifactZhishuCandidate}
                  onExecute={executeTaskRun}
                  onPreflightProviderArtifactZhishuAdmission={preflightProviderArtifactZhishuAdmission}
                  onPromoteArtifact={promoteTaskArtifact}
                  onReviewProviderArtifactZhishuAdmission={reviewProviderArtifactZhishuAdmission}
                  onSchedulerTick={runSchedulerTick}
                  onReview={reviewTaskRun}
                  preflightingProviderArtifactZhishuId={preflightingProviderArtifactZhishuId}
                  promotingArtifactId={promotingArtifactId}
                  promotedArtifactIds={memoryItems.flatMap((item) =>
                    item.tags
                      .filter((tag) => tag.startsWith("artifact:"))
                      .map((tag) => tag.slice("artifact:".length)),
                  )}
                  providerArtifactAdmissionReviewReceipt={providerArtifactAdmissionReviewReceipt}
                  providerArtifactZhishuAdmissionPreflight={providerArtifactZhishuAdmissionPreflight}
                  providerArtifactZhishuCandidateReceipt={providerArtifactZhishuCandidateReceipt}
                  records={taskRunRecords}
                  reviewingProviderArtifactZhishuId={reviewingProviderArtifactZhishuId}
                  reviewingRunId={reviewingRunId}
                  updatingRunId={updatingRunId}
                />
                <ExecutionPanel executionRecord={executionRecord} plan={plan} />
                <ExecutorContractPanel
                  isLoading={isLoadingExecutorContract}
                  onRefresh={loadExecutorContractPreview}
                  preview={executorContractPreview}
                />
                <CapabilityPreviewPanel
                  aggregationPreview={aggregationPreview}
                  arsenalPreview={arsenalPreview}
                  isLoadingAggregation={isPreviewingAggregation}
                  isLoadingArsenal={isLoadingArsenal}
                  isImportingSources={isImportingSources}
                  isFetchingHttpSource={isFetchingHttpSource}
                  isPreviewingProviderAdapterReceipt={isPreviewingProviderAdapterReceipt}
                  isPreflightingProviderReceiptAdmission={isPreflightingProviderReceiptAdmission}
                  isPreviewingProviderReceiptAdmissionQueue={isPreviewingProviderReceiptAdmissionQueue}
                  isStagingProviderReceiptReviewCandidate={isStagingProviderReceiptReviewCandidate}
                  reviewingProviderReceiptCandidateId={reviewingProviderReceiptCandidateId}
                  preflightingProviderTaskArtifactCandidateId={
                    preflightingProviderTaskArtifactCandidateId
                  }
                  creatingProviderTaskArtifactCandidateId={creatingProviderTaskArtifactCandidateId}
                  preflightingProviderArtifactZhishuId={preflightingProviderArtifactZhishuId}
                  reviewingProviderArtifactZhishuId={reviewingProviderArtifactZhishuId}
                  creatingProviderArtifactZhishuCandidateId={creatingProviderArtifactZhishuCandidateId}
                  isLoadingSourceHealth={isLoadingSourceHealth}
                  isRunningMockAdapter={isRunningMockAdapter}
                  mockAdapterInput={mockAdapterInput}
                  mockAdapterReceipt={mockAdapterReceipt}
                  mockAdapterRunId={mockAdapterRunId}
                  httpSourceReceipt={httpSourceReceipt}
                  providerAdapterReceipt={providerAdapterReceipt}
                  providerReceiptAdmissionPreflight={providerReceiptAdmissionPreflight}
                  providerReceiptAdmissionQueuePreview={providerReceiptAdmissionQueuePreview}
                  providerReceiptReviewQueueReceipt={providerReceiptReviewQueueReceipt}
                  providerReceiptReviewDecisionReceipt={providerReceiptReviewDecisionReceipt}
                  providerReceiptTaskArtifactPreflight={providerReceiptTaskArtifactPreflight}
                  providerReceiptTaskArtifactReceipt={providerReceiptTaskArtifactReceipt}
                  providerArtifactZhishuAdmissionPreflight={providerArtifactZhishuAdmissionPreflight}
                  providerArtifactAdmissionReviewReceipt={providerArtifactAdmissionReviewReceipt}
                  providerArtifactZhishuCandidateReceipt={providerArtifactZhishuCandidateReceipt}
                  providerReceiptReviewCandidates={providerReceiptReviewCandidates}
                  sourceImportContent={sourceImportContent}
                  sourceImportFormat={sourceImportFormat}
                  sourceImportReceipt={sourceImportReceipt}
                  sourceHealthReport={sourceHealthReport}
                  onAggregationQueryChange={setAggregationQuery}
                  onOnlineEnabledChange={setAggregationOnlineEnabled}
                  onMockAdapterInputChange={setMockAdapterInput}
                  onMockAdapterRunIdChange={setMockAdapterRunId}
                  onRunMockAdapter={runMockAdapter}
                  onFetchHttpSource={fetchConfiguredHttpSource}
                  onPreviewProviderAdapterReceipt={previewProviderAdapterLoopbackReceipt}
                  onPreflightProviderReceiptAdmission={preflightProviderReceiptAdmission}
                  onPreviewProviderReceiptAdmissionQueue={previewProviderReceiptAdmissionQueue}
                  onStageProviderReceiptReviewCandidate={stageProviderReceiptReviewCandidate}
                  onReviewProviderReceiptReviewCandidate={reviewProviderReceiptReviewCandidate}
                  onPreflightProviderReceiptTaskArtifact={preflightProviderReceiptTaskArtifact}
                  onCreateProviderReceiptTaskArtifact={createProviderReceiptTaskArtifact}
                  onPreflightProviderArtifactZhishuAdmission={preflightProviderArtifactZhishuAdmission}
                  onReviewProviderArtifactZhishuAdmission={reviewProviderArtifactZhishuAdmission}
                  onCreateProviderArtifactZhishuCandidate={createProviderArtifactZhishuCandidate}
                  onSourceImportContentChange={setSourceImportContent}
                  onSourceImportFormatChange={setSourceImportFormat}
                  onSubmitSourceImport={importSourceObservations}
                  onPreviewAggregation={previewAggregation}
                  onRefreshArsenal={loadArsenalPreview}
                  onRefreshSecurityCenter={refreshSecurityCenter}
                  onRefreshSourceHealth={loadSourceHealthReport}
                  onSetToolAllowState={setToolAllowState}
                  onlineEnabled={aggregationOnlineEnabled}
                  query={aggregationQuery}
                  sourceObservationHistory={sourceObservationHistory}
                  updatingToolId={updatingToolId}
                />
                <AgentHarnessPanel
                  arsenalPreview={arsenalPreview}
                  executionReceipt={agentExecutionReceipt}
                  isExecuting={isExecutingCodexAgent}
                  isPreflightingRealAgent={isPreflightingRealAgent}
                  isSmokingAdapters={isSmokingAgentAdapters}
                  isRunning={isRunningAgentHarness}
                  onDryRun={dryRunAgentHarness}
                  onExecute={executeCodexAgent}
                  onPreflightRealAgent={preflightRealAgentExecution}
                  onSmokeAdapters={smokeAgentAdapters}
                  realAgentPreflight={realAgentPreflight}
                  receipt={agentDryRunReceipt}
                  smokeReport={agentAdapterSmokeReport}
                  runs={taskRunRecords}
                />
                <AgentTeamPanel
                  arsenalPreview={arsenalPreview}
                  isExecuting={isExecutingAgentTeam}
                  isExecutingReal={isExecutingRealAgentTeam}
                  isCancellingReal={isCancellingRealAgentTeam}
                  isPreflightingReal={isPreflightingRealAgentTeam}
                  isStagingReal={isStagingRealAgentTeam}
                  isPreviewing={isPreviewingAgentTeam}
                  onExecute={executeFakeAgentTeam}
                  onExecuteReal={executeRealAgentTeam}
                  onCancelReal={cancelRealAgentTeam}
                  onPreflightReal={preflightRealAgentTeam}
                  onPreview={previewAgentTeam}
                  onStageReal={stageRealAgentTeam}
                  preview={agentTeamPreview}
                  realPreflight={realAgentTeamPreflight}
                  realExecutionReceipt={realAgentTeamExecutionReceipt}
                  realStagingReceipt={realAgentTeamStagingReceipt}
                  receipt={agentTeamReceipt}
                  runs={taskRunRecords}
                />
                <BrowserAutomationPanel
                  isExecuting={isExecutingBrowserInspection}
                  isPreflightingWriteStaging={isPreflightingBrowserWriteStaging}
                  isPreviewing={isPreviewingBrowserInspection}
                  onExecute={executeBrowserInspection}
                  onPreflightWriteStaging={preflightBrowserWriteStaging}
                  onPreview={previewBrowserInspection}
                  preview={browserInspectionPreview}
                  receipt={browserInspectionReceipt}
                  runs={taskRunRecords}
                  writeStagingPreflight={browserWriteStagingPreflight}
                />
                <LocalAppBridgePanel
                  apps={localApps}
                  allowStateReceipt={localAppAllowStateReceipt}
                  isExecuting={isExecutingLocalApp}
                  isPreflighting={isPreflightingLocalApp}
                  isPreviewing={isPreviewingLocalApp}
                  onExecute={executeLocalAppLaunch}
                  onPreflight={preflightLocalAppLaunch}
                  onPreview={previewLocalAppLaunch}
                  onSetAllowState={setLocalAppAllowState}
                  preflight={localAppLaunchPreflight}
                  preview={localAppLaunchPreview}
                  receipt={localAppLaunchReceipt}
                  runs={taskRunRecords}
                  updatingAppId={updatingLocalAppId}
                />
                <NotificationGatewayPanel
                  attempts={notificationDeliveryAttempts}
                  isDelivering={isDeliveringNotification}
                  isExecutingWebhookProduction={isExecutingWebhookProduction}
                  isExecutingWebhookStaging={isExecutingWebhookStaging}
                  isPreflightingWebhookProduction={isPreflightingWebhookProduction}
                  isPreflightingWebhookStaging={isPreflightingWebhookStaging}
                  isPreviewing={isPreviewingNotification}
                  onDeliver={deliverNotification}
                  onExecuteWebhookProduction={executeWebhookProduction}
                  onExecuteWebhookStaging={executeWebhookStaging}
                  onPreview={previewNotification}
                  onPreflightWebhookProduction={preflightWebhookProduction}
                  onPreflightWebhookStaging={preflightWebhookStaging}
                  onReconcileAttempt={reconcileNotificationDeliveryAttempt}
                  preview={notificationPreview}
                  receipt={notificationReceipt}
                  reconciliationReceipt={notificationReconciliationReceipt}
                  reconcilingAttemptId={reconcilingNotificationAttemptId}
                  runs={taskRunRecords}
                  webhookProductionPreflight={webhookProductionPreflight}
                  webhookStagingPreflight={webhookStagingPreflight}
                />
                <DailyBriefingPanel
                  archiveReceipt={dailyBriefingArchiveReceipt}
                  isArchiving={isArchivingDailyBriefing}
                  isReviewingDelivery={isReviewingDailyBriefingDelivery}
                  isFetchingLiveSource={isFetchingDailyBriefingLiveSource}
                  isPreflightingLiveSources={isPreflightingDailyBriefingLiveSources}
                  isPreviewing={isPreviewingDailyBriefing}
                  isReviewingScheduledArchive={isReviewingScheduledArchive}
                  liveSourceReceipt={dailyBriefingLiveSourceReceipt}
                  liveSourcePreflight={dailyBriefingLiveSourcePreflight}
                  onArchive={archiveDailyBriefing}
                  onReviewDelivery={reviewDailyBriefingDelivery}
                  onFetchLiveSource={fetchDailyBriefingLiveSource}
                  onPreflightLiveSources={preflightDailyBriefingLiveSources}
                  onPreview={previewDailyBriefing}
                  onReviewScheduledArchive={reviewScheduledDailyBriefingArchive}
                  preview={dailyBriefingPreview}
                  deliveryReview={dailyBriefingDeliveryReview}
                  scheduledArchiveReview={dailyBriefingScheduledArchiveReview}
                  runs={taskRunRecords}
                />
                <ComputerDiagnosticsPanel
                  cleanupMutationPreflight={computerCleanupMutationPreflight}
                  cleanupPreview={computerCleanupPreview}
                  isArchiving={isArchivingComputerDiagnostics}
                  isPreflightingCleanupMutation={isPreflightingComputerCleanupMutation}
                  isPreviewingCleanup={isPreviewingComputerCleanup}
                  isPreviewing={isPreviewingComputerDiagnostics}
                  onArchive={archiveComputerDiagnostics}
                  onPreflightCleanupMutation={preflightComputerCleanupMutation}
                  onPreviewCleanup={previewComputerCleanup}
                  onPreview={previewComputerDiagnostics}
                  report={computerDiagnosticReport}
                  runs={taskRunRecords}
                />
                <QuantLabPanel
                  isArchiving={isArchivingQuant}
                  isResearching={isResearchingQuant}
                  onArchive={archiveQuantResearch}
                  onResearch={previewQuantResearch}
                  report={quantResearchReport}
                  runs={taskRunRecords}
                />
                <WebAppShellPanel
                  isPreviewing={isPreviewingWebAppShell}
                  onPreview={previewWebAppShell}
                  preview={webAppShellPreview}
                />
                <DeviceSyncPanel
                  importApplyPreflight={deviceSyncImportApplyPreflight}
                  importPreview={deviceSyncImportPreview}
                  importReceipt={deviceSyncImportReceipt}
                  isExporting={isExportingDeviceSync}
                  isPreflightingImport={isPreflightingDeviceSyncImport}
                  isImporting={isImportingDeviceSync}
                  isPreviewingImport={isPreviewingDeviceSyncImport}
                  onExport={exportDeviceSyncPackage}
                  onImport={importDeviceSyncPackage}
                  onPackageChange={setDeviceSyncPackageJson}
                  onPreflightImport={preflightDeviceSyncImportApply}
                  onPreviewImport={previewDeviceSyncImport}
                  onPreviewRelay={previewSyncRelay}
                  packageJson={deviceSyncPackageJson}
                  relayPreview={relayPreview}
                  state={deviceSyncState}
                  syncPackage={deviceSyncPackage}
                />
              </section>
            )}
          </section>

          <aside className="context-rail" aria-label={t("cognitive.contextRail")}>
            <ProductionReadinessPanel
              isRefreshing={isRefreshingProductionReadiness}
              onRefresh={refreshProductionOverview}
              preview={productionReadinessPreview}
            />
            <CapabilityStatusPanel capabilities={status?.capabilities ?? []} />
            <SchedulerStatusPanel status={status?.scheduler_status} />
            <SecurityCenterPanel
              auditEvents={auditEvents}
              capabilities={status?.capabilities ?? []}
              isRefreshing={isRefreshingSecurityCenter}
              onRefresh={refreshSecurityCenter}
              onRollbackSnapshot={rollbackProtectedSnapshot}
              rollingBackSnapshotId={rollingBackProtectedSnapshotId}
              snapshots={protectedSnapshots}
            />
            <SagaRecoveryPanel
              isRefreshing={isRefreshingSagaRecovery}
              recordingSagaId={recordingSagaRecoveryId}
              onRefresh={refreshProductionOverview}
              onRecordReview={recordSagaRecoveryReview}
              preview={sagaRecoveryPreview}
            />
          </aside>

          <section className="system-monitor" aria-label={t("cognitive.systemMonitor")}>
            <div className="monitor-header">
              <div>
                <p className="eyebrow">{t("cognitive.systemMonitor")}</p>
                <h3>{t("cognitive.cliActivity")}</h3>
              </div>
              <span>{activePlanId ?? "synapse-local"}</span>
            </div>
            <div className="monitor-stream" data-testid="interaction-feedback">
              <code>{text(activity)}</code>
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

export default App;
