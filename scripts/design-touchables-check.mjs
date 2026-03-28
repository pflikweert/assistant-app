import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CONFIG_PATH = path.join(
  ROOT,
  "docs/design/design-enforcement.config.json",
);
const BASELINE_PATH = path.join(
  ROOT,
  "docs/design/touchables-baseline.json",
);

const TOUCHABLE_REGEX = /<(TouchableOpacity|Pressable)\b/g;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function shouldIncludeFile(filePath, config) {
  const normalized = filePath.split(path.sep).join("/");
  if (!config.includeExtensions.some((extension) => normalized.endsWith(extension))) {
    return false;
  }
  if (config.excludeSuffixes.some((suffix) => normalized.endsWith(suffix))) {
    return false;
  }
  if (config.excludePathIncludes.some((token) => normalized.includes(token))) {
    return false;
  }
  if ((config.touchablesExcludePathIncludes || []).some((token) => normalized.includes(token))) {
    return false;
  }
  return true;
}

function walk(dirPath, config, out) {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, config, out);
      continue;
    }
    if (shouldIncludeFile(fullPath, config)) {
      out.push(fullPath);
    }
  }
}

function collectFiles(config) {
  const result = [];
  for (const root of config.scanRoots) {
    walk(path.join(ROOT, root), config, result);
  }
  return result.sort();
}

function collectOccurrences(files) {
  const occurrences = [];
  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, "utf8");
    const lines = raw.split(/\r?\n/);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const matches = [...line.matchAll(TOUCHABLE_REGEX)];
      for (const match of matches) {
        const kind = match[1];
        const compactLine = line.trim().replace(/\s+/g, " ");
        const key = `${path.relative(ROOT, filePath)}|${kind}|${compactLine}`;
        occurrences.push({
          key,
          kind,
          file: path.relative(ROOT, filePath).split(path.sep).join("/"),
          line: lineIndex + 1,
          snippet: compactLine,
        });
      }
    }
  }
  occurrences.sort((left, right) => left.key.localeCompare(right.key));
  return occurrences;
}

function toSet(items) {
  return new Set(items.map((item) => item.key));
}

function writeBaseline(occurrences) {
  const payload = {
    generatedAt: new Date().toISOString(),
    count: occurrences.length,
    entries: occurrences.map((item) => ({
      key: item.key,
      kind: item.kind,
      file: item.file,
      snippet: item.snippet,
    })),
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

function main() {
  const write = process.argv.includes("--write-baseline");
  const config = readJson(CONFIG_PATH);
  const files = collectFiles(config);
  const occurrences = collectOccurrences(files);

  if (write) {
    writeBaseline(occurrences);
    console.log(
      `[design-touchables-check] baseline written: ${occurrences.length} entries`,
    );
    return;
  }

  if (!fs.existsSync(BASELINE_PATH)) {
    console.error(
      "[design-touchables-check] baseline missing. Run: node scripts/design-touchables-check.mjs --write-baseline",
    );
    process.exit(1);
  }

  const baseline = readJson(BASELINE_PATH);
  const baselineSet = new Set((baseline.entries || []).map((entry) => entry.key));
  const currentSet = toSet(occurrences);

  const newViolations = occurrences.filter((item) => !baselineSet.has(item.key));
  const removedSinceBaseline = (baseline.entries || []).filter(
    (entry) => !currentSet.has(entry.key),
  );

  if (newViolations.length) {
    console.error(
      `[design-touchables-check] found ${newViolations.length} new raw touchable occurrence(s):`,
    );
    for (const violation of newViolations.slice(0, 50)) {
      console.error(
        `- ${violation.file}:${violation.line} [${violation.kind}] :: ${violation.snippet}`,
      );
    }
    if (newViolations.length > 50) {
      console.error(
        `... and ${newViolations.length - 50} more (trimmed output).`,
      );
    }
    console.error(
      "Use FinanceButton or FinancePressableSurface patterns for new interaction surfaces.",
    );
    process.exit(1);
  }

  console.log(
    `[design-touchables-check] OK. ${occurrences.length} tracked occurrences, ${removedSinceBaseline.length} removed vs baseline.`,
  );
}

main();
