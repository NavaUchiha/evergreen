#!/usr/bin/env bash
# Usage: ./add-concept.sh <slug> "<Title>" "<one-line summary>"
# Registers a concept page in the tracker's SEED list, commits, and (optionally) pushes.
set -euo pipefail

SLUG="${1:?slug required, e.g. sort-list}"
TITLE="${2:?title required, e.g. \"Sort List — bottom-up merge sort\"}"
NOTE="${3:-}"

PAGE="concepts/${SLUG}.md"
if [[ ! -f "$PAGE" ]]; then
  echo "warning: $PAGE does not exist yet — add the page file, then rerun." >&2
fi

# Insert a SEED entry just after the 'const SEED = [' line in index.html.
ENTRY="  { title: \"${TITLE//\"/\\\"}\", slug: \"concepts/${SLUG}\", note: \"${NOTE//\"/\\\"}\" },"
if grep -q "concepts/${SLUG}\"" index.html; then
  echo "already registered: concepts/${SLUG} — skipping seed insert."
else
  awk -v entry="$ENTRY" '
    /const SEED = \[/ { print; print entry; next }
    { print }
  ' index.html > index.html.tmp && mv index.html.tmp index.html
  echo "registered concepts/${SLUG} in tracker."
fi

git add "$PAGE" index.html 2>/dev/null || git add index.html
git commit -m "Add concept: ${TITLE}"
echo "committed. run 'git push' to deploy."
