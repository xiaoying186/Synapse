import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const checks = [];
const staticOnly = process.argv.includes("--static");
const releaseMode = process.argv.includes("--release");
const jsonOutput = process.argv.includes("--json");
const PUBLIC_VERSION = "0.0.0";
const INTERNAL_DESIGN_VERSION = "V6.6";
const PUBLIC_BASELINE_NAME = `Synapse ${PUBLIC_VERSION} Public Baseline`;
const INTERNAL_DESIGN_ALIGNMENT = `Synapse Design ${INTERNAL_DESIGN_VERSION}`;

function pass(id, detail, remediation = null) {
  checks.push({ id, state: "pass", detail, remediation });
}

function fail(id, detail, remediation = null) {
  checks.push({ id, state: "fail", detail, remediation });
}

function readText(path) {
  return readFileSync(join(root, path), "utf8");
}

function readProtectedText(path, id, label) {
  try {
    const content = readText(path);
    pass(id, `${label} is present`);
    return content;
  } catch (error) {
    fail(
      id,
      `${label} is missing or unreadable: ${error.message}`,
      `Restore ${path} before using the ${PUBLIC_BASELINE_NAME} production or release baseline.`,
    );
    return "";
  }
}

function tomlValue(raw, section, key) {
  const sectionPattern = new RegExp(`^\\[${escapeRegExp(section)}\\]\\s*$`, "m");
  const match = sectionPattern.exec(raw);
  if (!match) {
    return null;
  }
  const rest = raw.slice(match.index + match[0].length);
  const nextSection = rest.search(/^\[[^\]]+\]\s*$/m);
  const body = nextSection >= 0 ? rest.slice(0, nextSection) : rest;
  const keyPattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=\\s*(.+?)\\s*$`, "m");
  return keyPattern.exec(body)?.[1]?.trim() ?? null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertTomlValue(raw, section, key, expected, id) {
  const value = tomlValue(raw, section, key);
  if (value === expected) {
    pass(id, `[${section}].${key} = ${expected}`);
  } else {
    fail(
      id,
      `Expected [${section}].${key} = ${expected}, found ${value ?? "missing"}`,
      `Set [${section}].${key} back to ${expected} before using the ${PUBLIC_BASELINE_NAME}.`,
    );
  }
}

function run(command, args, options = {}) {
  const label = [command, ...args].join(" ");
  const usesWindowsCmd = process.platform === "win32" && command.endsWith(".cmd");
  const result = spawnSync(
    usesWindowsCmd ? "cmd.exe" : command,
    usesWindowsCmd ? ["/d", "/s", "/c", label] : args,
    {
      cwd: options.cwd ? join(root, options.cwd) : root,
      encoding: "utf8",
      stdio: "pipe",
    },
  );
  if (result.status === 0) {
    pass(options.id, label);
    return;
  }
  const output =
    `${result.error?.message ?? ""}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  fail(options.id, `${label}\n${output}`);
}

const packageJson = JSON.parse(readText("package.json"));
const gitignore = readProtectedText(".gitignore", "gitignore-file", ".gitignore");
const gitattributes = readProtectedText(".gitattributes", "gitattributes-file", ".gitattributes");
readProtectedText("package-lock.json", "npm-lockfile", "npm lockfile");
const cargoToml = readProtectedText("src-tauri/Cargo.toml", "cargo-manifest", "Cargo manifest");
readProtectedText("src-tauri/Cargo.lock", "cargo-lockfile", "Cargo lockfile");
if (packageJson.version === PUBLIC_VERSION) {
  pass("package-public-version", `package.json version is ${PUBLIC_VERSION}`);
} else {
  fail(
    "package-public-version",
    `Expected package.json version ${PUBLIC_VERSION}, found ${packageJson.version ?? "missing"}`,
    `Keep public package metadata on ${PUBLIC_BASELINE_NAME} unless intentionally releasing a new public software version.`,
  );
}
if (
  cargoToml.includes(`version = "${PUBLIC_VERSION}"`) &&
  cargoToml.includes(`Synapse ${PUBLIC_VERSION}`) &&
  cargoToml.includes(INTERNAL_DESIGN_VERSION)
) {
  pass("cargo-public-version-description", "Cargo manifest separates public version and internal design alignment");
} else {
  fail(
    "cargo-public-version-description",
    "Cargo manifest must use public version metadata and internal design alignment wording.",
    `Set src-tauri/Cargo.toml version to ${PUBLIC_VERSION} and mention ${INTERNAL_DESIGN_ALIGNMENT} in the description.`,
  );
}
if (packageJson.dependencies?.["@tauri-apps/api"] === "2.10.1") {
  pass("tauri-api-version", "@tauri-apps/api pinned to 2.10.1");
} else {
  fail(
    "tauri-api-version",
    `Expected @tauri-apps/api 2.10.1, found ${packageJson.dependencies?.["@tauri-apps/api"] ?? "missing"}`,
    "Pin @tauri-apps/api to 2.10.1 or update the Rust Tauri crate and npm API package together.",
  );
}
if (packageJson.scripts?.["release:status"] === "node scripts/release-status.mjs") {
  pass("release-status-package-script", "release:status reads release evidence");
} else {
  fail(
    "release-status-package-script",
    `Expected release:status script to run node scripts/release-status.mjs, found ${
      packageJson.scripts?.["release:status"] ?? "missing"
    }`,
    "Restore the release:status package script before publishing.",
  );
}
if (packageJson.scripts?.["release:doctor"] === "node scripts/release-doctor.mjs") {
  pass("release-doctor-package-script", "release:doctor summarizes release readiness");
} else {
  fail(
    "release-doctor-package-script",
    `Expected release:doctor script to run node scripts/release-doctor.mjs, found ${
      packageJson.scripts?.["release:doctor"] ?? "missing"
    }`,
    "Restore the release:doctor package script before publishing.",
  );
}
if (packageJson.scripts?.["release:acceptance"] === "node scripts/release-acceptance.mjs") {
  pass("release-acceptance-package-script", "release:acceptance verifies installer artifacts");
} else {
  fail(
    "release-acceptance-package-script",
    `Expected release:acceptance script to run node scripts/release-acceptance.mjs, found ${
      packageJson.scripts?.["release:acceptance"] ?? "missing"
    }`,
    "Restore the release:acceptance package script before publishing.",
  );
}
if (
  packageJson.scripts?.["release:smoke:installer"] ===
  "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/installer-smoke.ps1"
) {
  pass("release-installer-smoke-package-script", "release:smoke:installer runs the packaged installer smoke test");
} else {
  fail(
    "release-installer-smoke-package-script",
    `Expected release:smoke:installer to run scripts/installer-smoke.ps1, found ${
      packageJson.scripts?.["release:smoke:installer"] ?? "missing"
    }`,
    "Restore the installer smoke package script before publishing.",
  );
}
if (packageJson.scripts?.["tauri:build:release"] === "tauri build --bundles nsis") {
  pass("tauri-release-build-package-script", "tauri:build:release builds the NSIS release installer");
} else {
  fail(
    "tauri-release-build-package-script",
    `Expected tauri:build:release to run tauri build --bundles nsis, found ${
      packageJson.scripts?.["tauri:build:release"] ?? "missing"
    }`,
    "Restore the NSIS release build script before publishing.",
  );
}
if (packageJson.scripts?.["secret:scan"] === "node scripts/secret-guard.mjs") {
  pass("secret-guard-package-script", "secret:scan runs Secret Guard");
} else {
  fail(
    "secret-guard-package-script",
    `Expected secret:scan script to run node scripts/secret-guard.mjs, found ${
      packageJson.scripts?.["secret:scan"] ?? "missing"
    }`,
    "Restore the secret:scan package script so local secret checks remain available.",
  );
}
if (cargoDependencyVersion(cargoToml, "dependencies", "tauri") === "=2.10.3") {
  pass("tauri-rust-version", "Rust tauri crate pinned to =2.10.3");
} else {
  fail(
    "tauri-rust-version",
    `Expected Rust tauri crate =2.10.3, found ${cargoDependencyVersion(cargoToml, "dependencies", "tauri") ?? "missing"}`,
    "Pin src-tauri/Cargo.toml [dependencies].tauri to =2.10.3 or update the npm API package and docs together.",
  );
}
if (cargoDependencyVersion(cargoToml, "build-dependencies", "tauri-build") === "=2.5.6") {
  pass("tauri-build-version", "tauri-build crate pinned to =2.5.6");
} else {
  fail(
    "tauri-build-version",
    `Expected tauri-build =2.5.6, found ${cargoDependencyVersion(cargoToml, "build-dependencies", "tauri-build") ?? "missing"}`,
    "Pin src-tauri/Cargo.toml [build-dependencies].tauri-build to =2.5.6 or update the release baseline intentionally.",
  );
}

const tauriConfig = JSON.parse(readText("src-tauri/tauri.conf.json"));
if (tauriConfig.version === PUBLIC_VERSION) {
  pass("tauri-public-version", `Tauri config version is ${PUBLIC_VERSION}`);
} else {
  fail(
    "tauri-public-version",
    `Expected Tauri config version ${PUBLIC_VERSION}, found ${tauriConfig.version ?? "missing"}`,
    `Keep Tauri installer metadata on ${PUBLIC_BASELINE_NAME} unless intentionally releasing a new public software version.`,
  );
}
if (tauriConfig.identifier === "com.synapse.local") {
  pass("tauri-identifier", "Tauri identifier is com.synapse.local");
} else {
  fail(
    "tauri-identifier",
    `Expected Tauri identifier com.synapse.local, found ${tauriConfig.identifier ?? "missing"}`,
    "Restore the local Windows baseline identifier or intentionally update release documentation and signing metadata.",
  );
}
if (typeof tauriConfig.app?.security?.csp === "string" && tauriConfig.app.security.csp.trim()) {
  pass("tauri-csp", "Tauri CSP is configured");
} else {
  fail(
    "tauri-csp",
    `Tauri CSP must not be null for the ${PUBLIC_BASELINE_NAME}`,
    "Configure a restrictive app.security.csp in src-tauri/tauri.conf.json.",
  );
}
if (Array.isArray(tauriConfig.bundle?.targets) && tauriConfig.bundle.targets.includes("msi")) {
  pass("tauri-msi-target", "Tauri bundle targets include MSI");
} else {
  fail(
    "tauri-msi-target",
    "Tauri bundle targets should include MSI for the Windows local baseline",
    "Add msi to src-tauri/tauri.conf.json bundle.targets or update the Windows release checklist.",
  );
}
if (Array.isArray(tauriConfig.bundle?.targets) && tauriConfig.bundle.targets.includes("nsis")) {
  pass("tauri-nsis-target", "Tauri bundle targets include NSIS for the public preview installer");
} else {
  fail(
    "tauri-nsis-target",
    "Tauri bundle targets should include NSIS for the public preview installer",
    "Add nsis to src-tauri/tauri.conf.json bundle.targets or update the Windows release checklist.",
  );
}
if (tauriConfig.bundle?.useLocalToolsDir === true) {
  pass("tauri-local-tools-cache", "Tauri build tools use the project target cache");
} else {
  fail(
    "tauri-local-tools-cache",
    "Tauri should use the project target cache for Windows build tools",
    "Set src-tauri/tauri.conf.json bundle.useLocalToolsDir to true so release machines do not depend on restricted user cache paths.",
  );
}
if (tauriConfig.bundle?.windows?.nsis?.installMode === "currentUser") {
  pass("tauri-nsis-current-user", "NSIS installer uses currentUser mode");
} else {
  fail(
    "tauri-nsis-current-user",
    `Expected NSIS installMode currentUser, found ${
      tauriConfig.bundle?.windows?.nsis?.installMode ?? "missing"
    }`,
    "Set bundle.windows.nsis.installMode to currentUser for the public preview installer.",
  );
}

const config = readText("synapse.config.toml");
assertTomlValue(config, "safety", "external_delivery_enabled", "false", "external-delivery-off");
assertTomlValue(config, "safety", "agent_execution_enabled", "false", "agent-execution-off");
assertTomlValue(config, "safety", "script_execution_enabled", "false", "script-execution-off");
assertTomlValue(config, "sync.relay", "enabled", "false", "relay-off");
assertTomlValue(config, "notifications.feishu", "webhook_url", '""', "feishu-webhook-empty");
assertTomlValue(config, "notifications.wechat", "webhook_url", '""', "wechat-webhook-empty");
if (gitignore) {
  const requiredIgnoreItems = [".env", ".env.*", "*.pem", "*.key", "*.pfx", "*.p12"];
  const missingIgnoreItems = requiredIgnoreItems.filter((item) => !gitignore.includes(item));
  if (missingIgnoreItems.length === 0) {
    pass("secret-ignore-rules", ".gitignore protects local secrets and signing material");
  } else {
    fail(
      "secret-ignore-rules",
      `Missing .gitignore secret rule(s): ${missingIgnoreItems.join(" / ")}`,
      "Restore local secret and certificate ignore rules before publishing.",
    );
  }
}
if (gitattributes) {
  const requiredGitattributesItems = [
    "* text=auto",
    "*.rs text eol=lf",
    "*.tsx text eol=lf",
    "*.md text eol=lf",
    "*.docx binary",
    "*.pdf binary",
    "*.pptx binary",
    "*.xlsx binary",
    "*.png binary",
    "*.icns binary",
    "*.msi binary",
    "*.7z binary",
    "*.rar binary",
  ];
  const missingGitattributesItems = requiredGitattributesItems.filter(
    (item) => !gitattributes.includes(item),
  );
  if (missingGitattributesItems.length === 0) {
    pass("gitattributes-release-hygiene", ".gitattributes normalizes text and protects binary artifacts");
  } else {
    fail(
      "gitattributes-release-hygiene",
      `Missing .gitattributes item(s): ${missingGitattributesItems.join(" / ")}`,
      "Restore .gitattributes before publishing to GitHub from a Windows workspace.",
    );
  }
}
checkSensitiveFilesAbsent();
checkHardcodedSecretsAbsent();
checkSecretGuard();

