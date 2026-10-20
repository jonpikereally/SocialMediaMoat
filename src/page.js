// Runs in x.com's own page (manifest "world": "MAIN") so it can see the API answers X
// already loads. From those it takes only one thing: which accounts you follow
// (relationship_perspectives.following, or legacy.following on older responses).
// It never changes requests or answers, and passes on nothing but handle + true/false.
(() => {
  if (window.__smmPage) return;
  window.__smmPage = true;

  const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
  const MAX_NODES = 200000;
  const MAX_USERS = 500;
  let buffer = [];      // kept until the content script says it's listening
  let ready = false;

  function collect(json) {
    const out = new Map();
    const stack = [json];
    let n = 0;
    while (stack.length && n++ < MAX_NODES && out.size < MAX_USERS) {
      const v = stack.pop();
      if (!v || typeof v !== "object") continue;
      if (v.__typename === "User") {
        const name = v.core?.screen_name ?? v.legacy?.screen_name;
        const f = v.relationship_perspectives?.following ?? v.legacy?.following;
        if (typeof name === "string" && HANDLE.test(name) && typeof f === "boolean") out.set(name.toLowerCase(), f);
      }
      for (const k in v) if (v[k] && typeof v[k] === "object") stack.push(v[k]);
    }
    return [...out];
  }

  function send(users) {
    if (!users.length) return;
    if (!ready) { buffer.push(...users); buffer = buffer.slice(-2000); return; }
    window.postMessage({ source: "smm-follows", users }, location.origin);
  }

  function handle(url, text) {
    try {
      if (/\/i\/api\/graphql\//.test(url)) {
        send(collect(JSON.parse(text)));
      } else if (/\/i\/api\/1\.1\/friendships\/(create|destroy)\.json/.test(url)) {
        // Follow / unfollow clicks answer with the account itself.
        const name = JSON.parse(text)?.screen_name;
        if (typeof name === "string" && HANDLE.test(name)) send([[name.toLowerCase(), /create/.test(url)]]);
      }
    } catch {}
  }

  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.addEventListener("load", () => {
      if (this.responseType === "" || this.responseType === "text") handle(String(url), this.responseText);
    });
    return open.call(this, method, url, ...rest);
  };

  const fetch0 = window.fetch;
  window.fetch = function (input, init) {
    const p = fetch0.apply(this, arguments);
    const url = typeof input === "string" ? input : input?.url || "";
    if (/\/i\/api\//.test(url)) p.then((r) => r.clone().text()).then((t) => handle(url, t)).catch(() => {});
    return p;
  };

  window.addEventListener("message", (e) => {
    if (e.source !== window || e.data?.source !== "smm-ready") return;
    ready = true;
    const users = buffer;
    buffer = [];
    send(users);
  });
})();
