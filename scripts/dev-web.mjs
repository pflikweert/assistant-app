import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

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