const releaseChecklist = readProtectedText(
  "docs/RELEASE_CHECKLIST.md",
  "release-checklist-file",
  "Release checklist",
);
const releaseDistributionNotes = readProtectedText(
  "docs/RELEASE_DISTRIBUTION_NOTES.md",
  "release-distribution-notes-file",
  "Release distribution notes",
);
const readme = readProtectedText("README.md", "readme-file", "README");
const license = readProtectedText("LICENSE", "license-file", "License");
const securityPolicy = readProtectedText("SECURITY.md", "security-policy-file", "Security policy");
const contributing = readProtectedText("CONTRIBUTING.md", "contributing-file", "Contributing guide");
const envExample = readProtectedText(".env.example", "env-example-file", "Environment example");
const changelog = readProtectedText("CHANGELOG.md", "changelog-file", "Changelog");
const versioning = readProtectedText("VERSIONING.md", "versioning-file", "Versioning policy");
const capabilityMatrix = readProtectedText(
  "docs/CAPABILITY_MATRIX.md",
  "capability-matrix-file",
  "Capability matrix",
);
const configCapabilityMatrix = readProtectedText(
  "docs/CONFIG_CAPABILITY_MATRIX.md",
  "config-capability-matrix-file",
  "Config capability matrix",
);
const sourceRegistryDoc = readProtectedText(
  "docs/SOURCE_REGISTRY.md",
  "source-registry-doc-file",
  "Data Source Registry documentation",
);
readProtectedText(
  "docs/BAIGONG_MODULE_MANIFEST.md",
  "baigong-module-manifest-file",
  "Baigong module manifest template",
);
const publicBaselineStatus = readProtectedText(
  "docs/PUBLIC_BASELINE_STATUS.md",
  "public-baseline-status-file",
  "Public baseline status",
);
const developmentGuide = readProtectedText(
  "docs/DEVELOPMENT.md",
  "development-guide-file",
  "Development guide",
);
const installationGuide = readProtectedText(
  "docs/INSTALLATION.md",
  "installation-guide-file",
  "Installation guide",
);
const localDataPrivacy = readProtectedText(
  "docs/LOCAL_DATA_AND_PRIVACY.md",
  "local-data-privacy-file",
  "Local data and privacy guide",
);
const claimBoundaries = readProtectedText(
  "docs/CLAIM_BOUNDARIES.md",
  "claim-boundaries-file",
  "Claim boundaries",
);
const architectureOverview = readProtectedText(
  "docs/ARCHITECTURE_OVERVIEW.md",
  "architecture-overview-file",
  "Architecture overview",
);
const publicRoadmap = readProtectedText(
  "docs/PUBLIC_ROADMAP.md",
  "public-roadmap-file",
  "Public roadmap",
);
const bugReportTemplate = readProtectedText(
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  "bug-report-template-file",
  "Bug report template",
);
const featureRequestTemplate = readProtectedText(
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  "feature-request-template-file",
  "Feature request template",
);
const securityBoundaryTemplate = readProtectedText(
  ".github/ISSUE_TEMPLATE/security_boundary.yml",
  "security-boundary-template-file",
  "Security boundary issue template",
);
const documentationFixTemplate = readProtectedText(
  ".github/ISSUE_TEMPLATE/documentation_fix.yml",
  "documentation-fix-template-file",
  "Documentation fix issue template",
);
const pullRequestTemplate = readProtectedText(
  ".github/pull_request_template.md",
  "pull-request-template-file",
  "Pull request template",
);
const githubWorkflow = readProtectedText(
  ".github/workflows/public-baseline.yml",
  "github-public-baseline-workflow-file",
  "GitHub Actions public baseline workflow",
);
const releaseWorkflow = readProtectedText(
  ".github/workflows/manual-release.yml",
  "github-release-workflow-file",
  "GitHub Actions manual release workflow",
);
const gitBootstrap = readProtectedText(
  "scripts/git-bootstrap.mjs",
  "git-bootstrap-script",
  "Git bootstrap script",
);
const wixDiagnose = readProtectedText(
  "scripts/wix-diagnose.mjs",
  "wix-diagnose-script",
  "WiX diagnosis script",
);
const releaseEvidence = readProtectedText(
  "scripts/release-evidence.mjs",
  "release-evidence-script",
  "Release evidence script",
);
const releaseStatus = readProtectedText(
  "scripts/release-status.mjs",
  "release-status-script",
  "Release status script",
);
const releaseDoctor = readProtectedText(
  "scripts/release-doctor.mjs",
  "release-doctor-script",
  "Release doctor script",
);
const releaseAcceptance = readProtectedText(
  "scripts/release-acceptance.mjs",
  "release-acceptance-script",
  "Release acceptance script",
);
const installerSmoke = readProtectedText(
  "scripts/installer-smoke.ps1",
  "installer-smoke-script",
  "Installer smoke script",
);
const agentTeamPanel = readProtectedText(
  "src/components/AgentTeamPanel.tsx",
  "agent-team-panel-file",
  "Agent Team panel",
);
const agentTeamDomain = readProtectedText(
  "src-tauri/src/domains/agent_team.rs",
  "agent-team-domain-file",
  "Agent Team domain",
);
const agentHarnessDomain = readProtectedText(
  "src-tauri/src/domains/agent_harness.rs",
  "agent-harness-file",
  "Agent Harness domain",
);
const agentHarnessHook = readProtectedText(
  "src/app/useAgentHarness.ts",
  "agent-harness-hook-file",
  "Agent Harness UI hook",
);
const baigongArsenalHook = readProtectedText(
  "src/app/useBaigongArsenal.ts",
  "baigong-arsenal-hook-file",
  "Baigong Arsenal UI hook",
);
const notificationGateway = readProtectedText(
  "src-tauri/src/domains/notification_gateway.rs",
  "notification-gateway-file",
  "Notification gateway domain",
);
const notificationDeliveryAttemptStore = readProtectedText(
  "src-tauri/src/store/notification_delivery_attempt.rs",
  "notification-delivery-attempt-store-file",
  "Notification delivery attempt store",
);
const planWorkflowHook = readProtectedText(
  "src/app/usePlanWorkflow.ts",
  "plan-workflow-hook-file",
  "Plan Workflow UI hook",
);
const tauriCommands = readProtectedText(
  "src-tauri/src/lib.rs",
  "tauri-command-file",
  "Tauri command bridge",
);
const localAppBridge = readProtectedText(
  "src-tauri/src/domains/local_app_bridge.rs",
  "local-app-bridge-file",
  "Local App Bridge domain",
);
const localAppBridgePanel = readProtectedText(
  "src/components/LocalAppBridgePanel.tsx",
  "local-app-bridge-panel-file",
  "Local App Bridge panel",
);
const localAppBridgeHook = readProtectedText(
  "src/app/useLocalAppBridge.ts",
  "local-app-bridge-hook-file",
  "Local App Bridge UI hook",
);
const browserAutomation = readProtectedText(
  "src-tauri/src/domains/browser_automation.rs",
  "browser-automation-file",
  "Browser Automation domain",
);
const browserAutomationPanel = readProtectedText(
  "src/components/BrowserAutomationPanel.tsx",
  "browser-automation-panel-file",
  "Browser Automation panel",
);
const webAppShell = readProtectedText(
  "src-tauri/src/domains/web_app_shell.rs",
  "web-app-shell-file",
  "Web App Shell domain",
);
const webAppShellPanel = readProtectedText(
  "src/components/WebAppShellPanel.tsx",
  "web-app-shell-panel-file",
  "Web App Shell panel",
);
const codebaseMemory = readProtectedText(
  "src-tauri/src/domains/codebase_memory.rs",
  "codebase-memory-file",
  "Codebase Memory domain",
);
const codebaseMemoryPanel = readProtectedText(
  "src/components/CodebaseMemoryPanel.tsx",
  "codebase-memory-panel-file",
  "Codebase Memory panel",
);
const permissionMemory = readProtectedText(
  "src-tauri/src/domains/permission_memory.rs",
  "permission-memory-file",
  "Permission Memory domain",
);
const permissionMemoryPanel = readProtectedText(
  "src/components/PermissionMemoryPanel.tsx",
  "permission-memory-panel-file",
  "Permission Memory panel",
);
const skillLibrary = readProtectedText(
  "src-tauri/src/domains/skill_library.rs",
  "skill-library-file",
  "Skill Library domain",
);
const safeSystemInventoryScript = readProtectedText(
  "src-tauri/scripts/safe-system-inventory.ps1",
  "safe-system-inventory-script-file",
  "Safe system inventory script",
);
const skillLibraryPanel = readProtectedText(
  "src/components/SkillLibraryPanel.tsx",
  "skill-library-panel-file",
  "Skill Library panel",
);
const browserReadonlyScript = readProtectedText(
  "src-tauri/scripts/browser_readonly.py",
  "browser-readonly-script-file",
  "Browser read-only script",
);
const httpSource = readProtectedText(
  "src-tauri/src/http_source.rs",
  "http-source-file",
  "HTTP source adapter",
);
const capabilityPreviewPanel = readProtectedText(
  "src/components/CapabilityPreviewPanel.tsx",
  "capability-preview-panel-file",
  "Capability Preview panel",
);
const providerArtifactAdmissionHook = readProtectedText(
  "src/app/useProviderArtifactAdmission.ts",
  "provider-artifact-admission-hook-file",
  "Provider artifact admission UI hook",
);
const quantLabHook = readProtectedText(
  "src/app/useQuantLab.ts",
  "quant-lab-hook-file",
  "Quant Lab UI hook",
);
const sourceAggregationHook = readProtectedText(
  "src/app/useSourceAggregation.ts",
  "source-aggregation-hook-file",
  "Source aggregation UI hook",
);
const sourceRegistry = readProtectedText(
  "src-tauri/src/domains/source_registry.rs",
  "source-registry-domain-file",
  "Data Source Registry domain",
);
const sourceRegistryPanel = readProtectedText(
  "src/components/SourceRegistryPanel.tsx",
  "source-registry-panel-file",
  "Data Source Registry panel",
);
const sourceRegistryHook = readProtectedText(
  "src/app/useSourceRegistryPreview.ts",
  "source-registry-hook-file",
  "Data Source Registry preview hook",
);
const synapseCorePreviewsHook = readProtectedText(
  "src/app/useSynapseCorePreviews.ts",
  "synapse-core-previews-hook-file",
  "Synapse Core Previews UI hook",
);
const taihengProtectedSnapshotsHook = readProtectedText(
  "src/app/useTaihengProtectedSnapshots.ts",
  "taiheng-protected-snapshots-hook-file",
  "Taiheng Protected Snapshots UI hook",
);
const taihengRuntimeHook = readProtectedText(
  "src/app/useTaihengRuntime.ts",
  "taiheng-runtime-hook-file",
  "Taiheng Runtime UI hook",
);
const xingtaiTaskLoopHook = readProtectedText(
  "src/app/useXingtaiTaskLoop.ts",
  "xingtai-task-loop-hook-file",
  "Xingtai Task Loop UI hook",
);
const zhishuKnowledgeHook = readProtectedText(
  "src/app/useZhishuKnowledge.ts",
  "zhishu-knowledge-hook-file",
  "Zhishu Knowledge UI hook",
);
const zhishuAdmissionReviewHook = readProtectedText(
  "src/app/useZhishuAdmissionReview.ts",
  "zhishu-admission-review-hook-file",
  "Zhishu Admission Review UI hook",
);
const zhishuCaptureStreamsHook = readProtectedText(
  "src/app/useZhishuCaptureStreams.ts",
  "zhishu-capture-streams-hook-file",
  "Zhishu Capture Streams UI hook",
);
const deviceSync = readProtectedText(
  "src-tauri/src/domains/device_sync.rs",
  "device-sync-file",
  "Device Sync domain",
);
const deviceSyncHook = readProtectedText(
  "src/app/useDeviceSync.ts",
  "device-sync-hook-file",
  "Device Sync UI hook",
);
const deviceSyncPanel = readProtectedText(
  "src/components/DeviceSyncPanel.tsx",
  "device-sync-panel-file",
  "Device Sync panel",
);
const dailyBriefing = readProtectedText(
  "src-tauri/src/domains/daily_briefing.rs",
  "daily-briefing-file",
  "Daily Briefing domain",
);
const dailyBriefingPanel = readProtectedText(
  "src/components/DailyBriefingPanel.tsx",
  "daily-briefing-panel-file",
  "Daily Briefing panel",
);
const computerDiagnostics = readProtectedText(
  "src-tauri/src/domains/computer_diagnostics.rs",
  "computer-diagnostics-file",
  "Computer Diagnostics domain",
);
readProtectedText(
  "src/app/useComputerDiagnostics.ts",
  "computer-diagnostics-hook-file",
  "Computer Diagnostics UI hook",
);
const contextBudgetHook = readProtectedText(
  "src/app/useContextBudgetPreview.ts",
  "context-budget-hook-file",
  "Context Budget UI hook",
);
const contextBudget = readProtectedText(
  "src-tauri/src/domains/context_budget.rs",
  "context-budget-file",
  "Context Budget domain",
);
const libraryHome = readProtectedText(
  "src-tauri/src/domains/library_home.rs",
  "library-home-domain-file",
  "Library Home domain",
);
const productionReadiness = readProtectedText(
  "src-tauri/src/domains/production_readiness.rs",
  "production-readiness-file",
  "Production Readiness domain",
);
const systemService = readProtectedText(
  "src-tauri/src/services/system.rs",
  "system-service-file",
  "System capability service",
);
const storeMod = readProtectedText("src-tauri/src/store/mod.rs", "store-mod-file", "Store module");
const storeRepository = readProtectedText(
  "src-tauri/src/store/repository.rs",
  "store-repository-file",
  "Store repository",
);
const taskCenterStore = readProtectedText(
  "src-tauri/src/store/task_center.rs",
  "task-center-store-file",
  "Task Center store",
);
const taskCenterService = readProtectedText(
  "src-tauri/src/services/task_center.rs",
  "task-center-service-file",
  "Task Center service",
);
const providerReceiptStore = readProtectedText(
  "src-tauri/src/store/provider_receipt.rs",
  "provider-receipt-store-file",
  "Provider receipt review store",
);
const zhishuCore = readProtectedText("src-tauri/src/zhishu.rs", "zhishu-core-file", "Zhishu retrieval core");
const uiSmoke = readProtectedText("scripts/ui-smoke.mjs", "ui-smoke-file", "UI smoke script");
const secretGuard = readProtectedText("scripts/secret-guard.mjs", "secret-guard-file", "Secret Guard script");
const i18nCheck = readProtectedText("scripts/i18n-check.mjs", "i18n-check-file", "I18n check script");
const viteConfig = readProtectedText("vite.config.ts", "vite-config-file", "Vite config");
const appShell = readProtectedText("src/App.tsx", "app-shell-file", "App shell");
const alignmentMatrix = readProtectedText(
  "docs/CAPABILITY_MATRIX.md",
  "public-capability-matrix-file",
  "public baseline alignment matrix",
);
const requiredNonGoals = [
  "No direct CLI Agent execution",
  "No one-click real Agent team execution",
  "No automatic Feishu or WeChat delivery",
  "No automatic C drive cleanup or system file deletion",
  "No automatic L2 writes without explicit review",
  "Do not include internal design documents",
];
if (releaseChecklist) {
  const requiredChecklistItems = [
    ...requiredNonGoals,
    "docs/CLAIM_BOUNDARIES.md",
    "docs/CAPABILITY_MATRIX.md",
  ];
  const missingChecklistItems = requiredChecklistItems.filter((item) => !releaseChecklist.includes(item));
  if (missingChecklistItems.length === 0) {
    pass("public-release-checklist", `Release checklist includes ${PUBLIC_BASELINE_NAME} non-goals and release summary review`);
  } else {
    fail(
      "public-release-checklist",
      `Missing checklist item(s): ${missingChecklistItems.join(" / ")}`,
      `Restore the ${PUBLIC_BASELINE_NAME} release checklist so release review cannot accidentally claim unsafe automation or publish private planning material.`,
    );
  }
}

const requiredDistributionNotes = [
  "Signing",
  "SHA-256",
  "Do Not Claim In This Baseline",
  "Direct CLI Agent execution",
  "Automatic Feishu or WeChat delivery",
  ".tmp/release-evidence/release-summary.md",
];
if (releaseDistributionNotes) {
  const missingDistributionNotes = requiredDistributionNotes.filter(
    (item) => !releaseDistributionNotes.includes(item),
  );
  if (missingDistributionNotes.length === 0) {
    pass("release-distribution-notes", `Release notes cover signing, hashes, and ${PUBLIC_BASELINE_NAME} claim boundaries`);
  } else {
    fail(
      "release-distribution-notes",
      `Missing release distribution note item(s): ${missingDistributionNotes.join(" / ")}`,
      "Restore docs/RELEASE_DISTRIBUTION_NOTES.md before publishing a release artifact.",
    );
  }
}

if (readme) {
  const requiredReadmeItems = [
    "Public Repository Policy",
    "Release Status",
    PUBLIC_BASELINE_NAME,
    INTERNAL_DESIGN_ALIGNMENT,
    "Taiheng",
    "Xingtai",
    "Baigong",
    "docs/CAPABILITY_MATRIX.md",
    "docs/CONFIG_CAPABILITY_MATRIX.md",
    "docs/SOURCE_REGISTRY.md",
    "docs/CLAIM_BOUNDARIES.md",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "docs/DEVELOPMENT.md",
    "docs/INSTALLATION.md",
    "docs/LOCAL_DATA_AND_PRIVACY.md",
    "CHANGELOG.md",
    "npm.cmd run preflight:release",
    "npm.cmd run release:evidence",
    "npm.cmd run release:status",
    "Do Not Claim",
    "guarded local-first baseline",
  ];
  const missingReadmeItems = requiredReadmeItems.filter((item) => !readme.includes(item));
  if (missingReadmeItems.length === 0) {
    pass("readme-release-boundary", `README covers public repository policy and ${PUBLIC_BASELINE_NAME} claim boundaries`);
  } else {
    fail(
      "readme-release-boundary",
      `Missing README release boundary item(s): ${missingReadmeItems.join(" / ")}`,
      `Restore README public repository policy and ${PUBLIC_BASELINE_NAME} claim-boundary guidance before publishing.`,
    );
  }
}

if (license) {
  const requiredLicenseItems = ["Apache License", "Version 2.0", "Copyright 2026"];
  const missingLicenseItems = requiredLicenseItems.filter((item) => !license.includes(item));
  if (missingLicenseItems.length === 0) {
    pass("license-policy", "LICENSE declares Apache-2.0 public licensing");
  } else {
    fail(
      "license-policy",
      `Missing license item(s): ${missingLicenseItems.join(" / ")}`,
      "Restore LICENSE before treating the repository as an open public baseline.",
    );
  }
}

if (securityPolicy) {
  const requiredSecurityItems = [
    "External delivery is disabled by default",
    "Direct Agent execution is disabled by default",
    "Data Source Registry does not store credentials",
    "Do not include secrets",
  ];
  const missingSecurityItems = requiredSecurityItems.filter((item) => !securityPolicy.includes(item));
  if (missingSecurityItems.length === 0) {
    pass("security-policy", "SECURITY.md documents public baseline safety defaults and reporting boundaries");
  } else {
    fail(
      "security-policy",
      `Missing security policy item(s): ${missingSecurityItems.join(" / ")}`,
      "Restore SECURITY.md before accepting public security reports.",
    );
  }
}

if (contributing) {
  const requiredContributingItems = [
    "Do not submit secrets",
    "docs/CLAIM_BOUNDARIES.md",
    "npm.cmd run preflight:static",
  ];
  const missingContributingItems = requiredContributingItems.filter((item) => !contributing.includes(item));
  if (missingContributingItems.length === 0) {
    pass("contributing-guide", "CONTRIBUTING.md keeps contribution boundaries visible");
  } else {
    fail(
      "contributing-guide",
      `Missing contributing item(s): ${missingContributingItems.join(" / ")}`,
      "Restore CONTRIBUTING.md before inviting public contributions.",
    );
  }
}

if (envExample) {
  const requiredEnvItems = [
    "SYNAPSE_SMTP_USERNAME=",
    "SYNAPSE_SMTP_PASSWORD=",
    "SYNAPSE_RELAY_TOKEN=",
  ];
  const missingEnvItems = requiredEnvItems.filter((item) => !envExample.includes(item));
  if (missingEnvItems.length === 0) {
    pass("env-example", ".env.example lists empty local secret placeholders");
  } else {
    fail(
      "env-example",
      `Missing env example item(s): ${missingEnvItems.join(" / ")}`,
      "Restore .env.example with empty placeholders only.",
    );
  }
}

if (changelog) {
  const requiredChangelogItems = [
    "0.0.0 - Initial Public Baseline",
    "Internal design document versions are not public release numbers",
    "unrestricted Agent execution",
  ];
  const missingChangelogItems = requiredChangelogItems.filter((item) => !changelog.includes(item));
  if (missingChangelogItems.length === 0) {
    pass("changelog-public-versioning", "CHANGELOG.md documents public versions without internal design release numbers");
  } else {
    fail(
      "changelog-public-versioning",
      `Missing changelog item(s): ${missingChangelogItems.join(" / ")}`,
      "Restore CHANGELOG.md before tagging a public baseline.",
    );
  }
}

if (versioning) {
  const requiredVersioningItems = [
    PUBLIC_VERSION,
    "Initial Public Baseline",
    INTERNAL_DESIGN_ALIGNMENT,
    "separates public software versions from internal design document",
  ];
  const missingVersioningItems = requiredVersioningItems.filter((item) => !versioning.includes(item));
  if (missingVersioningItems.length === 0) {
    pass("versioning-policy", "Versioning policy separates public software and internal design tracks");
  } else {
    fail(
      "versioning-policy",
      `Missing versioning policy item(s): ${missingVersioningItems.join(" / ")}`,
      "Restore VERSIONING.md before changing package, Cargo, Tauri, or release version metadata.",
    );
  }
}

