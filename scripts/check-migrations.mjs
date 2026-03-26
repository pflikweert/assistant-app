import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
const MIGRATION_FILE_PATTERN = /^(\d{8}|\d{14})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;

// Legacy short versions are allowed to keep existing history stable.
// New migrations must use a 14-digit timestamp prefix.
const LEGACY_SHORT_VERSIONS = new Set([
  "20260311",
  "20260312",
  "20260313",
  "20260314",
  "20260315",
  "20260316",
  "20260318",
  "20260319",
  "20260320",
  "20260321",
  "20260322",
  "20260323",
  "20260324",
  "20260326",
  "20260327",
  "20260328",
  "20260329",
  "20260330",
  "20260331",
  "20260401",
  "20260402",
  "20260403",
  "20260404",
  "20260405",
  "20260406",
  "20260407",
  "20260413",
  "20260414",
  "20260415",
]);

function readMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Map niet gevonden: ${MIGRATIONS_DIR}`);
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

function validateMigrations(fileNames) {
  const errors = [];
  const versions = new Map();
  const versionsByDay = new Map();

  for (const fileName of fileNames) {
    const match = fileName.match(MIGRATION_FILE_PATTERN);
    if (!match) {
      errors.push(
        `${fileName}: ongeldig format. Verwacht <version>_<slug>.sql met version van 8 of 14 cijfers.`,
      );
      continue;
    }

    const version = match[1];
    const dayKey = version.slice(0, 8);

    if (version.length === 8 && !LEGACY_SHORT_VERSIONS.has(version)) {
      errors.push(
        `${fileName}: nieuwe korte version '${version}' niet toegestaan. Gebruik 14-cijfer timestamp (bijv. 20260425153000_...).`,
      );
    }

    if (versions.has(version)) {
      errors.push(
        `${fileName}: duplicate migration version '${version}' (ook in ${versions.get(version)}).`,
      );
    } else {
      versions.set(version, fileName);
    }

    const dayVersions = versionsByDay.get(dayKey) || [];
    dayVersions.push(version);
    versionsByDay.set(dayKey, dayVersions);
  }

  for (const [dayKey, dayVersions] of versionsByDay.entries()) {
    const hasShort = dayVersions.includes(dayKey);
    const hasLongSameDay = dayVersions.some(
      (version) => version.length === 14 && version.startsWith(dayKey),
    );
    if (hasShort && hasLongSameDay) {
      errors.push(
        `Version-collision op ${dayKey}: zowel korte (${dayKey}) als 14-cijfer migrations aanwezig. Gebruik alleen 14-cijfer varianten per dag.`,
      );
    }
  }

  return errors;
}

try {
  const fileNames = readMigrationFiles();
  const errors = validateMigrations(fileNames);

  if (errors.length > 0) {
    console.error("[migrations:check] Compatibiliteitsfouten gevonden:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `[migrations:check] OK (${fileNames.length} migrations). Bestandsversies zijn compatibel.`,
  );
} catch (error) {
  console.error(
    `[migrations:check] Mislukt: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
