import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const root = process.cwd();
const gitPath = join(root, ".git");
const repairEmptyGit = process.argv.includes("--repair-empty-git");
const yes = process.argv.includes("--yes");

function line(message) {
  console.log(message);
}

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
}

line("Synapse Git bootstrap");
line(`Project: ${root}`);

if (!existsSync(gitPath)) {
  line("[INFO] .git does not exist.");
  if (repairEmptyGit) {
    runGitInit();
  } else {
    line("[DRY-RUN] Would run git init when you are ready.");
    line("[NEXT] npm.cmd run git:bootstrap -- --repair-empty-git --yes");
  }
  process.exit(0);
}

const metadata = statSync(gitPath);
if (!metadata.isDirectory()) {
  fail(".git exists but is not a directory. Inspect it manually before repair.");
}

const entries = readdirSync(gitPath, { withFileTypes: true });
const names = entries.map((entry) => entry.name);
line(`[INFO] .git directory exists with ${entries.length} item(s).`);

if (entries.length > 0) {
  const missing = ["HEAD", "objects", "refs"].filter((name) => !names.includes(name));
  if (missing.length === 0) {
    line("[PASS] .git already has the basic repository shape.");
    line("[NEXT] Run git status --short.");
    process.exit(0);
  }
  fail(`.git is not empty but is missing expected item(s): ${missing.join(", ")}. Refusing automatic repair.`);
}

line("[WARN] .git is an empty directory.");
if (!repairEmptyGit) {
  line("[DRY-RUN] Would remove only the empty .git directory, then run git init.");
  line("[NEXT] npm.cmd run git:bootstrap -- --repair-empty-git --yes");
  process.exit(0);
}
if (!yes) {
  fail("Refusing to modify .git without --yes.");
}

rmSync(gitPath, { recursive: false, force: false });
line("[INFO] Removed empty .git directory.");
runGitInit();

function runGitInit() {
  const result = spawnSync("git", ["init"], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
    windowsHide: true,
  });
  if (result.status !== 0) {
    fail(`git init failed:\n${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim());
  }
  line((result.stdout || result.stderr || "[PASS] git init completed.").trim());
  line("[NEXT] Run git status --short and review files before the first commit.");
}
