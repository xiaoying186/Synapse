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
const installerBuildInputFiles = [
  "index.html",
  "package.json",
  "package-lock.json",
  "vite.config.ts",
  "src-tauri/Cargo.toml",
  "src-tauri/Cargo.lock",
  "src-tauri/tauri.conf.json",
  "src-tauri/build.rs",
];
const installerBuildInputDirectories = ["src", "src-tauri/src", "src-tauri/scripts", "src-tauri/capabilities"];
const signingPolicy = {
  mode: process.env.SYNAPSE_SIGNING_MODE || "signed",
  unsigned_preview_allowed: process.env.SYNAPSE_ALLOW_UNSIGNED === "true",
};

async function main() {
  await mkdir(outputDir, { recursive: true });

  const packageJson = JSON.parse(await readText("package.json"));
  const tauriConfig = JSON.parse(await readText("src-tauri/tauri.conf.json"));
  const releasePreflight = runPreflight(["--static", "--release", "--json"]);
  const staticPreflight = runPreflight(["--static", "--json"]);
  const gitBootstrap = runDiagnostic("git-bootstrap", ["scripts/git-bootstrap.mjs"]);
  const wixDiagnose = runDiagnostic("wix-diagnose", ["scripts/wix-diagnose.mjs"]);
  const installerArtifacts = await findInstallerArtifacts(packageJson.version);
  const installerBuildFreshness = await findInstallerBuildFreshness(installerArtifacts);
  const uiSmokeArtifacts = await findUiSmokeArtifacts();
  const installerSmokeEvidence = await readInstallerSmokeEvidence();
  const generatedAt = new Date().toISOString();
  const releaseReview = buildReleaseReview(
    releasePreflight,
    installerArtifacts,
    installerBuildFreshness,
    installerSmokeEvidence,
    signingPolicy,
  );

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
      notification_staging: {
        feishu_wechat_delivery: "signed-loopback-staging-delivery",
        real_webhook_delivery: "disabled-by-default",
        staging_endpoint_scope: "http-loopback-staging-only",
        audit_evidence: "policy-and-envelope-without-secrets",
      },
      release_signing: signingPolicy,
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
      installers: installerArtifacts,
      msi: installerArtifacts.filter((artifact) => artifact.kind === "msi"),
      installer_build_freshness: installerBuildFreshness,
      ui_smoke: uiSmokeArtifacts,
      installer_smoke: installerSmokeEvidence,
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

function buildReleaseReview(
  releasePreflight,
  installerArtifacts,
  installerBuildFreshness,
  installerSmokeEvidence,
  signingPolicy,
) {
  const blockers = releasePreflight.checks
    .filter((check) => check.state === "fail")
    .map((check) => ({
      id: check.id,
      detail: check.detail,
      remediation: check.remediation ?? null,
    }));
  const releaseArtifacts = installerArtifacts.filter(
    (artifact) => artifact.profile === "release" && artifact.version_matches,
  );
  const debugArtifacts = installerArtifacts.filter((artifact) => artifact.profile === "debug");
  if (!releaseArtifacts.some((artifact) => artifact.distributable)) {
    blockers.push({
      id: "release-installer-current-version",
      detail: "No distributable release installer matching the current public version was found.",
      remediation:
        "Build the release NSIS/MSI installer after version changes, then rerun npm.cmd run release:evidence.",
    });
  }
  if (!installerBuildFreshness.fresh) {
    blockers.push({
      id: "release-installer-stale",
      detail: `Release installer artifacts are older than build input(s): ${installerBuildFreshness.stale_inputs.join(", ")}.`,
      remediation:
        "Rebuild every release installer after source changes, regenerate SHA-256 files, rerun installer smoke, then regenerate release evidence.",
    });
  }
  if (!installerSmokeEvidence?.uninstall_verified) {
    blockers.push({
      id: "installer-smoke-evidence-missing",
      detail: "No verified installer smoke evidence was found.",
      remediation:
        "Run npm.cmd run release:smoke:installer after building the installer, then rerun npm.cmd run release:evidence.",
    });
  } else if (!installerSmokeEvidence.main_window_detected) {
    blockers.push({
      id: "installer-smoke-window-evidence-missing",
      detail: "Installer smoke evidence did not verify that Synapse created a main window.",
      remediation:
        "Run the current npm.cmd run release:smoke:installer after building the installer, then rerun npm.cmd run release:evidence.",
      });
  }
  if (!installerSmokeEvidence?.window_nonblank_verified || !installerSmokeEvidence?.window_screenshot_present) {
    blockers.push({
      id: "installer-smoke-visual-evidence-missing",
      detail: "Installer smoke evidence did not verify a nonblank packaged application window screenshot.",
      remediation:
        "Run the current npm.cmd run release:smoke:installer in an interactive Windows session, then rerun npm.cmd run release:evidence.",
    });
  }
  if (!installerSmokeEvidence?.runtime_config_template_created) {
    blockers.push({
      id: "installer-smoke-runtime-config-evidence-missing",
      detail: "Installer smoke evidence did not verify AppData runtime configuration creation.",
      remediation:
        "Run npm.cmd run release:smoke:installer with the current packaged app, then rerun npm.cmd run release:evidence.",
    });
  }
  const signedReleaseArtifacts = releaseArtifacts.filter((artifact) => artifact.signature_status === "Valid");
  if (signingPolicy.mode === "signed") {
    if (process.platform !== "win32") {
      blockers.push({
        id: "installer-signature-verification-unavailable",
        detail: "Signed release readiness requires Windows Authenticode verification.",
        remediation:
          "Run release evidence on Windows after signing installers, or use unsigned-preview only for explicit preview releases.",
      });
    } else if (signedReleaseArtifacts.length !== releaseArtifacts.length || releaseArtifacts.length === 0) {
      blockers.push({
        id: "installer-signature-invalid",
        detail:
          "Signed release mode requires every distributable release installer to have a valid Authenticode signature.",
        remediation:
          "Configure WINDOWS_SIGNING_CERT_BASE64 and WINDOWS_SIGNING_CERT_PASSWORD in the manual release workflow, sign the installers, then rerun release evidence.",
      });
    }
  } else if (signingPolicy.mode === "unsigned-preview") {
    if (!signingPolicy.unsigned_preview_allowed) {
      blockers.push({
        id: "unsigned-preview-not-explicitly-allowed",
        detail: "Unsigned preview mode requires SYNAPSE_ALLOW_UNSIGNED=true.",
        remediation:
          "Set SYNAPSE_ALLOW_UNSIGNED=true only for an intentional unsigned preview release, or sign installers for production release.",
      });
    }
  } else {
    blockers.push({
      id: "unsupported-signing-mode",
      detail: `Unsupported signing mode: ${signingPolicy.mode}.`,
      remediation: "Use SYNAPSE_SIGNING_MODE=signed or SYNAPSE_SIGNING_MODE=unsigned-preview.",
    });
  }
  const ready = blockers.length === 0;
  const signedProductionReady =
    signingPolicy.mode === "signed" &&
    releaseArtifacts.length > 0 &&
    signedReleaseArtifacts.length === releaseArtifacts.length;
  const distributionTier = signedProductionReady
    ? "signed-production-review"
    : "unsigned-preview-review";
  return {
    state: ready
      ? signedProductionReady
        ? "ready-for-signed-production-review"
        : "ready-for-unsigned-preview-review"
      : "blocked-before-release",
    ready,
    distribution_tier: distributionTier,
    blockers,
    artifact_readiness: {
      release_installer_count: releaseArtifacts.length,
      debug_installer_count: debugArtifacts.length,
      release_msi_count: releaseArtifacts.filter((artifact) => artifact.kind === "msi").length,
      release_nsis_count: releaseArtifacts.filter((artifact) => artifact.kind === "nsis").length,
      debug_msi_count: debugArtifacts.filter((artifact) => artifact.kind === "msi").length,
      debug_nsis_count: debugArtifacts.filter((artifact) => artifact.kind === "nsis").length,
      has_distributable_installer: releaseArtifacts.some((artifact) => artifact.distributable),
      has_distributable_msi: releaseArtifacts.some((artifact) => artifact.kind === "msi" && artifact.distributable),
      has_distributable_nsis: releaseArtifacts.some((artifact) => artifact.kind === "nsis" && artifact.distributable),
      debug_installer_distributable: debugArtifacts.some((artifact) => artifact.distributable),
      debug_msi_distributable: debugArtifacts.some((artifact) => artifact.kind === "msi" && artifact.distributable),
      installer_smoke_verified: Boolean(installerSmokeEvidence?.uninstall_verified),
      installer_build_fresh: installerBuildFreshness.fresh,
      installer_visual_smoke_verified:
        Boolean(installerSmokeEvidence?.window_nonblank_verified) &&
        Boolean(installerSmokeEvidence?.window_screenshot_present),
      signing_mode: signingPolicy.mode,
      unsigned_preview_allowed: signingPolicy.unsigned_preview_allowed,
      signed_installer_count: signedReleaseArtifacts.length,
      all_release_installers_signed:
        releaseArtifacts.length > 0 && signedReleaseArtifacts.length === releaseArtifacts.length,
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

async function findInstallerArtifacts(expectedVersion) {
  const roots = [
    {
      profile: "release",
      directory: path.join(root, "src-tauri", "target", "release", "bundle", "msi"),
      kind: "msi",
      distributable: true,
    },
    {
      profile: "release",
      directory: path.join(root, "src-tauri", "target", "release", "bundle", "nsis"),
      kind: "nsis",
      distributable: true,
    },
    {
      profile: "debug",
      directory: path.join(root, "src-tauri", "target", "debug", "bundle", "msi"),
      kind: "msi",
      distributable: false,
    },
    {
      profile: "debug",
      directory: path.join(root, "src-tauri", "target", "debug", "bundle", "nsis"),
      kind: "nsis",
      distributable: false,
    },
  ];
  const artifacts = [];
  for (const { profile, directory, kind, distributable } of roots) {
    if (!existsSync(directory)) {
      continue;
    }
    for (const file of await readdir(directory)) {
      const extension = path.extname(file).toLowerCase();
      if (![".msi", ".exe"].includes(extension)) {
        continue;
      }
      const absolutePath = path.join(directory, file);
      const metadata = await stat(absolutePath);
      const buffer = await readFile(absolutePath);
      const versionMatches = file.includes(`_${expectedVersion}_`);
      const shaSidecarPath = `${absolutePath}.sha256`;
      const shaSidecarPresent = existsSync(shaSidecarPath);
      artifacts.push({
        path: path.relative(root, absolutePath).replaceAll("\\", "/"),
        kind,
        profile,
        version_matches: versionMatches,
        sha256_sidecar_present: shaSidecarPresent,
        distributable: distributable && versionMatches && shaSidecarPresent,
        signature_status: inspectInstallerSignature(absolutePath),
        bytes: metadata.size,
        modified_at: metadata.mtime.toISOString(),
        modified_at_ms: metadata.mtimeMs,
        sha256: createHash("sha256").update(buffer).digest("hex"),
      });
    }
  }
  return artifacts;
}

async function findInstallerBuildFreshness(installerArtifacts) {
  const releaseArtifacts = installerArtifacts.filter(
    (artifact) => artifact.profile === "release" && artifact.version_matches && artifact.distributable,
  );
  if (releaseArtifacts.length === 0) {
    return {
      fresh: false,
      newest_source_input_at: null,
      oldest_release_installer_at: null,
      stale_inputs: ["release installer artifact missing"],
    };
  }

  const oldestReleaseInstallerMs = Math.min(...releaseArtifacts.map((artifact) => artifact.modified_at_ms));
  const buildInputs = [
    ...installerBuildInputFiles,
    ...(await Promise.all(installerBuildInputDirectories.map(collectInstallerBuildFiles))).flat(),
  ];
  const staleInputs = [];
  let newestSourceInputMs = 0;
  for (const relativePath of new Set(buildInputs)) {
    const absolutePath = path.join(root, relativePath);
    if (!existsSync(absolutePath)) {
      continue;
    }
    const metadata = await stat(absolutePath);
    newestSourceInputMs = Math.max(newestSourceInputMs, metadata.mtimeMs);
    if (metadata.mtimeMs > oldestReleaseInstallerMs + 1000) {
      staleInputs.push(relativePath.replaceAll("\\", "/"));
    }
  }
  return {
    fresh: staleInputs.length === 0,
    newest_source_input_at: newestSourceInputMs ? new Date(newestSourceInputMs).toISOString() : null,
    oldest_release_installer_at: new Date(oldestReleaseInstallerMs).toISOString(),
    stale_inputs: staleInputs.sort(),
  };
}

async function collectInstallerBuildFiles(relativeDirectory) {
  const absoluteDirectory = path.join(root, relativeDirectory);
  if (!existsSync(absoluteDirectory)) {
    return [];
  }
  const files = [];
  for (const entry of await readdir(absoluteDirectory, { withFileTypes: true })) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectInstallerBuildFiles(relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

function inspectInstallerSignature(absolutePath) {
  if (process.platform !== "win32") {
    return "unverified-non-windows";
  }
  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      "$sig = Get-AuthenticodeSignature -LiteralPath $env:SYNAPSE_INSTALLER_PATH; $sig.Status.ToString()",
    ],
    {
      cwd: root,
      env: { ...process.env, SYNAPSE_INSTALLER_PATH: absolutePath },
      encoding: "utf8",
      stdio: "pipe",
      windowsHide: true,
    },
  );
  return result.status === 0 ? result.stdout.trim() || "Unknown" : result.stderr.trim() || "Unknown";
}

async function readInstallerSmokeEvidence() {
  const evidencePath = path.join(outputDir, "installer-smoke.json");
  if (!existsSync(evidencePath)) {
    return null;
  }
  try {
    const raw = await readText(path.relative(root, evidencePath));
    const evidence = JSON.parse(raw.replace(/^\uFEFF/, ""));
    const expectedScreenshotPath = path.join(outputDir, "installer-window.png");
    const screenshotPath = evidence.window_screenshot_path;
    const screenshotPresent =
      typeof screenshotPath === "string" &&
      path.resolve(screenshotPath) === expectedScreenshotPath &&
      existsSync(expectedScreenshotPath) &&
      (await stat(expectedScreenshotPath)).size > 0;
    return {
      ...evidence,
      window_screenshot_present: screenshotPresent,
    };
  } catch (error) {
    return {
      schema_version: 1,
      read_error: error.message,
      uninstall_verified: false,
    };
  }
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
  const installerArtifacts = evidence.artifacts.installers ?? evidence.artifacts.msi ?? [];
  const artifactLines =
    installerArtifacts.length === 0
      ? ["- No Windows installer artifacts were found under `src-tauri/target/**/bundle/{nsis,msi}/`."]
      : installerArtifacts.map(
          (artifact) => {
            const artifactState = artifact.distributable
              ? "distributable candidate"
              : artifact.version_matches
                ? "missing SHA-256 sidecar or debug-only rehearsal artifact"
                : "version-mismatch artifact";
            const sidecar = artifact.sha256_sidecar_present ? "sidecar present" : "sidecar missing";
            return `- \`${artifact.path}\` (${artifact.kind ?? "installer"}, ${artifact.profile}, ${artifactState}, ${sidecar}, signature: ${artifact.signature_status ?? "unknown"}, ${artifact.bytes} bytes), SHA-256: \`${artifact.sha256}\``;
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
  const installerSmoke = evidence.artifacts.installer_smoke;
  const installerSmokeLines = installerSmoke
    ? [
        `- Installer: \`${installerSmoke.installer ?? "unknown"}\``,
        `- Start menu shortcut: \`${installerSmoke.start_menu_shortcut ?? "unknown"}\``,
          `- Start menu target: \`${installerSmoke.start_menu_target ?? "unknown"}\``,
          `- Runtime config: \`${installerSmoke.runtime_config_path ?? "unknown"}\``,
          `- Runtime config template created: ${installerSmoke.runtime_config_template_created ? "true" : "false"}`,
          `- Uninstall verified: ${installerSmoke.uninstall_verified ? "true" : "false"}`,
      ]
    : ["- No installer smoke evidence was found under `.tmp/release-evidence/installer-smoke.json`."];
  return `# Synapse Release Evidence

Generated: ${evidence.generated_at}
Schema version: ${evidence.schema_version}

## Project

- Name: ${evidence.project.name}
- Version: ${evidence.project.version}
- Tauri identifier: ${evidence.project.tauri_identifier}
- Bundle targets: ${evidence.project.bundle_targets.join(", ") || "none"}
- Baseline: ${evidence.public_baseline.claim_boundary}
- Release signing mode: ${evidence.public_baseline.release_signing.mode}
- Unsigned preview allowed: ${evidence.public_baseline.release_signing.unsigned_preview_allowed ? "true" : "false"}

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

## Windows Installer Artifacts

${artifactLines.join("\n")}

## Installer Smoke Evidence

${installerSmokeLines.join("\n")}

## UI Smoke Screenshots

${screenshotLines.join("\n")}

## Public Baseline Claim Boundary

- External delivery default: ${evidence.public_baseline.external_delivery_default}
- Agent execution default: ${evidence.public_baseline.agent_execution_default}
- Relay upload default: ${evidence.public_baseline.relay_upload_default}
- Feishu/WeChat notification staging: ${evidence.public_baseline.notification_staging.feishu_wechat_delivery}
- Real webhook delivery: ${evidence.public_baseline.notification_staging.real_webhook_delivery}
- Webhook staging endpoint scope: ${evidence.public_baseline.notification_staging.staging_endpoint_scope}
- Release signing mode: ${evidence.public_baseline.release_signing.mode}
- Unsigned preview allowed: ${evidence.public_baseline.release_signing.unsigned_preview_allowed ? "true" : "false"}
- Do not claim unrestricted automation, real Agent teams, automatic Feishu/WeChat delivery, browser write automation, automatic cleanup, or automatic L2 writes for this baseline.
`;
}

function renderReleaseSummary(evidence) {
  const releaseFailures = evidence.release_review.blockers;
  const installerArtifacts = evidence.artifacts.installers ?? evidence.artifacts.msi ?? [];
  const releaseInstallerArtifacts = installerArtifacts.filter(
    (artifact) => artifact.profile === "release" && artifact.version_matches,
  );
  const debugInstallerArtifacts = installerArtifacts.filter((artifact) => artifact.profile === "debug");
  const blockerLines =
    releaseFailures.length === 0
      ? ["- None reported by release preflight."]
      : releaseFailures.map((blocker) => `- ${blocker.id}: ${blocker.detail}`);
  const nextActionLines =
    releaseFailures.length === 0
      ? [
          "- Sign and timestamp the installer outside the repository when a signing certificate is available.",
          "- Publish the NSIS/MSI installer with its SHA-256 sidecar and guarded baseline release notes.",
          "- Keep generated evidence, signing details, and reviewer notes outside the public repository unless intentionally published.",
        ]
      : releaseFailures.map((blocker) => `- ${blocker.remediation ?? `Resolve ${blocker.id}.`}`);
  const artifactLines = [
    releaseInstallerArtifacts.length === 0
      ? "- No release installer artifact is present yet."
      : `- Release installer artifact(s): ${releaseInstallerArtifacts.map((artifact) => `\`${artifact.path}\``).join(", ")}`,
    debugInstallerArtifacts.length === 0
      ? "- No debug installer rehearsal artifact is present."
      : `- Debug installer rehearsal artifact(s): ${debugInstallerArtifacts.map((artifact) => `\`${artifact.path}\``).join(", ")}. Do not distribute these as a formal release.`,
    evidence.artifacts.installer_smoke?.uninstall_verified
      ? "- Installer smoke evidence verifies install, Start menu launch target, and uninstall."
      : "- Installer smoke evidence is missing or incomplete.",
    `- Signing mode: ${evidence.public_baseline.release_signing.mode}; unsigned preview allowed: ${
      evidence.public_baseline.release_signing.unsigned_preview_allowed ? "true" : "false"
    }; all release installers signed: ${
      evidence.release_review.artifact_readiness.all_release_installers_signed ? "true" : "false"
    }.`,
  ];
  return `# ${PUBLIC_BASELINE_NAME} Release Review Summary

Generated: ${evidence.generated_at}
Schema version: ${evidence.schema_version}

## State

- ${evidence.release_review.state}
- Static preflight: ${evidence.preflight.static.state}
- Release preflight: ${evidence.preflight.release.state}
- Baseline: ${evidence.public_baseline.claim_boundary}
- Feishu/WeChat notification staging: ${evidence.public_baseline.notification_staging.feishu_wechat_delivery}
- Real webhook delivery: ${evidence.public_baseline.notification_staging.real_webhook_delivery}
- Release signing mode: ${evidence.public_baseline.release_signing.mode}

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
