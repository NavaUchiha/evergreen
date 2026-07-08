/* Evergreen — SQLite schema + data access.
   One file DB at data/evergreen.db. Everything the app needs:
   concepts (with full markdown body + 1·4·7 tracking), tags (m2m), comments, review log. */
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DATA_DIR = process.env.EVERGREEN_DATA || path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, "evergreen.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS concepts (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  note TEXT DEFAULT '',
  body TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  stage INTEGER NOT NULL DEFAULT 0,     -- 0..3 on the 1·4·7 ladder (3 = mastered)
  anchored_at INTEGER NOT NULL          -- day-0 for the current ladder
);
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS concept_tags (
  concept_id INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (concept_id, tag_id)
);
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY,
  concept_id INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY,
  concept_id INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  at INTEGER NOT NULL,
  action TEXT NOT NULL,                 -- 'reviewed' | 'forgot'
  stage INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_concept ON comments(concept_id);
CREATE INDEX IF NOT EXISTS idx_reviews_concept ON reviews(concept_id);
`);

// --- migrations ---
const cols = db.prepare("PRAGMA table_info(concepts)").all().map(c => c.name);
if (!cols.includes("starred")) db.exec("ALTER TABLE concepts ADD COLUMN starred INTEGER NOT NULL DEFAULT 0");
// content sections (each markdown): problem, first instinct, key takeaways, quick version, rundown
for (const c of ["problem", "first_instinct", "key_takeaways", "quick", "rundown"]) {
  if (!cols.includes(c)) db.exec(`ALTER TABLE concepts ADD COLUMN ${c} TEXT NOT NULL DEFAULT ''`);
}
// which page template a concept was authored with
if (!cols.includes("structure_version")) db.exec("ALTER TABLE concepts ADD COLUMN structure_version TEXT NOT NULL DEFAULT 'v2'");
// raw First Instinct notes staged for refinement (Claude refines, then writes first_instinct)
if (!cols.includes("first_instinct_draft")) db.exec("ALTER TABLE concepts ADD COLUMN first_instinct_draft TEXT NOT NULL DEFAULT ''");

const DAY = 86400000;
const OFFSETS = [1, 4, 7];
function dueAt(row) { return row.stage >= 3 ? null : row.anchored_at + OFFSETS[row.stage] * DAY; }

/* ---- tags ---- */
const tagByName = db.prepare("SELECT id FROM tags WHERE name = ?");
const insertTag = db.prepare("INSERT INTO tags(name) VALUES(?)");
function tagId(name) {
  const row = tagByName.get(name);
  return row ? row.id : insertTag.run(name).lastInsertRowid;
}
const clearConceptTags = db.prepare("DELETE FROM concept_tags WHERE concept_id = ?");
const linkTag = db.prepare("INSERT OR IGNORE INTO concept_tags(concept_id, tag_id) VALUES(?, ?)");
const pruneOrphanTags = db.prepare("DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM concept_tags)");
function setTags(conceptId, names) {
  clearConceptTags.run(conceptId);
  const clean = [...new Set((names || []).map(n => String(n).trim().toLowerCase()).filter(Boolean))];
  for (const n of clean) linkTag.run(conceptId, tagId(n));
  pruneOrphanTags.run();
}
const tagsForConcept = db.prepare(
  "SELECT t.name FROM tags t JOIN concept_tags ct ON ct.tag_id = t.id WHERE ct.concept_id = ? ORDER BY t.name"
);
function conceptTags(id) { return tagsForConcept.all(id).map(r => r.name); }

/* ---- concepts ---- */
const insConcept = db.prepare(
  `INSERT INTO concepts(slug,title,note,body,problem,first_instinct,key_takeaways,quick,rundown,structure_version,created_at,updated_at,stage,anchored_at)
   VALUES(@slug,@title,@note,@body,@problem,@first_instinct,@key_takeaways,@quick,@rundown,@structure_version,@now,@now,0,@now)`
);
const updConcept = db.prepare(
  `UPDATE concepts SET title=@title, note=@note, body=@body,
     problem=@problem, first_instinct=@first_instinct, key_takeaways=@key_takeaways, quick=@quick, rundown=@rundown,
     structure_version=@structure_version, updated_at=@now
   WHERE slug=@slug`
);
const getBySlug = db.prepare("SELECT * FROM concepts WHERE slug = ?");
const delBySlug = db.prepare("DELETE FROM concepts WHERE slug = ?");
const listConcepts = db.prepare("SELECT * FROM concepts ORDER BY updated_at DESC");

function shape(row, { withBody = false } = {}) {
  if (!row) return null;
  const out = {
    slug: row.slug, title: row.title, note: row.note,
    created_at: row.created_at, updated_at: row.updated_at,
    stage: row.stage, anchored_at: row.anchored_at, due_at: dueAt(row),
    mastered: row.stage >= 3, starred: !!row.starred, tags: conceptTags(row.id)
  };
  out.structure_version = row.structure_version || "v2";
  if (withBody) {
    out.body = row.body;                       // legacy single-body (fallback)
    out.problem = row.problem || "";
    out.first_instinct = row.first_instinct || "";
    out.key_takeaways = row.key_takeaways || "";
    out.quick = row.quick || "";
    out.rundown = row.rundown || "";
    out.first_instinct_draft = row.first_instinct_draft || "";
  }
  return out;
}

const createConcept = db.transaction((p) => {
  const now = Date.now();
  const info = insConcept.run({ slug: p.slug, title: p.title, note: p.note || "", body: p.body || "",
    problem: p.problem || "", first_instinct: p.first_instinct || "", key_takeaways: p.key_takeaways || "",
    quick: p.quick || "", rundown: p.rundown || "", structure_version: p.structure_version || "v2", now });
  setTags(info.lastInsertRowid, p.tags);
  return shape(getBySlug.get(p.slug), { withBody: true });
});

const editConcept = db.transaction((slug, p) => {
  const row = getBySlug.get(slug);
  if (!row) return null;
  updConcept.run({ slug, title: p.title ?? row.title, note: p.note ?? row.note, body: p.body ?? row.body,
    problem: p.problem ?? row.problem, first_instinct: p.first_instinct ?? row.first_instinct,
    key_takeaways: p.key_takeaways ?? row.key_takeaways, quick: p.quick ?? row.quick, rundown: p.rundown ?? row.rundown,
    structure_version: p.structure_version ?? row.structure_version, now: Date.now() });
  if (p.tags !== undefined) setTags(row.id, p.tags);
  return shape(getBySlug.get(slug), { withBody: true });
});

/* ---- comments ---- */
const insComment = db.prepare("INSERT INTO comments(concept_id,body,created_at) VALUES(?,?,?)");
const commentsFor = db.prepare("SELECT id, body, created_at FROM comments WHERE concept_id = ? ORDER BY created_at ASC");
const delComment = db.prepare("DELETE FROM comments WHERE id = ?");

/* ---- reviews (1·4·7) ---- */
const insReview = db.prepare("INSERT INTO reviews(concept_id,at,action,stage) VALUES(?,?,?,?)");
const reviewsFor = db.prepare("SELECT at, action, stage FROM reviews WHERE concept_id = ? ORDER BY at ASC");
const setStage = db.prepare("UPDATE concepts SET stage=?, anchored_at=?, updated_at=? WHERE id=?");

const doReview = db.transaction((slug) => {
  const row = getBySlug.get(slug); if (!row) return null;
  const now = Date.now();
  insReview.run(row.id, now, "reviewed", row.stage);
  const next = Math.min(row.stage + 1, 3);
  setStage.run(next, row.anchored_at, now, row.id);
  return shape(getBySlug.get(slug));
});
const doForgot = db.transaction((slug) => {
  const row = getBySlug.get(slug); if (!row) return null;
  const now = Date.now();
  insReview.run(row.id, now, "forgot", row.stage);
  setStage.run(0, now, now, row.id);           // re-anchor to today
  return shape(getBySlug.get(slug));
});

module.exports = {
  db,
  listConcepts: () => listConcepts.all().map(r => shape(r)),
  getConcept: (slug) => {
    const row = getBySlug.get(slug);
    if (!row) return null;
    const c = shape(row, { withBody: true });
    c.comments = commentsFor.all(row.id);
    c.reviews = reviewsFor.all(row.id);
    return c;
  },
  createConcept, editConcept,
  deleteConcept: (slug) => { const n = delBySlug.run(slug).changes; if (n) pruneOrphanTags.run(); return n > 0; },
  addComment: (slug, body) => {
    const row = getBySlug.get(slug); if (!row) return null;
    const now = Date.now();
    const info = insComment.run(row.id, body, now);
    return { id: info.lastInsertRowid, body, created_at: now };
  },
  deleteComment: (id) => delComment.run(id).changes > 0,
  review: doReview, forgot: doForgot,
  toggleStar: (slug) => {
    const row = getBySlug.get(slug); if (!row) return null;
    db.prepare("UPDATE concepts SET starred = ? WHERE id = ?").run(row.starred ? 0 : 1, row.id);
    return shape(getBySlug.get(slug));
  },
  setDraft: (slug, raw) => {
    const row = getBySlug.get(slug); if (!row) return null;
    db.prepare("UPDATE concepts SET first_instinct_draft = ? WHERE id = ?").run(String(raw || ""), row.id);
    return shape(getBySlug.get(slug), { withBody: true });   // withBody → problem + key_takeaways available
  },
  tags: () => db.prepare(
    `SELECT t.name AS name, COUNT(ct.concept_id) AS count
     FROM tags t LEFT JOIN concept_tags ct ON ct.tag_id = t.id
     GROUP BY t.id ORDER BY count DESC, t.name ASC`).all()
};