if (capabilityMatrix) {
  const requiredCapabilityItems = [
    "usable",
    "preview-only",
    "dry-run",
    "Taiheng",
    "Zhishu",
    "Xingtai",
    "Baigong",
    "Data source registry",
  ];
  const missingCapabilityItems = requiredCapabilityItems.filter((item) => !capabilityMatrix.includes(item));
  if (missingCapabilityItems.length === 0) {
    pass("capability-matrix", "Capability matrix covers current usable, preview, dry-run, and disabled states");
  } else {
    fail(
      "capability-matrix",
      `Missing capability matrix item(s): ${missingCapabilityItems.join(" / ")}`,
      "Restore docs/CAPABILITY_MATRIX.md before claiming current capabilities.",
    );
  }
}

if (configCapabilityMatrix) {
  const requiredConfigCapabilityItems = [
    "active",
    "preview",
    "reserved",
    "synapse.config.toml",
    "Data source registry entries",
  ];
  const missingConfigCapabilityItems = requiredConfigCapabilityItems.filter(
    (item) => !configCapabilityMatrix.includes(item),
  );
  if (missingConfigCapabilityItems.length === 0) {
    pass("config-capability-matrix", "Config capability matrix labels active, preview, and reserved settings");
  } else {
    fail(
      "config-capability-matrix",
      `Missing config capability matrix item(s): ${missingConfigCapabilityItems.join(" / ")}`,
      "Restore docs/CONFIG_CAPABILITY_MATRIX.md before expanding configuration claims.",
    );
  }
}

if (sourceRegistryDoc) {
  const requiredSourceRegistryDocItems = [
    "lightweight Baigong/Taiheng governance",
    "not a data warehouse",
    "No credentials are stored in the registry",
    "background heavy polling",
    "akshare_cn_stock",
    "verification_policy",
    "quarantine_policy",
  ];
  const missingSourceRegistryDocItems = requiredSourceRegistryDocItems.filter(
    (item) => !sourceRegistryDoc.includes(item),
  );
  if (missingSourceRegistryDocItems.length === 0) {
    pass("source-registry-doc", "Data Source Registry docs define lightweight governance and safety boundaries");
  } else {
    fail(
      "source-registry-doc",
      `Missing source registry doc item(s): ${missingSourceRegistryDocItems.join(" / ")}`,
      "Restore docs/SOURCE_REGISTRY.md before enabling source registry work.",
    );
  }
}

if (
  publicBaselineStatus &&
  claimBoundaries &&
  architectureOverview &&
  developmentGuide &&
  installationGuide &&
  localDataPrivacy &&
  publicRoadmap
) {
  const requiredPublicDocItems = [
    [publicBaselineStatus, "Synapse 0.0.0 Public Baseline Status"],
    [publicBaselineStatus, "Not Included In This Baseline"],
    [claimBoundaries, "Claim Boundaries"],
    [claimBoundaries, "Do not claim unrestricted or one-click Agent execution"],
    [architectureOverview, "Taiheng / Governance Core"],
    [architectureOverview, "Zhishu / Intelligence Hub"],
    [architectureOverview, "Xingtai / Action Desk"],
    [architectureOverview, "Baigong / Arsenal"],
    [developmentGuide, "Rust stable MSVC toolchain"],
    [developmentGuide, "npm.cmd run preflight:static"],
    [installationGuide, "Installer Status"],
    [installationGuide, "Debug MSI artifacts"],
    [localDataPrivacy, "Synapse is local-first"],
    [localDataPrivacy, ".synapse/"],
    [publicRoadmap, "0.0.x"],
    [publicRoadmap, "1.0.0"],
  ];
  const missingPublicDocItems = requiredPublicDocItems
    .filter(([content, item]) => !content.includes(item))
    .map(([, item]) => item);
  if (missingPublicDocItems.length === 0) {
    pass("public-doc-boundaries", "Public docs cover baseline status, claim boundaries, architecture, and roadmap");
  } else {
    fail(
      "public-doc-boundaries",
      `Missing public doc item(s): ${missingPublicDocItems.join(" / ")}`,
      "Restore public docs before promoting the repository.",
    );
  }
}

if (
  bugReportTemplate &&
  featureRequestTemplate &&
  securityBoundaryTemplate &&
  documentationFixTemplate &&
  pullRequestTemplate
) {
  const requiredTemplateItems = [
    [bugReportTemplate, "Do not include secrets"],
    [featureRequestTemplate, "Boundary check"],
    [securityBoundaryTemplate, "External delivery or webhook push"],
    [securityBoundaryTemplate, "Credential or secret handling"],
    [documentationFixTemplate, "Documentation fix"],
    [documentationFixTemplate, "private design documents"],
    [pullRequestTemplate, "Does not enable external delivery by default"],
    [pullRequestTemplate, "docs/CLAIM_BOUNDARIES.md"],
  ];
  const missingTemplateItems = requiredTemplateItems
    .filter(([content, item]) => !content.includes(item))
    .map(([, item]) => item);
  if (missingTemplateItems.length === 0) {
    pass("github-governance-templates", "Issue and PR templates protect public contribution boundaries");
  } else {
    fail(
      "github-governance-templates",
      `Missing GitHub template item(s): ${missingTemplateItems.join(" / ")}`,
      "Restore Issue/PR templates before enabling public collaboration.",
    );
  }
}

