/* Evergreen API — Express + SQLite.
   Reads are open; writes require  Authorization: Bearer <EVERGREEN_TOKEN>.
   CORS is limited to the configured frontend origins. */
const express = require("express");
const cors = require("cors");
const store = require("./db");

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.EVERGREEN_TOKEN || "";
const ORIGINS = (process.env.EVERGREEN_ORIGINS ||
  "https://navauchiha.github.io,http://localhost:8000,http://127.0.0.1:8000")
  .split(",").map(s => s.trim()).filter(Boolean);

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(cors({
  origin(origin, cb) {
    if (!origin || ORIGINS.includes(origin)) return cb(null, true);
    cb(null, false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// --- helpers ---
const slugify = (s) => String(s || "").toLowerCase().trim()
  .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

function requireAuth(req, res, next) {
  if (!TOKEN) return res.status(503).json({ error: "Server has no write token configured" });
  const h = req.get("authorization") || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (tok !== TOKEN) return res.status(401).json({ error: "Invalid or missing token" });
  next();
}
const wrap = (fn) => (req, res) => {
  try { fn(req, res); }
  catch (e) {
    if (String(e.message || "").includes("UNIQUE")) return res.status(409).json({ error: "slug already exists" });
    console.error(e); res.status(500).json({ error: "server error" });
  }
};

// --- health / auth check ---
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "evergreen", writeable: !!TOKEN }));
app.get("/api/verify", requireAuth, (_req, res) => res.json({ ok: true }));

// --- concepts ---
app.get("/api/concepts", wrap((_req, res) => res.json(store.listConcepts())));

app.get("/api/concepts/:slug", wrap((req, res) => {
  const c = store.getConcept(req.params.slug);
  if (!c) return res.status(404).json({ error: "not found" });
  res.json(c);
}));

app.post("/api/concepts", requireAuth, wrap((req, res) => {
  const { title, note, body, notes, tags } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ error: "title required" });
  const slug = slugify(req.body.slug || title);
  if (!slug) return res.status(400).json({ error: "could not derive slug" });
  res.status(201).json(store.createConcept({ slug, title: String(title).trim(), note, body, notes, tags }));
}));

app.put("/api/concepts/:slug", requireAuth, wrap((req, res) => {
  const { title, note, body, notes, tags } = req.body || {};
  const updated = store.editConcept(req.params.slug, { title, note, body, notes, tags });
  if (!updated) return res.status(404).json({ error: "not found" });
  res.json(updated);
}));

app.delete("/api/concepts/:slug", requireAuth, wrap((req, res) => {
  res.json({ deleted: store.deleteConcept(req.params.slug) });
}));

// --- comments ---
app.post("/api/concepts/:slug/comments", requireAuth, wrap((req, res) => {
  const body = String((req.body || {}).body || "").trim();
  if (!body) return res.status(400).json({ error: "comment body required" });
  const c = store.addComment(req.params.slug, body);
  if (!c) return res.status(404).json({ error: "concept not found" });
  res.status(201).json(c);
}));
app.delete("/api/comments/:id", requireAuth, wrap((req, res) => {
  res.json({ deleted: store.deleteComment(Number(req.params.id)) });
}));

// --- review tracking (1·4·7) ---
app.post("/api/concepts/:slug/review", requireAuth, wrap((req, res) => {
  const c = store.review(req.params.slug);
  if (!c) return res.status(404).json({ error: "not found" });
  res.json(c);
}));
app.post("/api/concepts/:slug/forgot", requireAuth, wrap((req, res) => {
  const c = store.forgot(req.params.slug);
  if (!c) return res.status(404).json({ error: "not found" });
  res.json(c);
}));

// --- star / favorite ---
app.post("/api/concepts/:slug/star", requireAuth, wrap((req, res) => {
  const c = store.toggleStar(req.params.slug);
  if (!c) return res.status(404).json({ error: "not found" });
  res.json(c);
}));

// --- tags ---
app.get("/api/tags", wrap((_req, res) => res.json(store.tags())));

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Evergreen API on 127.0.0.1:${PORT} — origins: ${ORIGINS.join(", ")} — writeable: ${!!TOKEN}`);
});
