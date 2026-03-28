import { spawnSync } from "node:child_process";

import { getVsCodeMcpPath, resolveStitchApiKey } from "./stitch-config.mjs";

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    env: options.env ?? process.env,
  });
}

function ensureCodexAvailable() {
  const result = run("codex", ["--version"]);
  if (result.status !== 0) {
    console.error("Codex CLI is niet beschikbaar in je PATH.");
    process.exit(1);
  }
}

function addOrReplaceStitchMcp(stitchApiKey) {
  run("codex", ["mcp", "remove", "stitch"]);

  const add = run("codex", [
    "mcp",
    "add",
    "stitch",
    "--env",
    `STITCH_API_KEY=${stitchApiKey}`,
    "--",
    "npx",
    "-y",
    "@_davideast/stitch-mcp",
    "proxy",
  ]);

  if (add.status !== 0) {
    console.error(add.stderr || add.stdout || "Kon Stitch MCP niet toevoegen.");
    process.exit(1);
  }
}

function verifyConfig() {
  const get = run("codex", ["mcp", "get", "stitch"]);
  if (get.status !== 0) {
    console.error(get.stderr || get.stdout || "Stitch MCP verificatie mislukt.");
    process.exit(1);
  }

  console.log(get.stdout.trim());
}

function main() {
  ensureCodexAvailable();

  const stitchApiKey = resolveStitchApiKey();
  if (!stitchApiKey) {
    console.error("Geen STITCH_API_KEY gevonden.");
    console.error(
      `Zet STITCH_API_KEY in je shell/.env of in VS Code MCP config: ${getVsCodeMcpPath()}`,
    );
    process.exit(1);
  }

  addOrReplaceStitchMcp(stitchApiKey);
  verifyConfig();

  console.log("");
  console.log("Stitch MCP staat nu in Codex.");
  console.log(
    "Belangrijk: herstart je Codex sessie voordat je Stitch tools in-chat gebruikt.",
  );
}

main();
