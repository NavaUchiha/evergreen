# CLAUDE.md — Recall: spaced-repetition DSA notes

This repo is a personal spaced-repetition learning system ("Evergreen"), published via
GitHub Pages. It has a **landing page**, a **concepts catalog**, a **1·4·7 tracker**, and
a **markdown reader**, all sharing one concept list and one dark theme. Concept content is
written elsewhere (in long Socratic sessions) and pasted in as `concepts/*.md` files; your
job in this repo is scaffolding, wiring, git, and deployment — **not** authoring the
derivations. When a new concept file appears, register it and push.

## Layout

```
index.html            # landing page (dark) — intro + entry points
tracker.html          # the 1·4·7 tracker (standalone, localStorage, offline)
concepts.html         # catalog: lists every concept, links into the reader
reader.html           # markdown viewer — reader.html?c=<slug> renders concepts/<slug>.md
concepts/<slug>.md     # one verbose page per concept (raw Markdown)
concepts/_template.md  # the format every concept page follows
assets/concepts.js     # SINGLE SOURCE OF TRUTH: window.CONCEPTS = [{title,slug,note}]
assets/theme.css       # shared dark theme
assets/marked.min.js   # vendored Markdown renderer (pinned, offline)
CLAUDE.md              # this file
add-concept.sh         # helper: registers a concept in assets/concepts.js + commits
```

All four pages read `assets/concepts.js`. Slugs are **bare** (`max-subarray`); pages derive
their own paths (`reader.html?c=<slug>` to view, `concepts/<slug>.md` to fetch).

## The 1·4·7 spaced-repetition rule

A concept is reviewed **1, 4, and 7 days** after it's marked done (day-0 = the day it's added).
- Add → due on day+1, then day+4, then day+7 → then "mastered".
- "Forgot" re-anchors day-0 to today and restarts the 1·4·7 ladder.
- The schedule lives entirely in the tracker's `localStorage`; the repo only stores the
  seed list of concepts (title, slug, created-date, stage) so a fresh device starts populated.

## Concept page format (every page follows this, in order)

1. **Intuition + first-principles derivation** — how you'd arrive at it cold, not just the answer.
2. **Worked example walk-through** — real numbers, traced step by step.
3. **Multiple approaches + trade-offs** — a ladder from brute force upward, with a comparison table.
4. **Complexity analysis (level-table style)** — sum work per level; show the table; Master
   Theorem only as a cross-check, never as the sole justification.
5. **Interview framing + likelihood** — odds of deriving it cold, and the exact sentence to say.

Tone: verbose, in-depth, but simple. Show the reasoning that *generates* the answer.
`concepts/max-subarray.md` is the reference for length and voice — match it.

## Adding a concept (the recurring loop)

When a new `concepts/<slug>.md` is added:
1. Append an entry to `assets/concepts.js`: `{ title, slug, note }` (slug is bare, no path).
2. Commit: `Add concept: <Title>`.
3. Push to `main` (GitHub Pages auto-deploys).

Prefer running `./add-concept.sh <slug> "<Title>" "<one-line summary>"` which does 1–2.
The catalog, tracker, and reader all pick it up automatically from `assets/concepts.js`.
If the script is missing, do the steps by hand and then create the script.

## Concept order (as learned)

1. `max-subarray`      — Max subarray, divide & conquer (the anchored-seam idea)
2. `sort-list`         — Sort List (LC 148), bottom-up merge sort, O(1) space
3. `java-pass-by-value`— Pass-by-value-of-reference in Java (the dummy-head fix)
4. `sort-lower-bound`  — Comparison-sort lower bound (why n log n — the n! guessing game)
5. `search-2d-matrix`  — Search a 2D Matrix II (LC 240), 4 approaches, staircase derivation
6. `recursion-tree`    — Recursion-tree complexity (flat / growing / shrinking levels)
7. `master-theorem`    — Master Theorem as a compiled shortcut of the level-table

## Deployment

GitHub Pages, deploy from `main` / root. Repo: `NavaUchiha/evergreen`.
Live: `https://navauchiha.github.io/evergreen/` (landing),
`.../tracker.html`, `.../concepts.html`, `.../reader.html?c=<slug>` (a rendered page).
Markdown pages render client-side via `reader.html` (vendored `assets/marked.min.js`) —
concept files stay raw `.md`; do **not** convert them to HTML.
