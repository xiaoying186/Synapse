import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedVersion = process.env.SYNAPSE_RELEASE_VERSION || "";
const signingMode = process.env.SYNAPSE_SIGNING_MODE || "signed";
const unsignedPreviewAllowed = process.env.SYNAPSE_ALLOW_UNSIGNED === "true";
const bundleRoot = path.join(root, "src-tauri", "target", "release", "bundle");

const failures = [];

function relative(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, "/");
}

function pass(name, detail) {
  console.log(`[PASS] ${name}: ${detail}`);
}

function fail(name, detail) {
  failures.push(`${name}: ${detail}`);
  console.error(`[FAIL] ${name}: ${detail}`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readText(filePath) {
  return readFile(filePath, "utf8");
}

async function walkFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function sha256(filePath) {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

async function checkVersionMetadata() {
  if (!expectedVersion) {
    fail("release-version-env", "SYNAPSE_RELEASE_VERSION is required.");
    return;
  }
  if (!/^\d+\.\d+\.\d+([.-][0-9A-Za-z.-]+)?$/.test(expectedVersion)) {
    fail("release-version-format", `Invalid release version: ${expectedVersion}`);
    return;
  }
  pass("release-version-format", expectedVersion);

  const packageJson = await readJson(path.join(root, "package.json"));
  const tauriConfig = await readJson(path.join(root, "src-tauri", "tauri.conf.json"));
  const cargoToml = await readText(path.join(root, "src-tauri", "Cargo.toml"));

  if (packageJson.version === expectedVersion) {
    pass("package-version", `package.json is ${expectedVersion}`);
  } else {
    fail("package-version", `package.json is ${packageJson.version}, expected ${expectedVersion}`);
  }

  if (tauriConfig.version === expectedVersion) {
    pass("tauri-version", `tauri.conf.json is ${expectedVersion}`);
  } else {
    fail("tauri-version", `tauri.conf.json is ${tauriConfig.version}, expected ${expectedVersion}`);
  }

  if (cargoToml.includes(`version = "${expectedVersion}"`)) {
    pass("cargo-version", `Cargo.toml is ${expectedVersion}`);
  } else {
    fail("cargo-version", `Cargo.toml does not contain version = "${expectedVersion}"`);
  }
}

async function checkAcceptanceDocument() {
  const acceptancePath = path.join(root, "ACCEPTANCE.md");
  if (!existsSync(acceptancePath)) {
    fail("acceptance-document", "ACCEPTANCE.md is missing.");
    return;
  }

  const acceptance = await readText(acceptancePath);
  const requiredSections = [
    "Startup Acceptance",
    "Home Layout Acceptance",
    "Button Feedback Acceptance",
    "Navigation Acceptance",
    "Installer Acceptance",
    "Release Blocking Conditions",
  ];
  const missing = requiredSections.filter((section) => !acceptance.includes(section));
  if (missing.length === 0) {
    pass("acceptance-document", "Release acceptance criteria are present.");
  } else {
    fail("acceptance-document", `Missing section(s): ${missing.join(", ")}`);
  }
}

async function checkFrontendVersionDisplay() {
  const distRoot = path.join(root, "dist");
  if (!existsSync(distRoot)) {
    fail("frontend-dist", "dist/ is missing. Run npm.cmd run build before release acceptance.");
    return;
  }

  const files = await walkFiles(distRoot);
  const searchableFiles = files.filter((file) => /\.(html|js|css)$/.test(file));
  const contents = await Promise.all(searchableFiles.map((file) => readText(file)));
  const versionNeedle = `Synapse ${expectedVersion}`;
  if (contents.some((content) => content.includes(versionNeedle))) {
    pass("frontend-version-display", `dist contains '${versionNeedle}'.`);
  } else {
    fail("frontend-version-display", `dist does not contain '${versionNeedle}'.`);
  }
}

async function checkInstallers() {
  if (!existsSync(bundleRoot)) {
    fail("installer-bundle-root", `Missing bundle directory: ${relative(bundleRoot)}`);
    return;
  }

  const files = await walkFiles(bundleRoot);
  const installers = files
    .filter((file) => [".msi", ".exe"].includes(path.extname(file).toLowerCase()))
    .sort();

  if (installers.length === 0) {
    fail("installer-artifacts", `No .msi/.exe/nsis artifacts found under ${relative(bundleRoot)}.`);
    return;
  }
  pass("installer-artifacts", `${installers.length} installer artifact(s) found.`);

  for (const installer of installers) {
    const installerStat = await stat(installer);
    if (installerStat.size > 0) {
      pass("installer-size", `${relative(installer)} is ${installerStat.size} bytes.`);
    } else {
      fail("installer-size", `${relative(installer)} is empty.`);
    }

    const shaFile = `${installer}.sha256`;
    if (!existsSync(shaFile)) {
      fail("installer-sha256", `Missing ${relative(shaFile)}.`);
      continue;
    }

    const actualHash = await sha256(installer);
    const shaText = (await readText(shaFile)).trim();
    if (shaText.includes(actualHash) && shaText.includes(path.basename(installer))) {
      pass("installer-sha256", `${relative(shaFile)} matches ${path.basename(installer)}.`);
    } else {
      fail("installer-sha256", `${relative(shaFile)} does not match ${path.basename(installer)}.`);
    }
  }

  checkInstallerSigning(installers);
}

function checkInstallerSigning(installers) {
  if (signingMode === "unsigned-preview") {
    if (unsignedPreviewAllowed) {
      pass(
        "installer-signing-policy",
        "unsigned-preview mode was explicitly allowed for this release run.",
      );
    } else {
      fail(
        "installer-signing-policy",
        "SYNAPSE_SIGNING_MODE=unsigned-preview requires SYNAPSE_ALLOW_UNSIGNED=true.",
      );
    }
    return;
  }

  if (signingMode !== "signed") {
    fail(
      "installer-signing-policy",
      `Unsupported SYNAPSE_SIGNING_MODE '${signingMode}'. Use signed or unsigned-preview.`,
    );
    return;
  }

  if (process.platform !== "win32") {
    fail(
      "installer-signing-platform",
      "Signed installer verification requires Windows Authenticode tooling.",
    );
    return;
  }

  for (const installer of installers) {
    const result = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "$sig = Get-AuthenticodeSignature -LiteralPath $env:SYNAPSE_INSTALLER_PATH; $sig.Status.ToString()",
      ],
      {
        cwd: root,
        env: { ...process.env, SYNAPSE_INSTALLER_PATH: installer },
        encoding: "utf8",
        stdio: "pipe",
        windowsHide: true,
      },
    );
    const status = result.stdout.trim();
    if (result.status === 0 && status === "Valid") {
      pass("installer-signature", `${relative(installer)} has a valid Authenticode signature.`);
    } else {
      fail(
        "installer-signature",
        `${relative(installer)} signature status is '${status || result.stderr.trim() || "unknown"}'.`,
      );
    }
  }
}

async function main() {
  await checkVersionMetadata();
  await checkAcceptanceDocument();
  await checkFrontendVersionDisplay();
  await checkInstallers();

  if (failures.length > 0) {
    console.error(`\n[FAIL] release acceptance failed with ${failures.length} issue(s).`);
    process.exit(1);
  }

  console.log("\n[PASS] release acceptance checks passed.");
}

main().catch((error) => {
  console.error(`[FAIL] release-acceptance: ${error.message}`);
  process.exit(1);
});
