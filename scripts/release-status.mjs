import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const evidenceRelativePath = ".tmp/release-evidence/release-evidence.json";
const evidencePath = join(root, ".tmp", "release-evidence", "release-evidence.json");
const jsonOutput = process.argv.includes("--json");
const freshnessInputs = [
  "package.json",
  "package-lock.json",
  ".gitattributes",
  "synapse.config.toml",
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "VERSIONING.md",
  "CONTRIBUTING.md",
  "CHANGELOG.md",
  "docs/ARCHITECTURE_OVERVIEW.md",
  "docs/CAPABILITY_MATRIX.md",
  "docs/CONFIG_CAPABILITY_MATRIX.md",
  "docs/CLAIM_BOUNDARIES.md",
  "docs/DEVELOPMENT.md",
  "docs/INSTALLATION.md",
  "docs/LOCAL_DATA_AND_PRIVACY.md",
  "docs/PUBLIC_BASELINE_STATUS.md",
  "docs/PUBLIC_ROADMAP.md",
  "docs/RELEASE_CHECKLIST.md",
  "docs/RELEASE_DISTRIBUTION_NOTES.md",
  "docs/SOURCE_REGISTRY.md",
  ".github/workflows/public-baseline.yml",
  ".github/workflows/manual-release.yml",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/documentation_fix.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/ISSUE_TEMPLATE/security_boundary.yml",
  ".github/pull_request_template.md",
  "scripts/production-preflight.mjs",
  "scripts/release-evidence.mjs",
  "scripts/release-status.mjs",
  "scripts/release-doctor.mjs",
  "scripts/release-acceptance.mjs",
  "scripts/installer-smoke.ps1",
  "scripts/git-diagnose.mjs",
  "scripts/wix-diagnose.mjs",
  "scripts/ui-smoke.mjs",
  "scripts/ui-smoke-tauri-mock.js",
  "src/App.tsx",
  "src/App.css",
  "src/app/useNotificationGateway.ts",
  "src-tauri/Cargo.toml",
  "src-tauri/Cargo.lock",
  "src-tauri/tauri.conf.json",
  "src-tauri/src/lib.rs",
  "src-tauri/src/domains/agent_harness.rs",
  "src-tauri/src/domains/notification_gateway.rs",
  "src-tauri/src/domains/context_budget.rs",
  "src-tauri/src/domains/library_home.rs",
  "src-tauri/src/domains/computer_diagnostics.rs",
  "src-tauri/src/domains/web_app_shell.rs",
  "src-tauri/src/domains/codebase_memory.rs",
  "src-tauri/src/domains/permission_memory.rs",
  "src-tauri/src/domains/production_readiness.rs",
  "src-tauri/src/services/system.rs",
  "src/components/ContextBudgetPanel.tsx",
  "src/components/LibraryHomePanel.tsx",
  "src/components/ComputerDiagnosticsPanel.tsx",
  "src/components/WebAppShellPanel.tsx",
  "src/components/CodebaseMemoryPanel.tsx",
  "src/components/PermissionMemoryPanel.tsx",
  "src/components/NotificationGatewayPanel.tsx",
  "src/i18n/localizeText.ts",
  ".tmp/ui-smoke/desktop.png",
  ".tmp/ui-smoke/mobile.png",
];
const freshnessInputDirectories = [
  "src",
  "src-tauri/src",
  "src-tauri/scripts",
  "scripts",
  "docs",
  ".github/workflows",
];

function line(message) {
  console.log(message);
}

function fail(message, next) {
  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          state: "failed",
          ready: false,
          error: message,
          next: next ?? null,
          evidence_path: evidenceRelativePath,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
  line("Synapse release status");
  line(`Project: ${root}`);
  line(`[FAIL] ${message}`);
  if (next) {
    line(`[NEXT] ${next}`);
  }
  process.exit(1);
}

let evidence;
try {
  evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
} catch (error) {
  fail(
    `Unable to read release evidence: ${error.message}`,
    "Run npm.cmd run release:evidence first, then rerun npm.cmd run release:status.",
  );
}

const review = evidence.release_review;
if (evidence.schema_version !== 1) {
  fail(
    `Unsupported release evidence schema_version: ${evidence.schema_version ?? "missing"}.`,
    "Regenerate evidence with this version of npm.cmd run release:evidence.",
  );
}
if (!review) {
  fail(
    "release_review is missing from release evidence.",
    "Regenerate evidence with npm.cmd run release:evidence.",
  );
}
const staleInputs = findStaleInputs(evidence.generated_at);

