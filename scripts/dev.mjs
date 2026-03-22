import "dotenv/config";

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const child = spawn("npm", ["run", "dev:web"], {
  cwd: path.resolve(__dirname, ".."),
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  process.exit(
    code ??
      (signal === "SIGINT"
        ? 130
        : signal === "SIGTERM"
          ? 143
          : 1),
  );
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
