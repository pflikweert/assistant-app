import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const VS_CODE_MCP_PATH = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "Code",
  "User",
  "mcp.json",
);

function safeReadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function resolveStitchApiKey() {
  if (process.env.STITCH_API_KEY && process.env.STITCH_API_KEY.trim()) {
    return process.env.STITCH_API_KEY.trim();
  }

  const vscodeMcp = safeReadJson(VS_CODE_MCP_PATH);
  const keyFromVSCode =
    vscodeMcp?.servers?.stitch?.env?.STITCH_API_KEY ||
    vscodeMcp?.servers?.stitch?.STITCH_API_KEY;

  if (typeof keyFromVSCode === "string" && keyFromVSCode.trim()) {
    return keyFromVSCode.trim();
  }

  return null;
}

export function getVsCodeMcpPath() {
  return VS_CODE_MCP_PATH;
}
