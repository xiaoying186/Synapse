import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AuditPanel } from "./components/AuditPanel";
import { AgentHarnessPanel } from "./components/AgentHarnessPanel";
import { AgentTeamPanel } from "./components/AgentTeamPanel";
import { LocalAppBridgePanel } from "./components/LocalAppBridgePanel";
import { NotificationGatewayPanel } from "./components/NotificationGatewayPanel";
import { DeviceSyncPanel } from "./components/DeviceSyncPanel";
import { BrowserAutomationPanel } from "./components/BrowserAutomationPanel";
import { CapabilityPreviewPanel } from "./components/CapabilityPreviewPanel";
import { CapabilityStatusPanel } from "./components/CapabilityStatusPanel";
import { CandidatePanel } from "./components/CandidatePanel";
import { ContextBudgetPanel } from "./components/ContextBudgetPanel";
import { DirectionListPanel } from "./components/DirectionListPanel";
import { DirectionSetupPanel } from "./components/DirectionSetupPanel";
import { DailyBriefingPanel } from "./components/DailyBriefingPanel";
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
import { SagaRecoveryPanel } from "./components/SagaRecoveryPanel";
import { SourceRegistryPanel } from "./components/SourceRegistryPanel";
import { SynthesisPanel } from "./components/SynthesisPanel";
import { TaskRunPanel } from "./components/TaskRunPanel";
import { TracePanel } from "./components/TracePanel";
import { ZhishuCapturePanel } from "./components/ZhishuCapturePanel";
import { ZhishuSearchPanel } from "./components/ZhishuSearchPanel";
import { LanguageSelector } from "./components/LanguageSelector";
import { useActivityLog } from "./app/useActivityLog";
import { usePreviewAdapters } from "./app/usePreviewAdapters";
import { useProductionOverview } from "./app/useProductionOverview";
import { useSourceRegistryPreview } from "./app/useSourceRegistryPreview";
import { useI18n } from "./i18n";
import type {
  AdapterExecutionReceipt,
  AgentDryRunReceipt,
  AgentDryRunRequest,
  AgentExecutionReceipt,
  AgentTeamPreview,
  AgentTeamRequest,
  ContextBudgetPreview,
  LocalAppDescriptor,
  LocalAppLaunchPreview,
  LocalAppLaunchReceipt,
  LocalAppLaunchRequest,
  NotificationPreview,
  NotificationReceipt,
  NotificationRequest,
  DeviceSyncImportPreview,
  DeviceSyncImportReceipt,
  DeviceSyncPackage,
  DeviceSyncState,
  RelayPreview,
  BrowserInspectionPreview,
  BrowserInspectionReceipt,
  BrowserInspectionRequest,
  ComputerDiagnosticArchiveReceipt,
  ComputerDiagnosticReport,
  QuantArchiveReceipt,
  QuantResearchReport,
  StrategyConfig,
  DailyBriefingArchiveReceipt,
  DailyBriefingPreview,
  DailyBriefingTemplate,
  HttpSourceReceipt,
  ExecutionRecord,
  ExecutorContractPreview,
  AggregationPreview,
  ArsenalPreview,
  AuditEventRecord,
  ArtifactPromotionReceipt,
  MemoryItem,
  MemoryRollbackReceipt,
  PlanPreview,
  PlanRecord,
  ProtectedSnapshotRollbackReceipt,
  ReviewReceipt,
  SynthesisPromotionReceipt,
  SynthesisPreview,
  SnapshotRecord,
  SourceHealthReport,
  SourceObservationRecord,
  SourceImportReceipt,
  SystemStatus,
  TaskCandidate,
  TaskCandidateReview,
  TaskArtifactRecord,
  TaskDirection,
  TaskRunExecutionReceipt,
  TaskRunRecord,
  TaskSchedulerTick,
  TaskSchedulePreview,
  ZhishuMaintenanceFinding,
  ZhishuRelationRecord,
  ZhishuRepositoryBundle,
  ZhishuRepositoryImportReceipt,
  ZhishuSearchQuery,
  ZhishuSearchResponse,
} from "./types";
import "./App.css";

