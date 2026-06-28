import { existsSync, readFileSync, statSync } from "node:fs";
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
  "docs/ARCHITECTURE_OVERVIEW.md",
  "docs/CAPABILITY_MATRIX.md",
  "docs/CONFIG_CAPABILITY_MATRIX.md",
  "docs/CLAIM_BOUNDARIES.md",
  "docs/PUBLIC_BASELINE_STATUS.md",
  "docs/PUBLIC_ROADMAP.md",
  "docs/RELEASE_CHECKLIST.md",
  "docs/RELEASE_DISTRIBUTION_NOTES.md",
  "docs/SOURCE_REGISTRY.md",
  ".github/workflows/v65-local-baseline.yml",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/ISSUE_TEMPLATE/security_boundary.yml",
  ".github/pull_request_template.md",
  "scripts/production-preflight.mjs",
  "scripts/release-evidence.mjs",
  "scripts/release-status.mjs",
  "scripts/release-doctor.mjs",
  "scripts/git-diagnose.mjs",
  "scripts/wix-diagnose.mjs",
  "scripts/ui-smoke.mjs",
  "src/App.tsx",
  "src/App.css",
  "src-tauri/Cargo.toml",
  "src-tauri/Cargo.lock",
  "src-tauri/tauri.conf.json",
  "src-tauri/src/domains/agent_harness.rs",
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
  ".tmp/ui-smoke/desktop.png",
  ".tmp/ui-smoke/mobile.png",
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
line(
  `[ARTIFACTS] release_msi=${artifact.release_msi_count ?? "unknown"} debug_msi=${
    artifact.debug_msi_count ?? "unknown"
  } distributable=${artifact.has_distributable_msi ? "true" : "false"}`,
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

line("[PASS] Release evidence reports no blockers.");

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
  return freshnessInputs.filter((relativePath) => {
    const absolutePath = join(root, relativePath);
    if (!existsSync(absolutePath)) {
      return false;
    }
    return statSync(absolutePath).mtimeMs > evidenceTimestamp + toleranceMs;
  });
}