const requiredWorkflowItems = [
  "Synapse Public Baseline",
  "windows-latest",
  "permissions:",
  "contents: read",
  "actions/checkout@v4",
  "actions/setup-node@v4",
  "dtolnay/rust-toolchain@stable",
  "npm ci",
  "npm.cmd run preflight:static",
  "npm.cmd run build",
  "cargo check",
  "cargo test zhishu_retrieval_acceptance_finds_reviewed_l2_memory_after_admission",
  "cargo test task_loop_acceptance_covers_direction_run_execution_artifact_and_memory_admission",
  "cargo test scheduled_task_loop_acceptance_covers_tick_approval_execution_and_memory_admission",
  "cargo test permission_memory",
  "cargo test codebase_memory",
  "cargo test feishu_wechat_mock_receipt_contract_never_marks_external_delivery_started",
  "cargo test daily_briefing",
  "cargo test source_registry",
  "cargo test device_sync",
  "cargo test browser_automation",
  "cargo test local_app_bridge",
  "cargo test agent_harness",
  "cargo test agent_team",
  "cargo test real_team_preflight",
  "cargo test computer_diagnostics",
  "cargo test skill_library",
  "cargo test production_readiness",
];
if (githubWorkflow) {
  const missingWorkflowItems = requiredWorkflowItems.filter((item) => !githubWorkflow.includes(item));
  if (missingWorkflowItems.length === 0) {
    pass("github-public-baseline-workflow", "GitHub Actions public baseline workflow is present");
  } else {
    fail(
      "github-public-baseline-workflow",
      `Missing workflow item(s): ${missingWorkflowItems.join(" / ")}`,
      "Restore .github/workflows/public-baseline.yml before publishing to GitHub.",
    );
  }
}
const requiredReleaseWorkflowItems = [
  "Synapse Manual Release",
  "workflow_dispatch:",
  "version:",
  "allow_unsigned",
  "contents: write",
  "git ls-remote --tags origin",
  "$existingTag",
  "Tag $tag already exists",
  "npm.cmd run secret:scan",
  "npm.cmd run preflight:static",
  "npm.cmd run i18n:check",
  "cargo check",
  "cargo test zhishu_retrieval_acceptance_finds_reviewed_l2_memory_after_admission",
  "cargo test task_loop_acceptance_covers_direction_run_execution_artifact_and_memory_admission",
  "cargo test scheduled_task_loop_acceptance_covers_tick_approval_execution_and_memory_admission",
  "cargo test permission_memory",
  "cargo test codebase_memory",
  "cargo test feishu_wechat_mock_receipt_contract_never_marks_external_delivery_started",
  "cargo test daily_briefing",
  "cargo test source_registry",
  "cargo test device_sync",
  "cargo test browser_automation",
  "cargo test local_app_bridge",
  "cargo test agent_harness",
  "cargo test agent_team",
  "cargo test real_team_preflight",
  "cargo test computer_diagnostics",
  "cargo test skill_library",
  "cargo test production_readiness",
  "Synchronize release version in workspace",
  "npm.cmd run build",
  "npm.cmd run tauri:build",
  "npm.cmd run tauri:build:release",
  "WINDOWS_SIGNING_CERT_BASE64",
  "WINDOWS_SIGNING_CERT_PASSWORD",
  "SYNAPSE_SIGNING_MODE=unsigned-preview",
  "verify /pa",
  "scripts/release-notes.mjs",
  "npm.cmd run release:acceptance",
  "npm.cmd run release:smoke:installer",
  "Get-FileHash -Algorithm SHA256",
  "gh release create",
];
if (releaseWorkflow) {
  const missingReleaseWorkflowItems = requiredReleaseWorkflowItems.filter(
    (item) => !releaseWorkflow.includes(item),
  );
  const forbiddenReleaseWorkflowItems = ["branches: [main]", "push:"].filter((item) =>
    releaseWorkflow.includes(item),
  );
  if (missingReleaseWorkflowItems.length === 0 && forbiddenReleaseWorkflowItems.length === 0) {
    pass("github-manual-release-workflow", "Manual release workflow is guarded and explicitly triggered");
  } else {
    fail(
      "github-manual-release-workflow",
      [
        missingReleaseWorkflowItems.length > 0
          ? `missing item(s): ${missingReleaseWorkflowItems.join(" / ")}`
          : null,
        forbiddenReleaseWorkflowItems.length > 0
          ? `forbidden automatic trigger item(s): ${forbiddenReleaseWorkflowItems.join(" / ")}`
          : null,
      ]
        .filter(Boolean)
        .join("; "),
      "Restore .github/workflows/manual-release.yml as a workflow_dispatch-only guarded release workflow.",
    );
  }
  const syncVersionIndex = releaseWorkflow.indexOf("Synchronize release version in workspace");
  const buildFrontendIndex = releaseWorkflow.indexOf("Build frontend");
  if (syncVersionIndex >= 0 && buildFrontendIndex >= 0 && syncVersionIndex < buildFrontendIndex) {
    pass("github-manual-release-version-build-order", "Manual release workflow synchronizes version metadata before building frontend assets");
  } else {
    fail(
      "github-manual-release-version-build-order",
      "Manual release workflow must synchronize release version metadata before the frontend build.",
      "Move the version synchronization step before npm.cmd run build so the packaged app displays the release version.",
    );
  }
}
if (gitBootstrap) {
  const requiredGitBootstrapItems = ["--repair-empty-git", "--yes", "git init", "Refusing automatic repair"];
  const missingGitBootstrapItems = requiredGitBootstrapItems.filter(
    (item) => !gitBootstrap.includes(item),
  );
  if (missingGitBootstrapItems.length === 0) {
    pass("git-bootstrap-guard", "Git bootstrap script keeps explicit repair guardrails");
  } else {
    fail(
      "git-bootstrap-guard",
      `Missing git bootstrap guard item(s): ${missingGitBootstrapItems.join(" / ")}`,
      "Restore scripts/git-bootstrap.mjs guardrails before publishing.",
    );
  }
}
if (wixDiagnose) {
  const requiredWixDiagnoseItems = ["candle.exe", "light.exe", "wix.exe", "pre-cache Tauri's WiX bundle"];
  const missingWixDiagnoseItems = requiredWixDiagnoseItems.filter(
    (item) => !wixDiagnose.includes(item),
  );
  if (missingWixDiagnoseItems.length === 0) {
    pass("wix-diagnose-guard", "WiX diagnosis script keeps release tooling guidance");
  } else {
    fail(
      "wix-diagnose-guard",
      `Missing WiX diagnosis item(s): ${missingWixDiagnoseItems.join(" / ")}`,
      "Restore scripts/wix-diagnose.mjs before release packaging.",
    );
  }
}
if (releaseEvidence) {
  const requiredReleaseEvidenceItems = [
    "Documentation Boundary",
    "public-release-checklist",
    "release-distribution-notes",
    "readme-release-boundary",
    "public-capability-matrix",
    "Release Blockers",
    "Public Baseline Claim Boundary",
    "notification_staging",
    "signed-loopback-staging-delivery",
    "http-loopback-staging-only",
    "policy-and-envelope-without-secrets",
    "findInstallerArtifacts",
    "release-installer-current-version",
    "installer-smoke-evidence-missing",
    "installer-smoke-window-evidence-missing",
    "installer_smoke",
    "release_nsis_count",
    "release_signing",
    "signing_mode",
    "unsigned_preview_allowed",
    "signed_installer_count",
    "all_release_installers_signed",
    "installer-signature-invalid",
    "Get-AuthenticodeSignature",
    "version_matches",
    "renderReleaseSummary",
    "buildReleaseReview",
    "schema_version: 1",
    "Schema version",
    "release_review",
    "artifact_readiness",
    "has_distributable_installer",
    "has_distributable_msi",
    "release-installer-stale",
    "installerBuildInputDirectories",
    "Safe Public Claim",
    "Artifact Readiness",
    "Windows Installer Artifacts",
    "Installer Smoke Evidence",
    "debug installer rehearsal artifact",
    "Do not distribute these as a formal release",
    "Do Not Claim",
    "Required Next Actions",
  ];
  const missingReleaseEvidenceItems = requiredReleaseEvidenceItems.filter(
    (item) => !releaseEvidence.includes(item),
  );
  if (missingReleaseEvidenceItems.length === 0) {
    pass("release-evidence-guard", "Release evidence script preserves documentation boundary and blocker summaries");
  } else {
    fail(
      "release-evidence-guard",
      `Missing release evidence item(s): ${missingReleaseEvidenceItems.join(" / ")}`,
      "Restore scripts/release-evidence.mjs so release evidence keeps documentation-boundary, blocker, and claim-boundary summaries.",
    );
  }
}
if (releaseStatus) {
  const requiredReleaseStatusItems = [
    "release_review",
    "schema_version",
    "[SCHEMA]",
    "--json",
    "evidence_path",
    "freshnessInputs",
    "scripts/release-doctor.mjs",
    "scripts/git-diagnose.mjs",
    "scripts/wix-diagnose.mjs",
    "scripts/ui-smoke.mjs",
    "scripts/ui-smoke-tauri-mock.js",
    "src/App.tsx",
    "src/App.css",
    "src/app/useNotificationGateway.ts",
    "src/components/NotificationGatewayPanel.tsx",
    "src-tauri/src/domains/notification_gateway.rs",
    "src/i18n/localizeText.ts",
    ".tmp/ui-smoke/desktop.png",
    ".tmp/ui-smoke/mobile.png",
    "src-tauri/src/domains/production_readiness.rs",
    "freshnessInputDirectories",
    "collectFilesRecursively",
    "Date.parse",
    "stale_inputs",
    "[STALE]",
    "artifact_readiness",
    "[STATE]",
    "[READY]",
    "[ARTIFACTS]",
    "[SIGNING]",
    "signed_installer_count",
    "all_release_installers_signed",
    "release_installer",
    "installer_smoke",
    "[BLOCKER]",
    "release:evidence",
  ];
  const missingReleaseStatusItems = requiredReleaseStatusItems.filter(
    (item) => !releaseStatus.includes(item),
  );
  if (missingReleaseStatusItems.length === 0) {
    pass("release-status-guard", "Release status script reports release_review state, blockers, and artifacts");
  } else {
    fail(
      "release-status-guard",
      `Missing release status item(s): ${missingReleaseStatusItems.join(" / ")}`,
      "Restore scripts/release-status.mjs so release status remains machine-readable and evidence-backed.",
    );
  }
}
if (releaseDoctor) {
  const requiredReleaseDoctorItems = [
    "--json",
    "This command is read-only",
    "read_only",
    "git-diagnose",
    "wix-diagnose",
    "preflight-static",
    "release-preflight-json",
    "generate evidence",
    "release-status-json",
    "parse_error",
    "checks",
    "[STALE-INPUT]",
    "[READY]",
    "[BLOCKER]",
  ];
  const missingReleaseDoctorItems = requiredReleaseDoctorItems.filter(
    (item) => !releaseDoctor.includes(item),
  );
  if (missingReleaseDoctorItems.length === 0) {
    pass("release-doctor-guard", "Release doctor summarizes read-only release readiness checks");
  } else {
    fail(
      "release-doctor-guard",
      `Missing release doctor item(s): ${missingReleaseDoctorItems.join(" / ")}`,
      "Restore scripts/release-doctor.mjs so release readiness can be summarized without mutating external state.",
    );
  }
}
if (i18nCheck) {
  const requiredI18nCoverageItems = [
    "readUsedLocalizedTextKeys",
    "readLocalizedTextKeys",
    "Used dynamic text key is not localized in localizeText.ts",
    "localizeTextSource.matchAll",
    "\\btext\\(\"([^\"]+)\"\\)",
  ];
  const missingI18nCoverageItems = requiredI18nCoverageItems.filter((item) => !i18nCheck.includes(item));
  if (missingI18nCoverageItems.length === 0) {
    pass("i18n-dynamic-text-coverage-guard", "I18n check enforces dynamic text() localization coverage");
  } else {
    fail(
      "i18n-dynamic-text-coverage-guard",
      `Missing i18n dynamic coverage item(s): ${missingI18nCoverageItems.join(" / ")}`,
      "Restore scripts/i18n-check.mjs so static text(\"...\") UI strings cannot bypass Simplified Chinese localization.",
    );
  }
}
if (releaseAcceptance) {
  const requiredReleaseAcceptanceItems = [
    "SYNAPSE_RELEASE_VERSION",
    "SYNAPSE_SIGNING_MODE",
    "SYNAPSE_ALLOW_UNSIGNED",
    "checkVersionMetadata",
    "checkFrontendVersionDisplay",
    "checkInstallers",
    "checkInstallerSigning",
    "Get-AuthenticodeSignature",
    "unsigned-preview",
    "installer-signature",
    ".sha256",
  ];
  const missingReleaseAcceptanceItems = requiredReleaseAcceptanceItems.filter(
    (item) => !releaseAcceptance.includes(item),
  );
  if (missingReleaseAcceptanceItems.length === 0) {
    pass("release-acceptance-guard", "Release acceptance verifies version display, installer artifacts, SHA-256 sidecars, and signing policy");
  } else {
    fail(
      "release-acceptance-guard",
      `Missing release acceptance item(s): ${missingReleaseAcceptanceItems.join(" / ")}`,
      "Restore scripts/release-acceptance.mjs before publishing a release.",
    );
  }
}
if (installerSmoke) {
  const requiredInstallerSmokeItems = [
    "Start Menu",
    "Synapse*.lnk",
    "WScript.Shell",
    "startup_window_seconds",
    "MainWindowHandle",
    "runtime_config_template_created",
    "window_nonblank_verified",
    "window_screenshot_path",
    "window_sampled_color_count",
    "PrintWindow",
    "com.synapse.local\\synapse.config.toml",
    "main_window_detected",
    "main_window_title",
    "installer-smoke.json",
    "uninstall.exe",
  ];
  const missingInstallerSmokeItems = requiredInstallerSmokeItems.filter(
    (item) => !installerSmoke.includes(item),
  );
  if (missingInstallerSmokeItems.length === 0) {
    pass("installer-smoke-guard", "Installer smoke verifies Start menu target, nonblank launch window screenshot, uninstall, and evidence output");
  } else {
    fail(
      "installer-smoke-guard",
      `Missing installer smoke item(s): ${missingInstallerSmokeItems.join(" / ")}`,
      "Restore scripts/installer-smoke.ps1 packaged-app acceptance coverage before release.",
    );
  }
}
if (agentTeamPanel && agentTeamDomain) {
  const requiredAgentTeamPreviewItems = [
    [agentTeamPanel, "Build team preview"],
    [agentTeamPanel, "Execute fake team"],
    [agentTeamPanel, "Preflight real team"],
    [agentTeamPanel, "agent-team-real-preflight-result"],
    [agentTeamPanel, "Record real staging receipt"],
    [agentTeamPanel, "agent-team-real-staging-result"],
    [agentTeamPanel, "Execute real team"],
    [agentTeamPanel, "agent-team-real-execution-result"],
    [agentTeamDomain, "blueprint-preview-ready"],
    [agentTeamDomain, "real-execution-requires-safety-enable-and-final-approval"],
    [agentTeamDomain, "fake-execution-receipt-recorded"],
    [agentTeamDomain, "fake-execution-budget-stopped-receipt-recorded"],
    [agentTeamDomain, "fake-execution-cancelled-receipt-recorded"],
    [agentTeamDomain, "agent-team-fake-execution-receipt"],
    [agentTeamDomain, "budget-stop-records-blocked-calls"],
    [agentTeamDomain, "operator-cancel-records-partial-receipt"],
    [agentTeamDomain, "\"calls_blocked\""],
    [agentTeamDomain, "\"stop_reason\""],
    [agentTeamDomain, "\"external_process_started\": false"],
    [agentTeamDomain, "\"no_direct_memory_write\": true"],
    [agentTeamDomain, "admission_state: \"quarantined\""],
    [agentTeamDomain, "process_started: false"],
    [agentTeamDomain, "AgentTeamRealExecutionPreflight"],
    [agentTeamDomain, "preflight_real_execution"],
    [agentTeamDomain, "per-step-agent-harness-preflight"],
    [agentTeamDomain, "all-steps-must-pass-before-team-execution"],
    [agentTeamDomain, "team-synthesizer-real-adapter-not-implemented"],
    [agentTeamDomain, "no-task-content-sent"],
    [agentTeamDomain, "real-team-execution-blocked-by-default"],
    [agentTeamDomain, "ready-for-final-human-team-execution-approval"],
    [agentTeamDomain, "real_team_preflight_blocks_when_any_step_is_not_execution_enabled"],
    [agentTeamDomain, "AgentTeamRealStagingReceipt"],
    [agentTeamDomain, "stage_real_execution"],
    [agentTeamDomain, "execute_real"],
    [agentTeamDomain, "agent-team-real-staging-receipt"],
    [agentTeamDomain, "agent-team-real-execution-receipt"],
    [agentTeamDomain, "real-agent-staging-receipt-recorded"],
    [agentTeamDomain, "real-agent-execution-receipt-recorded"],
    [agentTeamDomain, "real-agent-partial-execution-receipt-recorded"],
    [agentTeamDomain, "request_real_execution_cancel"],
    [agentTeamDomain, "TEAM_CANCELLATIONS"],
    [agentTeamDomain, "cancellation_observed"],
    [agentTeamDomain, "step-failed"],
    [agentTeamDomain, '"agent-team-real-execution"'],
    [agentTeamDomain, '"before-agent-team-real-execution"'],
    [agentTeamDomain, "fail_real_execution_saga"],
    [agentTeamDomain, "rollback_snapshot"],
    [agentTeamDomain, "audit_event"],
    [agentTeamDomain, '"committed"'],
    [agentHarnessDomain, "Codex execution cancelled by operator"],
    [agentHarnessDomain, "terminate_process_tree"],
    [agentHarnessDomain, 'Command::new("taskkill")'],
    [agentHarnessDomain, '"/T"'],
    [agentHarnessDomain, "windows_process_tree_termination_removes_descendant_process"],
    [agentHarnessDomain, "process_timeout_terminates_controlled_process"],
    [agentHarnessDomain, "wait_for_process"],
    [tauriCommands, "spawn_blocking"],
    [tauriCommands, "cancel_real_agent_team"],
    [agentTeamPanel, "agent-team-real-cancel-button"],
    [agentTeamPanel, "agent-team-real-lifecycle-result"],
    [agentTeamPanel, "agent-team-real-transaction-receipt"],
    [agentTeamDomain, "real-agent-staging-only"],
    [agentTeamDomain, "real-agent-guarded-execution"],
    [agentTeamDomain, "quarantined-staging-only"],
    [agentTeamDomain, "quarantined-real-output-review-required"],
    [agentTeamDomain, "real_staging_receipts_hash_inputs_and_never_start_processes"],
    [agentTeamDomain, "final_team_commit_failure_compensates_only_the_final_receipt"],
    [agentTeamDomain, "compensate_final_team_artifact"],
    [agentTeamDomain, "task_content_sent: false"],
    [agentTeamPanel, "Call budget"],
    [agentTeamPanel, "Cancel after calls"],
  ];
  const missingAgentTeamPreviewItems = requiredAgentTeamPreviewItems
    .filter(([content, item]) => !content.includes(item))
    .map(([, item]) => item);
  if (missingAgentTeamPreviewItems.length === 0) {
    pass(
      "agent-team-guarded-execution",
      "Agent team keeps fake/staging paths and guarded real execution with cancellation, timeout termination, quarantine, and partial receipts",
    );
  } else {
    fail(
      "agent-team-guarded-execution",
      `Missing Agent team guarded-execution item(s): ${missingAgentTeamPreviewItems.join(" / ")}`,
      `Restore Agent team execution guards before claiming the ${PUBLIC_BASELINE_NAME}.`,
    );
  }
}
if (agentHarnessDomain) {
  const requiredAgentHarnessItems = [
    "credential-env-filter",
    "env_clear()",
    "is_credential_env_key",
    "workspace-boundary",
    "pre-execution-rollback-snapshot",
    "store::create_snapshot",
    "post-execution-output-review",
    "secret-scan-required-before-admission",
    "test-check-required-before-admission",
    "agent-output-quarantine",
    "finalize_agent_execution",
    "compensate_agent_execution",
    "agent_execution_final_commit_failure_compensates_after_run_and_audit",
    "read-only",
    "smoke_adapters",
    "AgentAdapterSmokeReport",
    "RealAgentExecutionPreflight",
    "preflight_real_execution",
    "real-agent-execution-blocked-by-default",
    "agent execution is disabled by [safety].agent_execution_enabled",
    "external-agent-execution-gate-disabled",
    "no-version-probe",
    "no-task-prompt-sent",
    "no-process-spawn",
    "no-task-content-sent",
  ];
  const missingAgentHarnessItems = requiredAgentHarnessItems.filter(
    (item) => !agentHarnessDomain.includes(item),
  );
  if (missingAgentHarnessItems.length === 0) {
    pass("agent-harness-safety-guard", "Agent Harness keeps credential filtering, rollback, quarantine, and review gates");
  } else {
    fail(
      "agent-harness-safety-guard",
      `Missing Agent Harness guard item(s): ${missingAgentHarnessItems.join(" / ")}`,
      "Restore Agent Harness safety gates before enabling any real external Agent execution.",
    );
  }
}
if (agentHarnessHook) {
  const requiredAgentHarnessHookItems = [
    "useAgentHarness",
    "dry_run_agent_harness",
    "execute_codex_agent",
    "smoke_agent_adapters",
    "preflight_real_agent_execution",
    "loadExecutorContractPreview",
    "refreshProductionOverview",
    "window.confirm(",
    "read-only sandbox mode and quarantine its output",
  ];
  const missingAgentHarnessHookItems = requiredAgentHarnessHookItems.filter(
    (item) => !agentHarnessHook.includes(item),
  );
  if (missingAgentHarnessHookItems.length === 0) {
    pass(
      "agent-harness-hook-guard",
      "Agent Harness UI state and invoke flow stay isolated from the App shell",
    );
  } else {
    fail(
      "agent-harness-hook-guard",
      `Missing Agent Harness hook item(s): ${missingAgentHarnessHookItems.join(" / ")}`,
      "Restore src/app/useAgentHarness.ts before expanding Agent Harness execution flows.",
    );
  }
}
if (baigongArsenalHook) {
  const requiredBaigongArsenalHookItems = [
    "useBaigongArsenal",
    "preview_arsenal_registry",
    "set_arsenal_tool_allow_state",
    "execute_mock_adapter",
    "dry_run_mock_adapter",
    "loadProtectedSnapshots",
    "loadAuditEvents",
    "loadTaskArtifacts",
    "refreshProductionOverview",
    "setUpdatingToolId",
  ];
  const missingBaigongArsenalHookItems = requiredBaigongArsenalHookItems.filter(
    (item) => !baigongArsenalHook.includes(item),
  );
  if (missingBaigongArsenalHookItems.length === 0) {
    pass(
      "baigong-arsenal-hook-guard",
      "Baigong Arsenal registry and mock adapter flows stay isolated from the App shell",
    );
  } else {
    fail(
      "baigong-arsenal-hook-guard",
      `Missing Baigong Arsenal hook item(s): ${missingBaigongArsenalHookItems.join(" / ")}`,
      "Restore src/app/useBaigongArsenal.ts before expanding Baigong tool execution flows.",
    );
  }
}
if (planWorkflowHook) {
  const requiredPlanWorkflowHookItems = [
    "usePlanWorkflow",
    "get_recent_plans",
    "submit_intent",
    "clear_plan_history",
    "review_plan",
    "restoreLatest",
    "selectHistory",
    "setIsSubmitting",
    "setIsReviewing",
    "Materialized",
    "Audit review could not be recorded.",
  ];
  const missingPlanWorkflowHookItems = requiredPlanWorkflowHookItems.filter(
    (item) => !planWorkflowHook.includes(item),
  );
  if (missingPlanWorkflowHookItems.length === 0) {
    pass(
      "plan-workflow-hook-guard",
      "Plan submission, history, review, and selection flows stay isolated from the App shell",
    );
  } else {
    fail(
      "plan-workflow-hook-guard",
      `Missing Plan Workflow hook item(s): ${missingPlanWorkflowHookItems.join(" / ")}`,
      "Restore src/app/usePlanWorkflow.ts before expanding Thinking view planning flows.",
    );
  }
}
if (notificationGateway) {
  const requiredNotificationPreviewItems = [
    "adapter-preview-only",
    "delivery_started: false",
    "mock_webhook_payload",
    "mock-webhook-receipt-recorded",
    "SYNAPSE_MOCK_WEBHOOK_ENDPOINT",
    "MOCK_WEBHOOK_MAX_ATTEMPTS",
    "retryable-http-5xx",
    "permanent-http-4xx",
    "redacted_endpoint",
    "mock webhook endpoint must be an explicit http loopback URL with a port",
    "mock webhook endpoint must not contain credentials",
    "mock webhook endpoint delivery requires explicit approval",
    "WebhookStagingPolicy",
    "WebhookStagingEnvelope",
    "synapse.notification.webhook.staging.v1",
    "x-synapse-idempotency-key",
    "preview-only-not-deliverable",
    "configured-secret-redacted",
    "staging-contract-external-delivery-disabled",
    "platform-signature-or-hmac-required-before-real-send",
    "bounded-retry-with-idempotency-key-and-backoff",
    "redact-webhook-url-token-and-response-before-audit",
    "safety.external_delivery_enabled",
    "send-real-webhook",
    "deliver-without-redaction",
    "network_started: false",
    "external_delivery_started\": false",
    "credentials_persisted\": false",
    "notification dry-run receipt requires explicit approval",
    "feishu_wechat_mock_receipt_contract_never_marks_external_delivery_started",
    "webhook_staging_policy_blocks_external_delivery_without_gate",
    "webhook_staging_envelope_redacts_destination_and_never_starts_network",
    "WebhookStagingPreflight",
    "preflight_webhook_staging",
    "WebhookProductionPreflight",
    "preflight_webhook_production",
    "official-feishu-wechat-https-only",
    "endpoint-not-allowed-for-production",
    "audit-event-required-before-send",
    "redacted-endpoint-and-response-required",
    "bounded-retry-with-idempotency-required",
    "webhook_production_preflight_scope_requires_official_https_provider_endpoint",
    "http-loopback-staging-only",
    "endpoint-not-loopback-staging",
    "signature-material-missing",
    "external-delivery-gate-disabled",
    "no-network-started-during-preflight",
    "webhook_staging_preflight_scope_requires_loopback_signature_and_gate",
    "deliver_webhook_staging",
    "post_staging_webhook_to_loopback",
    "loopback-staging-only",
    "x-synapse-staging-signature",
    "loopback_staging_delivery_started",
    "staging-webhook-receipt-recorded",
    "loopback_staging_webhook_posts_signed_headers_without_secret_persistence",
    "deliver_webhook_production",
    "ProductionWebhookDeliveryEvidence",
    "post_production_webhook",
    "build_production_webhook_payload",
    "feishu_webhook_sign",
    "redacted_provider_endpoint",
    "provider-native-redacted",
    "notification-production-webhook-receipt",
    "production-webhook-receipt-recorded",
    "production_webhook_delivery",
    "production_webhook_delivery_started",
    "external_delivery_started\": true",
    "idempotency_header_present",
    "begin_notification_delivery_attempt",
    "prepared-before-network",
    "prepare-webhook-production-delivery",
    "prepared-audited",
    "outcome-uncertain",
    "provider-accepted",
    "receipt-recorded",
    "delivery_attempt: Some(delivery_attempt)",
    "audit_event: Some(audit_event)",
    "reconcile_notification_delivery_attempt",
    "confirmed-not-delivered",
    "reconciled-not-delivered",
    "retry_allowed",
  ];
  const notificationDeliveryContract = `${notificationGateway}\n${notificationDeliveryAttemptStore}`;
  const missingNotificationPreviewItems = requiredNotificationPreviewItems.filter(
    (item) => !notificationDeliveryContract.includes(item),
  );
  if (missingNotificationPreviewItems.length === 0) {
    pass(
      "feishu-wechat-mock-only",
      "Feishu and WeChat keep guarded mock, staging, production preflight, and approved production webhook gates",
    );
  } else {
    fail(
      "feishu-wechat-mock-only",
      `Missing notification mock-only guard item(s): ${missingNotificationPreviewItems.join(" / ")}`,
      `Restore Feishu/WeChat mock-only guards before claiming the ${PUBLIC_BASELINE_NAME}.`,
    );
  }
}
if (tauriCommands) {
  const requiredNotificationAuditItems = [
    "preview-notification",
    "webhook_staging_policy",
    "webhook_staging_envelope",
    "payload_sha256",
    "endpoint_redaction",
    "admission_state",
    "external_delivery_started",
    "network_started",
    "preflight-webhook-staging",
    "preflight-webhook-production",
    "execute-webhook-staging",
    "execute-webhook-production",
    "loopback_staging_delivery_started",
    "production_webhook_delivery_started",
    "endpoint_allowed_for_staging",
    "endpoint_allowed_for_production",
    "audit_required",
    "redaction_required",
    "signature_material_present",
  ];
  const missingNotificationAuditItems = requiredNotificationAuditItems.filter(
    (item) => !tauriCommands.includes(item),
  );
  if (missingNotificationAuditItems.length === 0) {
    pass(
      "notification-staging-audit-evidence",
      "Notification preview audit records webhook staging policy and envelope evidence without external delivery",
    );
  } else {
    fail(
      "notification-staging-audit-evidence",
      `Missing notification staging audit item(s): ${missingNotificationAuditItems.join(" / ")}`,
      "Restore notification preview audit evidence before claiming production notification readiness.",
    );
  }
}
if (localAppBridge && localAppBridgeHook && localAppBridgePanel) {
  const requiredLocalAppGuardItems = [
    [localAppBridge, "allow_state: \"blocked\".to_string()"],
    [localAppBridge, "argument_preview: vec![app.executable.clone()]"],
    [localAppBridge, "Command::new(&preview.app.executable)"],
    [localAppBridge, "stdin(Stdio::null())"],
    [localAppBridge, "LocalAppLaunchPreflight"],
    [localAppBridge, "preflight_launch"],
    [localAppBridge, "local-app-launch-preflight-review-required"],
    [localAppBridge, "no-user-supplied-executable"],
    [localAppBridge, "no-user-supplied-arguments"],
    [localAppBridge, "no-credential-or-session-extraction"],
    [localAppBridge, "no-window-content-reading"],
    [localAppBridge, "audit-required-before-local-app-launch"],
    [localAppBridge, "terminate_after_persistence_failure"],
    [localAppBridge, "remove_task_artifacts"],
    [localAppBridge, "was terminated because persistence failed"],
    [localAppBridge, "pub audit_event: store::AuditEvent"],
    [localAppBridge, "LocalAppAllowStateReceipt"],
    [localAppBridge, "local-app-allow-state-review"],
    [localAppBridge, "compensate_allow_state_review"],
    [localAppBridge, "local_app_launch_preflight_never_starts_process_or_reads_session"],
    [localAppBridge, "local app launch requires explicit approval"],
    [localAppBridge, "\"credentials_read\": false"],
    [localAppBridge, "\"window_content_read\": false"],
    [localAppBridgeHook, "useLocalAppBridge"],
    [localAppBridgeHook, "get_local_apps"],
    [localAppBridgeHook, "set_local_app_allow_state"],
    [localAppBridgeHook, "preview_local_app_launch"],
    [localAppBridgeHook, "preflight_local_app_launch"],
    [localAppBridgeHook, "execute_local_app_launch"],
    [localAppBridgeHook, "refreshProductionOverview"],
    [localAppBridgePanel, 'data-testid="local-app-launch-preflight-result"'],
    [localAppBridgePanel, 'data-testid="local-app-launch-receipt"'],
    [localAppBridgePanel, 'data-testid="local-app-allow-state-receipt"'],
    [localAppBridgePanel, 'text("Audit event")'],
    [localAppBridgeHook, "window.confirm("],
    [localAppBridgeHook, "without arguments or session-data access"],
  ];
  const missingLocalAppGuardItems = requiredLocalAppGuardItems
    .filter(([content, item]) => !content.includes(item))
    .map(([, item]) => item);
  if (missingLocalAppGuardItems.length === 0) {
    pass("local-app-launch-guard", "Local App Bridge remains allowlisted, approval-gated, launch-only, session-blind, and terminates spawned processes when receipt persistence fails");
  } else {
    fail(
      "local-app-launch-guard",
      `Missing local app guard item(s): ${missingLocalAppGuardItems.join(" / ")}`,
      `Restore Local App Bridge launch-only guards before claiming the ${PUBLIC_BASELINE_NAME}.`,
    );
  }
}
if (browserAutomation && browserAutomationPanel && browserReadonlyScript) {
  const requiredBrowserGuardItems = [
    [browserAutomation, "exact-host-allowlist"],
    [browserAutomation, "http-get-navigation-only"],
    [browserAutomation, "no-click-or-form-submit"],
    [browserAutomation, "no-upload-or-download"],
    [browserAutomation, "no-credentials"],
    [browserAutomation, "redirect-host-revalidation"],
    [browserAutomation, "output-quarantine"],
    [browserAutomation, "browser inspection requires explicit approval"],
    [browserAutomation, "BrowserActionPolicy"],
    [browserAutomation, "read-only-default-write-blocked"],
    [browserAutomation, "write_actions_allowed: Vec::new()"],
    [browserAutomation, "approval_required_for_write: true"],
    [browserAutomation, "strip-source-instructions-and-revalidate-action-intent"],
    [browserAutomation, "record-preview-decision-and-quarantine-output-before-admission"],
    [browserAutomation, "write-actions-require-domain-specific-rollback-or-manual-recovery-plan"],
    [browserAutomation, "browser_action_policy_blocks_write_actions_by_default"],
    [browserAutomation, "BrowserWriteActionStagingPreflight"],
    [browserAutomation, "preflight_write_action_staging"],
    [browserAutomation, "browser-write-staging-blocked-by-default"],
    [browserAutomation, "web_mutation_started: false"],
    [browserAutomation, "task_content_sent: false"],
    [browserAutomation, "rollback-contract-required"],
    [browserAutomation, "browser_write_staging_preflight_never_starts_process_or_web_mutation"],
    [browserAutomation, "process_started: false"],
    [browserAutomationPanel, 'data-testid="browser-action-policy"'],
    [browserAutomationPanel, 'data-testid="browser-write-staging-preflight-button"'],
    [browserAutomationPanel, 'data-testid="browser-write-staging-preflight-result"'],
    [browserReadonlyScript, "accept_downloads=False"],
    [browserReadonlyScript, "service_workers=\"block\""],
    [browserReadonlyScript, "route.abort()"],
    [browserReadonlyScript, "redirected host is not allowlisted"],
  ];
  const missingBrowserGuardItems = requiredBrowserGuardItems
    .filter(([content, item]) => !content.includes(item))
    .map(([, item]) => item);
  if (missingBrowserGuardItems.length === 0) {
    pass("browser-readonly-guard", "Browser automation remains allowlisted, read-only by default, write-staging blocked, no-download, and quarantine-gated");
  } else {
    fail(
      "browser-readonly-guard",
      `Missing browser read-only guard item(s): ${missingBrowserGuardItems.join(" / ")}`,
      `Restore browser read-only and allowlist guards before claiming the ${PUBLIC_BASELINE_NAME}.`,
    );
  }
}
if (webAppShell && webAppShellPanel) {
  const requiredWebAppShellItems = [
    [webAppShell, "manual-shell-preview-only"],
    [webAppShell, "isolated-profile-per-web-app"],
    [webAppShell, "manual-login-only"],
    [webAppShell, "manual-copy-paste-only"],
    [webAppShell, "no-browser-write-automation"],
    [webAppShell, "no-auto-submit-send-publish-or-trade"],
    [webAppShell, "no-sensitive-page-content-read"],
    [webAppShell, "no-cookie-token-or-session-export"],
    [webAppShell, "process-start-not-implemented"],
    [webAppShell, "process_started: false"],
    [webAppShellPanel, "process started:"],
    [webAppShellPanel, "Denied:"],
  ];
  const missingWebAppShellItems = requiredWebAppShellItems
    .filter(([content, item]) => !content.includes(item))
    .map(([, item]) => item);
  if (missingWebAppShellItems.length === 0) {
    pass("web-app-shell-preview-guard", "Web App Shell remains manual, isolated, preview-only, and non-automating");
  } else {
    fail(
      "web-app-shell-preview-guard",
      `Missing Web App Shell guard item(s): ${missingWebAppShellItems.join(" / ")}`,
      `Restore Web App Shell preview-only boundaries before claiming ${INTERNAL_DESIGN_ALIGNMENT}.`,
    );
  }
}
if (codebaseMemory && codebaseMemoryPanel) {
  const requiredCodebaseMemoryItems = [
    [codebaseMemory, "readonly-structural-preview"],
    [codebaseMemory, "CodebaseMemoryAdmissionPreflight"],
    [codebaseMemory, "codebase-memory-admission-review-required"],
    [codebaseMemory, "codegraph-mcp-preview"],
    [codebaseMemory, "no-repository-wide-scan"],
    [codebaseMemory, "no-file-content-ingest"],
    [codebaseMemory, "no-command-execution"],
    [codebaseMemory, "no-automatic-l2-write"],
    [codebaseMemory, "review-before-zhishu-admission"],
    [codebaseMemory, "human-summary-review-before-l2-write"],
    [codebaseMemory, "source-scope-review-before-admission"],
    [codebaseMemory, "zhishu-admission-not-approved"],
    [codebaseMemory, "operator-approval-before-index-rebuild"],
    [codebaseMemory, "process_started: false"],
    [codebaseMemory, "repository_scanned: false"],
    [codebaseMemory, "file_content_ingested: false"],
    [codebaseMemory, "l2_write_started: false"],
    [codebaseMemory, "admission_preflight_never_scans_ingests_or_writes_l2"],
    [codebaseMemoryPanel, 'data-testid="codebase-memory-admission-preflight-result"'],
    [codebaseMemoryPanel, "process started:"],
    [codebaseMemoryPanel, "Denied:"],
  ];
  const missingCodebaseMemoryItems = requiredCodebaseMemoryItems
    .filter(([content, item]) => !content.includes(item))
    .map(([, item]) => item);
  if (missingCodebaseMemoryItems.length === 0) {
    pass("codebase-memory-readonly-guard", "Codebase Memory adapter remains structural, read-only, no-scan, no-ingest, and review-gated");
  } else {
    fail(
      "codebase-memory-readonly-guard",
      `Missing Codebase Memory guard item(s): ${missingCodebaseMemoryItems.join(" / ")}`,
      `Restore Codebase Memory read-only structural boundaries before claiming ${INTERNAL_DESIGN_ALIGNMENT}.`,
    );
  }
}
if (permissionMemory && permissionMemoryPanel) {
  const requiredPermissionMemoryItems = [
    [permissionMemory, "candidate-preview-only"],
    [permissionMemory, "PermissionReusePreflight"],
    [permissionMemory, "permission-reuse-review-required"],
    [permissionMemory, "not-a-permanent-whitelist"],
    [permissionMemory, "scope-tool-level-pattern-required"],
    [permissionMemory, "same-scope-required-before-permission-reuse"],
    [permissionMemory, "same-tool-scope-required-before-permission-reuse"],
    [permissionMemory, "expiry-check-required-before-permission-reuse"],
    [permissionMemory, "expiry-and-revocation-required"],
    [permissionMemory, "audit-reference-required"],
    [permissionMemory, "high-risk-never-auto-reuse"],
    [permissionMemory, "no-policy-engine-auto-grant"],
    [permissionMemory, "auto_grant_started: false"],
    [permissionMemory, "permission_reused: false"],
    [permissionMemory, "durable_policy_write_started: false"],
    [permissionMemory, "cross-project"],
    [permissionMemory, "delete-move-cleanup"],
    [permissionMemory, "account-or-session-action"],
    [permissionMemory, "publish-or-submit"],
    [permissionMemory, "trade-or-financial-action"],
    [permissionMemory, "durable-zhishu-write"],
    [permissionMemory, "auto-grant-permission"],
    [permissionMemory, "auto_grants_permissions: false"],
    [permissionMemory, "permission_reuse_preflight_never_auto_grants_or_writes_policy"],
    [permissionMemoryPanel, 'data-testid="permission-reuse-preflight-result"'],
    [permissionMemoryPanel, "auto grants permissions:"],
    [permissionMemoryPanel, "Never auto-reuse:"],
  ];
  const missingPermissionMemoryItems = requiredPermissionMemoryItems
    .filter(([content, item]) => !content.includes(item))
    .map(([, item]) => item);
  if (missingPermissionMemoryItems.length === 0) {
    pass("permission-memory-preview-guard", "Permission Memory remains candidate-only, expiring, revocable, audited, and never auto-grants high-risk actions");
  } else {
    fail(
      "permission-memory-preview-guard",
      `Missing Permission Memory guard item(s): ${missingPermissionMemoryItems.join(" / ")}`,
      `Restore Permission Memory candidate-only boundaries before claiming ${INTERNAL_DESIGN_ALIGNMENT}.`,
    );
  }
}
if (skillLibrary && skillLibraryPanel) {
  const requiredSkillLibraryItems = [
    [skillLibrary, "guarded-skill-library-preview"],
    [skillLibrary, "SkillManifest"],
    [skillLibrary, "SkillExecutionContract"],
    [skillLibrary, "SkillScriptExecutionPreflight"],
    [skillLibrary, "script-execution-blocked-by-default"],
    [skillLibrary, "versioned-skill-manifest-required"],
    [skillLibrary, "taiheng-approval-before-process-start"],
    [skillLibrary, "test-receipt-before-reuse"],
    [skillLibrary, "quarantine-output-before-zhishu-review"],
    [skillLibrary, "rollback-plan-required-before-script-execution"],
    [skillLibrary, "least-privilege-sandbox-required"],
    [skillLibrary, "zhishu-admission-review-required"],
    [skillLibrary, "process_started: false"],
    [skillLibrary, "script_content_read: false"],
    [skillLibrary, "durable_zhishu_write: false"],
    [skillLibrary, "filesystem_mutation_started: false"],
    [skillLibrary, "network_call_started: false"],
    [skillLibrary, "script-execution-gate-disabled"],
    [skillLibrary, "script_execution_enabled"],
    [skillLibrary, "SYSTEM_INVENTORY_SHA256"],
    [skillLibrary, "d18be7479b9514e4959251d06101694dbf9aefe0b8f15568847d00d003ac95c2"],
    [skillLibrary, "execute_script"],
    [skillLibrary, "run_system_inventory_script"],
    [skillLibrary, "include_str!"],
    [skillLibrary, "encoded_system_inventory_script"],
    [skillLibrary, '"-EncodedCommand"'],
    [skillLibrary, "skill-script-output-quarantined"],
    [skillLibrary, '"skill-script-execution"'],
    [skillLibrary, "built_in_system_inventory_script_executes_readonly_and_returns_json"],
    [skillLibrary, "run-unreviewed-script"],
    [skillLibrary, "read-script-content"],
    [skillLibrary, "write-l2-without-review"],
    [skillLibrary, "skill_library_preview_never_executes_or_writes_memory"],
    [skillLibrary, "script_execution_preflight_blocks_process_and_memory_writes"],
    [skillLibraryPanel, 'data-testid="skill-library-preview-result"'],
    [skillLibraryPanel, 'data-testid="skill-script-execution-preflight-result"'],
    [skillLibraryPanel, 'data-testid="skill-script-execution-button"'],
    [skillLibraryPanel, 'data-testid="skill-script-execution-receipt"'],
    [safeSystemInventoryScript, 'schema = "synapse.skill.safe-system-inventory.v1"'],
    [safeSystemInventoryScript, "mutation_started = $false"],
    [safeSystemInventoryScript, "network_started = $false"],
    [skillLibraryPanel, "script content read"],
    [skillLibraryPanel, "durable Zhishu write"],
  ];
  const missingSkillLibraryItems = requiredSkillLibraryItems
    .filter(([content, item]) => !content.includes(item))
    .map(([, item]) => item);
  if (missingSkillLibraryItems.length === 0) {
    pass("skill-library-guarded-execution", "Skill Library has a default-off, hash-locked, Task-Run-gated read-only script executor with quarantine and transaction receipts");
  } else {
    fail(
      "skill-library-guarded-execution",
      `Missing Skill Library guard item(s): ${missingSkillLibraryItems.join(" / ")}`,
      "Restore Skill Library hash, approval, default-off execution, quarantine, and Zhishu admission guards.",
    );
  }
}
if (systemService) {
  const requiredSystemCapabilityItems = [
    "codebase-memory",
    "permission-memory",
    "CodeGraph-backed project structure",
    "Reusable approval candidates",
    "preview-only",
    "without command execution",
    "never auto-grant",
    "automatic L2 writes",
    "experience-reuse",
    "Matched success and avoidance records",
    "source-registry",
    "Baigong/Taiheng source registration metadata",
  ];
  const missingSystemCapabilityItems = requiredSystemCapabilityItems.filter(
    (item) => !systemService.includes(item),
  );
  if (missingSystemCapabilityItems.length === 0) {
    pass("system-capability-map-guard", "Runtime capability map surfaces Codebase Memory and experience reuse as guarded previews");
  } else {
    fail(
      "system-capability-map-guard",
      `Missing system capability map item(s): ${missingSystemCapabilityItems.join(" / ")}`,
      `Restore guarded runtime capability visibility before claiming the ${PUBLIC_BASELINE_NAME}.`,
    );
  }
}
if (sourceRegistry && sourceRegistryPanel && appShell && sourceRegistryHook) {
  const requiredSourceRegistryItems = [
    "SourceRegistryPreview",
    "SourceRegistryEntry",
    "SourceEnablementPreflight",
    "SourceEnablementReviewReceipt",
    "preflight_enable_source",
    "review_enable_source",
    "source-registry-approval",
    "finalize_enablement_review",
    "compensate_enablement_review",
    "lightweight-registration-only",
    "no-heavy-data-processing",
    "credential-guard-required-before-auth",
    "source-enablement-review-required",
    "network_started: false",
    "credential_read_started: false",
    "fetch_started: false",
    "storage_write_started: false",
    "source_enablement_preflight_never_fetches_or_reads_credentials",
    "enablement_review_compensates_audit_failure_after_approval_write",
    "store-credentials-in-registry",
    "background-heavy-polling",
    "auto-fetch-live-data",
    "enabled: false",
    "verification_policy",
    "quarantine_policy",
    "registry_entries_have_required_contract_policies",
  ];
  const missingSourceRegistryItems = requiredSourceRegistryItems.filter(
    (item) => !sourceRegistry.includes(item),
  );
  const requiredSourceRegistryPanelItems = [
    "Data Source Registry",
    "denied_actions",
    "entry.enabled",
    "entry.auth_required",
    "entry.verification_policy",
    "entry.quarantine_policy",
    "source-enablement-preflight-button",
    "source-enablement-preflight-result",
    "source-enablement-review-button",
    "source-enablement-review-confirmation",
    "source-enablement-review-receipt",
    "enablementPreflight",
    "reviewReceipt",
  ];
  const missingSourceRegistryPanelItems = requiredSourceRegistryPanelItems.filter(
    (item) => !sourceRegistryPanel.includes(item),
  );
  const requiredSourceRegistryAppItems = [
    "SourceRegistryPanel",
    "sourceRegistryPreview",
    "sourceEnablementPreflight",
    "sourceEnablementReviewReceipt",
  ];
  const missingSourceRegistryAppItems = requiredSourceRegistryAppItems.filter(
    (item) => !appShell.includes(item),
  );
  const requiredSourceRegistryHookItems = [
    "preview_source_registry",
    "preflight_source_enablement",
    "review_source_enablement",
    "sourceRegistryPreview",
    "sourceEnablementPreflight",
    "setIsPreflightingSourceEnablement",
    "setIsLoadingSourceRegistry",
  ];
  const missingSourceRegistryHookItems = requiredSourceRegistryHookItems.filter(
    (item) => !sourceRegistryHook.includes(item),
  );
  const missingSourceRegistryAll = [
    ...missingSourceRegistryItems,
    ...missingSourceRegistryPanelItems,
    ...missingSourceRegistryAppItems,
    ...missingSourceRegistryHookItems,
  ];
  if (missingSourceRegistryAll.length === 0) {
    pass("source-registry-preview-only", "Data Source Registry keeps manual approval transactional and live retrieval guarded");
  } else {
    fail(
      "source-registry-preview-only",
      `Missing source registry guard item(s): ${missingSourceRegistryAll.join(" / ")}`,
      `Restore Data Source Registry guardrails before claiming the ${PUBLIC_BASELINE_NAME}.`,
    );
  }
}
if (httpSource) {
  const requiredHttpSourceItems = [
    "redirect(Policy::none())",
    ".get(url.clone())",
    "Accept\", \"application/json",
    "MAX_HTTP_RESPONSE_BYTES",
    "Configured source URL cannot contain credentials",
    "Configured source URL must use HTTPS",
    "quarantine-before-use",
    "review-before-zhishu-admission",
    "validate_evidence_contract",
    "cross-check-insufficient",
    "durable_write_allowed",
    "ProviderAdapterExecutionReceipt",
    "ProviderReceiptAdmissionPreflight",
    "ProviderReceiptAdmissionQueuePreview",
    "loopback_provider_fixture_receipt",
    "preflight_provider_receipt_admission",
    "preview_provider_receipt_admission_queue",
    "provider_adapter_receipt",
    "source_sha256",
    "task_artifact_write_started: false",
    "durable_zhishu_write_started: false",
    "provider-adapter-receipt-required",
    "source-sha256-recorded",
    "provider-receipt-admission-review-required",
    "provider-receipt-review-queue-preview",
    "write-provider-receipt-to-l2-without-review",
    "persist-provider-review-queue-without-store-transaction",
    "audit-record-before-admission",
    "quarantine-record-before-use",
    "json-content-type",
    "no-redirects",
  ];
  const missingHttpSourceItems = requiredHttpSourceItems.filter((item) => !httpSource.includes(item));
  if (missingHttpSourceItems.length === 0) {
    pass("http-source-quarantine-guard", "HTTP source adapter remains configured-only, JSON-only, no-redirect, credential-free, and quarantined");
  } else {
    fail(
      "http-source-quarantine-guard",
      `Missing HTTP source guard item(s): ${missingHttpSourceItems.join(" / ")}`,
      `Restore HTTP source quarantine and retrieval guards before claiming the ${PUBLIC_BASELINE_NAME}.`,
    );
  }
}
if (capabilityPreviewPanel) {
  const requiredProviderReceiptUiItems = [
    'data-testid="provider-adapter-loopback-receipt-button"',
    'data-testid="provider-adapter-loopback-receipt"',
    'data-testid="provider-receipt-admission-preflight-button"',
    'data-testid="provider-receipt-admission-preflight-result"',
    'data-testid="provider-receipt-review-queue-button"',
    'data-testid="provider-receipt-review-queue-result"',
    'data-testid="provider-receipt-stage-review-candidate-button"',
    'data-testid="provider-receipt-stage-review-candidate-result"',
    'data-testid="provider-receipt-review-candidates"',
    'data-testid="provider-receipt-review-decision-result"',
    "provider-receipt-review-approve-",
    "provider-task-artifact-preflight-",
    'data-testid="provider-task-artifact-preflight-result"',
    "provider-task-artifact-stage-",
    'data-testid="provider-task-artifact-stage-result"',
    'data-testid="provider-artifact-zhishu-preflight-button"',
    'data-testid="provider-artifact-zhishu-preflight-result"',
    'data-testid="provider-artifact-zhishu-review-approve-button"',
    'data-testid="provider-artifact-zhishu-review-result"',
    'data-testid="provider-artifact-zhishu-candidate-create-button"',
    'data-testid="provider-artifact-zhishu-candidate-result"',
    "Provider receipt",
    "Provider admission preflight",
    "Provider review queue preview",
    "Provider review candidate staged",
    "Provider review decision",
    "Provider task artifact preflight",
    "Provider task artifact staged",
    "Provider artifact Zhishu admission preflight",
    "Provider artifact Zhishu admission review",
    "Provider artifact Zhishu candidate receipt",
    "summary candidate created",
    "task artifact write started",
    "source_sha256",
    "audit recorded",
    "quarantine recorded",
    "credential read",
  ];
  const missingProviderReceiptUiItems = requiredProviderReceiptUiItems.filter(
    (item) => !capabilityPreviewPanel.includes(item),
  );
  if (missingProviderReceiptUiItems.length === 0) {
    pass("provider-adapter-receipt-ui", "Provider adapter loopback receipt is visible in the UI");
  } else {
    fail(
      "provider-adapter-receipt-ui",
      `Missing provider adapter receipt UI item(s): ${missingProviderReceiptUiItems.join(" / ")}`,
      "Restore provider adapter receipt UI before claiming provider adapter readiness.",
    );
  }
}
if (providerArtifactAdmissionHook) {
  const requiredProviderArtifactAdmissionHookItems = [
    "useProviderArtifactAdmission",
    "preview_provider_adapter_loopback_receipt",
    "preflight_provider_receipt_admission",
    "preview_provider_receipt_admission_queue",
    "stage_provider_receipt_review_candidate",
    "review_provider_receipt_review_candidate",
    "preflight_provider_receipt_task_artifact",
    "create_provider_receipt_task_artifact",
    "preflight_provider_artifact_zhishu_admission",
    "review_provider_artifact_zhishu_admission",
    "create_provider_artifact_zhishu_candidate",
    "upsertMemoryItem",
  ];
  const missingProviderArtifactAdmissionHookItems =
    requiredProviderArtifactAdmissionHookItems.filter((item) => !providerArtifactAdmissionHook.includes(item));
  if (missingProviderArtifactAdmissionHookItems.length === 0) {
    pass(
      "provider-artifact-admission-hook-guard",
      "Provider artifact admission state and invoke flow stay isolated from the App shell",
    );
  } else {
    fail(
      "provider-artifact-admission-hook-guard",
      `Missing provider artifact admission hook item(s): ${missingProviderArtifactAdmissionHookItems.join(" / ")}`,
      "Restore src/app/useProviderArtifactAdmission.ts before expanding Provider artifact admission flows.",
    );
  }
}
if (quantLabHook) {
  const requiredQuantLabHookItems = [
    "useQuantLab",
    "preview_quant_research",
    "archive_quant_research",
    "loadTaskRunRecords",
    "loadTaskArtifacts",
    "refreshProductionOverview",
    "Quant research completed",
    "Quant research archival was blocked or failed.",
  ];
  const missingQuantLabHookItems = requiredQuantLabHookItems.filter(
    (item) => !quantLabHook.includes(item),
  );
  if (missingQuantLabHookItems.length === 0) {
    pass(
      "quant-lab-hook-guard",
      "Quant Lab research and archive flows stay isolated from the App shell",
    );
  } else {
    fail(
      "quant-lab-hook-guard",
      `Missing Quant Lab hook item(s): ${missingQuantLabHookItems.join(" / ")}`,
      "Restore src/app/useQuantLab.ts before expanding A-share strategy research flows.",
    );
  }
}
if (sourceAggregationHook) {
  const requiredSourceAggregationHookItems = [
    "useSourceAggregation",
    "get_source_observation_history",
    "get_source_health_report",
    "import_source_observations",
    "fetch_configured_http_source",
    "preview_information_aggregation",
    "setAggregationPreview",
    "setSourceHealthReport",
    "setHttpSourceReceipt",
  ];
  const missingSourceAggregationHookItems = requiredSourceAggregationHookItems.filter(
    (item) => !sourceAggregationHook.includes(item),
  );
  if (missingSourceAggregationHookItems.length === 0) {
    pass(
      "source-aggregation-hook-guard",
      "Source aggregation state and invoke flow stay isolated from the App shell",
    );
  } else {
    fail(
      "source-aggregation-hook-guard",
      `Missing source aggregation hook item(s): ${missingSourceAggregationHookItems.join(" / ")}`,
      "Restore src/app/useSourceAggregation.ts before expanding source aggregation flows.",
    );
  }
}
if (synapseCorePreviewsHook) {
  const requiredSynapseCorePreviewsHookItems = [
    "useSynapseCorePreviews",
    "get_recent_memory_items",
    "preview_executor_contract",
    "preview_synthesis",
    "promote_synthesis_candidate",
    "upsertMemoryItem",
    "refreshProductionOverview",
    "setIsLoadingExecutorContract",
    "setIsLoadingSynthesis",
    "setPromotingSynthesisCandidateId",
  ];
  const missingSynapseCorePreviewsHookItems = requiredSynapseCorePreviewsHookItems.filter(
    (item) => !synapseCorePreviewsHook.includes(item),
  );
  if (missingSynapseCorePreviewsHookItems.length === 0) {
    pass(
      "synapse-core-previews-hook-guard",
      "Memory, executor contract, synthesis preview, and promotion flows stay isolated from the App shell",
    );
  } else {
    fail(
      "synapse-core-previews-hook-guard",
      `Missing Synapse Core Previews hook item(s): ${missingSynapseCorePreviewsHookItems.join(" / ")}`,
      "Restore src/app/useSynapseCorePreviews.ts before expanding core memory and synthesis flows.",
    );
  }
}
if (taihengProtectedSnapshotsHook) {
  const requiredTaihengProtectedSnapshotsHookItems = [
    "useTaihengProtectedSnapshots",
    "useProtectedSnapshotRollback",
    "get_object_snapshots",
    "rollback_protected_snapshot",
    "window.confirm(",
    "loadTaskDirections",
    "loadTaskSchedulePreviews",
    "loadExecutorContractPreview",
    "loadArsenalPreview",
    "loadAuditEvents",
    "refreshProductionOverview",
    "setRollingBackProtectedSnapshotId",
  ];
  const missingTaihengProtectedSnapshotsHookItems =
    requiredTaihengProtectedSnapshotsHookItems.filter(
      (item) => !taihengProtectedSnapshotsHook.includes(item),
    );
  if (missingTaihengProtectedSnapshotsHookItems.length === 0) {
    pass(
      "taiheng-protected-snapshots-hook-guard",
      "Taiheng protected snapshot loading and rollback flows stay isolated from the App shell",
    );
  } else {
    fail(
      "taiheng-protected-snapshots-hook-guard",
      `Missing Taiheng protected snapshots hook item(s): ${missingTaihengProtectedSnapshotsHookItems.join(" / ")}`,
      "Restore src/app/useTaihengProtectedSnapshots.ts before expanding Taiheng recovery flows.",
    );
  }
}
if (taihengRuntimeHook) {
  const requiredTaihengRuntimeHookItems = [
    "useTaihengRuntime",
    "get_system_status",
    "get_audit_events",
    "get_object_snapshots",
    'objectType: "zhishu-item"',
    "loadSystemStatus",
    "loadAuditEvents",
    "loadZhishuSnapshots",
    "refreshSecurityCenter",
    "setIsRefreshingSecurityCenter",
  ];
  const missingTaihengRuntimeHookItems = requiredTaihengRuntimeHookItems.filter(
    (item) => !taihengRuntimeHook.includes(item),
  );
  if (missingTaihengRuntimeHookItems.length === 0) {
    pass(
      "taiheng-runtime-hook-guard",
      "Taiheng runtime status, audit, and Zhishu snapshot flows stay isolated from the App shell",
    );
  } else {
    fail(
      "taiheng-runtime-hook-guard",
      `Missing Taiheng Runtime hook item(s): ${missingTaihengRuntimeHookItems.join(" / ")}`,
      "Restore src/app/useTaihengRuntime.ts before expanding Taiheng security-center flows.",
    );
  }
}
if (xingtaiTaskLoopHook) {
  const requiredXingtaiTaskLoopHookItems = [
    "useXingtaiTaskLoop",
    "save_task_direction",
    "generate_task_candidates",
    "set_task_direction_active",
    "request_task_run",
    "review_task_run",
    "task_scheduler_tick",
    "execute_task_run",
    "cancel_task_run",
    "archive_task_run",
    "promote_task_artifact_to_zhishu",
    "review_task_candidate",
    "refreshProductionOverview",
    "loadExecutorContractPreview",
    "loadSynthesisPreview",
  ];
  const missingXingtaiTaskLoopHookItems = requiredXingtaiTaskLoopHookItems.filter(
    (item) => !xingtaiTaskLoopHook.includes(item),
  );
  if (missingXingtaiTaskLoopHookItems.length === 0) {
    pass(
      "xingtai-task-loop-hook-guard",
      "Xingtai task direction, run, artifact, and candidate flows stay isolated from the App shell",
    );
  } else {
    fail(
      "xingtai-task-loop-hook-guard",
      `Missing Xingtai task loop hook item(s): ${missingXingtaiTaskLoopHookItems.join(" / ")}`,
      "Restore src/app/useXingtaiTaskLoop.ts before expanding task-loop production flows.",
    );
  }
}
if (zhishuKnowledgeHook) {
  const requiredZhishuKnowledgeHookItems = [
    "useZhishuKnowledge",
    "capture_zhishu_item",
    "search_zhishu",
    "generate_zhishu_relations",
    "review_zhishu_relation",
    "scan_zhishu_maintenance",
    "review_zhishu_maintenance_finding",
    "export_zhishu_repository",
    "import_zhishu_repository",
    "loadSynthesisPreview",
    "refreshProductionOverview",
    "window.confirm(",
  ];
  const missingZhishuKnowledgeHookItems = requiredZhishuKnowledgeHookItems.filter(
    (item) => !zhishuKnowledgeHook.includes(item),
  );
  if (missingZhishuKnowledgeHookItems.length === 0) {
    pass(
      "zhishu-knowledge-hook-guard",
      "Zhishu capture, retrieval, relation, maintenance, and repository flows stay isolated from the App shell",
    );
  } else {
    fail(
      "zhishu-knowledge-hook-guard",
      `Missing Zhishu knowledge hook item(s): ${missingZhishuKnowledgeHookItems.join(" / ")}`,
      "Restore src/app/useZhishuKnowledge.ts before expanding Zhishu production flows.",
    );
  }
}
if (zhishuAdmissionReviewHook) {
  const requiredZhishuAdmissionReviewHookItems = [
    "useZhishuAdmissionReview",
    "review_memory_item",
    "rollback_zhishu_snapshot",
    "review_provider_artifact_zhishu_candidate",
    "provider-artifact-review",
    "loadTaskCandidates",
    "loadZhishuSnapshots",
    "refreshProductionOverview",
    "setProviderArtifactZhishuFinalReviewReceipt",
  ];
  const missingZhishuAdmissionReviewHookItems = requiredZhishuAdmissionReviewHookItems.filter(
    (item) => !zhishuAdmissionReviewHook.includes(item),
  );
  if (missingZhishuAdmissionReviewHookItems.length === 0) {
    pass(
      "zhishu-admission-review-hook-guard",
      "Zhishu memory review, Provider final review, and rollback flows stay isolated from the App shell",
    );
  } else {
    fail(
      "zhishu-admission-review-hook-guard",
      `Missing Zhishu admission review hook item(s): ${missingZhishuAdmissionReviewHookItems.join(" / ")}`,
      "Restore src/app/useZhishuAdmissionReview.ts before expanding Zhishu admission and rollback flows.",
    );
  }
}
if (zhishuCaptureStreamsHook) {
  const requiredZhishuCaptureStreamsHookItems = [
    "useZhishuCaptureStreams",
    "capture_inspiration",
    "capture_experience",
    "parseTags",
    "loadMemory",
    "loadSynthesisPreview",
    "refreshProductionOverview",
    "Capture a fragment first",
    "Record the experience first",
    "setExperienceType(\"success\")",
  ];
  const missingZhishuCaptureStreamsHookItems = requiredZhishuCaptureStreamsHookItems.filter(
    (item) => !zhishuCaptureStreamsHook.includes(item),
  );
  if (missingZhishuCaptureStreamsHookItems.length === 0) {
    pass(
      "zhishu-capture-streams-hook-guard",
      "Zhishu inspiration and experience capture flows stay isolated from the App shell",
    );
  } else {
    fail(
      "zhishu-capture-streams-hook-guard",
      `Missing Zhishu capture streams hook item(s): ${missingZhishuCaptureStreamsHookItems.join(" / ")}`,
      "Restore src/app/useZhishuCaptureStreams.ts before expanding inspiration and experience admission flows.",
    );
  }
}
if (appShell) {
  const requiredProviderFinalReviewUiItems = [
    [appShell, 'data-testid="provider-artifact-zhishu-final-review-result"'],
    [appShell, "Provider artifact Zhishu final review"],
    [appShell, "providerArtifactZhishuFinalReviewReceipt"],
    [zhishuAdmissionReviewHook, "review_provider_artifact_zhishu_candidate"],
  ];
  const missingProviderFinalReviewUiItems = requiredProviderFinalReviewUiItems
    .filter(([content, item]) => !content?.includes(item))
    .map(([, item]) => item);
  if (missingProviderFinalReviewUiItems.length === 0) {
    pass(
      "provider-artifact-final-review-ui",
      "Provider artifact Zhishu candidate final review receipt is visible in the Zhishu UI",
    );
  } else {
    fail(
      "provider-artifact-final-review-ui",
      `Missing provider artifact final review UI item(s): ${missingProviderFinalReviewUiItems.join(" / ")}`,
      "Restore the Provider artifact final review receipt before claiming Provider evidence admission readiness.",
    );
  }
}
if (providerReceiptStore) {
  const requiredProviderReceiptStoreItems = [
    "ProviderReceiptReviewCandidate",
    "ProviderReceiptReviewQueueReceipt",
    "ProviderReceiptReviewDecisionReceipt",
    "ProviderReceiptTaskArtifactPreflight",
    "ProviderReceiptTaskArtifactReceipt",
    "ProviderArtifactZhishuAdmissionPreflight",
    "stage_provider_receipt_review_candidate",
    "review_provider_receipt_review_candidate",
    "preflight_provider_receipt_task_artifact",
    "create_provider_receipt_task_artifact",
    "preflight_provider_artifact_zhishu_admission",
    "provider_receipt_review_candidates",
    "provider-receipt-review-candidate-staged",
    "provider-receipt-review-decision-recorded",
    "pending-human-review",
    "approved-for-task-artifact-review",
    "provider-task-artifact-preflight-ready-for-review",
    "provider-task-artifact-preflight-blocked",
    "provider-task-artifact-staged",
    "provider-artifact-zhishu-admission-review-required",
    "provider-artifact-zhishu-admission-reviewed",
    "provider-artifact-zhishu-candidate-created",
    "provider-artifact-zhishu-candidate-accepted",
    "approved-for-zhishu-candidate",
    "review_provider_artifact_zhishu_admission",
    "create_provider_artifact_zhishu_candidate",
    "review_provider_artifact_zhishu_candidate",
    "create-provider-artifact-zhishu-candidate",
    "append_provider_artifact_zhishu_candidate_at",
    "review_memory_item_with_protection_at",
    "create-provider-receipt-task-artifact",
    "create_snapshot_at",
    "append_audit_event_at",
    "begin_saga",
    "transition_saga",
    "task_artifact_write_started: false",
    "durable_zhishu_write_started: false",
    "no-automatic-task-artifact-write",
    "auto-promote-provider-candidate-to-zhishu",
    "write-task-artifact-from-provider-preflight",
    "isolated-task-artifact-created",
    "artifact-review-required-before-zhishu",
    "auto-promote-provider-artifact-to-zhishu",
    "write-provider-artifact-to-l2-from-preflight",
    "auto-confirm-provider-artifact-knowledge",
    "confirmed_knowledge_write_started: false",
    "no-automatic-provider-knowledge-confirmation",
    "bypass-provider-candidate-final-review",
  ];
  const missingProviderReceiptStoreItems = requiredProviderReceiptStoreItems.filter(
    (item) => !providerReceiptStore.includes(item),
  );
  if (missingProviderReceiptStoreItems.length === 0) {
    pass(
      "provider-receipt-review-store-guard",
      "Provider receipt review candidates are staged with snapshot, audit, saga, and no task/L2 write",
    );
  } else {
    fail(
      "provider-receipt-review-store-guard",
      `Missing provider receipt review store item(s): ${missingProviderReceiptStoreItems.join(" / ")}`,
      `Restore provider receipt review candidate staging guards before claiming the ${PUBLIC_BASELINE_NAME}.`,
    );
  }
}
if (taskCenterService) {
  const requiredProviderArtifactPromotionGuardItems = [
    "requires_provider_artifact_admission_flow",
    "provider-receipt-evidence",
    "provider_artifact_admission_required",
    "Provider-governed evidence requires provider artifact Zhishu admission preflight before promotion.",
  ];
  const missingProviderArtifactPromotionGuardItems =
    requiredProviderArtifactPromotionGuardItems.filter((item) => !taskCenterService.includes(item));
  if (missingProviderArtifactPromotionGuardItems.length === 0) {
    pass(
      "provider-artifact-promotion-bypass-guard",
      "Provider-governed evidence cannot use the generic artifact-to-Zhishu promotion path",
    );
  } else {
    fail(
      "provider-artifact-promotion-bypass-guard",
      `Missing provider artifact promotion guard item(s): ${missingProviderArtifactPromotionGuardItems.join(" / ")}`,
      "Restore the Provider artifact admission guard before enabling provider evidence promotion.",
    );
  }
}
if (deviceSync && deviceSyncHook && deviceSyncPanel) {
  const requiredDeviceSyncItems = [
    [deviceSync, "sha256-content-integrity"],
    [deviceSync, "base-hash-conflict-detection"],
    [deviceSync, "explicit-replace-for-nonempty-initial-import"],
    [deviceSync, "DeviceSyncImportApplyPreflight"],
    [deviceSync, "preflight_import_apply"],
    [deviceSync, "device-sync-import-apply-review-required"],
    [deviceSync, "device-sync-import-apply-blocked"],
    [deviceSync, "rollback-snapshot-before-import"],
    [deviceSync, "device-sync-import"],
    [deviceSync, "compensate_import"],
    [deviceSync, "before-device-sync-import"],
    [deviceSync, "audit-required-before-device-sync-import"],
    [deviceSync, "local-device-remains-source-of-truth"],
    [deviceSync, "import_apply_preflight_never_writes_and_blocks_replace_without_approval"],
    [deviceSync, "import_started: false"],
    [deviceSync, "durable_write_started: false"],
    [deviceSync, "cloud_source_of_truth: false"],
    [deviceSync, "no-automatic-merge"],
    [deviceSync, "no-credentials-or-environment-data"],
    [deviceSync, "token-from-environment-only"],
    [deviceSync, "no-network-upload-in-this-stage"],
    [deviceSync, "network_started: false"],
    [deviceSync, "sync package requires explicit replace approval"],
    [deviceSyncHook, "preflight_device_sync_import_apply"],
    [deviceSyncHook, "replace a non-empty local Zhishu repository"],
    [deviceSyncHook, "no network upload started"],
    [deviceSyncPanel, 'data-testid="device-sync-import-preflight-result"'],
    [deviceSyncPanel, 'data-testid="device-sync-import-transaction-receipt"'],
  ];
  const missingDeviceSyncItems = requiredDeviceSyncItems
    .filter(([content, item]) => !content.includes(item))
    .map(([, item]) => item);
  if (missingDeviceSyncItems.length === 0) {
    pass("device-sync-local-first-guard", "Device sync remains hash-verified, previewed before import, relay-dry-run only, and token-env-only");
  } else {
    fail(
      "device-sync-local-first-guard",
      `Missing device sync guard item(s): ${missingDeviceSyncItems.join(" / ")}`,
      `Restore Device Sync local-first and relay dry-run guards before claiming the ${PUBLIC_BASELINE_NAME}.`,
    );
  }
}
if (dailyBriefing && dailyBriefingPanel) {
  const requiredDailyBriefingItems = [
    [dailyBriefing, "DailyBriefingEvidenceContract"],
    [dailyBriefing, "DailyBriefingArchiveReceipt"],
    [dailyBriefing, "daily-briefing-archive"],
    [dailyBriefing, "compensate_archive"],
    [dailyBriefing, "remove_task_artifacts"],
    [dailyBriefing, "remove_source_observations"],
    [dailyBriefing, "restore_task_run"],
    [dailyBriefing, "evidence_contract"],
    [dailyBriefing, "evidence_validation"],
    [dailyBriefing, "provider_receipt"],
    [dailyBriefing, "provider_admission_preflight"],
    [dailyBriefing, "provider_review_queue_preview"],
    [dailyBriefing, "daily_briefing_provider_receipt"],
    [dailyBriefing, "provider_artifact_admission_required"],
    [dailyBriefing, "daily-briefing-provider-evidence"],
    [dailyBriefing, "source_sha256"],
    [dailyBriefing, "task-artifact-review-required"],
    [dailyBriefing, "zhishu_admission_state"],
    [dailyBriefing, "provider-receipt-before-briefing-admission"],
    [dailyBriefing, "provider-review-queue-before-briefing-zhishu"],
    [dailyBriefing, "provider-receipt-admission-review-required"],
    [dailyBriefing, "provider-receipt-review-queue-preview"],
    [dailyBriefing, "source-observations-recorded-before-archive"],
    [dailyBriefing, "quarantine-before-summary"],
    [dailyBriefing, "human-review-before-reuse"],
    [dailyBriefing, "no-automatic-zhishu-admission"],
    [dailyBriefing, "no-automatic-external-delivery"],
    [dailyBriefing, "external_delivery_started: false"],
    [dailyBriefing, "durable_zhishu_write: false"],
    [dailyBriefing, "send-briefing-without-approval"],
    [dailyBriefing, "write-l2-without-review"],
    [dailyBriefing, "treat-fixture-as-current-fact"],
    [dailyBriefing, "DailyBriefingLiveSourceStagingPreflight"],
    [dailyBriefing, "LiveSourceProviderGate"],
    [dailyBriefing, "preflight_live_source_staging"],
    [dailyBriefing, "fetch_live_source"],
    [dailyBriefing, "DailyBriefingLiveSourceReceipt"],
    [dailyBriefing, "daily-briefing-live-source-fetch"],
    [dailyBriefing, "prepare-daily-briefing-live-source-fetch"],
    [dailyBriefing, "network-intent-audited"],
    [dailyBriefing, "compensate_live_source"],
    [dailyBriefing, "finish_live_source_compensation"],
    [dailyBriefing, "live-source-staging-blocked-by-default"],
    [dailyBriefing, "live-source-staging-ready"],
    [dailyBriefing, "configured-http-source-url-required"],
    [dailyBriefing, "configured-http-source-cross-check-required"],
    [dailyBriefing, "configured-independent-sources-before-network"],
    [dailyBriefing, "configured-http-json-live-source-bundle"],
    [dailyBriefing, "fetch_configured_source_as"],
    [dailyBriefing, "daily-briefing-live-source-receipt"],
    [dailyBriefing, "configured-http-json-live-source"],
    [dailyBriefing, "provider-live-source-review-required"],
    [dailyBriefing, "external_network_started: false"],
    [dailyBriefing, "\"external_network_started\": true"],
    [dailyBriefing, "\"durable_zhishu_write_started\": false"],
    [dailyBriefing, "provider_gates"],
    [dailyBriefing, "provider-allowlist-before-network"],
    [dailyBriefing, "provider-specific-gate-before-network"],
    [dailyBriefing, "credential-policy-before-provider-use"],
    [dailyBriefing, "provider-audit-before-network"],
    [dailyBriefing, "fetch-provider-without-allowlist"],
    [dailyBriefing, "read-provider-credential-before-approval"],
    [dailyBriefing, "external-source-network-gate-disabled"],
    [dailyBriefing, "live_source_staging_preflight_blocks_network_by_default"],
    [dailyBriefing, "live_source_fetch_requires_approval_and_gate_before_network"],
    [dailyBriefing, "live_source_artifact_persistence_failure_removes_post_fetch_observations"],
    [dailyBriefing, "finish_live_source_compensation"],
    [dailyBriefing, "compensate_live_source"],
    [dailyBriefing, "DailyBriefingScheduledArchiveReview"],
    [dailyBriefing, "review_scheduled_archive"],
    [dailyBriefing, "scheduled_archive_review_only_exposes_approved_schedule_tick_runs"],
    [dailyBriefingPanel, 'data-testid="daily-briefing-scheduled-archive-review-button"'],
    [dailyBriefingPanel, 'data-testid="daily-briefing-scheduled-archive-review"'],
    [dailyBriefingPanel, 'data-testid="daily-briefing-evidence-contract"'],
    [dailyBriefingPanel, 'data-testid="daily-briefing-evidence-validation"'],
    [dailyBriefingPanel, 'data-testid="daily-briefing-provider-admission-path"'],
    [dailyBriefingPanel, "Provider admission path"],
    [dailyBriefingPanel, 'data-testid="daily-briefing-live-source-preflight-button"'],
    [dailyBriefingPanel, 'data-testid="daily-briefing-live-source-preflight-result"'],
    [dailyBriefingPanel, 'data-testid="daily-briefing-live-source-fetch-button"'],
    [dailyBriefingPanel, 'data-testid="daily-briefing-live-source-receipt"'],
    [dailyBriefingPanel, 'data-testid="daily-briefing-archive-receipt"'],
    [dailyBriefingPanel, 'data-testid="daily-briefing-provider-gates"'],
    [dailyBriefingPanel, "credential policy"],
    [dailyBriefingPanel, "network policy"],
    [dailyBriefingPanel, "audit policy"],
    [dailyBriefingPanel, "external delivery started"],
    [dailyBriefingPanel, "durable Zhishu write"],
    [dailyBriefingPanel, "durable write allowed"],
    [httpSource, "fetch_configured_source_as"],
    [httpSource, "HTTP source identity mismatch"],
    [httpSource, "rejects_response_that_claims_a_different_configured_source_id"],
    [sourceRegistry, "latest_health_projection"],
    [sourceRegistryPanel, 'data-testid="source-health-status"'],
    [taskCenterService, "finalize_direction_state_change"],
    [taskCenterService, "direction_activation_compensates_when_audit_write_fails"],
    [taskCenterService, "direction_activation_compensates_when_saga_commit_fails"],
    [providerReceiptStore, "finish_provider_candidate_compensation"],
    [providerReceiptStore, "candidate-create-audit-failure"],
    [providerReceiptStore, "compensate_provider_task_artifact"],
    [providerReceiptStore, "artifact-create-audit-failure"],
    [providerReceiptStore, "finish_provider_candidate_queue_compensation"],
    [providerReceiptStore, "candidate-queue-audit-failure"],
    [providerReceiptStore, "commit_provider_saga_with_compensation"],
    [providerReceiptStore, "final_provider_saga_commit_failure_runs_compensation_before_returning_error"],
  ];
  const missingDailyBriefingItems = requiredDailyBriefingItems
    .filter(([content, item]) => !content.includes(item))
    .map(([, item]) => item);
  if (missingDailyBriefingItems.length === 0) {
    pass("daily-briefing-evidence-guard", "Daily Briefing keeps archive and live-source evidence compensatable, writes network intent before fetch, and keeps delivery/admission manual");
  } else {
    fail(
      "daily-briefing-evidence-guard",
      `Missing Daily Briefing evidence guard item(s): ${missingDailyBriefingItems.join(" / ")}`,
      "Restore Daily Briefing evidence contracts before claiming briefing production readiness.",
    );
  }
}
if (computerDiagnostics) {
  const requiredDiagnosticsItems = [
    "no-process-launch",
    "no-file-deletion",
    "no-registry-write",
    "no-system-setting-change",
    "cleanup_dry_run",
    "cleanup_mutation_preflight",
    "CleanupDryRunPreview",
    "CleanupMutationPreflight",
    "cleanup-dry-run-review-required",
    "cleanup-mutation-blocked-by-default",
    "deleted_bytes: 0",
    "mutation_started: false",
    "system_mutation_started: false",
    "file_deletion_started: false",
    "registry_write_started: false",
    "process_kill_started: false",
    "restore-point-required-before-real-cleanup",
    "explicit-approval-required-before-real-cleanup",
    "audit-required-before-real-cleanup",
    "rollback-plan-required-before-real-cleanup",
    "real-cleanup-executor-disabled",
    "preview-only-no-delete",
    "cleanup_dry_run_never_deletes_or_starts_mutation",
    "cleanup_mutation_preflight_requires_restore_point_and_never_mutates",
    "SystemProfileSnapshot",
    "context-snapshot-only",
    "current-task-context-only",
    "review-before-working-or-durable-memory",
    "non-sensitive-local-environment-only",
    "no-file-content-read",
    "no-account-or-browser-data",
    "no-token-cookie-or-api-key-read",
    "not-automatically-written-to-l2",
    "denied_fields",
    "computer diagnostics require an approved, not-started Task Run",
    "Read-only computer diagnostic",
  ];
  const missingDiagnosticsItems = requiredDiagnosticsItems.filter(
    (item) => !computerDiagnostics.includes(item),
  );
  if (missingDiagnosticsItems.length === 0) {
    pass("computer-diagnostics-readonly-guard", "Computer diagnostics remain read-only and archive only after an approved Task Run");
  } else {
    fail(
      "computer-diagnostics-readonly-guard",
      `Missing computer diagnostics guard item(s): ${missingDiagnosticsItems.join(" / ")}`,
      `Restore read-only computer diagnostics guards before claiming the ${PUBLIC_BASELINE_NAME}.`,
    );
  }
}
if (contextBudget) {
  const requiredContextBudgetItems = [
    "source_sha256",
    "source-sha256-manifest",
    "evidence_state",
    "missing-evidence-review",
    "missing-evidence-requires-review",
    "sensitive_markers",
    "sensitive-marker-review-before-model-call",
    "preserve-error-paths-and-evidence-ids",
    "quarantine-untrusted-web-and-agent-output",
  ];
  const missingContextBudgetItems = requiredContextBudgetItems.filter(
    (item) => !contextBudget.includes(item),
  );
  if (missingContextBudgetItems.length === 0) {
    pass("context-budget-evidence-guard", "Context Budget preserves evidence manifests and review signals");
  } else {
    fail(
      "context-budget-evidence-guard",
      `Missing Context Budget evidence item(s): ${missingContextBudgetItems.join(" / ")}`,
      "Restore Context Budget evidence preservation before using model-call packaging.",
    );
  }
}
if (contextBudgetHook) {
  const requiredContextBudgetHookItems = [
    "useContextBudgetPreview",
    "preview_context_budget",
    "manual-context-package",
    "preserve_evidence: true",
    "evidence_refs",
    "setIsPreviewingContextBudget",
    "Paste at least one context snippet",
    "Context budget preview:",
  ];
  const missingContextBudgetHookItems = requiredContextBudgetHookItems.filter(
    (item) => !contextBudgetHook.includes(item),
  );
  if (missingContextBudgetHookItems.length === 0) {
    pass(
      "context-budget-hook-guard",
      "Context Budget UI state and invoke flow stay isolated from the App shell",
    );
  } else {
    fail(
      "context-budget-hook-guard",
      `Missing Context Budget hook item(s): ${missingContextBudgetHookItems.join(" / ")}`,
      "Restore src/app/useContextBudgetPreview.ts before expanding model-call packaging flows.",
    );
  }
}
if (libraryHome && appShell) {
  const requiredLibraryHomeItems = [
    [libraryHome, "backup_library_policy"],
    [libraryHome, "restore_policy"],
    [libraryHome, "recycle_policy"],
    [libraryHome, "restore-to-temporary-recovery-area-first"],
    [libraryHome, "no-backup-cleanup-without-review"],
    [libraryHome, "no-permanent-delete-without-audit"],
    [libraryHome, "permission review"],
    [libraryHome, "audit record"],
    [appShell, "LibraryHomePanel"],
  ];
  const missingLibraryHomeItems = requiredLibraryHomeItems
    .filter(([content, item]) => !content.includes(item))
    .map(([, item]) => item);
  if (missingLibraryHomeItems.length === 0) {
    pass("library-home-recoverability-guard", "Library Home surfaces backup/recycle recovery policy without restore or delete bypass");
  } else {
    fail(
      "library-home-recoverability-guard",
      `Missing Library Home recoverability item(s): ${missingLibraryHomeItems.join(" / ")}`,
      `Restore backup/recycle review and temporary recovery boundaries before claiming ${INTERNAL_DESIGN_ALIGNMENT}.`,
    );
  }
}
if (productionReadiness) {
  const requiredProductionReadinessItems = [
    "release_evidence_check",
    ".tmp",
    "release-evidence",
    "release-evidence.json",
    "schema_version",
    "artifact_readiness",
    "stale_release_evidence_inputs",
    "web-app-shell-manual-preview",
    "web-app-shell-manual-isolated-preview",
    "codebase-memory-structural-preview",
    "codebase-memory-readonly-structural-preview",
    "permission-memory-candidate-preview",
    "permission-memory-candidate-only-no-auto-grant",
    "task_loop_acceptance_check",
    "xingtai-task-loop-acceptance",
    "Task loop acceptance covers direction request",
    "source-registry-lightweight-governance-preview",
    "source-registry-no-credential-or-heavy-fetch",
    "src-tauri/src/domains/notification_gateway.rs",
    "src/components/NotificationGatewayPanel.tsx",
    "src/app/useNotificationGateway.ts",
    "src/i18n/localizeText.ts",
    ".github/workflows/manual-release.yml",
    "scripts/ui-smoke-tauri-mock.js",
    "signing_mode",
    "all_release_installers_signed",
    "backup-library-readonly-temporary-restore-first",
    "release:doctor -- --json",
  ];
  const missingProductionReadinessItems = requiredProductionReadinessItems.filter(
    (item) => !productionReadiness.includes(item),
  );
  if (missingProductionReadinessItems.length === 0) {
    pass("production-readiness-release-evidence-guard", "Production Readiness surfaces current release evidence state");
  } else {
    fail(
      "production-readiness-release-evidence-guard",
      `Missing Production Readiness release evidence item(s): ${missingProductionReadinessItems.join(" / ")}`,
      `Restore the read-only release evidence gate before claiming the ${PUBLIC_BASELINE_NAME}.`,
    );
  }
}
if (viteConfig) {
  const forbiddenViteBuildItems = ["app: \"index.html\"", "index: \"./index.html\"", "S:/My/Synapse2.0/index.html"];
  const foundViteBuildItems = forbiddenViteBuildItems.filter((item) => viteConfig.includes(item));
  const requiredViteBuildItems = ["emptyOutDir: true"];
  const missingViteBuildItems = requiredViteBuildItems.filter((item) => !viteConfig.includes(item));
  if (foundViteBuildItems.length === 0 && missingViteBuildItems.length === 0) {
    pass("vite-windows-html-entry", "Vite build uses the default HTML entry to avoid Windows absolute asset names");
  } else {
    fail(
      "vite-windows-html-entry",
      [
        foundViteBuildItems.length > 0 ? `Forbidden Vite build item(s): ${foundViteBuildItems.join(" / ")}` : "",
        missingViteBuildItems.length > 0 ? `Missing Vite build item(s): ${missingViteBuildItems.join(" / ")}` : "",
      ].filter(Boolean).join(" / "),
      "Use Vite's default HTML entry before claiming the Windows production baseline.",
    );
  }
}
if (storeMod && storeRepository) {
  const requiredStoreMigrationItems = [
    [storeMod, "STORE_SCHEMA_VERSION"],
    [storeMod, "JsonRecordEnvelope"],
    [storeMod, "JsonRecordEnvelopeRef"],
    [storeMod, "value.is_array()"],
    [storeMod, "unsupported store schema version"],
    [storeMod, "temporary_store_path"],
    [storeMod, "write_and_sync_file"],
    [storeMod, "replace_file"],
    [storeMod, "reads_legacy_record_array"],
    [storeMod, "writes_schema_envelope_records"],
    [storeMod, "rejects_future_schema_envelope_records"],
    [storeRepository, "legacy-imported:{collection}"],
    [storeRepository, "import_legacy_once"],
    [storeRepository, "ZhishuRepositoryBundle"],
    [storeRepository, "unsupported Zhishu repository schema version"],
    [storeRepository, "validate_bundle"],
    [storeRepository, "imports_legacy_json_once_and_preserves_sqlite_updates"],
  ];
  const missingStoreMigrationItems = requiredStoreMigrationItems
    .filter(([content, item]) => !content.includes(item))
    .map(([, item]) => item);
  if (missingStoreMigrationItems.length === 0) {
    pass("store-schema-migration-guard", "Store keeps schema envelopes, legacy reads, future-schema rejection, atomic file writes, and SQLite legacy import guards");
  } else {
    fail(
      "store-schema-migration-guard",
      `Missing store schema/migration guard item(s): ${missingStoreMigrationItems.join(" / ")}`,
      `Restore store schema and migration guards before claiming the ${PUBLIC_BASELINE_NAME}.`,
    );
  }
}
if (taskCenterStore) {
  const requiredTaskLoopItems = [
    "task_loop_acceptance_covers_direction_run_execution_artifact_and_memory_admission",
    "scheduled_task_loop_acceptance_covers_tick_approval_execution_and_memory_admission",
    "task_scheduler_tick_at",
    "trigger_kind, \"schedule-tick\"",
    "schedule_frequency, \"daily\"",
    "request_task_run_at",
    "review_task_run_at",
    "execute_task_run_at",
    "review_task_candidate_at",
    "receipt.run.lifecycle_state, \"succeeded\"",
    "receipt.run.execution_state, \"completed\"",
    "receipt.artifacts[0].reference_id",
    "promoted.scope, \"L1 Working\"",
    "promoted.admission_rule, \"task-candidate-review\"",
    "template:opportunity",
  ];
  const missingTaskLoopItems = requiredTaskLoopItems.filter(
    (item) => !taskCenterStore.includes(item),
  );
  if (missingTaskLoopItems.length === 0) {
    pass(
      "xingtai-task-loop-acceptance",
      "Xingtai task loop has acceptance tests for manual and scheduled direction, approval, execution, artifact, and memory admission",
    );
  } else {
    fail(
      "xingtai-task-loop-acceptance",
      `Missing Xingtai task loop acceptance item(s): ${missingTaskLoopItems.join(" / ")}`,
      `Restore the end-to-end task loop verifier before claiming the ${PUBLIC_BASELINE_NAME}.`,
    );
  }
}
if (zhishuCore) {
  const requiredZhishuRetrievalItems = [
    "zhishu_retrieval_acceptance_finds_reviewed_l2_memory_after_admission",
    "L2 Knowledge",
    "admission_state: Some(\"accepted\"",
    "minimum_confidence: Some(0.7)",
    "retention_policy, \"durable-review\"",
    "matched_fields",
  ];
  const missingZhishuRetrievalItems = requiredZhishuRetrievalItems.filter(
    (item) => !zhishuCore.includes(item),
  );
  if (missingZhishuRetrievalItems.length === 0) {
    pass(
      "zhishu-retrieval-acceptance",
      "Zhishu retrieval has an acceptance test for reviewed L2 memory admission and filtered search",
    );
  } else {
    fail(
      "zhishu-retrieval-acceptance",
      `Missing Zhishu retrieval acceptance item(s): ${missingZhishuRetrievalItems.join(" / ")}`,
      `Restore reviewed L2 memory retrieval coverage before claiming the ${PUBLIC_BASELINE_NAME}.`,
    );
  }
}
if (uiSmoke) {
  const requiredUiSmokeItems = [
    "LibraryHomePanel",
    "ProductionReadinessPanel",
    "WebAppShellPanel",
    "CodebaseMemoryPanel",
    "PermissionMemoryPanel",
    "SourceRegistryPanel",
    "Library home",
    "Production readiness",
    "Web App Shell",
    "Codebase Memory",
    "Permission Memory",
    "Data Source Registry",
    "desktop",
    "mobile",
    "screenshotDir",
    "fullPage",
    "ui-smoke-tauri-mock.js",
    "assertZhishuMemoryLoop",
    "zhishu-capture-input",
    "zhishu-search-result",
    "accept-memory-candidate-button",
    "assertXingtaiTaskLoop",
    "scheduler-tick-button",
    "direction-frequency-select",
    "UI smoke scheduled loop",
    "schedule-tick",
    "direction-title-input",
    "request-task-run-button",
    "approve-task-run-button",
    "execute-task-run-button",
    "promote-task-artifact-button",
    "provider-governed-task-artifact",
    "task-artifact-provider-zhishu-preflight-button",
    "task-artifact-provider-zhishu-review-button",
    "task-artifact-provider-zhishu-candidate-button",
    "task-artifact-provider-review-result",
  ];
  const missingUiSmokeItems = requiredUiSmokeItems.filter((item) => !uiSmoke.includes(item));
  if (missingUiSmokeItems.length === 0) {
    pass("ui-smoke-production-anchors", "UI smoke protects Library Home, Production Readiness, Zhishu retrieval, and Xingtai task-loop anchors with desktop/mobile screenshots");
  } else {
    fail(
      "ui-smoke-production-anchors",
      `Missing UI smoke anchor item(s): ${missingUiSmokeItems.join(" / ")}`,
      `Restore UI smoke anchors before claiming the ${PUBLIC_BASELINE_NAME}.`,
    );
  }
}
if (alignmentMatrix) {
  const requiredAlignmentItems = [
    "Synapse 0.0.0 Capability Matrix",
    "usable",
    "guarded",
    "preview-only",
    "dry-run",
    "disabled",
    "Taiheng",
    "Zhishu",
    "Xingtai",
    "Baigong",
    "Data source registry",
    "Cloud relay as source of truth",
  ];
  const missingAlignmentItems = requiredAlignmentItems.filter(
    (item) => !alignmentMatrix.includes(item),
  );
  if (missingAlignmentItems.length === 0) {
    pass("public-capability-matrix", "Public capability matrix covers core evidence areas");
  } else {
    fail(
      "public-capability-matrix",
      `Missing public baseline alignment item(s): ${missingAlignmentItems.join(" / ")}`,
      "Restore docs/CAPABILITY_MATRIX.md before claiming public baseline capabilities.",
    );
  }
}

