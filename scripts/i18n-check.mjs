import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const translationsPath = path.join(root, "src", "i18n", "translations.ts");
const localizeTextPath = path.join(root, "src", "i18n", "localizeText.ts");
const sourceRoots = [path.join(root, "src")];

const translationsSource = readFileSync(translationsPath, "utf8");
const localizeTextSource = readFileSync(localizeTextPath, "utf8");
const enKeys = readDictionaryKeys("en");
const zhKeys = readDictionaryKeys("zhCN");
const usedKeys = readUsedTranslationKeys();
const localizedTextKeys = readLocalizedTextKeys();
const usedLocalizedTextKeys = readUsedLocalizedTextKeys();

const requiredZhTranslations = {
  "terms.taiheng.zh": "太衡",
  "terms.zhishu.zh": "智枢",
  "terms.xingtai.zh": "行台",
  "terms.baigong.zh": "百工",
  "terms.libraryHome": "图书馆首页",
  "topbar.title": "认知执行工作台",
  "cognitive.knowledge": "知识",
  "cognitive.thinking": "思维",
  "cognitive.execution": "执行",
};

const requiredLocalizedText = {
  "Taiheng": "太衡",
  "Zhishu": "智枢",
  "Xingtai": "行台",
  "Baigong": "百工",
  "Library Home": "图书馆主页",
  "Agent team": "智能体团队",
  "Preflight real team": "预检真实团队",
  "real-team-execution-blocked-by-default": "真实团队执行默认阻断",
  "real-agent-staging-receipt-recorded": "已记录真实智能体分阶段收据",
  "Record real staging receipt": "记录真实团队分阶段收据",
  "mock-webhook-receipt-recorded": "已记录模拟 Webhook 收据",
  "Library Home is open.": "图书馆首页已打开。",
  "Reading pane": "阅读窗口",
  "Category task list": "分类任务列表",
  "Zhishu knowledge and memory workspace is open.": "智枢知识与记忆工作区已打开。",
  "Taiheng governance, audit, and permission gates are open.": "太衡治理、审计与权限门禁已打开。",
  "Xingtai task and schedule workspace is open.": "行台任务与调度工作区已打开。",
  "Baigong tools and automation workspace is open.": "百工工具与自动化工作区已打开。",
  "Computer assistant": "电脑助手",
  "cleanup-dry-run-review-required": "清理干运行需要复核",
  "Archive report": "归档报告",
  "Skill library": "本能库",
  "guarded-skill-library-preview": "受保护的本能库预览",
  "zhishu-admission-review-required": "智枢入库需要复核",
  "run-unreviewed-script": "运行未复核脚本",
  "Evidence contract": "证据合同",
  "no-automatic-zhishu-admission": "不自动写入智枢",
  "Browser action policy": "浏览器动作策略",
  "read-only-default-write-blocked": "只读默认模式，写操作已阻断",
  "Webhook staging policy": "Webhook 分阶段投递策略",
  "Webhook staging envelope": "Webhook 分阶段请求封套",
  "Webhook staging preflight": "Webhook 分阶段预检",
  "Send loopback staging webhook": "发送回环分阶段 Webhook",
  "staging-webhook-receipt-recorded": "已记录分阶段 Webhook 收据",
  "preview-only-not-deliverable": "仅预览，不可投递",
  "staging-webhook-blocked": "分阶段 Webhook 已阻断",
  "http-loopback-staging-only": "仅允许 HTTP 回环分阶段环境",
  "staging-contract-external-delivery-disabled": "分阶段合同：外部投递已禁用",
  "send-real-webhook": "发送真实 Webhook",
  "deliver-without-redaction": "未脱敏即投递",
};

const failures = [];

for (const key of difference(enKeys, zhKeys)) {
  failures.push(`Missing zh-CN translation key: ${key}`);
}

for (const key of difference(zhKeys, enKeys)) {
  failures.push(`Extra zh-CN translation key not present in en: ${key}`);
}

