#!/usr/bin/env node
/* Evergreen MCP — stdio server for Claude Code (local).
   Config via env: EVERGREEN_API, EVERGREEN_TOKEN, EVERGREEN_SITE. */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./tools.js";

const server = createServer();
await server.connect(new StdioServerTransport());
