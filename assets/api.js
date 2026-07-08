/* Evergreen — API client + password prompt. All pages talk to the OCI backend here.
   Reads are open; writes send a bearer password the user enters once. */
(function (global) {
  "use strict";
  const BASE = "https://140.245.228.37.sslip.io/api";
  const KEY = "evergreen_token";

  async function req(method, path, body) {
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const t = API.getToken();
    if (t) headers["Authorization"] = "Bearer " + t;
    let res;
    try {
      res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch (e) { throw new Error("Can't reach the server — is the instance running?"); }
    if (res.status === 204) return null;
    let data = null; try { data = await res.json(); } catch (e) {}
    if (!res.ok) { const err = new Error((data && data.error) || ("HTTP " + res.status)); err.status = res.status; throw err; }
    return data;
  }

  const API = {
    BASE,
    /* token stored in localStorage (remembered) or sessionStorage (this session only) */
    getToken() { try { return sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || ""; } catch (e) { return ""; } },
    setToken(t, remember) {
      t = (t || "").trim();
      try {
        if (remember === false) { sessionStorage.setItem(KEY, t); localStorage.removeItem(KEY); }
        else { localStorage.setItem(KEY, t); sessionStorage.removeItem(KEY); }
      } catch (e) {}
    },
    clearToken() { try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch (e) {} },
    hasToken() { return !!API.getToken(); },
    async verify() {
      try { const r = await fetch(BASE + "/verify", { headers: { Authorization: "Bearer " + API.getToken() } }); return r.ok; }
      catch (e) { return false; }
    },

    /* Ensure we hold a valid password; show the modal if not. Resolves true/false. */
    async ensureToken(opts) { return API.hasToken() ? true : API.promptPassword(opts); },

    /* Run a write; if it 401s (wrong/stale password) clear it, re-prompt, retry once. */
    async withAuth(run, opts) {
      if (!(await API.ensureToken(opts))) return undefined;
      try { return await run(); }
      catch (e) {
        if (e && e.status === 401) { API.clearToken(); if (await API.ensureToken({ error: "That password didn't work." })) return await run(); }
        throw e;
      }
    },

    /* Styled password modal (replaces window.prompt). Resolves true if a valid password was set. */
    promptPassword(opts) {
      opts = opts || {};
      return new Promise((resolve) => {
        const ov = document.createElement("div");
        ov.className = "pw-overlay";
        ov.innerHTML =
          '<div class="pw-modal" role="dialog" aria-modal="true" aria-label="Enter password">' +
            '<div class="pw-lock">🔒</div>' +
            '<h3>Enter your password</h3>' +
            '<p>' + (opts.message || "Your notes live on your own server. Enter your password to make changes.") + '</p>' +
            '<input class="pw-input" type="password" placeholder="password" autocomplete="current-password" autocapitalize="off" spellcheck="false">' +
            '<div class="pw-err">' + (opts.error || "") + '</div>' +
            '<label class="pw-remember"><input type="checkbox" checked> Remember on this device</label>' +
            '<div class="pw-actions"><button class="btn ghost pw-cancel">Cancel</button><button class="btn primary pw-ok">Unlock</button></div>' +
          '</div>';
        document.body.appendChild(ov);
        const input = ov.querySelector(".pw-input");
        const remember = ov.querySelector(".pw-remember input");
        const err = ov.querySelector(".pw-err");
        const ok = ov.querySelector(".pw-ok");
        setTimeout(() => input.focus(), 30);
        function close(v) { document.removeEventListener("keydown", onKey); ov.remove(); resolve(v); }
        async function submit() {
          const v = input.value.trim();
          if (!v) { input.focus(); return; }
          ok.disabled = true; err.textContent = "Checking…"; err.classList.remove("bad");
          API.setToken(v, remember.checked);
          if (await API.verify()) { close(true); }
          else { API.clearToken(); err.textContent = "Wrong password — try again."; err.classList.add("bad"); ok.disabled = false; input.select(); }
        }
        function onKey(e) { if (e.key === "Escape") close(false); }
        ok.onclick = submit;
        ov.querySelector(".pw-cancel").onclick = () => close(false);
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
        ov.addEventListener("mousedown", (e) => { if (e.target === ov) close(false); });
        document.addEventListener("keydown", onKey);
      });
    },

    health: () => req("GET", "/health"),
    listConcepts: () => req("GET", "/concepts"),
    getConcept: (slug) => req("GET", "/concepts/" + encodeURIComponent(slug)),
    createConcept: (data) => req("POST", "/concepts", data),
    updateConcept: (slug, data) => req("PUT", "/concepts/" + encodeURIComponent(slug), data),
    deleteConcept: (slug) => req("DELETE", "/concepts/" + encodeURIComponent(slug)),
    addComment: (slug, body) => req("POST", "/concepts/" + encodeURIComponent(slug) + "/comments", { body }),
    deleteComment: (id) => req("DELETE", "/comments/" + id),
    review: (slug) => req("POST", "/concepts/" + encodeURIComponent(slug) + "/review"),
    forgot: (slug) => req("POST", "/concepts/" + encodeURIComponent(slug) + "/forgot"),
    toggleStar: (slug) => req("POST", "/concepts/" + encodeURIComponent(slug) + "/star"),
    tags: () => req("GET", "/tags")
  };

  global.EvergreenAPI = API;
})(window);
