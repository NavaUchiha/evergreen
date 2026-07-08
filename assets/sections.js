/* Evergreen — the concept section template. Single source of truth for the
   ordered content sections, shared by editor.html and reader.html. */
(function (global) {
  "use strict";
  const SECTIONS = [
    { key: "problem",        label: "Problem statement", icon: "🧩", hint: "The problem / question / constraints…" },
    { key: "first_instinct", label: "First Instinct",    icon: "💭", hint: "Your raw first thoughts, before the answer…" },
    { key: "quick",          label: "Quick Version",     icon: "⚡", hint: "The 60-second recap…" },
    { key: "rundown",        label: "Rundown",           icon: "📓", hint: "The full walkthrough…" }
  ];
  function esc(s) { return String(s).replace(/[&<>]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m])); }

  const Sections = {
    SECTIONS,
    // Render every non-empty section (in order) to HTML using a marked instance.
    renderHTML(values, marked) {
      let out = "";
      for (const s of SECTIONS) {
        const v = (values[s.key] || "").trim();
        if (!v) continue;
        out += '<section class="concept-sec"><h2 class="sec-head">' + s.icon + " " + esc(s.label) + "</h2>"
             + marked.parse(v) + "</section>";
      }
      return out;
    }
  };
  global.EVERGREEN_SECTIONS = SECTIONS;
  global.EvergreenSections = Sections;
})(window);
