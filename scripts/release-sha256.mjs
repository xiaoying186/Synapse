import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const artifactName = `Synapse_${packageJson.version}_x64_en-US.msi`;
  const artifactPath = path.join(root, "src-tauri", "target", "release", "bundle", "msi", artifactName);

  if (!existsSync(artifactPath)) {
    console.error(`[FAIL] Release MSI not found: ${path.relative(root, artifactPath)}`);
    console.error("[NEXT] Run npm.cmd run tauri:build, then rerun npm.cmd run release:sha256.");
    process.exit(1);
  }

  const buffer = await readFile(artifactPath);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const shaPath = `${artifactPath}.sha256`;
  await writeFile(shaPath, `${sha256}  ${artifactName}\n`, "utf8");

  console.log(`SHA-256 written: ${path.relative(root, shaPath)}`);
  console.log(`${sha256}  ${artifactName}`);
}

main().catch((error) => {
  console.error(`[FAIL] release-sha256: ${error.message}`);
  process.exit(1);
});
