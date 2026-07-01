import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2]?.trim();
const outputPath = process.argv[3]?.trim();
const signingMode = process.argv[4]?.trim() || "signed";

if (!version || !/^\d+\.\d+\.\d+([.-][0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Usage: node scripts/release-notes.mjs <semver> <output-path>");
  process.exit(1);
}

if (!outputPath) {
  console.error("Missing output path for release notes.");
  process.exit(1);
}

const changelog = readFileSync("CHANGELOG.md", "utf8").replace(/\r\n/g, "\n");

function extractSection(heading) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const suffix = heading === "Unreleased" ? "" : "(?:\\s+-.*)?";
  const pattern = new RegExp(
    `^##\\s+${escapedHeading}${suffix}\\s*$\\n([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`,
    "m",
  );
  return changelog.match(pattern)?.[1]?.trim() ?? "";
}

const versionNotes = extractSection(version);
const unreleasedNotes = extractSection("Unreleased");
const changelogNotes = versionNotes || unreleasedNotes;
const sourceHeading = versionNotes
  ? `CHANGELOG.md section: ${version}`
  : "CHANGELOG.md section: Unreleased";

if (!changelogNotes) {
  console.error(
    `No CHANGELOG.md notes found for ${version}, and Unreleased is empty.`,
  );
  process.exit(1);
}

const releaseNotes = [
  `Synapse ${version} manual release.`,
  "",
  "This release was created by the guarded manual release workflow.",
  `Release notes source: ${sourceHeading}.`,
  signingMode === "unsigned-preview"
    ? "Signing status: unsigned preview installer. Verify the SHA-256 file before local testing."
    : "Signing status: signed Windows installer verified before upload.",
  "",
  "## Changelog",
  "",
  changelogNotes,
  "",
  "## Validation",
  "",
  "- npm ci",
  "- npm.cmd run secret:scan",
  "- npm.cmd run preflight:static",
  "- npm.cmd run i18n:check",
  "- npm.cmd run build",
  "- npm.cmd run tauri:build",
  signingMode === "unsigned-preview"
    ? "- Windows installer code signing skipped by explicit manual release input"
    : "- Windows installer code signing",
  "- SHA-256 checksum generation",
  "",
  "Installers include adjacent SHA-256 checksum files.",
  "",
].join("\n");

writeFileSync(outputPath, releaseNotes, "utf8");
