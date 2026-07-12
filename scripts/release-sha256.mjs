import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundleRoot = path.join(root, "src-tauri", "target", "release", "bundle");

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

function isInstaller(filePath) {
  return [".msi", ".exe"].includes(path.extname(filePath).toLowerCase());
}

async function main() {
  if (!existsSync(bundleRoot)) {
    console.error(`[FAIL] Release bundle directory not found: ${path.relative(root, bundleRoot)}`);
    console.error("[NEXT] Run npm.cmd run tauri:build, then rerun npm.cmd run release:sha256.");
    process.exit(1);
  }

  const artifacts = (await walkFiles(bundleRoot)).filter(isInstaller).sort();
  if (artifacts.length === 0) {
    console.error(`[FAIL] No release installers found under: ${path.relative(root, bundleRoot)}`);
    console.error("[NEXT] Run npm.cmd run tauri:build, then rerun npm.cmd run release:sha256.");
    process.exit(1);
  }

  for (const artifactPath of artifacts) {
    const artifactName = path.basename(artifactPath);
    const buffer = await readFile(artifactPath);
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const shaPath = `${artifactPath}.sha256`;
    await writeFile(shaPath, `${sha256}  ${artifactName}\n`, "utf8");

    console.log(`SHA-256 written: ${path.relative(root, shaPath)}`);
    console.log(`${sha256}  ${artifactName}`);
  }
}

main().catch((error) => {
  console.error(`[FAIL] release-sha256: ${error.message}`);
  process.exit(1);
});
