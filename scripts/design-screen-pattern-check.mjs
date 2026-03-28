import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const RULES = [
  {
    file: "app/bankrekeningen.tsx",
    mustMatch: [
      {
        pattern: /\bFinanceUtilityShell\b/,
        label: "utility shell import/usage",
      },
      {
        pattern: /function formatAccountStatusLabel/,
        label: "status label mapper",
      },
      {
        pattern: /In budget/,
        label: "status copy: In budget",
      },
      {
        pattern: /Alleen overzicht/,
        label: "status copy: Alleen overzicht",
      },
      {
        pattern: /Verborgen/,
        label: "status copy: Verborgen",
      },
      {
        pattern: /Beheer je rekeningen/,
        label: "hero title copy",
      },
      {
        pattern:
          /Beheer welke rekeningen Budio gebruikt voor budget en overzicht\./,
        label: "hero body copy",
      },
      {
        pattern: /label="Nieuwe rekening"/,
        label: "primary CTA copy",
      },
      {
        pattern: /\bloadingRow\b/,
        label: "loading state style",
      },
      {
        pattern: /\berrorCard\b/,
        label: "error state style",
      },
      {
        pattern: /\bemptyCard\b/,
        label: "empty state style",
      },
    ],
    mustNotMatch: [
      {
        pattern: /\bFinanceDetailShell\b/,
        label: "legacy detail shell token",
      },
    ],
  },
];

function main() {
  const failures = [];

  for (const rule of RULES) {
    const fullPath = path.join(ROOT, rule.file);
    if (!fs.existsSync(fullPath)) {
      failures.push(`${rule.file}: file not found`);
      continue;
    }

    const text = fs.readFileSync(fullPath, "utf8");

    for (const check of rule.mustMatch || []) {
      if (!check.pattern.test(text)) {
        failures.push(`${rule.file}: missing ${check.label}`);
      }
    }

    for (const check of rule.mustNotMatch || []) {
      if (check.pattern.test(text)) {
        failures.push(`${rule.file}: found forbidden ${check.label}`);
      }
    }
  }

  if (failures.length) {
    console.error(
      `[design-screen-pattern-check] found ${failures.length} screen-pattern issue(s):`,
    );
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(
    `[design-screen-pattern-check] OK. ${RULES.length} screen rule set(s) comply.`,
  );
}

main();
