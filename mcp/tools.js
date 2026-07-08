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
      problem: z.string().optional().describe("Section: 🧩 Problem statement (Markdown)"),
      first_instinct: z.string().optional().describe("Section: 💭 First Instinct — raw first thoughts (Markdown)"),
      quick: z.string().optional().describe("Section: ⚡ Quick Version — 60-second recap (Markdown)"),
      rundown: z.string().optional().describe("Section: 📓 Rundown — full walkthrough (Markdown)"),
      body: z.string().optional().describe("Legacy single-body Markdown (prefer the section fields)")
    },
    async ({ title, summary, tags, problem, first_instinct, quick, rundown, body }) => {
      if (!TOKEN) return fail("EVERGREEN_TOKEN not configured — cannot publish.");
      try {
        const c = await api("POST", "/concepts", { title, note: summary || "", tags: tags || [], problem, first_instinct, quick, rundown, body }, true);
        return ok({ id: c.slug, slug: c.slug, url: urlFor(c.slug), title: c.title, tags: c.tags });
      } catch (e) { return fail(e.message); }
    }
  );

  server.tool(
    "update_concept",
    "Update an existing Evergreen concept in place, by slug — improve a page without creating a duplicate. Any of title/summary/tags/body may be given; omit a field to leave it unchanged.",
    {
      slug: z.string().describe("Slug of the concept to update, e.g. \"max-subarray\""),
      title: z.string().optional().describe("New title"),
      summary: z.string().optional().describe("New one-line summary"),
      tags: z.array(z.string()).optional().describe("New full tag list (replaces existing)"),
      problem: z.string().optional().describe("Section: 🧩 Problem statement (replaces existing)"),
      first_instinct: z.string().optional().describe("Section: 💭 First Instinct (replaces existing)"),
      quick: z.string().optional().describe("Section: ⚡ Quick Version (replaces existing)"),
      rundown: z.string().optional().describe("Section: 📓 Rundown (replaces existing)"),
      body: z.string().optional().describe("Legacy single-body Markdown (replaces existing)")
    },
    async ({ slug, title, summary, tags, problem, first_instinct, quick, rundown, body }) => {
      if (!TOKEN) return fail("EVERGREEN_TOKEN not configured — cannot update.");
      const payload = {};
      if (title !== undefined) payload.title = title;
      if (summary !== undefined) payload.note = summary;
      if (tags !== undefined) payload.tags = tags;
      const sects = { problem, first_instinct, quick, rundown, body };
      for (const k of Object.keys(sects)) if (sects[k] !== undefined) payload[k] = sects[k];
      if (Object.keys(payload).length === 0) return fail("Nothing to update — provide a field to change.");
      try {
        const c = await api("PUT", "/concepts/" + encodeURIComponent(slug), payload, true);
        return ok({ id: c.slug, slug: c.slug, url: urlFor(c.slug), title: c.title, tags: c.tags, updated_at: c.updated_at });
      } catch (e) { return fail(e.message.includes("404") ? `No concept "${slug}"` : e.message); }
    }
  );

  server.tool(
    "delete_concept",
    "Permanently delete an Evergreen concept by slug. This cannot be undone.",
    { slug: z.string().describe("Slug of the concept to delete") },
    async ({ slug }) => {
      if (!TOKEN) return fail("EVERGREEN_TOKEN not configured — cannot delete.");
      try {
        const r = await api("DELETE", "/concepts/" + encodeURIComponent(slug), undefined, true);
        return ok({ deleted: !!(r && r.deleted), slug });
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
          problem: c.problem, first_instinct: c.first_instinct, quick: c.quick, rundown: c.rundown,
          body: c.body, comments: c.comments, url: urlFor(c.slug)
        });
      } catch (e) { return fail(e.message.includes("404") ? `No concept "${slug}"` : e.message); }
    }
  );

  return server;
}
