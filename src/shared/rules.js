// Pure filtering rules, shared by the content script, the popup and the tests.
// Plain script (not a module) so it can be listed in manifest content_scripts.
(function (root) {
  const DEFAULTS = {
    enabled: true,
    mode: "only",          // "only": show just these countries · "hide": hide these countries
    countries: ["Canada"],
    unknown: "show",       // accounts X shows no country for: "show" | "hide"
    hideStyle: "bar",      // "bar": a thin "Hidden post" strip · "remove": gone entirely
    showTags: true,        // country tag next to each name
    hideReposts: false,    // also hide reposts made by accounts that would be hidden
    allow: [],             // handles always shown
    queryId: "",           // advanced override for X's AboutAccountQuery id
    updateSource: "",
  };

  const norm = (s) => String(s ?? "").trim().replace(/^@/, "").toLowerCase();

  // record: undefined = not looked up yet, { c: "Canada" | null } once known.
  // Returns "show", "hide" or "pending".
  function decide(handle, record, settings, ctx = {}) {
    const s = { ...DEFAULTS, ...settings };
    if (!s.enabled) return "show";
    const h = norm(handle);
    if (h && (h === norm(ctx.own) || h === norm(ctx.pageOwner))) return "show";
    if (s.allow.some((a) => norm(a) === h)) return "show";
    if (!record) return "pending";
    if (!record.c) return s.unknown === "hide" ? "hide" : "show";
    const listed = s.countries.some((c) => norm(c) === norm(record.c));
    return (s.mode === "only") === listed ? "show" : "hide";
  }

  // A post is judged by its author. A repost is also judged by the account that
  // reposted it when hideReposts is on. Returns { v, by } where by is "author" or
  // "reposter" (whose country caused the hide). lookup(handle) returns the cached record.
  function decidePost(author, reposter, lookup, settings, ctx = {}) {
    const a = decide(author, lookup(norm(author)), settings, ctx);
    if (a === "hide") return { v: "hide", by: "author" };
    if (!reposter || !{ ...DEFAULTS, ...settings }.hideReposts) return { v: a, by: "author" };
    const r = decide(reposter, lookup(norm(reposter)), settings, ctx);
    if (r === "hide") return { v: "hide", by: "reposter" };
    return { v: a === "pending" || r === "pending" ? "pending" : "show", by: "author" };
  }

  function flagFor(country) {
    const code = (root.SM_COUNTRIES || {})[norm(country)];
    if (!code) return "🌐";
    return String.fromCodePoint(...[...code].map((ch) => 0x1f1a5 + ch.charCodeAt(0)));
  }

  root.SMRules = { DEFAULTS, norm, decide, decidePost, flagFor };
})(globalThis);
