import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

/**
 * Lightweight governance check:
 * - active main tab screens should use shared shell building blocks.
 * - transactions tab is delegated to screens/TransactionsScreen and is intentionally excluded.
 */
const EXPECTED_IMPORTS = [
  {
    file: "app/(tabs)/index.tsx",
    mustInclude: ["FinanceDashboardHeader", "FinanceScreenBackdrop"],
  },
  {
    file: "app/(tabs)/insights.tsx",
    mustInclude: ["FinanceTopBar", "FinanceHeroShell", "FinanceScreenBackdrop"],
  },
  {
    file: "app/(tabs)/budget.tsx",
    mustInclude: ["FinanceTopBar", "FinanceHeroShell", "FinanceScreenBackdrop"],
  },
  {
    file: "app/(tabs)/settings.tsx",
    mustInclude: ["FinanceUtilityShell"],
  },
  {
    file: "app/settings/security/password.tsx",
    mustIncludeAny: ["FinanceUtilityShell", "AuthScreenShell"],
  },
  {
    file: "app/subscriptions.tsx",
    mustInclude: ["FinanceUtilityShell"],
  },
  {
    file: "app/admin/index.tsx",
    mustInclude: ["FinanceAdminShell"],
  },
  {
    file: "app/bankrekeningen.tsx",
    mustInclude: ["FinanceUtilityShell"],
  },
  {
    file: "app/analysis-detail.tsx",
    mustInclude: ["FinanceDetailShell"],
  },
  {
    file: "app/import-control.tsx",
    mustInclude: ["FinanceDetailShell"],
  },
  {
    file: "app/import-afronden.tsx",
    mustInclude: ["FinanceDetailShell"],
  },
  {
    file: "app/category-budget-groups.tsx",
    mustInclude: ["FinanceDetailShell"],
  },
  {
    file: "app/transaction-detail.tsx",
    mustInclude: ["FinanceDetailShell"],
  },
];

function main() {
  const failures = [];

  for (const rule of EXPECTED_IMPORTS) {
    const fullPath = path.join(ROOT, rule.file);
    if (!fs.existsSync(fullPath)) {
      failures.push(`${rule.file}: file not found`);
      continue;
    }
    const text = fs.readFileSync(fullPath, "utf8");
    for (const token of rule.mustInclude || []) {
      if (!text.includes(token)) {
        failures.push(`${rule.file}: missing shared shell token "${token}"`);
      }
    }

    if (rule.mustIncludeAny?.length) {
      const hasAny = rule.mustIncludeAny.some((token) => text.includes(token));
      if (!hasAny) {
        failures.push(
          `${rule.file}: missing one of shared shell tokens [${rule.mustIncludeAny.join(", ")}]`,
        );
      }
    }
  }

  if (failures.length) {
    console.error(
      `[design-shell-pattern-check] found ${failures.length} shell-pattern issue(s):`,
    );
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(
    `[design-shell-pattern-check] OK. ${EXPECTED_IMPORTS.length} route files comply with shell imports.`,
  );
}

main();
