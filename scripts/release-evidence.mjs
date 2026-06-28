import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, ".tmp", "release-evidence");
const PUBLIC_VERSION = "0.0.0";
const INTERNAL_DESIGN_VERSION = "V6.6";
const PUBLIC_BASELINE_NAME = `Synapse ${PUBLIC_VERSION} Public Baseline`;
const INTERNAL_DESIGN_ALIGNMENT = `Synapse Design ${INTERNAL_DESIGN_VERSION}`;

async function main() {
  await mkdir(outputDir, { recursive: true });

  const packageJson = JSON.parse(await readText("package.json"));
  const tauriConfig = JSON.parse(await readText("src-tauri/tauri.conf.json"));
  const releasePreflight = runPreflight(["--static", "--release", "--json"]);
  const staticPreflight = runPreflight(["--static", "--json"]);
  const gitBootstrap = runDiagnostic("git-bootstrap", ["scripts/git-bootstrap.mjs"]);
  const wixDiagnose = runDiagnostic("wix-diagnose", ["scripts/wix-diagnose.mjs"]);
  const msiArtifacts = await findMsiArtifacts(packageJson.version);
  const uiSmokeArtifacts = await findUiSmokeArtifacts();
  const generatedAt = new Date().toISOString();
  const releaseReview = buildReleaseReview(releasePreflight, msiArtifacts);

  const evidence = {
    schema_version: 1,
    generated_at: generatedAt,
    project: {
      name: packageJson.name,
      version: packageJson.version,
      tauri_identifier: tauriConfig.identifier,
      bundle_targets: tauriConfig.bundle?.targets ?? [],
    },
    public_baseline: {
      external_delivery_default: "disabled",
      agent_execution_default: "disabled",
      relay_upload_default: "disabled",
      claim_boundary: `${PUBLIC_BASELINE_NAME} aligned with ${INTERNAL_DESIGN_ALIGNMENT}`,
    },
    preflight: {
      static: staticPreflight,
      release: releasePreflight,
    },
    release_review: releaseReview,
    diagnostics: {
      git_bootstrap: gitBootstrap,
      wix: wixDiagnose,
    },
    artifacts: {
      msi: msiArtifacts,
      ui_smoke: uiSmokeArtifacts,
    },
  };

  const jsonPath = path.join(outputDir, "release-evidence.json");
  const mdPath = path.join(outputDir, "release-evidence.md");
  const summaryPath = path.join(outputDir, "release-summary.md");
  await writeFile(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(mdPath, renderMarkdown(evidence), "utf8");
  await writeFile(summaryPath, renderReleaseSummary(evidence), "utf8");

  console.log(`Release evidence written: ${jsonPath}`);
  console.log(`Release evidence summary: ${mdPath}`);
  console.log(`Release review summary: ${summaryPath}`);
  if (releasePreflight.state !== "passed") {
    process.exitCode = 1;
  }
}

function buildReleaseReview(releasePreflight, msiArtifacts) {
  const blockers = releasePreflight.checks
    .filter((check) => check.state === "fail")
    .map((check) => ({
      id: check.id,
      detail: check.detail,
      remediation: check.remediation ?? null,
    }));
  const releaseArtifacts = msiArtifacts.filter(
    (artifact) => artifact.profile === "release" && artifact.version_matches,
  );
  const debugArtifacts = msiArtifacts.filter((artifact) => artifact.profile === "debug");
  if (!releaseArtifacts.some((artifact) => artifact.distributable)) {
    blockers.push({
      id: "release-msi-current-version",
      detail: "No distributable release MSI matching the current public version was found.",
      remediation:
        "Build the release MSI after version changes, then rerun npm.cmd run release:evidence.",
    });
  }
  return {
    state: blockers.length === 0 ? "ready-for-release-review" : "blocked-before-release",
    ready: blockers.length === 0,
    blockers,
    artifact_readiness: {
      release_msi_count: releaseArtifacts.length,
      debug_msi_count: debugArtifacts.length,
      has_distributable_msi: releaseArtifacts.some((artifact) => artifact.distributable),
      debug_msi_distributable: debugArtifacts.some((artifact) => artifact.distributable),
    },
  };
}

async function readText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function runPreflight(args) {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", "production-preflight.mjs"), ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
    windowsHide: true,
  });
  const output = result.stdout.trim();
  try {
    return {
      exit_code: result.status ?? 1,
      ...JSON.parse(output),
    };
  } catch {
    return {
      exit_code: result.status ?? 1,
      state: "failed",
      failed_count: 1,
      checks: [
        {
          id: "preflight-json",
          state: "fail",
          detail: output || result.stderr.trim() || "preflight did not return JSON",
          remediation: "Run production-preflight.mjs directly and inspect its output.",
        },
      ],
    };
  }
}

