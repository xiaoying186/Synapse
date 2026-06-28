import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const checks = [];
const staticOnly = process.argv.includes("--static");
const releaseMode = process.argv.includes("--release");
const jsonOutput = process.argv.includes("--json");

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
      `Restore ${path} before using the V6.5 production or release baseline.`,
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
      `Set [${section}].${key} back to ${expected} before using the V6.5 local production baseline.`,
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
    "Tauri CSP must not be null for the V6.5 production baseline",
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

const config = readText("synapse.config.toml");
assertTomlValue(config, "safety", "external_delivery_enabled", "false", "external-delivery-off");
assertTomlValue(config, "safety", "agent_execution_enabled", "false", "agent-execution-off");
assertTomlValue(config, "sync.relay", "enabled", "false", "relay-off");
assertTomlValue(config, "notifications.feishu", "webhook_url", '""', "feishu-preview-only");
assertTomlValue(config, "notifications.wechat", "webhook_url", '""', "wechat-preview-only");
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
    "*.png binary",
    "*.msi binary",
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

const releaseChecklist = readProtectedText(
  "PRODUCTION_RELEASE_CHECKLIST.md",
  "release-checklist-file",
  "Release checklist",
);
const releaseDistributionNotes = readProtectedText(
  "RELEASE_DISTRIBUTION_NOTES.md",
  "release-distribution-notes-file",
  "Release distribution notes",
);
const readme = readProtectedText("README.md", "readme-file", "README");
const githubWorkflow = readProtectedText(
  ".github/workflows/v65-local-baseline.yml",
  "github-local-baseline-workflow-file",
  "GitHub Actions local baseline workflow",
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
const notificationGateway = readProtectedText(
  "src-tauri/src/domains/notification_gateway.rs",
  "notification-gateway-file",
  "Notification gateway domain",
);
const localAppBridge = readProtectedText(
  "src-tauri/src/domains/local_app_bridge.rs",
  "local-app-bridge-file",
  "Local App Bridge domain",
);
const browserAutomation = readProtectedText(
  "src-tauri/src/domains/browser_automation.rs",
  "browser-automation-file",
  "Browser Automation domain",
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
const deviceSync = readProtectedText(
  "src-tauri/src/domains/device_sync.rs",
  "device-sync-file",
  "Device Sync domain",
);
const computerDiagnostics = readProtectedText(
  "src-tauri/src/domains/computer_diagnostics.rs",
  "computer-diagnostics-file",
  "Computer Diagnostics domain",
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
const uiSmoke = readProtectedText("scripts/ui-smoke.mjs", "ui-smoke-file", "UI smoke script");
const viteConfig = readProtectedText("vite.config.ts", "vite-config-file", "Vite config");
const appShell = readProtectedText("src/App.tsx", "app-shell-file", "App shell");
const alignmentMatrix = readProtectedText(
  "V65_ALIGNMENT_MATRIX.md",
  "v65-alignment-matrix-file",
  "V6.5 alignment matrix",
);
const requiredNonGoals = [
  "No direct CLI Agent execution",
  "No one-click real Agent team execution",
  "No automatic Feishu or WeChat delivery",
  "No automatic C drive cleanup or system file deletion",
  "No automatic L2 writes without explicit review",
];
if (releaseChecklist) {
  const requiredChecklistItems = [
    ...requiredNonGoals,
    ".tmp/release-evidence/release-summary.md",
    "documentation-boundary summary",
  ];
  const missingChecklistItems = requiredChecklistItems.filter((item) => !releaseChecklist.includes(item));
  if (missingChecklistItems.length === 0) {
    pass("v65-release-checklist", "Release checklist includes V6.5 non-goals and release summary review");
  } else {
    fail(
      "v65-release-checklist",
      `Missing checklist item(s): ${missingChecklistItems.join(" / ")}`,
      "Restore the V6.5 non-goal and release-summary checklist so release review cannot accidentally claim unsafe automation.",
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
    pass("release-distribution-notes", "Release notes cover signing, hashes, and V6.5 claim boundaries");
  } else {
    fail(
      "release-distribution-notes",
      `Missing release distribution note item(s): ${missingDistributionNotes.join(" / ")}`,
      "Restore RELEASE_DISTRIBUTION_NOTES.md before publishing a release artifact.",
    );
  }
}

if (readme) {
  const requiredReadmeItems = [
    "GitHub Readiness",
    "Local Production Baseline",
    "npm.cmd run preflight:release",
    "npm.cmd run release:evidence",
    "npm.cmd run release:status",
    "Do Not Claim In This Baseline",
    "guarded local-first baseline",
  ];
  const missingReadmeItems = requiredReadmeItems.filter((item) => !readme.includes(item));
  if (missingReadmeItems.length === 0) {
    pass("readme-release-boundary", "README covers GitHub readiness and V6.5 claim boundaries");
  } else {
    fail(
      "readme-release-boundary",
      `Missing README release boundary item(s): ${missingReadmeItems.join(" / ")}`,
      "Restore README GitHub readiness and V6.5 claim-boundary guidance before publishing.",
    );
  }
}

const requiredWorkflowItems = [
  "V6.5 Local Baseline",
  "windows-latest",
  "npm ci",
  "npm run preflight:static",
  "npm run smoke:ui",
  "cargo fmt --check",
  "npm run preflight",
  "npm run release:evidence",
  "npm run release:status -- --json",
  "npm run release:doctor -- --json",
  "actions/upload-artifact@v4",
  "synapse-v65-release-evidence",
  "synapse-v65-ui-smoke",
  "continue-on-error: true",
];
if (githubWorkflow) {
  const missingWorkflowItems = requiredWorkflowItems.filter((item) => !githubWorkflow.includes(item));
  if (missingWorkflowItems.length === 0) {
    pass("github-local-baseline-workflow", "GitHub Actions local baseline workflow is present");
  } else {
    fail(
      "github-local-baseline-workflow",
      `Missing workflow item(s): ${missingWorkflowItems.join(" / ")}`,
      "Restore .github/workflows/v65-local-baseline.yml before publishing to GitHub.",
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
    "v65-release-checklist",
    "release-distribution-notes",
    "readme-release-boundary",
    "v65-alignment-matrix",
    "Release Blockers",
    "V6.5 Claim Boundary",
    "renderReleaseSummary",
    "buildReleaseReview",
    "schema_version: 1",
    "Schema version",
    "release_review",
    "artifact_readiness",
    "has_distributable_msi",
    "Safe Public Claim",
    "Artifact Readiness",
    "debug-only rehearsal artifact",
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
    "src/App.tsx",
    "src/App.css",
    ".tmp/ui-smoke/desktop.png",
    ".tmp/ui-smoke/mobile.png",
    "src-tauri/src/domains/production_readiness.rs",
    "Date.parse",
    "stale_inputs",
    "[STALE]",
    "artifact_readiness",
    "[STATE]",
    "[READY]",
    "[ARTIFACTS]",
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
if (agentTeamPanel && agentTeamDomain) {
  const requiredAgentTeamPreviewItems = [
    [agentTeamPanel, "Build team preview"],
    [agentTeamPanel, "preview only"],
    [agentTeamDomain, "blueprint-preview-ready"],
    [agentTeamDomain, "blueprint-preview-only"],
    [agentTeamDomain, "final-execution-approval-not-implemented"],
    [agentTeamDomain, "process_started: false"],
  ];
  const missingAgentTeamPreviewItems = requiredAgentTeamPreviewItems
    .filter(([content, item]) => !content.includes(item))
    .map(([, item]) => item);
  if (missingAgentTeamPreviewItems.length === 0) {
    pass("agent-team-preview-only", "Agent team remains a V6.5 blueprint preview with no process start");
  } else {
    fail(
      "agent-team-preview-only",
      `Missing Agent team preview guard item(s): ${missingAgentTeamPreviewItems.join(" / ")}`,
      "Restore Agent team preview-only guards before claiming the V6.5 local production baseline.",
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
    "read-only",
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
if (notificationGateway) {
  const requiredNotificationPreviewItems = [
    "adapter-preview-only",
    "delivery_started: false",
    "only the email notification adapter is implemented",
    "notification delivery requires explicit approval",
  ];
  const missingNotificationPreviewItems = requiredNotificationPreviewItems.filter(
    (item) => !notificationGateway.includes(item),
  );
  if (missingNotificationPreviewItems.length === 0) {
    pass("feishu-wechat-preview-only", "Feishu and WeChat remain preview-only notification adapters");
  } else {
    fail(
      "feishu-wechat-preview-only",
      `Missing notification preview guard item(s): ${missingNotificationPreviewItems.join(" / ")}`,
      "Restore Feishu/WeChat preview-only guards before claiming the V6.5 local production baseline.",
    );
  }
}
if (localAppBridge && appShell) {
  const requiredLocalAppGuardItems = [
    [localAppBridge, "allow_state: \"blocked\".to_string()"],
    [localAppBridge, "argument_preview: vec![app.executable.clone()]"],
    [localAppBridge, "Command::new(&preview.app.executable)"],
    [localAppBridge, "stdin(Stdio::null())"],
    [localAppBridge, "no-user-supplied-executable"],
    [localAppBridge, "no-credential-or-session-extraction"],
    [localAppBridge, "no-window-content-reading"],
    [localAppBridge, "local app launch requires explicit approval"],
    [localAppBridge, "\"credentials_read\": false"],
    [localAppBridge, "\"window_content_read\": false"],
    [appShell, "window.confirm("],
    [appShell, "without arguments or session-data access"],
  ];
  const missingLocalAppGuardItems = requiredLocalAppGuardItems
    .filter(([content, item]) => !content.includes(item))
    .map(([, item]) => item);
  if (missingLocalAppGuardItems.length === 0) {
    pass("local-app-launch-guard", "Local App Bridge remains allowlisted, approval-gated, launch-only, and session-blind");
  } else {
    fail(
      "local-app-launch-guard",
      `Missing local app guard item(s): ${missingLocalAppGuardItems.join(" / ")}`,
      "Restore Local App Bridge launch-only guards before claiming the V6.5 local production baseline.",
    );
  }
}
if (browserAutomation && browserReadonlyScript) {
  const requiredBrowserGuardItems = [
    [browserAutomation, "exact-host-allowlist"],
    [browserAutomation, "http-get-navigation-only"],
    [browserAutomation, "no-click-or-form-submit"],
    [browserAutomation, "no-upload-or-download"],
    [browserAutomation, "no-credentials"],
    [browserAutomation, "redirect-host-revalidation"],
    [browserAutomation, "output-quarantine"],
    [browserAutomation, "browser inspection requires explicit approval"],
    [browserAutomation, "process_started: false"],
    [browserReadonlyScript, "accept_downloads=False"],
    [browserReadonlyScript, "service_workers=\"block\""],
    [browserReadonlyScript, "route.abort()"],
    [browserReadonlyScript, "redirected host is not allowlisted"],
  ];
  const missingBrowserGuardItems = requiredBrowserGuardItems
    .filter(([content, item]) => !content.includes(item))
    .map(([, item]) => item);
  if (missingBrowserGuardItems.length === 0) {
    pass("browser-readonly-guard", "Browser automation remains allowlisted, read-only, no-download, and quarantine-gated");
  } else {
    fail(
      "browser-readonly-guard",
      `Missing browser read-only guard item(s): ${missingBrowserGuardItems.join(" / ")}`,
      "Restore browser read-only and allowlist guards before claiming the V6.5 local production baseline.",
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
      "Restore Web App Shell preview-only boundaries before claiming V6.5 alignment.",
    );
  }
}
if (codebaseMemory && codebaseMemoryPanel) {
  const requiredCodebaseMemoryItems = [
    [codebaseMemory, "readonly-structural-preview"],
    [codebaseMemory, "codegraph-mcp-preview"],
    [codebaseMemory, "no-repository-wide-scan"],
    [codebaseMemory, "no-file-content-ingest"],
    [codebaseMemory, "no-command-execution"],
    [codebaseMemory, "no-automatic-l2-write"],
    [codebaseMemory, "review-before-zhishu-admission"],
    [codebaseMemory, "operator-approval-before-index-rebuild"],
    [codebaseMemory, "process_started: false"],
    [codebaseMemory, "repository_scanned: false"],
    [codebaseMemory, "file_content_ingested: false"],
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
      "Restore Codebase Memory read-only structural boundaries before claiming V6.5 alignment.",
    );
  }
}
if (permissionMemory && permissionMemoryPanel) {
  const requiredPermissionMemoryItems = [
    [permissionMemory, "candidate-preview-only"],
    [permissionMemory, "not-a-permanent-whitelist"],
    [permissionMemory, "scope-tool-level-pattern-required"],
    [permissionMemory, "expiry-and-revocation-required"],
    [permissionMemory, "audit-reference-required"],
    [permissionMemory, "high-risk-never-auto-reuse"],
    [permissionMemory, "no-policy-engine-auto-grant"],
    [permissionMemory, "cross-project"],
    [permissionMemory, "delete-move-cleanup"],
    [permissionMemory, "account-or-session-action"],
    [permissionMemory, "publish-or-submit"],
    [permissionMemory, "trade-or-financial-action"],
    [permissionMemory, "durable-zhishu-write"],
    [permissionMemory, "auto_grants_permissions: false"],
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
      "Restore Permission Memory candidate-only boundaries before claiming V6.5 alignment.",
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
      "Restore guarded runtime capability visibility before claiming the V6.5 local production baseline.",
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
      "Restore HTTP source quarantine and retrieval guards before claiming the V6.5 local production baseline.",
    );
  }
}
if (deviceSync && appShell) {
  const requiredDeviceSyncItems = [
    [deviceSync, "sha256-content-integrity"],
    [deviceSync, "base-hash-conflict-detection"],
    [deviceSync, "explicit-replace-for-nonempty-initial-import"],
    [deviceSync, "no-automatic-merge"],
    [deviceSync, "no-credentials-or-environment-data"],
    [deviceSync, "token-from-environment-only"],
    [deviceSync, "no-network-upload-in-this-stage"],
    [deviceSync, "network_started: false"],
    [deviceSync, "sync package requires explicit replace approval"],
    [appShell, "replace a non-empty local Zhishu repository"],
    [appShell, "no network upload started"],
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
      "Restore Device Sync local-first and relay dry-run guards before claiming the V6.5 local production baseline.",
    );
  }
}
if (computerDiagnostics) {
  const requiredDiagnosticsItems = [
    "no-process-launch",
    "no-file-deletion",
    "no-registry-write",
    "no-system-setting-change",
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
      "Restore read-only computer diagnostics guards before claiming the V6.5 local production baseline.",
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
      "Restore backup/recycle review and temporary recovery boundaries before claiming V6.5 alignment.",
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
      "Restore the read-only release evidence gate before claiming the V6.5 local production baseline.",
    );
  }
}
if (viteConfig) {
  const requiredViteBuildItems = ["rollupOptions", "input", "app: \"index.html\""];
  const missingViteBuildItems = requiredViteBuildItems.filter((item) => !viteConfig.includes(item));
  if (missingViteBuildItems.length === 0) {
    pass("vite-windows-html-entry", "Vite build uses a stable relative HTML entry for Windows release builds");
  } else {
    fail(
      "vite-windows-html-entry",
      `Missing Vite build item(s): ${missingViteBuildItems.join(" / ")}`,
      "Restore the relative Vite HTML entry before claiming the Windows production baseline.",
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
      "Restore store schema and migration guards before claiming the V6.5 local production baseline.",
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
    "Library home",
    "Production readiness",
    "Web App Shell",
    "Codebase Memory",
    "Permission Memory",
    "desktop",
    "mobile",
    "screenshotDir",
    "fullPage",
  ];
  const missingUiSmokeItems = requiredUiSmokeItems.filter((item) => !uiSmoke.includes(item));
  if (missingUiSmokeItems.length === 0) {
    pass("ui-smoke-production-anchors", "UI smoke protects Library Home and Production Readiness anchors with desktop/mobile screenshots");
  } else {
    fail(
      "ui-smoke-production-anchors",
      `Missing UI smoke anchor item(s): ${missingUiSmokeItems.join(" / ")}`,
      "Restore UI smoke anchors before claiming the V6.5 local production baseline.",
    );
  }
}
if (alignmentMatrix) {
  const requiredAlignmentItems = [
    "Local-first operation",
    "Safety Boundaries",
    "State Integrity",
    "Release Blockers",
    "Push metadata only",
    "Agent team blueprint preview",
    "Agent Harness safety gateway",
    "Secret-free release tree",
    "GitHub repository hygiene",
    "Local app launch-only bridge",
    "Browser read-only automation",
    "Web App Shell manual preview",
    "Codebase Memory structural adapter",
    "Permission Memory candidate preview",
    "HTTP source quarantine",
    "Device sync local-first relay preview",
    "Computer diagnostics read-only",
    "System Profile Reader context snapshot",
    "Context Budget evidence preservation",
    "Store schema migration guard",
    "Library Home recoverability policy",
    "UI smoke production anchors",
    "CI evidence artifacts",
    "Machine-readable release status",
    "Read-only release doctor",
    "In-app release evidence gate",
    "GitHub-facing documentation boundary",
    "npm.cmd run preflight:static",
    "npm.cmd run release:evidence",
    "npm.cmd run release:status -- --json",
    "npm.cmd run release:doctor",
  ];
  const missingAlignmentItems = requiredAlignmentItems.filter(
    (item) => !alignmentMatrix.includes(item),
  );
  if (missingAlignmentItems.length === 0) {
    pass("v65-alignment-matrix", "V6.5 alignment matrix covers core evidence areas");
  } else {
    fail(
      "v65-alignment-matrix",
      `Missing V6.5 alignment item(s): ${missingAlignmentItems.join(" / ")}`,
      "Restore V65_ALIGNMENT_MATRIX.md before claiming V6.5 baseline alignment.",
    );
  }
}

if (releaseMode) {
  checkGitRepository();
  checkWindowsMsiTooling();
}

if (staticOnly) {
  pass("static-mode", "Skipped build commands; static V6.5 gates only");
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
      ? `\n${releaseMode ? "Release" : "Static production"} preflight passed for the V6.5 local-first baseline.`
      : "\nProduction preflight passed for the V6.5 local-first baseline.",
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
