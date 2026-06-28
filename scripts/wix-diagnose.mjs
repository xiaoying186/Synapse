import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const localAppData = process.env.LOCALAPPDATA ?? "";

function line(message) {
  console.log(message);
}

function commandExists(name) {
  return (process.env.PATH ?? "")
    .split(";")
    .filter(Boolean)
    .some((directory) => existsSync(join(directory.trim(), name)));
}

function cacheCandidates() {
  const candidates = [
    localAppData && join(localAppData, "tauri"),
    localAppData && join(localAppData, "tauri", "WixTools"),
    localAppData && join(localAppData, "tauri", "wix"),
    join(root, "src-tauri", "target", "wix"),
  ].filter(Boolean);
  return candidates.map((directory) => ({
    directory,
    exists: existsSync(directory),
    ...cachePreview(directory),
  }));
}

function cachePreview(directory) {
  try {
    if (!existsSync(directory) || !statSync(directory).isDirectory()) {
      return { readable: false, files: [] };
    }
    return {
      readable: true,
      files: readdirSync(directory, { withFileTypes: true }).map((entry) => entry.name).slice(0, 10),
    };
  } catch (error) {
    return { readable: false, files: [`unreadable: ${error.code ?? error.message}`] };
  }
}

line("Synapse WiX tooling diagnosis");
line(`Project: ${root}`);

const hasWixV3 = commandExists("candle.exe") && commandExists("light.exe");
const hasWixV4 = commandExists("wix.exe");

if (hasWixV3) {
  line("[PASS] WiX v3 tools found on PATH: candle.exe and light.exe.");
}
if (hasWixV4) {
  line("[PASS] WiX CLI found on PATH: wix.exe.");
}

const caches = cacheCandidates();
for (const cache of caches) {
  line(
    `${cache.exists ? cache.readable ? "[INFO]" : "[WARN]" : "[MISS]"} Cache candidate: ${cache.directory}${
      cache.files.length ? ` (${cache.files.join(", ")})` : ""
    }`,
  );
}

if (hasWixV3 || hasWixV4) {
  line("[NEXT] Run npm.cmd run preflight:release after Git metadata is ready.");
  process.exit(0);
}

line("[WARN] WiX tooling is not available on PATH.");
line("[NEXT] Install WiX v3/v4 on the release machine, or pre-cache Tauri's WiX bundle in a network-enabled environment.");
line("[NEXT] Then rerun npm.cmd run wix:diagnose and npm.cmd run preflight:release.");
process.exit(1);
