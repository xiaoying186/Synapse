import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const translationsPath = path.join(root, "src", "i18n", "translations.ts");
const sourceRoots = [path.join(root, "src")];

const translationsSource = readFileSync(translationsPath, "utf8");
const enKeys = readDictionaryKeys("en");
const zhKeys = readDictionaryKeys("zhCN");
const usedKeys = readUsedTranslationKeys();

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

if (failures.length > 0) {
  console.error("[FAIL] i18n key sync check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`[PASS] i18n keys are synchronized (${enKeys.size} keys, ${usedKeys.size} used).`);

function readDictionaryKeys(exportName) {
  const start = translationsSource.indexOf(`export const ${exportName} = {`);
  if (start === -1) {
    throw new Error(`Dictionary not found: ${exportName}`);
  }
  const endMarker = exportName === "en" ? "} as const;" : "} satisfies Record<TranslationKey, string>;";
  const end = translationsSource.indexOf(endMarker, start);
  if (end === -1) {
    throw new Error(`Dictionary end not found: ${exportName}`);
  }
  const block = translationsSource.slice(start, end);
  return new Set([...block.matchAll(/^\s*"([^"]+)":/gm)].map((match) => match[1]));
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
