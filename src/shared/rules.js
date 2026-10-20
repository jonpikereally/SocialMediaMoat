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

  function flagFor(country) {
    const code = (root.SM_COUNTRIES || {})[norm(country)];
    if (!code) return "🌐";
    return String.fromCodePoint(...[...code].map((ch) => 0x1f1a5 + ch.charCodeAt(0)));
  }

  root.SMRules = { DEFAULTS, norm, decide, flagFor };
})(globalThis);
