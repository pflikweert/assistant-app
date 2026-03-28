import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, "tmp/design-ui-compliance-report.md");
const BASELINE_PATH = path.join(ROOT, "docs/design/forbidden-hex-baseline.json");
const CONFIG_PATH = path.join(ROOT, "docs/design/design-enforcement.config.json");
const INVENTORY_PATH = path.join(ROOT, "docs/design/screen-inventory.md");

const HEX_REGEX = /#[0-9A-Fa-f]{3,8}\b/g;

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

function parseInventoryRows(markdown) {
  const lines = markdown.split(/\r?\n/);
  const rows = lines.filter((line) => /^\|\s*`?\/.+\|/.test(line));
  return rows.map((line) => line.trim());
}

function main() {
  const config = readJson(CONFIG_PATH);
  const files = collectFiles(config);
  const baseline = fs.existsSync(BASELINE_PATH) ? readJson(BASELINE_PATH) : { entries: [] };
  const baselineSet = new Set((baseline.entries || []).map((entry) => entry.key));
  let currentOccurrenceCount = 0;
  let nonBaselineOccurrenceCount = 0;

  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, "utf8");
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const matches = line.match(HEX_REGEX);
      if (!matches) continue;
      const compactLine = line.trim().replace(/\s+/g, " ");
      for (const value of matches) {
        currentOccurrenceCount += 1;
        const key = `${path.relative(ROOT, filePath)}|${value}|${compactLine}`;
        if (!baselineSet.has(key)) {
          nonBaselineOccurrenceCount += 1;
        }
      }
    }
  }

  const inventory = fs.readFileSync(INVENTORY_PATH, "utf8");
  const inventoryRows = parseInventoryRows(inventory);
  const activeRows = inventoryRows.filter((row) =>
    /\|\s*`?active`?\s*\|/.test(row),
  );
  const rowsWithStateCoverage = inventoryRows.filter(
    (row) =>
      row.includes("loading:") &&
      row.includes("empty:") &&
      row.includes("partial:") &&
      row.includes("error:"),
  );

  const tokenCompliantFiles = Math.max(files.length - currentOccurrenceCount, 0);
  const tokenCompliancePct = files.length
    ? Math.round((tokenCompliantFiles / files.length) * 100)
    : 100;

  const report = [
    "# UI Compliance Report",
    "",
    `- generatedAt: ${new Date().toISOString()}`,
    `- scannedFiles: ${files.length}`,
    `- trackedRawHexOccurrences: ${currentOccurrenceCount}`,
    `- newRawHexOccurrencesVsBaseline: ${nonBaselineOccurrenceCount}`,
    `- tokenCompliantFilesEstimate: ${tokenCompliantFiles}`,
    `- tokenComplianceEstimatePct: ${tokenCompliancePct}%`,
    `- inventoryRows: ${inventoryRows.length}`,
    `- activeInventoryRows: ${activeRows.length}`,
    `- rowsWithExplicitStateCoverage: ${rowsWithStateCoverage.length}`,
    "",
    "## Notes",
    "",
    "- `tokenCompliantFilesEstimate` is a coarse signal for trend monitoring.",
    "- Baseline deltas are controlled by `scripts/design-forbidden-hex.mjs`.",
    "",
  ].join("\n");

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, report, "utf8");
  console.log(`[design-compliance-report] wrote ${path.relative(ROOT, REPORT_PATH)}`);
}

main();