if (releaseMode) {
  checkGitRepository();
  checkWindowsMsiTooling();
}

if (staticOnly) {
  pass("static-mode", `Skipped build commands; static ${PUBLIC_BASELINE_NAME} gates only`);
} else {
  run("npm.cmd", ["run", "build"], { id: "frontend-build" });
  run("cargo", ["fmt", "--check"], { cwd: "src-tauri", id: "rust-format-check" });
  run("cargo", ["check", "--offline"], { cwd: "src-tauri", id: "rust-offline-check" });
}

const failed = checks.filter((check) => check.state === "fail");
if (jsonOutput) {
  console.log(
    JSON.stringify(
      {
        mode: releaseMode ? "release" : staticOnly ? "static" : "production",
        static_only: staticOnly,
        release_mode: releaseMode,
        state: failed.length > 0 ? "failed" : "passed",
        failed_count: failed.length,
        checks,
      },
      null,
      2,
    ),
  );
} else {
  for (const check of checks) {
    const prefix = check.state === "pass" ? "[PASS]" : "[FAIL]";
    console.log(`${prefix} ${check.id}: ${check.detail}`);
    if (check.state === "fail" && check.remediation) {
      console.log(`       fix: ${check.remediation}`);
    }
  }
}

if (failed.length > 0) {
  if (!jsonOutput) {
    console.error(`\nProduction preflight failed: ${failed.length} check(s) need attention.`);
  }
  process.exit(1);
}

