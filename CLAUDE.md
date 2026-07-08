# CLAUDE.md — Evergreen: spaced-repetition learning

A personal spaced-repetition learning app ("Evergreen"). **Split architecture:**

- **Frontend** — static, on **GitHub Pages** (`NavaUchiha/evergreen`, this repo). Dark themed.
- **Backend** — Node + Express + **SQLite**, on an **OCI** instance, behind **Caddy** (HTTPS).
  Concepts, tags, comments, and 1·4·7 review tracking all persist server-side.

The frontend fetches everything from the API — there is no localStorage of content anymore.

## Frontend layout (repo root, served by Pages)

```
index.html            # landing page (warm, human copy)
concepts.html         # catalog — fetches /api/concepts, tag filter, links to reader/editor
reader.html           # one concept — renders body, tags, 1·4·7 controls, comments
editor.html           # write/edit a concept — live Markdown preview, needs write token
tracker.html          # the 1·4·7 review board — due/upcoming/mastered, review via API
assets/api.js          # API client (base URL + bearer-token helpers) — used by every page
assets/theme.css       # shared dark theme
assets/marked.min.js   # vendored Markdown renderer (pinned, offline)
import-concept.sh      # CLI: POST a local .md file into the backend
concepts/*.md          # ARCHIVE ONLY — original source files; app no longer reads these
```

**API base:** `https://140.245.233.61.sslip.io/api` (set in `assets/api.js`).
`sslip.io` gives the OCI IP a DNS name so Caddy can hold a Let's Encrypt cert (no domain bought).

## Backend (`server/`, deployed to the OCI box, NOT to Pages)

```
server/server.js            # Express app — routes + CORS + bearer auth
server/db.js                # SQLite schema + data access (better-sqlite3)
server/package.json         # deps: express, cors, better-sqlite3
server/Caddyfile            # reverse proxy + auto-HTTPS for 140.245.233.61.sslip.io
server/evergreen-api.service# systemd unit (User=ubuntu, EnvironmentFile=.env)
```

Deployed to `/home/ubuntu/evergreen/` on the instance. DB at `/home/ubuntu/evergreen/data/evergreen.db`.
Secrets live in `server/.env` on the box (never committed): `EVERGREEN_TOKEN`, `EVERGREEN_ORIGINS`.

**Access the box:** `ssh oci-test`. Service: `sudo systemctl {status,restart} evergreen-api`.
Redeploy backend: `tar` the `server/` dir over ssh, `npm install --omit=dev`, restart the service.

### API surface
```
GET    /api/health
GET    /api/concepts                       list (no body)
POST   /api/concepts            [auth]      {title, slug?, note, body, tags[]}
GET    /api/concepts/:slug                  full: body, tags, comments, reviews
PUT    /api/concepts/:slug      [auth]      update {title, note, body, tags}
DELETE /api/concepts/:slug      [auth]
POST   /api/concepts/:slug/comments [auth]  {body}
DELETE /api/comments/:id        [auth]
POST   /api/concepts/:slug/review   [auth]  advance 1·4·7 stage
POST   /api/concepts/:slug/forgot   [auth]  reset stage, re-anchor to today
GET    /api/tags                            tags with counts
```
Reads are open; **writes need `Authorization: Bearer <password>`**. The password is set in
`server/.env` (`EVERGREEN_TOKEN`) on the box; the user enters it once via a styled modal
(`EvergreenAPI.promptPassword`, verified against `GET /api/verify`) and it's kept in the browser
(localStorage if "remember", else sessionStorage). It is NOT in the repo.

## Backups

Nightly `cron` at 02:00 UTC on the box runs `~/evergreen/backup.sh`: a consistent SQLite
snapshot (better-sqlite3 online backup) → gzip → HTTP PUT to an **OCI Object Storage** bucket
`evergreen-backups` via a write-only **Pre-Authenticated Request** (URL stored in
`~/evergreen/backup.env`, the only secret; no OCI keys on the box). Restore = download the latest
`evergreen-*.db.gz`, gunzip, replace `~/evergreen/data/evergreen.db`, restart the service.

## MCP servers (`mcp/`)

Tools: `publish_concept(title, summary, tags, body)`, `list_due_reviews()`, `get_concept(slug)`.
Shared defs in `mcp/tools.js` (`createServer`). Two transports:
- `mcp/server.js` — **stdio**, for Claude Code (registered via `claude mcp add`, token in env).
- `mcp/remote.js` — **Streamable HTTP** (Express, stateless), for **claude.ai** browser connectors.
  Deployed on the box as systemd `evergreen-mcp` (port 3001), exposed by Caddy at a *secret path*
  `https://<host>/mcp/<SECRET>`. The secret is only in the box's Caddyfile; rotate to revoke.

## Networking

The instance now has a **reserved** public IP `140.245.233.61` (survives stop/start). If it ever
changes, update: `assets/api.js` BASE, `mcp/tools.js` default, the box Caddyfile hostname, the MCP
`.env` `EVERGREEN_API`, and `~/.ssh/config`. Security list allows 22/80/443/8080.

## The 1·4·7 rule (now server-side)

Reviewed **1, 4, 7 days** after day-0. `review` advances the stage; after stage 3 → **mastered**.
`forgot` re-anchors day-0 to today and restarts. `due_at` is computed by the API from
`anchored_at + [1,4,7][stage]`.

## Concept page format — structure **v2** (every page follows this exact order)

Each concept is stored as separate section fields (not one blob). Defined once in
`assets/sections.js` (the single source of truth the editor and reader both read), mirrored by
the SQLite columns and the MCP tool params. `structure_version` records which template a page
used (default `"v2"`).

| # | Section (field) | Icon | What goes here |
|---|---|---|---|
| 1 | Problem Statement (`problem`) | 🧩 | LC link, examples, constraints |
| 2 | First Instinct (`first_instinct`) | 💭 | blank placeholder — the user fills their raw cold take |
| 3 | Key Takeaways (`key_takeaways`) | 💡 | 3–5 bullet points, the most important things to remember |
| 4 | Quick Version (`quick`) | ⚡ | the 60-second recap |
| 5 | Rundown (`rundown`) | 📓 | full walkthrough, code, complexity (level-table style; Master Theorem only as cross-check) |
| 6 | Comments (`comments`) | 💬 | blank placeholder at the bottom (timestamped log, not a section field) |

Tone for the written sections: verbose, in-depth, but simple — show the reasoning that
*generates* the answer, how you'd derive it cold. This structure is also embedded verbatim in the
`publish_concept` / `update_concept` MCP tool descriptions, so an agent authoring pages must follow it.

To change the template: edit `assets/sections.js` (adds/renames render everywhere), add the matching
column in `server/db.js`, thread it through `server/server.js` + `mcp/tools.js`, and bump
`structure_version`.

## Writing a concept now

- **Inline (easiest):** open a concept in `reader.html` and click **＋ add / edit** on any section
  — type in place, Save writes just that section via the API.
- **Full editor:** `editor.html` — title, summary, tags, and one textarea per section with a combined
  live preview.
Both POST/PUT to the backend and persist in SQLite. Legacy `.md` bulk import (lands in Rundown):
`EVERGREEN_TOKEN=… ./import-concept.sh concepts/<slug>.md "tag1,tag2"`.

## Deployment

- **Frontend:** commit + push `main` → GitHub Pages auto-deploys. Live at
  `https://navauchiha.github.io/evergreen/`.
- **Backend:** lives on the OCI instance (`ssh oci-test`), managed by systemd + Caddy.
  It is only reachable while that instance is running.