function runDiagnostic(id, args) {
  const result = spawnSync(process.execPath, args.map((arg) => path.join(root, arg)), {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
    windowsHide: true,
  });
  return {
    id,
    exit_code: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

async function findMsiArtifacts(expectedVersion) {
  const roots = [
    {
      profile: "release",
      directory: path.join(root, "src-tauri", "target", "release", "bundle", "msi"),
      distributable: true,
    },
    {
      profile: "debug",
      directory: path.join(root, "src-tauri", "target", "debug", "bundle", "msi"),
      distributable: false,
    },
  ];
  const artifacts = [];
  for (const { profile, directory, distributable } of roots) {
    if (!existsSync(directory)) {
      continue;
    }
    for (const file of await readdir(directory)) {
      if (!file.toLowerCase().endsWith(".msi")) {
        continue;
      }
      const absolutePath = path.join(directory, file);
      const metadata = await stat(absolutePath);
      const buffer = await readFile(absolutePath);
      const versionMatches = file.includes(`_${expectedVersion}_`);
      artifacts.push({
        path: path.relative(root, absolutePath).replaceAll("\\", "/"),
        profile,
        version_matches: versionMatches,
        distributable: distributable && versionMatches,
        bytes: metadata.size,
        sha256: createHash("sha256").update(buffer).digest("hex"),
      });
    }
  }
  return artifacts;
}

async function findUiSmokeArtifacts() {
  const directory = path.join(root, ".tmp", "ui-smoke");
  if (!existsSync(directory)) {
    return [];
  }
  const artifacts = [];
  for (const file of await readdir(directory)) {
    if (!file.toLowerCase().endsWith(".png")) {
      continue;
    }
    const absolutePath = path.join(directory, file);
    const metadata = await stat(absolutePath);
    const buffer = await readFile(absolutePath);
    artifacts.push({
      path: path.relative(root, absolutePath).replaceAll("\\", "/"),
      bytes: metadata.size,
      sha256: createHash("sha256").update(buffer).digest("hex"),
    });
  }
  return artifacts;
}

function renderMarkdown(evidence) {
  const releaseFailures = evidence.preflight.release.checks.filter((check) => check.state === "fail");
  const staticFailures = evidence.preflight.static.checks.filter((check) => check.state === "fail");
  const artifactLines =
    evidence.artifacts.msi.length === 0
      ? ["- No MSI artifacts were found under `src-tauri/target/**/bundle/msi/`."]
      : evidence.artifacts.msi.map(
          (artifact) => {
            const artifactState = artifact.distributable
              ? "distributable candidate"
              : artifact.version_matches
                ? "debug-only rehearsal artifact"
                : "version-mismatch artifact";
            return `- \`${artifact.path}\` (${artifact.profile}, ${artifactState}, ${artifact.bytes} bytes), SHA-256: \`${artifact.sha256}\``;
          },
        );
  const screenshotLines =
    evidence.artifacts.ui_smoke.length === 0
      ? ["- No UI smoke screenshots were found under `.tmp/ui-smoke/`."]
      : evidence.artifacts.ui_smoke.map(
          (artifact) => `- \`${artifact.path}\` (${artifact.bytes} bytes), SHA-256: \`${artifact.sha256}\``,
        );
  const documentationChecks = [
    "public-release-checklist",
    "release-distribution-notes",
    "readme-release-boundary",
    "public-capability-matrix",
  ]
    .map((id) => evidence.preflight.static.checks.find((check) => check.id === id))
    .filter(Boolean);
  const documentationLines =
    documentationChecks.length === 0
      ? ["- Documentation boundary checks were not reported by static preflight."]
      : documentationChecks.map((check) => `- ${check.id}: ${check.state} - ${check.detail}`);
  return `# Synapse Release Evidence

Generated: ${evidence.generated_at}
Schema version: ${evidence.schema_version}

## Project

- Name: ${evidence.project.name}
- Version: ${evidence.project.version}
- Tauri identifier: ${evidence.project.tauri_identifier}
- Bundle targets: ${evidence.project.bundle_targets.join(", ") || "none"}
- Baseline: ${evidence.public_baseline.claim_boundary}

## Preflight

- Static preflight: ${evidence.preflight.static.state} (${staticFailures.length} failure(s))
- Release preflight: ${evidence.preflight.release.state} (${releaseFailures.length} failure(s))

## Documentation Boundary

${documentationLines.join("\n")}

## Release Blockers

${
  releaseFailures.length === 0
    ? "- None reported by release preflight."
    : releaseFailures
        .map((check) => `- ${check.id}: ${check.detail}${check.remediation ? `\n  Fix: ${check.remediation}` : ""}`)
        .join("\n")
}

## Local Diagnostics

### Git Bootstrap

- Exit code: ${evidence.diagnostics.git_bootstrap.exit_code}

\`\`\`text
${evidence.diagnostics.git_bootstrap.stdout || evidence.diagnostics.git_bootstrap.stderr || "No output."}
\`\`\`

### WiX Diagnosis

- Exit code: ${evidence.diagnostics.wix.exit_code}

\`\`\`text
${evidence.diagnostics.wix.stdout || evidence.diagnostics.wix.stderr || "No output."}
\`\`\`

## MSI Artifacts

${artifactLines.join("\n")}

## UI Smoke Screenshots

${screenshotLines.join("\n")}

## Public Baseline Claim Boundary

- External delivery default: ${evidence.public_baseline.external_delivery_default}
- Agent execution default: ${evidence.public_baseline.agent_execution_default}
- Relay upload default: ${evidence.public_baseline.relay_upload_default}
- Do not claim unrestricted automation, real Agent teams, automatic Feishu/WeChat delivery, browser write automation, automatic cleanup, or automatic L2 writes for this baseline.
`;
}

function renderReleaseSummary(evidence) {
  const releaseFailures = evidence.release_review.blockers;
  const releaseMsiArtifacts = evidence.artifacts.msi.filter(
    (artifact) => artifact.profile === "release" && artifact.version_matches,
  );
  const debugMsiArtifacts = evidence.artifacts.msi.filter((artifact) => artifact.profile === "debug");
  const blockerLines =
    releaseFailures.length === 0
      ? ["- None reported by release preflight."]
      : releaseFailures.map((blocker) => `- ${blocker.id}: ${blocker.detail}`);
  const nextActionLines =
    releaseFailures.length === 0
      ? [
          "- Build the release MSI on the release machine.",
          "- Sign and timestamp the MSI outside the repository.",
          "- Publish the SHA-256 hash with the release notes.",
        ]
      : releaseFailures.map((blocker) => `- ${blocker.remediation ?? `Resolve ${blocker.id}.`}`);
  const artifactLines = [
    releaseMsiArtifacts.length === 0
      ? "- No release MSI artifact is present yet."
      : `- Release MSI artifact(s): ${releaseMsiArtifacts.map((artifact) => `\`${artifact.path}\``).join(", ")}`,
    debugMsiArtifacts.length === 0
      ? "- No debug MSI rehearsal artifact is present."
      : `- Debug MSI rehearsal artifact(s): ${debugMsiArtifacts.map((artifact) => `\`${artifact.path}\``).join(", ")}. Do not distribute these as a formal release.`,
  ];
  return `# ${PUBLIC_BASELINE_NAME} Release Review Summary

Generated: ${evidence.generated_at}
Schema version: ${evidence.schema_version}

## State

- ${evidence.release_review.state}
- Static preflight: ${evidence.preflight.static.state}
- Release preflight: ${evidence.preflight.release.state}
- Baseline: ${evidence.public_baseline.claim_boundary}

## Current Release Blockers

${blockerLines.join("\n")}

## Artifact Readiness

${artifactLines.join("\n")}

## Safe Public Claim

Synapse ${PUBLIC_VERSION} is a guarded local-first public baseline aligned with
internal ${INTERNAL_DESIGN_ALIGNMENT}. External delivery, direct Agent
execution, and relay upload are disabled by default. The current evidence
supports local guarded review, preview-only Agent teams, preview-only
Feishu/WeChat adapters, read-only browser automation, local package device sync,
and explicit review before risky local changes.

## Do Not Claim

- Unrestricted automation.
- One-click real Agent team execution.
- Automatic Feishu or WeChat delivery.
- Browser write automation or arbitrary scripts.
- Automatic cleanup, deletion, or system maintenance.
- Automatic L2 memory writes without explicit review.
- Cloud synchronization as a source of truth.

## Required Next Actions

${nextActionLines.join("\n")}
`;
}

main().catch((error) => {
  console.error(`[FAIL] release-evidence: ${error.message}`);
  process.exit(1);
});