if (!jsonOutput) {
  console.log(
    staticOnly
      ? `\n${releaseMode ? "Release" : "Static production"} preflight passed for the ${PUBLIC_BASELINE_NAME}.`
      : `\nProduction preflight passed for the ${PUBLIC_BASELINE_NAME}.`,
  );
}

function checkGitRepository() {
  const gitPath = join(root, ".git");
  if (!existsSync(gitPath)) {
    fail(
      "git-repository",
      ".git does not exist; run git init before publishing",
      "Run git init from the project root after confirming no previous history needs to be preserved.",
    );
    return;
  }
  const stat = statSync(gitPath);
  if (!stat.isDirectory()) {
    fail(
      "git-repository",
      ".git exists but is not a directory",
      "Inspect .git manually; only repair it after confirming whether it is a worktree pointer or corrupted metadata.",
    );
    return;
  }
  const names = readdirSync(gitPath, { withFileTypes: true }).map((entry) => entry.name);
  const missing = ["HEAD", "objects", "refs"].filter((name) => !names.includes(name));
  if (names.length === 0) {
    fail(
      "git-repository",
      ".git is an empty directory; remove it intentionally, then run git init",
      "If no history must be preserved, remove only the empty .git directory, run git init, then rerun preflight:release.",
    );
    return;
  }
  if (missing.length > 0) {
    fail(
      "git-repository",
      `.git is missing expected item(s): ${missing.join(", ")}`,
      "Repair or reinitialize the repository before publishing to GitHub.",
    );
    return;
  }
  pass("git-repository", ".git has the basic repository shape");
}

