import "dotenv/config";

import http from "node:http";
import { Buffer } from "node:buffer";

import openAiHandler from "../api/openai/chat-completions.ts";
import adminHandler from "../api/admin/index.ts";
import resetPasswordLogHandler from "../api/auth/reset-password-log.ts";
import githubIssuesHandler from "../api/github/issues.ts";

const routes = new Map([
  ["OPTIONS /api/admin", adminHandler],
  ["GET /api/admin", adminHandler],
  ["PATCH /api/admin", adminHandler],
  ["OPTIONS /api/openai/chat-completions", openAiHandler],
  ["POST /api/openai/chat-completions", openAiHandler],
  ["OPTIONS /api/auth/reset-password-log", resetPasswordLogHandler],
  ["POST /api/auth/reset-password-log", resetPasswordLogHandler],
  ["OPTIONS /api/github/issues", githubIssuesHandler],
  ["POST /api/github/issues", githubIssuesHandler],
]);

function resolveListenPort() {
  const baseUrl = process.env.APP_BASE_URL?.trim();
  if (baseUrl) {
    try {
      const parsed = new URL(baseUrl);
      if (
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1"
      ) {
        return parsed.port ? Number(parsed.port) : 3000;
      }
    } catch {
      // Ignore invalid URLs and fall back to the default dev port.
    }
  }

  return 3001;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function createResponse(res) {
  return {
    status(code) {
      res.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      res.setHeader(name, value);
      return this;
    },
    json(payload) {
      if (!res.getHeader("Content-Type")) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      }
      res.end(JSON.stringify(payload));
      return this;
    },
    send(payload) {
      if (payload === undefined || payload === null) {
        res.end();
        return this;
      }

      if (Buffer.isBuffer(payload)) {
        res.end(payload);
        return this;
      }

      if (typeof payload === "object") {
        if (!res.getHeader("Content-Type")) {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
        }
        res.end(JSON.stringify(payload));
        return this;
      }

      res.end(String(payload));
      return this;
    },
    end(payload) {
      if (payload !== undefined) {
        return this.send(payload);
      }
      res.end();
      return this;
    },
  };
}

function sendNotFound(res) {
  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ message: "Not found" }));
}

const port = resolveListenPort();

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "localhost"}`,
  );
  const routeKey = `${req.method ?? "GET"} ${requestUrl.pathname}`;
  const handler = routes.get(routeKey);

  if (!handler) {
    sendNotFound(res);
    return;
  }

  const rawBody = await readBody(req);
  let body = rawBody;
  if (rawBody.trim()) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = rawBody;
    }
  }

  req.body = body;

  try {
    await handler(req, createResponse(res));
  } catch (error) {
    console.error(
      `Dev API handler failed for ${routeKey}:`,
      error instanceof Error ? error.stack ?? error.message : error,
    );
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ message: "Dev API handler failed" }));
      return;
    }
    res.end();
  }
});

server.listen(port, () => {
  console.log(`Dev API server running at http://localhost:${port}`);
});

function shutdown(signal) {
  server.close(() => {
    process.exit(signal === "SIGINT" ? 130 : 143);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
