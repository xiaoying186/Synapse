import { spawnSync } from "node:child_process";
import process from "node:process";

const root = process.cwd();
const jsonOutput = process.argv.includes("--json");

function run(id, command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
    windowsHide: true,
  });
  return {
    id,
    exitCode: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

function line(message) {
  console.log(message);
}

function printSection(result) {
  const state = result.exitCode === 0 ? "pass" : "review";
  line(`\n## ${result.id}`);
  line(`[STATE] ${state}`);
  line(`[EXIT] ${result.exitCode}`);
  const output = result.stdout || result.stderr || "No output.";
  line(output);
}

if (!jsonOutput) {
  line("Synapse release doctor");
  line(`Project: ${root}`);
  line(
    "This command is read-only. It does not repair Git metadata, install WiX, generate evidence, sign artifacts, or publish releases.",
  );
}

const results = [
  run("git-diagnose", process.execPath, ["scripts/git-diagnose.mjs"]),
  run("wix-diagnose", process.execPath, ["scripts/wix-diagnose.mjs"]),
  run("preflight-static", process.execPath, ["scripts/production-preflight.mjs", "--static"]),
  run("release-preflight-json", process.execPath, [
    "scripts/production-preflight.mjs",
    "--static",
    "--release",
    "--json",
  ]),
  run("release-status-json", process.execPath, ["scripts/release-status.mjs", "--json"]),
];

const releaseStatus = results.find((result) => result.id === "release-status-json");
let ready = false;
let blockers = [];
let staleInputs = [];
let releaseStatusParseError = null;
try {
  const parsed = JSON.parse(releaseStatus?.stdout ?? "{}");
  ready = Boolean(parsed.ready) && parsed.stale === false;
  blockers = Array.isArray(parsed.blockers) ? parsed.blockers : [];
  staleInputs = Array.isArray(parsed.stale_inputs) ? parsed.stale_inputs : [];
} catch (error) {
  releaseStatusParseError = error.message;
  blockers = [{ id: "release-status-json", detail: "Unable to parse release status JSON." }];
}

if (jsonOutput) {
  console.log(
    JSON.stringify(
      {
        ready,
        read_only: true,
        stale: staleInputs.length > 0,
        stale_inputs: staleInputs,
        blockers,
        checks: results.map((result) => ({
          id: result.id,
          state: result.exitCode === 0 ? "pass" : "review",
          exit_code: result.exitCode,
        })),
        parse_error: releaseStatusParseError,
        next:
          "Resolve reported blockers, rerun npm.cmd run release:evidence, then rerun npm.cmd run release:doctor.",
      },
      null,
      2,
    ),
  );
  process.exit(ready ? 0 : 1);
}

for (const result of results) {
  printSection(result);
}

line("\n## Summary");
line(`[READY] ${ready ? "true" : "false"}`);
if (blockers.length === 0) {
  line("[BLOCKERS] none reported by release status");
} else {
  for (const blocker of blockers) {
    line(`[BLOCKER] ${blocker.id}: ${blocker.detail}`);
  }
}
if (staleInputs.length > 0) {
  for (const input of staleInputs) {
    line(`[STALE-INPUT] ${input}`);
  }
}
line("[NEXT] Resolve reported blockers, rerun npm.cmd run release:evidence, then rerun npm.cmd run release:doctor.");

process.exit(ready ? 0 : 1);
