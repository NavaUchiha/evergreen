/* Evergreen — the single source of truth for concepts.
   Read by the landing page, the concepts catalog, and the tracker.
   The CLI (add-concept.sh) appends new entries just after `const CONCEPTS = [`.
   Format: { title, slug, note } — slug is the bare page name (concepts/<slug>.md).
   Per-review progress lives only in the tracker's localStorage, never here. */
const CONCEPTS = [
  { title: "Max subarray — divide & conquer", slug: "max-subarray", note: "Anchored-seam pattern; O(n log n)" },
];
if (typeof window !== "undefined") window.CONCEPTS = CONCEPTS;
