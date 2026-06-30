import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const jsonOutput = process.argv.includes("--json");

const ignoredDirectories = new Set([
  ".git",
  ".codegraph",
  ".tmp",
  ".synapse",
  "node_modules",
  "dist",
  "dist-ssr",
  "build",
  "target",
  "data",
  "logs",
  "coverage",
  "dataset",
  "backtest_results",
]);

const ignoredFiles = new Set([
  "package-lock.json",
  "scripts/secret-guard.mjs",
  "scripts/production-preflight.mjs",
]);

const textFilePattern = /\.(rs|ts|tsx|js|mjs|toml|json|md|yml|yaml|env|example|txt)$/i;

const secretPatterns = [
  {
    id: "private-key-block",
    severity: "critical",
    pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
  },
  {
    id: "github-token",
    severity: "critical",
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  },
  {
    id: "openai-api-key",
    severity: "critical",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  },
  {
    id: "jwt",
    severity: "high",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
  {
    id: "aws-access-key",
    severity: "high",
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  },
  {
    id: "populated-secret-assignment",
    severity: "medium",
    pattern:
      /\b(api[_-]?key|access[_-]?token|auth[_-]?token|secret|password|webhook_url|smtp_password)\b\s*[:=]\s*["']([^"']{8,})["']/i,
    validate: (match) => {
      const value = match[2].trim();
      return !(
        value === "SYNAPSE_SMTP_PASSWORD" ||
        value.startsWith("SYNAPSE_") ||
        value.includes("example") ||
        value.includes("placeholder") ||
        value.includes("preview") ||
        value === "blocked" ||
        value === "missing"
      );
    },
  },
];

const sensitiveFilePatterns = [
  /^\.env$/i,
  /^\.env\.(?!example$).+/i,
  /\.(pem|key|pfx|p12|token)$/i,
  /^credentials\.json$/i,
];

const findings = [];

for (const file of walkFiles(root)) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const basename = path.basename(relative);

  if (ignoredFiles.has(relative)) {
    continue;
  }

  if (sensitiveFilePatterns.some((pattern) => pattern.test(basename))) {
    findings.push({
      severity: "critical",
      rule: "sensitive-file",
      path: relative,
      detail: "Sensitive filename is present in the repository tree.",
    });
    continue;
  }

  if (!textFilePattern.test(relative)) {
    continue;
  }

  let content = "";
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const rule of secretPatterns) {
    const match = rule.pattern.exec(content);
    if (!match) {
      continue;
    }
    if (rule.validate && !rule.validate(match)) {
      continue;
    }
    findings.push({
      severity: rule.severity,
      rule: rule.id,
      path: relative,
      detail: "Potential secret-like value detected.",
    });
  }
}

const result = {
  state: findings.length === 0 ? "passed" : "failed",
  finding_count: findings.length,
  findings,
};

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else if (findings.length === 0) {
  console.log("[PASS] Secret Guard found no obvious local secrets.");
} else {
  console.error("[FAIL] Secret Guard found potential secret material:");
  for (const finding of findings) {
    console.error(`- ${finding.severity} ${finding.rule}: ${finding.path}`);
  }
}

process.exit(findings.length === 0 ? 0 : 1);

function walkFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      const size = statSync(fullPath).size;
      if (size <= 1024 * 1024) {
        files.push(fullPath);
      }
    }
  }
  return files;
}
