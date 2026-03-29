import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const DEV_API_PORT = 3001;

function stopExistingDevApiServer(port) {
  try {
    const output = execSync(`lsof -ti tcp:${port}`, {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const pids = output
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (!pids.length) return;

    for (const pid of pids) {
      try {
        process.kill(Number(pid), "SIGTERM");
      } catch {
        // The process may already be gone; continue with the others.
      }
    }
  } catch {
    // No listener on this port or lsof unavailable; continue with startup.
  }
}

stopExistingDevApiServer(DEV_API_PORT);

const api = spawn(process.execPath, [
  "--experimental-strip-types",
  path.join(__dirname, "dev-api-server.mjs"),
], {
  cwd: projectRoot,
  env: process.env,
  stdio: "inherit",
});

const expo = spawn("npx", ["expo", "start", "--web", "--port", "8081", "--non-interactive"], {
  cwd: projectRoot,
  env: process.env,
  stdio: "inherit",
});

function shutdown(signal) {
  api.kill(signal);
  expo.kill(signal);
}

api.on("exit", (code) => {
  if (typeof code === "number" && code !== 0) {
    expo.kill("SIGTERM");
    process.exit(code);
  }
});

expo.on("exit", (code) => {
  if (typeof code === "number" && code !== 0) {
    api.kill("SIGTERM");
    process.exit(code);
  }
});

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
