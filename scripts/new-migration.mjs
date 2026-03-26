import fs from "node:fs";
import path from "node:path";

const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
const rawName = process.argv.slice(2).join(" ").trim();

if (!rawName) {
  console.error("Gebruik: npm run migration:new -- <korte-omschrijving>");
  process.exit(1);
}

const slug = rawName
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

if (!slug) {
  console.error("Kon geen geldige slug maken. Gebruik letters/cijfers in de omschrijving.");
  process.exit(1);
}

const now = new Date();
const timestamp = [
  now.getUTCFullYear(),
  String(now.getUTCMonth() + 1).padStart(2, "0"),
  String(now.getUTCDate()).padStart(2, "0"),
  String(now.getUTCHours()).padStart(2, "0"),
  String(now.getUTCMinutes()).padStart(2, "0"),
  String(now.getUTCSeconds()).padStart(2, "0"),
].join("");

const fileName = `${timestamp}_${slug}.sql`;
const filePath = path.join(migrationsDir, fileName);

if (fs.existsSync(filePath)) {
  console.error(`Bestaat al: ${fileName}`);
  process.exit(1);
}

const template = `begin;

-- TODO: beschrijf wijziging

commit;
`;

fs.writeFileSync(filePath, template, "utf8");

console.log(`Nieuwe migration aangemaakt: supabase/migrations/${fileName}`);