function App() {
  const { t } = useI18n();
  const { activity, setActivity } = useActivityLog(t("activity.waiting"));
  const [activeCognitiveView, setActiveCognitiveView] = useState<
    "knowledge" | "thinking" | "execution"
  >("knowledge");
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [plan, setPlan] = useState<PlanPreview | null>(null);
  const [history, setHistory] = useState<PlanRecord[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [reviewReceipt, setReviewReceipt] = useState<ReviewReceipt | null>(null);
  const [executionRecord, setExecutionRecord] = useState<ExecutionRecord | null>(null);
  const [executorContractPreview, setExecutorContractPreview] = useState<ExecutorContractPreview | null>(null);
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventRecord[]>([]);
  const [zhishuSnapshots, setZhishuSnapshots] = useState<SnapshotRecord[]>([]);
  const [protectedSnapshots, setProtectedSnapshots] = useState<SnapshotRecord[]>([]);
  const [zhishuSearchQuery, setZhishuSearchQuery] = useState<ZhishuSearchQuery>({
    text: "",
    minimum_confidence: 0,
    limit: 20,
  });
  const [zhishuSearchResponse, setZhishuSearchResponse] = useState<ZhishuSearchResponse | null>(null);
  const [zhishuRelations, setZhishuRelations] = useState<ZhishuRelationRecord[]>([]);
  const [zhishuMaintenanceFindings, setZhishuMaintenanceFindings] = useState<
    ZhishuMaintenanceFinding[]
  >([]);
  const [zhishuRepositoryBundle, setZhishuRepositoryBundle] = useState("");
  const [zhishuRepositoryImportReceipt, setZhishuRepositoryImportReceipt] =
    useState<ZhishuRepositoryImportReceipt | null>(null);
  const [taskDirections, setTaskDirections] = useState<TaskDirection[]>([]);
  const [taskSchedulePreviews, setTaskSchedulePreviews] = useState<TaskSchedulePreview[]>([]);
  const [taskCandidates, setTaskCandidates] = useState<TaskCandidate[]>([]);
  const [taskRunRecords, setTaskRunRecords] = useState<TaskRunRecord[]>([]);
  const [taskArtifacts, setTaskArtifacts] = useState<TaskArtifactRecord[]>([]);
  const [aggregationPreview, setAggregationPreview] = useState<AggregationPreview | null>(null);
  const [dailyBriefingPreview, setDailyBriefingPreview] =
    useState<DailyBriefingPreview | null>(null);
  const [computerDiagnosticReport, setComputerDiagnosticReport] =
    useState<ComputerDiagnosticReport | null>(null);
  const [quantResearchReport, setQuantResearchReport] = useState<QuantResearchReport | null>(null);
  const [sourceObservationHistory, setSourceObservationHistory] = useState<SourceObservationRecord[]>([]);
  const [sourceHealthReport, setSourceHealthReport] = useState<SourceHealthReport | null>(null);
  const [sourceImportFormat, setSourceImportFormat] = useState("json");
  const [sourceImportContent, setSourceImportContent] = useState("");
  const [sourceImportReceipt, setSourceImportReceipt] = useState<SourceImportReceipt | null>(null);
  const [httpSourceReceipt, setHttpSourceReceipt] = useState<HttpSourceReceipt | null>(null);
  const [arsenalPreview, setArsenalPreview] = useState<ArsenalPreview | null>(null);
  const [mockAdapterReceipt, setMockAdapterReceipt] = useState<AdapterExecutionReceipt | null>(null);
  const [agentDryRunReceipt, setAgentDryRunReceipt] = useState<AgentDryRunReceipt | null>(null);
  const [agentExecutionReceipt, setAgentExecutionReceipt] =
    useState<AgentExecutionReceipt | null>(null);
  const [browserInspectionPreview, setBrowserInspectionPreview] =
    useState<BrowserInspectionPreview | null>(null);
  const [browserInspectionReceipt, setBrowserInspectionReceipt] =
    useState<BrowserInspectionReceipt | null>(null);
  const [agentTeamPreview, setAgentTeamPreview] = useState<AgentTeamPreview | null>(null);
  const [localApps, setLocalApps] = useState<LocalAppDescriptor[]>([]);
  const [localAppLaunchPreview, setLocalAppLaunchPreview] =
    useState<LocalAppLaunchPreview | null>(null);
  const [localAppLaunchReceipt, setLocalAppLaunchReceipt] =
    useState<LocalAppLaunchReceipt | null>(null);
  const [notificationPreview, setNotificationPreview] = useState<NotificationPreview | null>(null);
  const [notificationReceipt, setNotificationReceipt] = useState<NotificationReceipt | null>(null);
  const [contextBudgetDraft, setContextBudgetDraft] = useState("");
  const [contextBudgetPreview, setContextBudgetPreview] =
    useState<ContextBudgetPreview | null>(null);
  const [deviceSyncState, setDeviceSyncState] = useState<DeviceSyncState | null>(null);
  const [deviceSyncPackage, setDeviceSyncPackage] = useState<DeviceSyncPackage | null>(null);
  const [deviceSyncPackageJson, setDeviceSyncPackageJson] = useState("");
  const [deviceSyncImportPreview, setDeviceSyncImportPreview] =
    useState<DeviceSyncImportPreview | null>(null);
  const [deviceSyncImportReceipt, setDeviceSyncImportReceipt] =
    useState<DeviceSyncImportReceipt | null>(null);
  const [relayPreview, setRelayPreview] = useState<RelayPreview | null>(null);
  const [mockAdapterRunId, setMockAdapterRunId] = useState("");
  const [mockAdapterInput, setMockAdapterInput] = useState("");
  const [synthesisPreview, setSynthesisPreview] = useState<SynthesisPreview | null>(null);
  const [draft, setDraft] = useState("");
  const [aggregationQuery, setAggregationQuery] = useState("");
  const [aggregationOnlineEnabled, setAggregationOnlineEnabled] = useState(false);
  const [inspirationDraft, setInspirationDraft] = useState("");
  const [inspirationTags, setInspirationTags] = useState("");
  const [experienceDraft, setExperienceDraft] = useState("");
  const [experienceTags, setExperienceTags] = useState("");
  const [experienceType, setExperienceType] = useState("success");
  const [zhishuDraft, setZhishuDraft] = useState("");
  const [zhishuTags, setZhishuTags] = useState("");
  const [zhishuKind, setZhishuKind] = useState("knowledge");
  const [directionTitle, setDirectionTitle] = useState("");
  const [directionDescription, setDirectionDescription] = useState("");
  const [directionKeywords, setDirectionKeywords] = useState("");
  const [directionPriority, setDirectionPriority] = useState(3);
  const [directionFrequency, setDirectionFrequency] = useState("manual");
  const [directionOnlineEnabled, setDirectionOnlineEnabled] = useState(false);
  const [directionPushEnabled, setDirectionPushEnabled] = useState(false);
  const [directionPushChannels, setDirectionPushChannels] = useState<string[]>(["email"]);
  const [directionOutputTemplate, setDirectionOutputTemplate] = useState("auto");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSavingExperience, setIsSavingExperience] = useState(false);
  const [isSavingZhishu, setIsSavingZhishu] = useState(false);
  const [isSearchingZhishu, setIsSearchingZhishu] = useState(false);
  const [isGeneratingZhishuRelations, setIsGeneratingZhishuRelations] = useState(false);
  const [isScanningZhishuMaintenance, setIsScanningZhishuMaintenance] = useState(false);
  const [isImportingZhishuRepository, setIsImportingZhishuRepository] = useState(false);
  const [reviewingRelationId, setReviewingRelationId] = useState<string | null>(null);
  const [reviewingMaintenanceFindingId, setReviewingMaintenanceFindingId] = useState<
    string | null
  >(null);
  const [isSavingDirection, setIsSavingDirection] = useState(false);
  const [isMiningTasks, setIsMiningTasks] = useState(false);
  const [isPreviewingAggregation, setIsPreviewingAggregation] = useState(false);
  const [isPreviewingDailyBriefing, setIsPreviewingDailyBriefing] = useState(false);
  const [isArchivingDailyBriefing, setIsArchivingDailyBriefing] = useState(false);
  const [isPreviewingComputerDiagnostics, setIsPreviewingComputerDiagnostics] = useState(false);
  const [isArchivingComputerDiagnostics, setIsArchivingComputerDiagnostics] = useState(false);
  const [isResearchingQuant, setIsResearchingQuant] = useState(false);
  const [isArchivingQuant, setIsArchivingQuant] = useState(false);
  const [isLoadingArsenal, setIsLoadingArsenal] = useState(false);
  const [isRunningMockAdapter, setIsRunningMockAdapter] = useState(false);
  const [isRunningAgentHarness, setIsRunningAgentHarness] = useState(false);
  const [isExecutingCodexAgent, setIsExecutingCodexAgent] = useState(false);
  const [isPreviewingBrowserInspection, setIsPreviewingBrowserInspection] = useState(false);
  const [isExecutingBrowserInspection, setIsExecutingBrowserInspection] = useState(false);
  const [isPreviewingAgentTeam, setIsPreviewingAgentTeam] = useState(false);
  const [isPreviewingLocalApp, setIsPreviewingLocalApp] = useState(false);
  const [isExecutingLocalApp, setIsExecutingLocalApp] = useState(false);
  const [updatingLocalAppId, setUpdatingLocalAppId] = useState<string | null>(null);
  const [isPreviewingNotification, setIsPreviewingNotification] = useState(false);
  const [isPreviewingContextBudget, setIsPreviewingContextBudget] = useState(false);
  const [isDeliveringNotification, setIsDeliveringNotification] = useState(false);
  const [isExportingDeviceSync, setIsExportingDeviceSync] = useState(false);
  const [isPreviewingDeviceSyncImport, setIsPreviewingDeviceSyncImport] = useState(false);
  const [isImportingDeviceSync, setIsImportingDeviceSync] = useState(false);
  const [isImportingSources, setIsImportingSources] = useState(false);
  const [isFetchingHttpSource, setIsFetchingHttpSource] = useState(false);
  const [isLoadingSourceHealth, setIsLoadingSourceHealth] = useState(false);
  const [updatingToolId, setUpdatingToolId] = useState<string | null>(null);
  const [isLoadingSynthesis, setIsLoadingSynthesis] = useState(false);
  const [isTickingScheduler, setIsTickingScheduler] = useState(false);
  const [isLoadingExecutorContract, setIsLoadingExecutorContract] = useState(false);
  const [reviewingCandidateId, setReviewingCandidateId] = useState<string | null>(null);
  const [requestingRunDirectionId, setRequestingRunDirectionId] = useState<string | null>(null);
  const [updatingDirectionId, setUpdatingDirectionId] = useState<string | null>(null);
  const [reviewingRunId, setReviewingRunId] = useState<string | null>(null);
  const [updatingRunId, setUpdatingRunId] = useState<string | null>(null);
  const [promotingArtifactId, setPromotingArtifactId] = useState<string | null>(null);
  const [reviewingMemoryItemId, setReviewingMemoryItemId] = useState<string | null>(null);
  const [rollingBackSnapshotId, setRollingBackSnapshotId] = useState<string | null>(null);
  const [rollingBackProtectedSnapshotId, setRollingBackProtectedSnapshotId] = useState<
    string | null
  >(null);
  const [isRefreshingSecurityCenter, setIsRefreshingSecurityCenter] = useState(false);
  const [executingRunId, setExecutingRunId] = useState<string | null>(null);
  const [promotingSynthesisCandidateId, setPromotingSynthesisCandidateId] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const {
    codebaseMemoryPreview,
    isPreviewingCodebaseMemory,
    isPreviewingPermissionMemory,
    isPreviewingWebAppShell,
    permissionMemoryPreview,
    previewCodebaseMemory,
    previewPermissionMemory,
    previewWebAppShell,
    webAppShellPreview,
  } = usePreviewAdapters({ setActivity });
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
    isLoadingSourceRegistry,
    loadSourceRegistryPreview,
    sourceRegistryPreview,
  } = useSourceRegistryPreview();

  useEffect(() => {
    invoke<SystemStatus>("get_system_status")
      .then(setStatus)
      .catch(() => {
        setActivity("Kernel status is unavailable. Confirm the Tauri backend is running.");
      });

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
    loadDeviceSyncState();
    loadSourceObservationHistory();
    loadSourceHealthReport();
    loadSourceRegistryPreview();
    loadSynthesisPreview();
    loadLibraryHomePreview();
    loadProductionReadinessPreview();
    loadSagaRecoveryPreview();
  }, []);

  async function loadMemory() {
    try {
      const records = await invoke<MemoryItem[]>("get_recent_memory_items");
      setMemoryItems(records);
      return records;
    } catch {
      setMemoryItems([]);
      return [];
    }
  }

  async function loadTaskDirections() {
    try {
      const records = await invoke<TaskDirection[]>("get_task_directions");
      setTaskDirections(records);
      return records;
    } catch {
      setTaskDirections([]);
      return [];
    }
  }

  async function loadAuditEvents() {
    try {
      const records = await invoke<AuditEventRecord[]>("get_audit_events", {
        targetType: null,
        targetId: null,
        limit: 24,
      });
      setAuditEvents(records);
      return records;
    } catch {
      setAuditEvents([]);
      return [];
    }
  }

  async function refreshSecurityCenter() {
    setIsRefreshingSecurityCenter(true);
    try {
      await Promise.all([
        invoke<SystemStatus>("get_system_status").then(setStatus),
        loadAuditEvents(),
        loadZhishuSnapshots(),
      ]);
      setActivity("Security center refreshed.");
    } catch {
      setActivity("Security center refresh failed.");
    } finally {
      setIsRefreshingSecurityCenter(false);
    }
  }

  async function loadZhishuSnapshots() {
    try {
      const records = await invoke<SnapshotRecord[]>("get_object_snapshots", {
        objectType: "zhishu-item",
        objectId: null,
        limit: 8,
      });
      setZhishuSnapshots(records);
      return records;
    } catch {
      setZhishuSnapshots([]);
      return [];
    }
  }

  async function loadProtectedSnapshots() {
    try {
      const records = await invoke<SnapshotRecord[]>("get_object_snapshots", {
        objectType: null,
        objectId: null,
        limit: 12,
      });
      setProtectedSnapshots(records);
      return records;
    } catch {
      setProtectedSnapshots([]);
      return [];
    }
  }

  async function loadZhishuRelations() {
    try {
      const records = await invoke<ZhishuRelationRecord[]>("get_zhishu_relations");
      setZhishuRelations(records);
      return records;
    } catch {
      setZhishuRelations([]);
      return [];
    }
  }

  async function loadZhishuMaintenanceFindings() {
    try {
      const records = await invoke<ZhishuMaintenanceFinding[]>(
        "get_zhishu_maintenance_findings",
      );
      setZhishuMaintenanceFindings(records);
      return records;
    } catch {
      setZhishuMaintenanceFindings([]);
      return [];
    }
  }

  async function searchZhishu() {
    setIsSearchingZhishu(true);
    try {
      const response = await invoke<ZhishuSearchResponse>("search_zhishu", {
        query: zhishuSearchQuery,
      });
      setZhishuSearchResponse(response);
      setActivity(`Zhishu search returned ${response.total_matches} explained matches.`);
    } catch {
      setActivity("Zhishu search could not be completed.");
    } finally {
      setIsSearchingZhishu(false);
    }
  }

  async function generateZhishuRelations() {
    setIsGeneratingZhishuRelations(true);
    try {
      const relations = await invoke<ZhishuRelationRecord[]>("generate_zhishu_relations", {
        query: zhishuSearchQuery,
      });
      await loadZhishuRelations();
      setActivity(`Generated or reused ${relations.length} Zhishu relation candidates.`);
    } catch {
      setActivity("Zhishu relation candidates could not be generated.");
    } finally {
      setIsGeneratingZhishuRelations(false);
    }
  }

  async function reviewZhishuRelation(
    relationId: string,
    decision: "accepted" | "rejected",
  ) {
    setReviewingRelationId(relationId);
    try {
      await invoke<ZhishuRelationRecord>("review_zhishu_relation", { relationId, decision });
      await loadZhishuRelations();
      setActivity(`Zhishu relation ${decision}.`);
    } catch {
      setActivity("Zhishu relation could not be reviewed.");
    } finally {
      setReviewingRelationId(null);
    }
  }

  async function scanZhishuMaintenance() {
    setIsScanningZhishuMaintenance(true);
    try {
      const findings = await invoke<ZhishuMaintenanceFinding[]>("scan_zhishu_maintenance", {
        staleDays: 90,
      });
      await loadZhishuMaintenanceFindings();
      setActivity(`Generated or reused ${findings.length} Zhishu maintenance findings.`);
    } catch {
      setActivity("Zhishu maintenance scan could not be completed.");
    } finally {
      setIsScanningZhishuMaintenance(false);
    }
  }

  async function reviewZhishuMaintenanceFinding(
    findingId: string,
    decision: "accepted" | "rejected",
  ) {
    setReviewingMaintenanceFindingId(findingId);
    try {
      await invoke<ZhishuMaintenanceFinding>("review_zhishu_maintenance_finding", {
        findingId,
        decision,
      });
      await loadZhishuMaintenanceFindings();
      setActivity(`Zhishu maintenance finding ${decision}.`);
    } catch {
      setActivity("Zhishu maintenance finding could not be reviewed.");
    } finally {
      setReviewingMaintenanceFindingId(null);
    }
  }

  async function exportZhishuRepository() {
    try {
      const bundle = await invoke<ZhishuRepositoryBundle>("export_zhishu_repository");
      setZhishuRepositoryBundle(JSON.stringify(bundle, null, 2));
      setActivity("Zhishu repository exported to a versioned JSON bundle.");
    } catch {
      setActivity("Zhishu repository could not be exported.");
    }
  }

  async function loadDeviceSyncState() {
    try {
      const state = await invoke<DeviceSyncState>("get_device_sync_state");
      setDeviceSyncState(state);
      return state;
    } catch {
      setDeviceSyncState(null);
      return null;
    }
  }

  async function exportDeviceSyncPackage() {
    setIsExportingDeviceSync(true);
    try {
      const syncPackage = await invoke<DeviceSyncPackage>("export_device_sync_package");
      setDeviceSyncPackage(syncPackage);
      setDeviceSyncPackageJson(JSON.stringify(syncPackage, null, 2));
      await loadDeviceSyncState();
      setActivity("Device sync package exported locally.");
    } catch {
      setActivity("Device sync package could not be exported.");
    } finally {
      setIsExportingDeviceSync(false);
    }
  }

  async function previewDeviceSyncImport() {
    setIsPreviewingDeviceSyncImport(true);
    try {
      const preview = await invoke<DeviceSyncImportPreview>("preview_device_sync_import", {
        raw: deviceSyncPackageJson,
      });
      setDeviceSyncImportPreview(preview);
      setActivity(`Device sync import preview: ${preview.state}.`);
    } catch {
      setActivity("Device sync package preview was rejected.");
    } finally {
      setIsPreviewingDeviceSyncImport(false);
    }
  }

  async function importDeviceSyncPackage() {
    const allowReplace = !!deviceSyncImportPreview?.requires_explicit_replace;
    if (
      allowReplace &&
      !window.confirm("This package will replace a non-empty local Zhishu repository. Continue?")
    ) {
      return;
    }
    setIsImportingDeviceSync(true);
    try {
      const receipt = await invoke<DeviceSyncImportReceipt>("import_device_sync_package", {
        raw: deviceSyncPackageJson,
        allowReplace,
      });
      setDeviceSyncImportReceipt(receipt);
      setDeviceSyncState(receipt.state);
      await Promise.all([
        loadMemory(),
        loadZhishuRelations(),
        loadZhishuMaintenanceFindings(),
        refreshProductionOverview(),
      ]);
      setActivity(`Device sync import completed: ${receipt.preview.state}.`);
    } catch {
      setActivity("Device sync import was blocked or failed.");
    } finally {
      setIsImportingDeviceSync(false);
    }
  }

  async function previewSyncRelay() {
    try {
      const preview = await invoke<RelayPreview>("preview_sync_relay");
      setRelayPreview(preview);
      setActivity(`Sync relay dry-run: ${preview.state}; no network upload started.`);
    } catch {
      setActivity("Sync relay preview could not be created.");
    }
  }

  async function importZhishuRepository() {
    if (
      !window.confirm(
        "Replace the current Zhishu memory, relation, and maintenance collections?",
      )
    ) {
      return;
    }
    setIsImportingZhishuRepository(true);
    try {
      const receipt = await invoke<ZhishuRepositoryImportReceipt>(
        "import_zhishu_repository",
        { raw: zhishuRepositoryBundle },
      );
      setZhishuRepositoryImportReceipt(receipt);
      await Promise.all([
        loadMemory(),
        loadZhishuRelations(),
        loadZhishuMaintenanceFindings(),
        refreshProductionOverview(),
      ]);
      setActivity("Zhishu repository imported transactionally.");
    } catch {
      setActivity("Zhishu repository import was rejected or could not be completed.");
    } finally {
      setIsImportingZhishuRepository(false);
    }
  }

  async function loadTaskSchedulePreviews() {
    try {
      const records = await invoke<TaskSchedulePreview[]>("get_task_schedule_previews");
      setTaskSchedulePreviews(records);
      return records;
    } catch {
      setTaskSchedulePreviews([]);
      return [];
    }
  }

  async function loadTaskCandidates() {
    try {
      const records = await invoke<TaskCandidate[]>("get_task_candidates");
      setTaskCandidates(records);
      return records;
    } catch {
      setTaskCandidates([]);
      return [];
    }
  }

  async function loadTaskRunRecords() {
    try {
      const records = await invoke<TaskRunRecord[]>("get_task_run_records");
      setTaskRunRecords(records);
      return records;
    } catch {
      setTaskRunRecords([]);
      return [];
    }
  }

  async function loadTaskArtifacts() {
    try {
      const records = await invoke<TaskArtifactRecord[]>("get_task_artifacts", {
        runId: null,
        limit: 50,
      });
      setTaskArtifacts(records);
      return records;
    } catch {
      setTaskArtifacts([]);
      return [];
    }
  }

  async function promoteTaskArtifact(artifactId: string) {
    setPromotingArtifactId(artifactId);
    try {
      const receipt = await invoke<ArtifactPromotionReceipt>("promote_task_artifact_to_zhishu", {
        artifactId,
        itemKind: "knowledge",
      });
      await Promise.all([
        loadMemory(),
        loadTaskArtifacts(),
        loadAuditEvents(),
        loadZhishuSnapshots(),
        loadProtectedSnapshots(),
        refreshProductionOverview(),
      ]);
      setActivity(
        `Promoted ${receipt.artifact.reference_id} into Zhishu candidate ${receipt.memory_item.id}.`,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setActivity(
        detail && detail !== "[object Object]"
          ? `Task artifact could not be promoted into Zhishu: ${detail}`
          : "Task artifact could not be promoted into Zhishu.",
      );
    } finally {
      setPromotingArtifactId(null);
    }
  }

  async function loadExecutorContractPreview() {
    setIsLoadingExecutorContract(true);

    try {
      const preview = await invoke<ExecutorContractPreview>("preview_executor_contract");
      setExecutorContractPreview(preview);
      return preview;
    } catch {
      setExecutorContractPreview(null);
      return null;
    } finally {
      setIsLoadingExecutorContract(false);
    }
  }

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

  async function loadSynthesisPreview() {
    setIsLoadingSynthesis(true);

    try {
      const preview = await invoke<SynthesisPreview>("preview_synthesis");
      setSynthesisPreview(preview);
      return preview;
    } catch {
      setSynthesisPreview(null);
      return null;
    } finally {
      setIsLoadingSynthesis(false);
    }
  }

  async function loadHistory(restoreLatest = false) {
    try {
      const records = await invoke<PlanRecord[]>("get_recent_plans");
      setHistory(records);

      if (restoreLatest && records[0]) {
        setPlan(records[0].preview);
        setActivePlanId(records[0].id);
        setReviewReceipt(records[0].review_receipt ?? null);
        setExecutionRecord(records[0].execution_record ?? null);
        setActivity(`Restored ${records.length} saved plan${records.length === 1 ? "" : "s"}.`);
      }

      return records;
    } catch {
      setHistory([]);
      return [];
    }
  }

  async function submitIntent() {
    const intent = draft.trim();

    if (!intent) {
      setActivity("Write a goal first, then Synapse can turn it into an executable plan.");
      return;
    }

    setIsSubmitting(true);

    try {
      const preview = await invoke<PlanPreview>("submit_intent", { intent });
      setPlan(preview);
      setReviewReceipt(null);
      setExecutionRecord(null);
      const records = await loadHistory();
      setActivePlanId(records[0]?.id ?? null);
      setActivity(`Materialized ${preview.steps.length} executable steps with ${preview.risk} risk.`);
      setDraft("");
    } catch {
      setActivity("Plan materialization failed. Confirm the Tauri backend command is available.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function captureInspiration() {
    const content = inspirationDraft.trim();

    if (!content) {
      setActivity("Capture a fragment first, then Synapse can place it into L0 memory.");
      return;
    }

    const tags = inspirationTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    setIsCapturing(true);

    try {
      const item = await invoke<MemoryItem>("capture_inspiration", { content, tags });
      await Promise.all([loadMemory(), loadSynthesisPreview(), refreshProductionOverview()]);
      setInspirationDraft("");
      setInspirationTags("");
      setActivity(`Captured inspiration into ${item.scope} as ${item.level} memory.`);
    } catch {
      setActivity("Inspiration could not be captured.");
    } finally {
      setIsCapturing(false);
    }
  }

  async function saveTaskDirection() {
    const title = directionTitle.trim();

    if (!title) {
      setActivity("Name a task direction before saving it.");
      return;
    }

    const keywords = directionKeywords
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean);

    if (directionPushEnabled && directionPushChannels.length === 0) {
      setActivity("Choose at least one push channel before saving this direction.");
      return;
    }

    setIsSavingDirection(true);

    try {
      const direction = await invoke<TaskDirection>("save_task_direction", {
        title,
        description: directionDescription,
        priority: directionPriority,
        keywords,
        scheduleFrequency: directionFrequency,
        onlineEnabled: directionOnlineEnabled,
        pushEnabled: directionPushEnabled,
        pushChannels: directionPushEnabled ? directionPushChannels : [],
        outputTemplate: directionOutputTemplate,
      });
      await loadTaskDirections();
      await loadTaskSchedulePreviews();
      setDirectionTitle("");
      setDirectionDescription("");
      setDirectionKeywords("");
      setDirectionPriority(3);
      setDirectionFrequency("manual");
      setDirectionOnlineEnabled(false);
      setDirectionPushEnabled(false);
      setDirectionPushChannels(["email"]);
      setDirectionOutputTemplate("auto");
      setActivity(`Task direction saved: ${direction.title}.`);
    } catch {
      setActivity("Task direction could not be saved.");
    } finally {
      setIsSavingDirection(false);
    }
  }

  async function generateTaskCandidates() {
    setIsMiningTasks(true);

    try {
      const candidates = await invoke<TaskCandidate[]>("generate_task_candidates");
      await loadTaskCandidates();
      await loadSynthesisPreview();
      setActivity(`Generated ${candidates.length} task candidate${candidates.length === 1 ? "" : "s"}.`);
    } catch {
      setActivity("Task candidates could not be generated.");
    } finally {
      setIsMiningTasks(false);
    }
  }

  async function setTaskDirectionActive(directionId: string, active: boolean) {
    setUpdatingDirectionId(directionId);

    try {
      const direction = await invoke<TaskDirection>("set_task_direction_active", {
        directionId,
        active,
      });
      await loadTaskDirections();
      await loadTaskSchedulePreviews();
      await Promise.all([
        loadExecutorContractPreview(),
        loadProtectedSnapshots(),
        loadAuditEvents(),
        refreshProductionOverview(),
      ]);
      setActivity(`Task direction ${direction.active ? "enabled" : "disabled"}: ${direction.title}.`);
    } catch {
      setActivity("Task direction active state could not be updated.");
    } finally {
      setUpdatingDirectionId(null);
    }
  }

  async function requestTaskRun(directionId: string) {
    setRequestingRunDirectionId(directionId);

    try {
      const record = await invoke<TaskRunRecord>("request_task_run", { directionId });
      await loadTaskRunRecords();
      await loadExecutorContractPreview();
      setActivity(
        `Task run ready in review queue for ${record.task_direction_title}: ${record.approval_state}.`,
      );
    } catch {
      setActivity("Task run request could not be recorded.");
    } finally {
      setRequestingRunDirectionId(null);
    }
  }

  async function reviewTaskRun(runId: string, approved: boolean) {
    setReviewingRunId(runId);

    try {
      const record = await invoke<TaskRunRecord>("review_task_run", { runId, approved });
      await loadTaskRunRecords();
      await loadExecutorContractPreview();
      setActivity(`Task run ${record.approval_state}: ${record.execution_state}.`);
    } catch {
      setActivity("Task run review could not be saved.");
    } finally {
      setReviewingRunId(null);
    }
  }

  async function runSchedulerTick() {
    setIsTickingScheduler(true);

    try {
      const tick = await invoke<TaskSchedulerTick>("task_scheduler_tick");
      await loadTaskRunRecords();
      await loadTaskSchedulePreviews();
      await loadExecutorContractPreview();
      const pushRunCount = tick.created_runs.filter((run) => run.push_enabled).length;
      setActivity(
        `Scheduler tick recorded ${tick.created_run_count} run${tick.created_run_count === 1 ? "" : "s"} and skipped ${tick.skipped_run_count}.${pushRunCount > 0 ? ` ${pushRunCount} push-gated.` : ""}`,
      );
    } catch {
      setActivity("Task scheduler tick could not be recorded.");
    } finally {
      setIsTickingScheduler(false);
    }
  }

  async function executeTaskRun(runId: string) {
    setExecutingRunId(runId);

    try {
      const receipt = await invoke<TaskRunExecutionReceipt>("execute_task_run", { runId });
      await loadTaskRunRecords();
      await Promise.all([
        loadTaskCandidates(),
        loadTaskArtifacts(),
        loadExecutorContractPreview(),
        loadSynthesisPreview(),
        refreshProductionOverview(),
      ]);
      const actionLabel = receipt.run.trigger_kind === "candidate-deepen" ? "Local deepening" : "Local executor";
      setActivity(
        `${actionLabel} ${receipt.run.execution_state}: ${receipt.generated_candidates.length} candidate${receipt.generated_candidates.length === 1 ? "" : "s"}.`,
      );
      } catch {
        await loadTaskRunRecords();
        await loadExecutorContractPreview();
        setActivity("Task run could not be executed locally.");
    } finally {
      setExecutingRunId(null);
    }
  }

  async function updateTaskRunState(runId: string, action: "cancel" | "archive") {
    setUpdatingRunId(runId);

    try {
      const command = action === "cancel" ? "cancel_task_run" : "archive_task_run";
      const run = await invoke<TaskRunRecord>(command, { runId });
      await loadTaskRunRecords();
      await loadTaskSchedulePreviews();
      await loadExecutorContractPreview();
      setActivity(`Task run ${run.lifecycle_state ?? run.execution_state}.`);
    } catch {
      setActivity(`Task run could not be ${action === "cancel" ? "cancelled" : "archived"}.`);
    } finally {
      setUpdatingRunId(null);
    }
  }

  async function promoteSynthesisCandidate(candidateId: string, candidateKind: "summary" | "association") {
    setPromotingSynthesisCandidateId(candidateId);

    try {
      const receipt = await invoke<SynthesisPromotionReceipt>("promote_synthesis_candidate", {
        candidateId,
        candidateKind,
      });
      await Promise.all([loadMemory(), loadSynthesisPreview(), refreshProductionOverview()]);
      setActivity(
        `Promoted ${receipt.candidate_kind} after ${receipt.admission_gate}; wrote ${receipt.promoted_memory_item.item_type} into ${receipt.promoted_memory_item.scope}.`,
      );
    } catch {
      setActivity("Synthesis candidate could not be promoted.");
    } finally {
      setPromotingSynthesisCandidateId(null);
    }
  }

  async function loadArsenalPreview() {
    setIsLoadingArsenal(true);

    try {
      const preview = await invoke<ArsenalPreview>("preview_arsenal_registry");
      setArsenalPreview(preview);
      return preview;
    } catch {
      setArsenalPreview(null);
      return null;
    } finally {
      setIsLoadingArsenal(false);
    }
  }

  async function loadLocalApps() {
    try {
      const records = await invoke<LocalAppDescriptor[]>("get_local_apps");
      setLocalApps(records);
      return records;
    } catch {
      setLocalApps([]);
      return [];
    }
  }

  async function setLocalAppAllowState(
    appId: string,
    allowState: "allowed" | "blocked",
  ) {
    setUpdatingLocalAppId(appId);
    try {
      const records = await invoke<LocalAppDescriptor[]>("set_local_app_allow_state", {
        appId,
        allowState,
      });
      setLocalApps(records);
      setLocalAppLaunchPreview(null);
      setActivity(`Local application ${appId} marked ${allowState}.`);
    } catch {
      setActivity("Local application allow state could not be updated.");
    } finally {
      setUpdatingLocalAppId(null);
    }
  }

  async function setToolAllowState(toolId: string, allowState: "allowed" | "blocked") {
    setUpdatingToolId(toolId);

    try {
      const preview = await invoke<ArsenalPreview>("set_arsenal_tool_allow_state", {
        toolId,
        allowState,
      });
      setArsenalPreview(preview);
      await Promise.all([loadProtectedSnapshots(), loadAuditEvents(), refreshProductionOverview()]);
      setActivity(`Arsenal tool ${toolId} marked ${allowState}; execution is still disabled.`);
    } catch {
      setActivity("Arsenal allowlist could not be updated.");
    } finally {
      setUpdatingToolId(null);
    }
  }

  async function runMockAdapter(approved: boolean) {
    setIsRunningMockAdapter(true);

    try {
      const command = approved ? "execute_mock_adapter" : "dry_run_mock_adapter";
      const receipt = await invoke<AdapterExecutionReceipt>(command, {
        runId: mockAdapterRunId,
        input: mockAdapterInput,
        ...(approved ? { approved: true } : {}),
      });
      setMockAdapterReceipt(receipt);
      if (receipt.artifact) {
        await Promise.all([loadTaskArtifacts(), refreshProductionOverview()]);
      }
      setActivity(
        `Mock adapter ${receipt.execution_mode} ${receipt.state}: ${receipt.output_summary}`,
      );
    } catch {
      setActivity(
        approved
          ? "Mock adapter execution was blocked or failed."
          : "Mock adapter dry-run could not be created.",
      );
    } finally {
      setIsRunningMockAdapter(false);
    }
  }

  async function dryRunAgentHarness(request: AgentDryRunRequest) {
    setIsRunningAgentHarness(true);
    try {
      const receipt = await invoke<AgentDryRunReceipt>("dry_run_agent_harness", {
        request,
      });
      setAgentDryRunReceipt(receipt);
      setActivity(
        `Agent Harness ${receipt.mode} preview: ${receipt.state}; no process was started.`,
      );
    } catch {
      setActivity("Agent Harness dry-run could not be created.");
    } finally {
      setIsRunningAgentHarness(false);
    }
  }

  async function executeCodexAgent(request: AgentDryRunRequest) {
    if (
      !window.confirm(
        "Run Codex CLI in ephemeral, read-only sandbox mode and quarantine its output?",
      )
    ) {
      return;
    }
    setIsExecutingCodexAgent(true);
    try {
      const receipt = await invoke<AgentExecutionReceipt>("execute_codex_agent", {
        request,
        approved: true,
      });
      setAgentExecutionReceipt(receipt);
      await Promise.all([
        loadTaskRunRecords(),
        loadTaskArtifacts(),
        loadExecutorContractPreview(),
        refreshProductionOverview(),
      ]);
      setActivity(`Codex execution completed; output quarantined as ${receipt.artifact.id}.`);
    } catch {
      setActivity("Codex execution was blocked, timed out, or failed.");
    } finally {
      setIsExecutingCodexAgent(false);
    }
  }

  async function previewBrowserInspection(request: BrowserInspectionRequest) {
    setIsPreviewingBrowserInspection(true);
    try {
      const preview = await invoke<BrowserInspectionPreview>("preview_browser_inspection", {
        request,
      });
      setBrowserInspectionPreview(preview);
      setActivity(`Browser inspection preview: ${preview.state}.`);
    } catch {
      setActivity("Browser inspection preview was rejected.");
    } finally {
      setIsPreviewingBrowserInspection(false);
    }
  }

  async function executeBrowserInspection(request: BrowserInspectionRequest) {
    if (
      !window.confirm(
        "Open this allowlisted URL in a headless, read-only Playwright context and quarantine the result?",
      )
    ) {
      return;
    }
    setIsExecutingBrowserInspection(true);
    try {
      const receipt = await invoke<BrowserInspectionReceipt>("execute_browser_inspection", {
        request,
        approved: true,
      });
      setBrowserInspectionReceipt(receipt);
      await Promise.all([
        loadTaskRunRecords(),
        loadTaskArtifacts(),
        loadExecutorContractPreview(),
        refreshProductionOverview(),
      ]);
      setActivity(`Browser inspection quarantined as ${receipt.artifact.id}.`);
    } catch {
      setActivity("Browser inspection was blocked, timed out, or failed.");
    } finally {
      setIsExecutingBrowserInspection(false);
    }
  }

  async function previewAgentTeam(request: AgentTeamRequest) {
    setIsPreviewingAgentTeam(true);
    try {
      const preview = await invoke<AgentTeamPreview>("preview_agent_team", { request });
      setAgentTeamPreview(preview);
      setActivity(
        `Agent team ${preview.team_mode} graph: ${preview.estimated_agent_calls} bounded calls.`,
      );
    } catch {
      setActivity("Agent team preview was rejected.");
    } finally {
      setIsPreviewingAgentTeam(false);
    }
  }

  async function previewLocalAppLaunch(request: LocalAppLaunchRequest) {
    setIsPreviewingLocalApp(true);
    try {
      const preview = await invoke<LocalAppLaunchPreview>("preview_local_app_launch", {
        request,
      });
      setLocalAppLaunchPreview(preview);
      setActivity(`Local app launch preview: ${preview.state}.`);
    } catch {
      setActivity("Local app launch preview was rejected.");
    } finally {
      setIsPreviewingLocalApp(false);
    }
  }

  async function executeLocalAppLaunch(request: LocalAppLaunchRequest) {
    if (
      !window.confirm(
        "Launch this approved local application without arguments or session-data access?",
      )
    ) {
      return;
    }
    setIsExecutingLocalApp(true);
    try {
      const receipt = await invoke<LocalAppLaunchReceipt>("execute_local_app_launch", {
        request,
        approved: true,
      });
      setLocalAppLaunchReceipt(receipt);
      await Promise.all([loadTaskArtifacts(), refreshProductionOverview()]);
      setActivity(`Local application launched as process ${receipt.process_id}.`);
    } catch {
      setActivity("Local application launch was blocked or failed.");
    } finally {
      setIsExecutingLocalApp(false);
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

  async function deliverNotification(request: NotificationRequest) {
    if (
      !window.confirm(
        "Send this message through the configured SMTP server and record a delivery receipt?",
      )
    ) {
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
      setActivity(`Email delivery receipt recorded as ${receipt.artifact.id}.`);
    } catch {
      setActivity("Email delivery was blocked or failed.");
    } finally {
      setIsDeliveringNotification(false);
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

  async function archiveDailyBriefing(runId: string, template: DailyBriefingTemplate) {
    setIsArchivingDailyBriefing(true);
    try {
      const receipt = await invoke<DailyBriefingArchiveReceipt>("archive_daily_briefing", {
        runId,
        template,
      });
      setDailyBriefingPreview(receipt.preview);
      await Promise.all([loadTaskRunRecords(), loadTaskArtifacts(), refreshProductionOverview()]);
      setActivity(`Daily briefing archived as ${receipt.artifact.reference_id}.`);
    } catch {
      setActivity("Daily briefing archival was blocked or failed.");
    } finally {
      setIsArchivingDailyBriefing(false);
    }
  }

  async function previewComputerDiagnostics() {
    setIsPreviewingComputerDiagnostics(true);
    try {
      const report = await invoke<ComputerDiagnosticReport>("preview_computer_diagnostics");
      setComputerDiagnosticReport(report);
      setActivity(`Computer diagnostic completed: ${report.overall_state}.`);
    } catch {
      setActivity("Computer diagnostics could not be completed.");
    } finally {
      setIsPreviewingComputerDiagnostics(false);
    }
  }

  async function archiveComputerDiagnostics(runId: string) {
    setIsArchivingComputerDiagnostics(true);
    try {
      const receipt = await invoke<ComputerDiagnosticArchiveReceipt>(
        "archive_computer_diagnostics",
        { runId },
      );
      setComputerDiagnosticReport(receipt.report);
      await Promise.all([loadTaskRunRecords(), loadTaskArtifacts(), refreshProductionOverview()]);
      setActivity(`Computer diagnostic archived as ${receipt.artifact.reference_id}.`);
    } catch {
      setActivity("Computer diagnostic archival was blocked or failed.");
    } finally {
      setIsArchivingComputerDiagnostics(false);
    }
  }

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

  async function captureExperience() {
    const content = experienceDraft.trim();

    if (!content) {
      setActivity("Record the experience first, then Synapse can place it into L1 memory.");
      return;
    }

    const tags = experienceTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    setIsSavingExperience(true);

    try {
      const item = await invoke<MemoryItem>("capture_experience", {
        content,
        tags,
        experienceType,
      });
      await Promise.all([loadMemory(), loadSynthesisPreview(), refreshProductionOverview()]);
      setExperienceDraft("");
      setExperienceTags("");
      setExperienceType("success");
      setActivity(`Captured ${item.item_type} into ${item.scope}.`);
    } catch {
      setActivity("Experience record could not be captured.");
    } finally {
      setIsSavingExperience(false);
    }
  }

  async function captureZhishuItem() {
    const content = zhishuDraft.trim();

    if (!content) {
      setActivity("Capture a Zhishu knowledge, rule, or skill candidate first.");
      return;
    }

    const tags = zhishuTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    setIsSavingZhishu(true);

    try {
      const item = await invoke<MemoryItem>("capture_zhishu_item", {
        content,
        tags,
        itemKind: zhishuKind,
      });
      await Promise.all([loadMemory(), loadSynthesisPreview(), refreshProductionOverview()]);
      setZhishuDraft("");
      setZhishuTags("");
      setZhishuKind("knowledge");
      setActivity(`Captured ${item.item_type} into ${item.scope} as a review candidate.`);
    } catch {
      setActivity("Zhishu item could not be captured.");
    } finally {
      setIsSavingZhishu(false);
    }
  }

  async function reviewMemoryItem(memoryId: string, decision: "accepted" | "rejected") {
    setReviewingMemoryItemId(memoryId);

    try {
      const item = await invoke<MemoryItem>("review_memory_item", {
        memoryId,
        decision,
      });
      await Promise.all([
        loadMemory(),
        loadZhishuSnapshots(),
        loadTaskCandidates(),
        loadSynthesisPreview(),
        refreshProductionOverview(),
      ]);
      setActivity(`Memory item ${item.admission_state ?? item.verification}: ${item.item_type}.`);
    } catch {
      setActivity("Memory item could not be reviewed.");
    } finally {
      setReviewingMemoryItemId(null);
    }
  }

  async function rollbackZhishuSnapshot(snapshotId: string) {
    setRollingBackSnapshotId(snapshotId);

    try {
      const receipt = await invoke<MemoryRollbackReceipt>("rollback_zhishu_snapshot", {
        snapshotId,
      });
      await Promise.all([
        loadMemory(),
        loadZhishuSnapshots(),
        loadTaskCandidates(),
        loadSynthesisPreview(),
        refreshProductionOverview(),
      ]);
      setActivity(
        `Restored ${receipt.restored_item.item_type} from snapshot v${receipt.source_snapshot.version}.`,
      );
    } catch {
      setActivity("Zhishu restore point could not be restored safely.");
    } finally {
      setRollingBackSnapshotId(null);
    }
  }

  async function rollbackProtectedSnapshot(snapshotId: string) {
    const approved = window.confirm(
      "Restore this protected snapshot? Current state will be protected first.",
    );
    if (!approved) {
      return;
    }
    setRollingBackProtectedSnapshotId(snapshotId);
    try {
      const receipt = await invoke<ProtectedSnapshotRollbackReceipt>(
        "rollback_protected_snapshot",
        { snapshotId },
      );
      await Promise.all([
        loadTaskDirections(),
        loadTaskSchedulePreviews(),
        loadExecutorContractPreview(),
        loadArsenalPreview(),
        loadProtectedSnapshots(),
        loadAuditEvents(),
        refreshProductionOverview(),
      ]);
      setActivity(
        `Restored ${receipt.object_type} ${receipt.object_id} to ${receipt.restored_state}.`,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setActivity(
        detail && detail !== "[object Object]"
          ? `Protected snapshot could not be restored: ${detail}`
          : "Protected snapshot could not be restored.",
      );
    } finally {
      setRollingBackProtectedSnapshotId(null);
    }
  }

  async function reviewTaskCandidate(candidateId: string, decision: "accepted" | "rejected" | "deepen") {
    setReviewingCandidateId(candidateId);

    try {
      const review = await invoke<TaskCandidateReview>("review_task_candidate", {
        candidateId,
        decision,
      });
      await loadTaskCandidates();
      if (review.follow_up_run) {
        await loadTaskRunRecords();
        await loadExecutorContractPreview();
      }
      if (review.promoted_memory_item) {
        await Promise.all([loadMemory(), refreshProductionOverview()]);
      }
      await loadSynthesisPreview();
      setActivity(
        review.follow_up_run
          ? `Task candidate ${review.candidate.status}; follow-up run is waiting for approval.`
          : `Task candidate ${review.candidate.status}.`,
      );
    } catch {
      setActivity("Task candidate review could not be saved.");
    } finally {
      setReviewingCandidateId(null);
    }
  }

  async function clearHistory() {
    try {
      await invoke("clear_plan_history");
      setHistory([]);
      setPlan(null);
      setActivePlanId(null);
      setReviewReceipt(null);
      setExecutionRecord(null);
      setActivity("Saved plan history cleared.");
    } catch {
      setActivity("Plan history could not be cleared.");
    }
  }

  async function reviewCurrentPlan(approved: boolean) {
    if (!plan) {
      return;
    }

    setIsReviewing(true);

    try {
      const receipt = await invoke<ReviewReceipt>("review_plan", {
        preview: plan,
        approved,
        planId: activePlanId,
      });
      setReviewReceipt(receipt);
      const records = await loadHistory();
      const activeRecord = records.find((record) => record.id === activePlanId);
      setExecutionRecord(activeRecord?.execution_record ?? null);
      setActivity(`${receipt.decision}: ${receipt.execution_state}.`);
    } catch {
      setActivity("Audit review could not be recorded.");
    } finally {
      setIsReviewing(false);
    }
  }

  return (
    <main className="shell cognitive-shell">
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
          <p className="eyebrow">{t("app.version")}</p>
          <h1>{status?.app_name ?? t("app.nameFallback")}</h1>
        </div>

        <nav className="nav" aria-label={t("nav.primary")}>
          <button
            className={activeCognitiveView === "knowledge" ? "nav-item active" : "nav-item"}
            type="button"
            onClick={() => setActiveCognitiveView("knowledge")}
          >
            {t("cognitive.knowledge")}
          </button>
          <button
            className={activeCognitiveView === "thinking" ? "nav-item active" : "nav-item"}
            type="button"
            onClick={() => setActiveCognitiveView("thinking")}
          >
            {t("cognitive.thinking")}
          </button>
          <button
            className={activeCognitiveView === "execution" ? "nav-item active" : "nav-item"}
            type="button"
            onClick={() => setActiveCognitiveView("execution")}
          >
            {t("cognitive.execution")}
          </button>
        </nav>

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
                  isRefreshing={isLoadingSourceRegistry}
                  onRefresh={loadSourceRegistryPreview}
                  preview={sourceRegistryPreview}
                />
                <CodebaseMemoryPanel
                  isPreviewing={isPreviewingCodebaseMemory}
                  onPreview={previewCodebaseMemory}
                  preview={codebaseMemoryPreview}
                />
                <PermissionMemoryPanel
                  isPreviewing={isPreviewingPermissionMemory}
                  onPreview={previewPermissionMemory}
                  preview={permissionMemoryPreview}
                />
              </section>
            )}

            {activeCognitiveView === "thinking" && (
              <section className="cognitive-view">
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
                  onSelect={({ executionRecord, plan, planId, reviewReceipt }) => {
                    setPlan(plan);
                    setActivePlanId(planId);
                    setReviewReceipt(reviewReceipt);
                    setExecutionRecord(executionRecord);
                  }}
                />
              </section>
            )}

            {activeCognitiveView === "execution" && (
              <section className="cognitive-view">
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
                    onPushChannelToggle={(channel, checked) => {
                      setDirectionPushChannels((channels) => {
                        if (checked) {
                          return channels.includes(channel) ? channels : [...channels, channel];
                        }
                        return channels.filter((item) => item !== channel);
                      });
                    }}
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
                  executingRunId={executingRunId}
                  isTicking={isTickingScheduler}
                  onArchive={(runId) => updateTaskRunState(runId, "archive")}
                  onCancel={(runId) => updateTaskRunState(runId, "cancel")}
                  onExecute={executeTaskRun}
                  onPromoteArtifact={promoteTaskArtifact}
                  onSchedulerTick={runSchedulerTick}
                  onReview={reviewTaskRun}
                  promotingArtifactId={promotingArtifactId}
                  promotedArtifactIds={memoryItems.flatMap((item) =>
                    item.tags
                      .filter((tag) => tag.startsWith("artifact:"))
                      .map((tag) => tag.slice("artifact:".length)),
                  )}
                  records={taskRunRecords}
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
                  isLoadingSourceHealth={isLoadingSourceHealth}
                  isRunningMockAdapter={isRunningMockAdapter}
                  mockAdapterInput={mockAdapterInput}
                  mockAdapterReceipt={mockAdapterReceipt}
                  mockAdapterRunId={mockAdapterRunId}
                  httpSourceReceipt={httpSourceReceipt}
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
                  isRunning={isRunningAgentHarness}
                  onDryRun={dryRunAgentHarness}
                  onExecute={executeCodexAgent}
                  receipt={agentDryRunReceipt}
                  runs={taskRunRecords}
                />
                <AgentTeamPanel
                  arsenalPreview={arsenalPreview}
                  isPreviewing={isPreviewingAgentTeam}
                  onPreview={previewAgentTeam}
                  preview={agentTeamPreview}
                  runs={taskRunRecords}
                />
                <BrowserAutomationPanel
                  isExecuting={isExecutingBrowserInspection}
                  isPreviewing={isPreviewingBrowserInspection}
                  onExecute={executeBrowserInspection}
                  onPreview={previewBrowserInspection}
                  preview={browserInspectionPreview}
                  receipt={browserInspectionReceipt}
                  runs={taskRunRecords}
                />
                <LocalAppBridgePanel
                  apps={localApps}
                  isExecuting={isExecutingLocalApp}
                  isPreviewing={isPreviewingLocalApp}
                  onExecute={executeLocalAppLaunch}
                  onPreview={previewLocalAppLaunch}
                  onSetAllowState={setLocalAppAllowState}
                  preview={localAppLaunchPreview}
                  receipt={localAppLaunchReceipt}
                  runs={taskRunRecords}
                  updatingAppId={updatingLocalAppId}
                />
                <NotificationGatewayPanel
                  isDelivering={isDeliveringNotification}
                  isPreviewing={isPreviewingNotification}
                  onDeliver={deliverNotification}
                  onPreview={previewNotification}
                  preview={notificationPreview}
                  receipt={notificationReceipt}
                  runs={taskRunRecords}
                />
                <DailyBriefingPanel
                  isArchiving={isArchivingDailyBriefing}
                  isPreviewing={isPreviewingDailyBriefing}
                  onArchive={archiveDailyBriefing}
                  onPreview={previewDailyBriefing}
                  preview={dailyBriefingPreview}
                  runs={taskRunRecords}
                />
                <ComputerDiagnosticsPanel
                  isArchiving={isArchivingComputerDiagnostics}
                  isPreviewing={isPreviewingComputerDiagnostics}
                  onArchive={archiveComputerDiagnostics}
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
                  importPreview={deviceSyncImportPreview}
                  importReceipt={deviceSyncImportReceipt}
                  isExporting={isExportingDeviceSync}
                  isImporting={isImportingDeviceSync}
                  isPreviewingImport={isPreviewingDeviceSyncImport}
                  onExport={exportDeviceSyncPackage}
                  onImport={importDeviceSyncPackage}
                  onPackageChange={setDeviceSyncPackageJson}
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
            <div className="monitor-stream">
              <code>{activity}</code>
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

export default App;
