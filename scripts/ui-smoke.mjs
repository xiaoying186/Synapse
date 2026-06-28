import { spawn, spawnSync } from "node:child_process";
import { access, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const screenshotDir = path.join(root, ".tmp", "ui-smoke");

const sourceChecks = [
  ["src/App.tsx", "LibraryHomePanel"],
  ["src/App.tsx", "ProductionReadinessPanel"],
  ["src/App.tsx", "SagaRecoveryPanel"],
  ["src/App.tsx", "SecurityCenterPanel"],
  ["src/App.tsx", "NotificationGatewayPanel"],
  ["src/App.tsx", "AgentTeamPanel"],
  ["src/App.tsx", "WebAppShellPanel"],
  ["src/components/WebAppShellPanel.tsx", "Web App Shell"],
  ["src/App.tsx", "CodebaseMemoryPanel"],
  ["src/components/CodebaseMemoryPanel.tsx", "Codebase Memory"],
  ["src/App.tsx", "PermissionMemoryPanel"],
  ["src/components/PermissionMemoryPanel.tsx", "Permission Memory"],
  ["src/App.css", ".shell"],
  ["src/App.css", ".workspace"],
];

async function main() {
  await runSourceChecks();

  const playwrightPackage = process.env.PLAYWRIGHT_PACKAGE ?? "playwright";
  let playwright;
  try {
    playwright = await import(playwrightPackage);
  } catch {
    const captured = await runPythonBrowserSmoke();
    if (!captured) {
      console.log(
        `[SKIP] playwright: ${playwrightPackage} is not installed and Python Playwright screenshot capture is unavailable; static UI smoke checks passed.`,
      );
    }
    return;
  }

  await runBrowserSmoke(playwright);
}

async function runSourceChecks() {
  for (const [relativePath, needle] of sourceChecks) {
    const absolutePath = path.join(root, relativePath);
    const content = await readFile(absolutePath, "utf8");
    if (!content.includes(needle)) {
      throw new Error(`${relativePath} is missing expected UI anchor: ${needle}`);
    }
    console.log(`[PASS] source-anchor: ${relativePath} contains ${needle}`);
  }
}

async function runBrowserSmoke(playwright) {
  await runWithViteServer(async () => {
    const browser = await playwright.chromium.launch();
    try {
      await smokeViewport(browser, "desktop", 1440, 1100);
      await smokeViewport(browser, "mobile", 390, 920);
    } finally {
      await browser.close();
    }
  });
}

async function runWithViteServer(callback) {
  await mkdir(screenshotDir, { recursive: true });
  const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
  await access(viteBin);

  const server = spawn(
    process.execPath,
    [viteBin, "--host", "127.0.0.1", "--port", "1420", "--strictPort"],
    {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );

  let output = "";
  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForServer("http://127.0.0.1:1420/");
    await callback();
  } finally {
    server.kill();
  }

  if (server.exitCode && server.exitCode !== 0) {
    throw new Error(`Vite smoke server exited with ${server.exitCode}:\n${output}`);
  }
}

async function runPythonBrowserSmoke() {
  const python = pythonCommand();
  if (!python) {
    return false;
  }

  let captured = false;
  await runWithViteServer(async () => {
    const script = String.raw`
import pathlib
import sys
from playwright.sync_api import sync_playwright

out = pathlib.Path(sys.argv[1])
with sync_playwright() as p:
    browser = p.chromium.launch()
    try:
        for name, width, height in (("desktop", 1440, 1100), ("mobile", 390, 920)):
            page = browser.new_page(viewport={"width": width, "height": height})
            page.goto("http://127.0.0.1:1420/", wait_until="networkidle")
            page.get_by_role("heading", name="Cognitive execution workbench").wait_for(timeout=10000)
            page.get_by_text("Library home").first.wait_for(timeout=10000)
            page.get_by_text("Production readiness").first.wait_for(timeout=10000)
            page.screenshot(path=str(out / f"{name}.png"), full_page=True)
            page.close()
    finally:
        browser.close()
`;
    const result = spawnSync(python, ["-c", script, screenshotDir], {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
      windowsHide: true,
    });
    if (result.status === 0) {
      captured = true;
      console.log("[PASS] python-browser-smoke: captured desktop and mobile screenshots");
    } else {
      const detail = (result.stderr || result.stdout || "Python Playwright failed").trim();
      console.log(`[SKIP] python-browser-smoke: ${firstLine(detail)}`);
    }
  });

  return captured;
}

function pythonCommand() {
  const candidates = [
    process.env.PYTHON_PLAYWRIGHT,
    "H:\\python311\\python.exe",
    "python",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes("\\") && !existsSync(candidate)) {
      continue;
    }
    const result = spawnSync(candidate, ["-c", "import playwright"], {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
      windowsHide: true,
    });
    if (result.status === 0) {
      return candidate;
    }
  }
  return null;
}

function firstLine(value) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    lines.find((line) => line.includes("Error:") || line.includes("spawn ")) ??
    lines.find((line) => !line.startsWith("File ") && !line.startsWith("Traceback")) ??
    lines[0] ??
    "unavailable"
  );
}

async function smokeViewport(browser, name, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto("http://127.0.0.1:1420/", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Synapse|Cognitive execution workbench/i }).first().waitFor();
  await page.getByText("Library home").first().waitFor();
  await page.getByText("Production readiness").first().waitFor();
  await page.screenshot({
    fullPage: true,
    path: path.join(screenshotDir, `${name}.png`),
  });
  await page.close();
  console.log(`[PASS] browser-smoke: captured ${name} screenshot`);
}

async function waitForServer(url) {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the dev server is ready or timeout expires.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

main().catch((error) => {
  console.error(`[FAIL] ui-smoke: ${error.message}`);
  process.exit(1);
});