if (jsonOutput) {
  console.log(
    JSON.stringify(
      {
        state: review.state,
        ready: Boolean(review.ready),
        schema_version: evidence.schema_version,
        generated_at: evidence.generated_at ?? null,
        evidence_path: evidenceRelativePath,
        stale: staleInputs.length > 0,
        stale_inputs: staleInputs,
        blockers: review.blockers ?? [],
        artifact_readiness: review.artifact_readiness ?? {},
      },
      null,
      2,
    ),
  );
  process.exit(review.ready && staleInputs.length === 0 ? 0 : 1);
}

line("Synapse release status");
line(`Project: ${root}`);
line(`[STATE] ${review.state}`);
line(`[READY] ${review.ready ? "true" : "false"}`);
line(`[DISTRIBUTION] ${review.distribution_tier ?? "unknown"}`);
line(`[SCHEMA] ${evidence.schema_version}`);
line(`[GENERATED] ${evidence.generated_at ?? "unknown"}`);
if (staleInputs.length > 0) {
  line("[STALE] Release evidence is older than release-relevant input file(s).");
  for (const input of staleInputs) {
    line(`[STALE-INPUT] ${input}`);
  }
  line("[NEXT] Run npm.cmd run release:evidence before using this release status.");
}

const artifact = review.artifact_readiness ?? {};
const hasDistributableInstaller = Boolean(
  artifact.has_distributable_installer ?? artifact.has_distributable_msi,
);
line(
  `[ARTIFACTS] release_installer=${artifact.release_installer_count ?? artifact.release_msi_count ?? "unknown"} debug_installer=${
    artifact.debug_installer_count ?? artifact.debug_msi_count ?? "unknown"
  } nsis=${artifact.release_nsis_count ?? "unknown"} msi=${artifact.release_msi_count ?? "unknown"} distributable=${
    hasDistributableInstaller ? "true" : "false"
  } installer_smoke=${artifact.installer_smoke_verified ? "true" : "false"}`,
);
line(
  `[SIGNING] mode=${artifact.signing_mode ?? "unknown"} unsigned_preview_allowed=${
    artifact.unsigned_preview_allowed ? "true" : "false"
  } signed_installer=${artifact.signed_installer_count ?? "unknown"} all_release_installers_signed=${
    artifact.all_release_installers_signed ? "true" : "false"
  }`,
);

if (review.blockers?.length) {
  for (const blocker of review.blockers) {
    line(`[BLOCKER] ${blocker.id}: ${blocker.detail}`);
    if (blocker.remediation) {
      line(`[FIX] ${blocker.remediation}`);
    }
  }
  process.exit(1);
}

if (staleInputs.length > 0) {
  process.exit(1);
}

if (review.distribution_tier === "unsigned-preview-review") {
  line("[PASS] Release evidence permits an explicit unsigned preview only; it is not signed production distribution.");
} else {
  line("[PASS] Release evidence reports no blockers.");
}

function findStaleInputs(generatedAt) {
  let evidenceTimestamp = Date.parse(generatedAt ?? "");
  try {
    if (!Number.isFinite(evidenceTimestamp)) {
      evidenceTimestamp = statSync(evidencePath).mtimeMs;
    }
  } catch {
    return freshnessInputs;
  }
  const toleranceMs = 1000;
  const inputs = [
    ...new Set(
      [...freshnessInputs, ...collectFreshnessInputFiles()].map((relativePath) =>
        relativePath.replaceAll("\\", "/"),
      ),
    ),
  ];
  return inputs.filter((relativePath) => {
    const absolutePath = join(root, relativePath);
    if (!existsSync(absolutePath)) {
      return false;
    }
    return statSync(absolutePath).mtimeMs > evidenceTimestamp + toleranceMs;
  });
}

function collectFreshnessInputFiles() {
  return freshnessInputDirectories.flatMap((relativeDirectory) =>
    collectFilesRecursively(relativeDirectory),
  );
}

function collectFilesRecursively(relativeDirectory) {
  const absoluteDirectory = join(root, relativeDirectory);
  if (!existsSync(absoluteDirectory)) {
    return [];
  }
  const files = [];
  for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const relativePath = join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFilesRecursively(relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}
