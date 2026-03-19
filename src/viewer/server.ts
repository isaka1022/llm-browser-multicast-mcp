#!/usr/bin/env node
import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { createReadStream, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3737;
const SESSIONS_DIR = resolve(process.cwd(), "logs", "sessions");
const WEBVIEW_DIST = resolve(process.cwd(), "dist", "webview");

// SSE clients
const sseClients = new Set<http.ServerResponse>();

// Track file sizes for change detection
const fileOffsets = new Map<string, number>();

function ensureSessionsDir() {
  try { fs.mkdirSync(SESSIONS_DIR, { recursive: true }); } catch { /* ignore */ }
}

function listSessions() {
  try {
    return readdirSync(SESSIONS_DIR)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => {
        const sessionId = f.replace(".jsonl", "");
        const content = readFileSync(path.join(SESSIONS_DIR, f), "utf-8");
        const firstLine = content.split("\n")[0];
        if (!firstLine) return null;
        try {
          const event = JSON.parse(firstLine);
          if (event.type !== "session_start") return null;
          return {
            sessionId,
            discussionType: event.discussionType,
            question: event.question,
            models: event.models,
            timestamp: event.timestamp,
            completed: content.includes('"type":"session_end"'),
          };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b!.timestamp.localeCompare(a!.timestamp));
  } catch { return []; }
}

function loadSession(sessionId: string) {
  const filePath = path.join(SESSIONS_DIR, `${sessionId}.jsonl`);
  try {
    const content = readFileSync(filePath, "utf-8");
    return content.split("\n")
      .filter((l) => l.trim())
      .map((l) => {
        try {
          const { _ts, ...event } = JSON.parse(l);
          return event;
        } catch { return null; }
      })
      .filter(Boolean);
  } catch { return []; }
}

function broadcast(msg: object) {
  const data = `data: ${JSON.stringify(msg)}\n\n`;
  for (const client of sseClients) {
    try { client.write(data); } catch { sseClients.delete(client); }
  }
}

// Poll for new JSONL lines and broadcast to SSE clients
function startFileWatcher() {
  setInterval(() => {
    try {
      const files = readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".jsonl"));
      for (const file of files) {
        const sessionId = file.replace(".jsonl", "");
        const filePath = path.join(SESSIONS_DIR, file);
        try {
          const stat = statSync(filePath);
          const offset = fileOffsets.get(sessionId) ?? 0;
          if (stat.size <= offset) continue;

          const fd = fs.openSync(filePath, "r");
          const buf = Buffer.alloc(stat.size - offset);
          fs.readSync(fd, buf, 0, buf.length, offset);
          fs.closeSync(fd);
          fileOffsets.set(sessionId, stat.size);

          for (const line of buf.toString("utf-8").split("\n")) {
            if (!line.trim()) continue;
            try {
              const { _ts, ...event } = JSON.parse(line);
              broadcast({ type: "session_event", sessionId, event });
              if (event.type === "session_start" || event.type === "session_end") {
                broadcast({ type: "session_list", sessions: listSessions() });
              }
            } catch { /* skip */ }
          }
        } catch { /* skip */ }
      }
    } catch { /* ignore */ }
  }, 500);
}

// Serve static files from dist/webview
function serveStatic(res: http.ServerResponse, filePath: string) {
  const ext = path.extname(filePath);
  const mimeTypes: Record<string, string> = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };
  const contentType = mimeTypes[ext] ?? "application/octet-stream";
  try {
    const stat = statSync(filePath);
    res.writeHead(200, { "Content-Type": contentType, "Content-Length": stat.size });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // SSE endpoint
  if (url.pathname === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write(": connected\n\n");
    sseClients.add(res);
    // Send current session list immediately
    res.write(`data: ${JSON.stringify({ type: "session_list", sessions: listSessions() })}\n\n`);
    req.on("close", () => sseClients.delete(res));
    return;
  }

  // REST: list sessions
  if (url.pathname === "/api/sessions" && req.method === "GET") {
    const sessions = listSessions();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(sessions));
    return;
  }

  // REST: load session events
  const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
  if (sessionMatch && req.method === "GET") {
    const events = loadSession(sessionMatch[1]);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(events));
    return;
  }

  // Static files from dist/webview
  let filePath = path.join(WEBVIEW_DIST, url.pathname === "/" ? "index.html" : url.pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(WEBVIEW_DIST, "index.html"); // SPA fallback
  }
  serveStatic(res, filePath);
});

ensureSessionsDir();
startFileWatcher();
server.listen(PORT, () => {
  console.log(`Council Viewer running at http://localhost:${PORT}`);
});
