import { spawnSync } from "node:child_process";

import { getVsCodeMcpPath, resolveStitchApiKey } from "./stitch-config.mjs";

function main() {
  const stitchApiKey = resolveStitchApiKey();
  if (!stitchApiKey) {
    console.error("Geen STITCH_API_KEY gevonden voor Stitch CLI.");
    console.error(
      `Zet STITCH_API_KEY in je shell/.env of in VS Code MCP config: ${getVsCodeMcpPath()}`,
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const cliArgs = ["-y", "@_davideast/stitch-mcp"];

  if (args.length === 0) {
    cliArgs.push("tool", "-s");
  } else if (args[0] === "tool") {
    cliArgs.push(...args);
  } else {
    cliArgs.push("tool", ...args);
  }

  const result = spawnSync("npx", cliArgs, {
    stdio: "inherit",
    env: {
      ...process.env,
      STITCH_API_KEY: stitchApiKey,
    },
  });

  process.exit(result.status ?? 1);
}

main();
