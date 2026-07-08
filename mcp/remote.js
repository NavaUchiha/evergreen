#!/usr/bin/env node
/* Evergreen MCP — remote HTTP server for claude.ai (browser) custom connectors.
   Streamable HTTP transport, stateless (a fresh server per request).
   Sits behind Caddy at a secret path; listens only on localhost.
   Config via env: EVERGREEN_API, EVERGREEN_TOKEN, EVERGREEN_SITE, MCP_PORT. */
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./tools.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

// simple liveness check (not part of MCP)
app.get("/healthz", (_req, res) => res.json({ ok: true, service: "evergreen-mcp" }));

async function handle(req, res) {
  try {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error("MCP error:", e);
    if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
  }
}

// Streamable HTTP: POST carries requests; GET/DELETE are for session streams (n/a in stateless).
app.post("/", handle);
app.post("/mcp", handle);
app.get("/", (_req, res) => res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (use POST)" }, id: null }));
app.get("/mcp", (_req, res) => res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (use POST)" }, id: null }));

const PORT = process.env.MCP_PORT || 3001;
app.listen(PORT, "127.0.0.1", () => console.log(`Evergreen MCP (HTTP) on 127.0.0.1:${PORT}`));
