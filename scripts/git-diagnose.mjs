import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const gitPath = join(root, ".git");

function line(message) {
  console.log(message);
}

line("Synapse Git repository diagnosis");
line(`Project: ${root}`);

if (!existsSync(gitPath)) {
  line("[INFO] .git does not exist.");
  line("[NEXT] Run git init when you are ready to create a repository.");
  process.exit(0);
}

const stat = statSync(gitPath);
if (!stat.isDirectory()) {
  line("[WARN] .git exists but is not a directory.");
  line("[NEXT] Inspect .git manually before initializing or publishing.");
  process.exit(1);
}

const entries = readdirSync(gitPath, { withFileTypes: true });
const names = entries.map((entry) => entry.name);
line(`[INFO] .git directory exists with ${entries.length} item(s).`);

const required = ["HEAD", "objects", "refs"];
const missing = required.filter((name) => !names.includes(name));
if (entries.length === 0) {
  line("[WARN] .git is an empty directory, so Git will not recognize this project.");
  line("[NEXT] If no repository history is needed, remove the empty .git directory, then run git init.");
  line("[NEXT] PowerShell: Remove-Item -LiteralPath .git -Force; git init");
  process.exit(1);
}

if (missing.length > 0) {
  line(`[WARN] .git is missing expected item(s): ${missing.join(", ")}`);
  line("[NEXT] Back up or inspect .git before repair. Do not overwrite it blindly.");
  process.exit(1);
}

line("[PASS] .git has the basic shape of a Git repository.");
line("[NEXT] Run git status --short to inspect tracked and untracked files.");
