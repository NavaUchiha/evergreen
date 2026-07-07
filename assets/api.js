/* Evergreen — API client. All pages talk to the OCI backend through this.
   Reads are open; writes send a bearer token the user pastes once (stored locally). */
(function (global) {
  "use strict";
  const BASE = "https://140.245.228.37.sslip.io/api";
  const TOKEN_KEY = "evergreen_token";

  async function req(method, path, body) {
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const t = API.getToken();
    if (t) headers["Authorization"] = "Bearer " + t;
    let res;
    try {
      res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch (e) {
      throw new Error("Can't reach the server — is the instance running?");
    }
    if (res.status === 204) return null;
    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      const msg = (data && data.error) || ("HTTP " + res.status);
      const err = new Error(msg); err.status = res.status; throw err;
    }
    return data;
  }

  const API = {
    BASE,
    getToken() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } },
    setToken(t) { try { localStorage.setItem(TOKEN_KEY, (t || "").trim()); } catch (e) {} },
    hasToken() { return !!API.getToken(); },

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
    tags: () => req("GET", "/tags")
  };

  global.EvergreenAPI = API;
})(window);