function checkWindowsMsiTooling() {
  if (process.platform !== "win32") {
    pass("windows-msi-tooling", "Skipped MSI tooling check on non-Windows host");
    return;
  }
  if (!Array.isArray(tauriConfig.bundle?.targets) || !tauriConfig.bundle.targets.includes("msi")) {
    pass("windows-msi-tooling", "Skipped MSI tooling check because MSI target is not enabled");
    return;
  }
  const hasWixV3 = commandExists("candle.exe") && commandExists("light.exe");
  const hasWixV4 = commandExists("wix.exe");
  if (hasWixV3 || hasWixV4) {
    pass("windows-msi-tooling", hasWixV3 ? "WiX v3 tooling is on PATH" : "WiX CLI is on PATH");
  } else {
    fail(
      "windows-msi-tooling",
      "MSI target needs cached/installed WiX tooling; install WiX or pre-cache Tauri's WiX bundle before release packaging",
      "Install WiX v3/v4 on PATH, or allow Tauri to download/cache wix314-binaries.zip in a network-enabled release environment.",
    );
  }
}

function commandExists(name) {
  const paths = (process.env.PATH ?? "").split(";");
  return paths.some((directory) => {
    if (!directory.trim()) {
      return false;
    }
    return existsSync(join(directory.trim(), name));
  });
}

