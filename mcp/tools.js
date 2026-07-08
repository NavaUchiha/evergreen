/* Evergreen MCP — shared tool definitions, used by both the stdio server (server.js,
   for Claude Code) and the remote HTTP server (remote.js, for claude.ai in the browser). */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const API = (process.env.EVERGREEN_API || "https://140.245.233.61.sslip.io/api").replace(/\/$/, "");
const TOKEN = process.env.EVERGREEN_TOKEN || "";
const SITE = (process.env.EVERGREEN_SITE || "https://navauchiha.github.io/evergreen").replace(/\/$/, "");

async function api(method, path, body, auth) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) headers["Authorization"] = "Bearer " + TOKEN;
  const res = await fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let data = null; try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
  return data;
}
const ok = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] });
const fail = (msg) => ({ isError: true, content: [{ type: "text", text: "Error: " + msg }] });
const urlFor = (slug) => `${SITE}/reader.html?c=${encodeURIComponent(slug)}`;

export function createServer() {
  const server = new McpServer({ name: "evergreen", version: "1.0.0" });

  server.tool(
    "publish_concept",
    "Save a new concept page to Evergreen (title, summary, tags, Markdown body). Returns its id (slug) and public URL.",
    {
      title: z.string().describe("Concept title, e.g. \"Dijkstra's shortest path\""),
      summary: z.string().optional().describe("One-line summary shown in the catalog"),
      tags: z.array(z.string()).optional().describe("Tags, e.g. [\"graphs\",\"greedy\"]"),
      body: z.string().describe("The full concept content in Markdown")
    },
    async ({ title, summary, tags, body }) => {
      if (!TOKEN) return fail("EVERGREEN_TOKEN not configured — cannot publish.");
      try {
        const c = await api("POST", "/concepts", { title, note: summary || "", tags: tags || [], body }, true);
        return ok({ id: c.slug, slug: c.slug, url: urlFor(c.slug), title: c.title, tags: c.tags });
      } catch (e) { return fail(e.message); }
    }
  );

  server.tool(
    "list_due_reviews",
    "List concepts due for review today (or overdue) per the 1·4·7 spaced-repetition schedule.",
    {},
    async () => {
      try {
        const all = await api("GET", "/concepts");
        const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
        const due = all
          .filter(c => !c.mastered && c.due_at && c.due_at <= endOfToday.getTime())
          .map(c => {
            const days = Math.round((new Date(c.due_at).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
            return { slug: c.slug, title: c.title, stage: c.stage, tags: c.tags,
                     when: days < 0 ? `${-days}d overdue` : "due today", url: urlFor(c.slug) };
          })
          .sort((a, b) => a.when.localeCompare(b.when));
        return ok({ count: due.length, due });
      } catch (e) { return fail(e.message); }
    }
  );

  server.tool(
    "get_concept",
    "Fetch a single concept page's full content (Markdown body, tags, tracking, comments) by slug.",
    { slug: z.string().describe("The concept slug, e.g. \"max-subarray\"") },
    async ({ slug }) => {
      try {
        const c = await api("GET", "/concepts/" + encodeURIComponent(slug));
        return ok({
          slug: c.slug, title: c.title, summary: c.note, tags: c.tags,
          starred: c.starred, stage: c.stage, mastered: c.mastered, due_at: c.due_at,
          body: c.body, comments: c.comments, url: urlFor(c.slug)
        });
      } catch (e) { return fail(e.message.includes("404") ? `No concept "${slug}"` : e.message); }
    }
  );

  return server;
}
