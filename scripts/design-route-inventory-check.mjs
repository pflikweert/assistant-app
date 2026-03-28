import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, "app");
const INVENTORY_PATH = path.join(ROOT, "docs/design/screen-inventory.md");
const STALE_ROUTE_ALLOWLIST = new Set(["/accounts", "/auth"]);

function collectAppRoutes() {
  const routes = [];

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const full = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".tsx")) continue;
      const rel = path.relative(APP_DIR, full).split(path.sep).join("/");
      if (
        rel.endsWith("_layout.tsx") ||
        rel === "+html.tsx" ||
        rel.endsWith(".test.tsx") ||
        rel.endsWith(".spec.tsx")
      ) {
        continue;
      }

      const route = toRoute(rel);
      routes.push(route);
    }
  }

  walk(APP_DIR);
  return [...new Set(routes)].sort();
}

function toRoute(relativeFilePath) {
  const noExt = relativeFilePath.replace(/\.tsx$/, "");
  const segments = noExt
    .split("/")
    .filter(Boolean)
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")));

  const mapped = segments
    .map((segment) => (segment === "index" ? "" : segment))
    .filter(Boolean)
    .join("/");

  return mapped ? `/${mapped}` : "/";
}

function parseInventoryRoutes(markdown) {
  const matches = [...markdown.matchAll(/\|\s*`?(\/[^|`]*)`?\s*\|/g)];
  return new Set(matches.map((match) => match[1].trim()));
}

function main() {
  const markdown = fs.readFileSync(INVENTORY_PATH, "utf8");
  const inventoryRoutes = parseInventoryRoutes(markdown);
  const appRoutes = collectAppRoutes();

  const missingInInventory = appRoutes.filter((route) => !inventoryRoutes.has(route));
  const staleInInventory = [...inventoryRoutes].filter(
    (route) => !appRoutes.includes(route) && !STALE_ROUTE_ALLOWLIST.has(route),
  );

  if (missingInInventory.length) {
    console.error(
      `[design-route-inventory-check] Missing ${missingInInventory.length} route(s) in docs/design/screen-inventory.md`,
    );
    for (const route of missingInInventory) {
      console.error(`- ${route}`);
    }
    process.exit(1);
  }

  if (staleInInventory.length) {
    console.warn(
      `[design-route-inventory-check] ${staleInInventory.length} documented route(s) are not present in app/:`,
    );
    for (const route of staleInInventory) {
      console.warn(`- ${route}`);
    }
  }

  console.log(
    `[design-route-inventory-check] OK. ${appRoutes.length} routes covered in inventory.`,
  );
}

main();