function checkSensitiveFilesAbsent() {
  const sensitiveNames = [];
  for (const file of walkFiles(root)) {
    const relative = file.slice(root.length + 1).replaceAll("\\", "/");
    const name = relative.split("/").at(-1) ?? relative;
    if (
      name === ".env" ||
      (name.startsWith(".env.") && name !== ".env.example") ||
      /\.(pem|key|pfx|p12)$/i.test(name)
    ) {
      sensitiveNames.push(relative);
    }
  }
  if (sensitiveNames.length === 0) {
    pass("sensitive-files-absent", "No local env, private key, or signing certificate files are present in the repository tree");
  } else {
    fail(
      "sensitive-files-absent",
      `Sensitive file(s) present: ${sensitiveNames.join(" / ")}`,
      "Move secrets and signing material outside the repository before publishing or packaging.",
    );
  }
}

function checkHardcodedSecretsAbsent() {
  const findings = [];
  const assignmentPattern =
    /\b(api[_-]?key|access[_-]?token|auth[_-]?token|secret|password|webhook_url|smtp_password)\b\s*[:=]\s*["']([^"']{6,})["']/gi;
  const defaultCredentialPattern =
    /\b(admin\s*[:/]\s*admin|username\s*[:=]\s*["']admin["'][\s\S]{0,120}password\s*[:=]\s*["']admin["'])/gi;
  for (const file of walkFiles(root)) {
    const relative = file.slice(root.length + 1).replaceAll("\\", "/");
    if (!/\.(rs|ts|tsx|js|mjs|toml|json|md)$/i.test(relative)) {
      continue;
    }
    if (relative.endsWith("package-lock.json") || relative === "scripts/production-preflight.mjs") {
      continue;
    }
    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(assignmentPattern)) {
      const value = match[2].trim();
      if (
        value === "SYNAPSE_SMTP_PASSWORD" ||
        value.startsWith("SYNAPSE_") ||
        value.includes("example") ||
        value.includes("preview") ||
        value === "admin" ||
        value === "missing" ||
        value === "blocked"
      ) {
        continue;
      }
      findings.push(`${relative}: ${match[1]}`);
    }
    if (defaultCredentialPattern.test(content)) {
      findings.push(`${relative}: default admin credential`);
    }
    defaultCredentialPattern.lastIndex = 0;
  }
  if (findings.length === 0) {
    pass("hardcoded-secret-scan", "No hardcoded secret assignments or factory default credentials found in source/config/docs");
  } else {
    fail(
      "hardcoded-secret-scan",
      `Potential hardcoded secret(s): ${findings.join(" / ")}`,
      "Remove hardcoded credentials and use environment-only or OS-secure storage before publishing.",
    );
  }
}

function checkSecretGuard() {
  const result = spawnSync(process.execPath, [join(root, "scripts", "secret-guard.mjs"), "--json"], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  });
  let report = null;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    fail(
      "secret-guard-scan",
      result.stderr.trim() || result.stdout.trim() || "Secret Guard did not return JSON.",
      "Run npm.cmd run secret:scan and inspect the output.",
    );
    return;
  }
  if (result.status === 0 && report.state === "passed") {
    pass("secret-guard-scan", "Secret Guard found no obvious local secrets");
    return;
  }
  const summary = (report.findings ?? [])
    .slice(0, 8)
    .map((finding) => `${finding.severity}:${finding.rule}:${finding.path}`)
    .join(" / ");
  fail(
    "secret-guard-scan",
    `Secret Guard finding(s): ${summary || result.stderr.trim() || "unknown finding"}`,
    "Remove or relocate secret material before committing, publishing, or packaging.",
  );
}

function walkFiles(directory) {
  const ignoredDirectories = new Set([
    ".git",
    ".codegraph",
    ".tmp",
    ".synapse",
    "node_modules",
    "dist",
    "dist-ssr",
    "build",
    "target",
    "data",
    "logs",
    "coverage",
    "dataset",
    "backtest_results",
  ]);
  const files = [];
  const entries = readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) {
      continue;
    }
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(path));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

function cargoDependencyVersion(raw, section, dependency) {
  if (!raw) {
    return null;
  }
  const sectionPattern = new RegExp(`^\\[${escapeRegExp(section)}\\]\\s*$`, "m");
  const match = sectionPattern.exec(raw);
  if (!match) {
    return null;
  }
  const rest = raw.slice(match.index + match[0].length);
  const nextSection = rest.search(/^\[[^\]]+\]\s*$/m);
  const body = nextSection >= 0 ? rest.slice(0, nextSection) : rest;
  const keyPattern = new RegExp(`^\\s*${escapeRegExp(dependency)}\\s*=\\s*(.+?)\\s*$`, "m");
  const value = keyPattern.exec(body)?.[1]?.trim();
  if (!value) {
    return null;
  }
  const objectVersion = /version\s*=\s*"([^"]+)"/.exec(value)?.[1];
  if (objectVersion) {
    return objectVersion;
  }
  return /^"([^"]+)"$/.exec(value)?.[1] ?? value;
}
