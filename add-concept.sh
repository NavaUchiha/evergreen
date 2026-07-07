#!/usr/bin/env bash
# Usage: ./add-concept.sh <slug> "<Title>" "<one-line summary>"
# Registers a concept page in assets/concepts.js (the single source of truth),
# commits, and (optionally) pushes. The landing page, catalog, and tracker all read it.
set -euo pipefail

SLUG="${1:?slug required, e.g. sort-list}"
TITLE="${2:?title required, e.g. \"Sort List — bottom-up merge sort\"}"
NOTE="${3:-}"

LIST="assets/concepts.js"
PAGE="concepts/${SLUG}.md"

if [[ ! -f "$PAGE" ]]; then
  echo "warning: $PAGE does not exist yet — add the page file, then rerun." >&2
fi

# Insert an entry just after the 'const CONCEPTS = [' line.
ENTRY="  { title: \"${TITLE//\"/\\\"}\", slug: \"${SLUG}\", note: \"${NOTE//\"/\\\"}\" },"
if grep -q "slug: \"${SLUG}\"" "$LIST"; then
  echo "already registered: ${SLUG} — skipping insert."
else
  awk -v entry="$ENTRY" '
    /const CONCEPTS = \[/ { print; print entry; next }
    { print }
  ' "$LIST" > "$LIST.tmp" && mv "$LIST.tmp" "$LIST"
  echo "registered ${SLUG} in $LIST."
fi

git add "$PAGE" "$LIST" 2>/dev/null || git add "$LIST"
git commit -m "Add concept: ${TITLE}"
echo "committed. run 'git push' to deploy."