for (const key of difference(usedKeys, enKeys)) {
  failures.push(`Used translation key is not defined: ${key}`);
}

for (const key of difference(usedLocalizedTextKeys, localizedTextKeys)) {
  failures.push(`Used dynamic text key is not localized in localizeText.ts: ${key}`);
}

for (const [key, expected] of Object.entries(requiredZhTranslations)) {
  const actual = readStringValue(readDictionaryBlock("zhCN"), key);
  if (actual !== expected) {
    failures.push(`Incorrect zh-CN translation for ${key}: expected "${expected}", found "${actual ?? "<missing>"}"`);
  }
}

for (const [key, expected] of Object.entries(requiredLocalizedText)) {
  const actual = readStringValue(localizeTextSource, key);
  if (actual !== expected) {
    failures.push(`Incorrect dynamic zh-CN text for ${key}: expected "${expected}", found "${actual ?? "<missing>"}"`);
  }
}

for (const [label, source] of [
  ["translations.ts", translationsSource],
  ["localizeText.ts", localizeTextSource],
]) {
  const mojibake = firstMojibakeSignal(source);
  if (mojibake) {
    failures.push(`${label} contains likely mojibake or replacement text near: ${mojibake}`);
  }
}

if (failures.length > 0) {
  console.error("[FAIL] i18n key sync check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`[PASS] i18n keys are synchronized (${enKeys.size} keys, ${usedKeys.size} used).`);

function readDictionaryKeys(exportName) {
  const block = readDictionaryBlock(exportName);
  return new Set([...block.matchAll(/^\s*"([^"]+)":/gm)].map((match) => match[1]));
}

function readDictionaryBlock(exportName) {
  const start = translationsSource.indexOf(`export const ${exportName} = {`);
  if (start === -1) {
    throw new Error(`Dictionary not found: ${exportName}`);
  }
  const endMarker = exportName === "en" ? "} as const;" : "} satisfies Record<TranslationKey, string>;";
  const end = translationsSource.indexOf(endMarker, start);
  if (end === -1) {
    throw new Error(`Dictionary end not found: ${exportName}`);
  }
  return translationsSource.slice(start, end);
}

function readUsedTranslationKeys() {
  const keys = new Set();
  for (const file of walkSourceFiles(sourceRoots)) {
    if (file.endsWith(path.join("src", "i18n", "translations.ts"))) {
      continue;
    }
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\bt\("([^"]+)"\)/g)) {
      keys.add(match[1]);
    }
  }
  return keys;
}

function readLocalizedTextKeys() {
  return new Set([...localizeTextSource.matchAll(/^\s*"([^"]+)":/gm)].map((match) => match[1]));
}

function readUsedLocalizedTextKeys() {
  const keys = new Set();
  for (const file of walkSourceFiles(sourceRoots)) {
    if (file.endsWith(path.join("src", "i18n", "localizeText.ts"))) {
      continue;
    }
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\btext\("([^"]+)"\)/g)) {
      keys.add(match[1]);
    }
  }
  return keys;
}

function readStringValue(source, key) {
  const escapedKey = escapeRegExp(key);
  const match = source.match(new RegExp(`"${escapedKey}"\\s*:\\s*"([^"]*)"`));
  return match?.[1];
}

function firstMojibakeSignal(source) {
  const lines = source.split(/\r?\n/);
  const signal = /锟|�|Ã|Â|Ð|Ñ|æ|ç|œ|™|璁ょ煡|鐭ヨ瘑|鎵ц|鏅烘|绂|浠诲|椋炰功|鏃犳硶|藉姏/;
  const line = lines.find((item) => signal.test(item));
  return line?.trim().slice(0, 120);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function walkSourceFiles(roots) {
  const files = [];
  for (const rootDir of roots) {
    for (const entry of readdirSync(rootDir)) {
      const fullPath = path.join(rootDir, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        files.push(...walkSourceFiles([fullPath]));
      } else if (/\.(ts|tsx)$/.test(entry)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function difference(left, right) {
  return [...left].filter((key) => !right.has(key)).sort();
}
