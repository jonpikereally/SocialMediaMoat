// Social Media Moat: hides X posts from accounts based outside the countries you pick.
//
// The country comes from X's own "About this account" lookup (AboutAccountQuery),
// called the same way x.com calls it, with your session. Results are cached in
// chrome.storage.local as `c:<handle>` so each account is looked up once a month at most.
(() => {
  if (window.__smmLoaded) return;
  window.__smmLoaded = true;

  const { DEFAULTS, norm, decide, flagFor } = globalThis.SMRules;
  const DEFAULT_QID = "XRqGa7EeokUU5kppkh13EA";
  // The public bearer token x.com's own web app sends with every API call.
  const BEARER = "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
  const FOUND_TTL = 30 * 864e5;   // re-check a known country after 30 days
  const NONE_TTL = 3 * 864e5;     // re-check "no country shown" after 3 days
  const GAP_MS = 400;             // between lookups
  const RETRY_MS = 5 * 60e3;      // after a failed lookup
  const HANDLE_PATH = /^\/([A-Za-z0-9_]{1,15})$/;
  const KEY = "c:";

  let settings = { ...DEFAULTS };
  let qid = DEFAULT_QID;
  let rlUntil = 0;                // X's rate-limit reset, shared by all tabs
  let stopped = null;             // error code that halts lookups for this page
  let triedDiscover = false;
  const mem = new Map();          // handle → { c, t } once loaded from storage or X
  const loading = new Set();      // handles being read from storage
  const queue = new Set();        // handles waiting for an X lookup
  const failedAt = new Map();     // handle → time of last failed lookup
  const revealed = new Set();     // posts the user clicked "Show" on, this tab only
  const reported = new Set();

  function report(code, details) {
    if (reported.has(code)) return;
    reported.add(code);
    try { chrome.runtime.sendMessage({ type: "error", code, details: String(details || "").slice(0, 1500) }).catch(() => {}); } catch {}
  }

  const fresh = (r) => r && Date.now() - r.t < (r.c ? FOUND_TTL : NONE_TTL);

  // ---------- reading the page ----------

  function handleOf(article) {
    const name = article.querySelector('[data-testid="User-Name"]');
    if (!name) return null;
    for (const a of name.querySelectorAll('a[href^="/"]')) {
      const m = HANDLE_PATH.exec(a.getAttribute("href"));
      if (m) return m[1];
    }
    return null;
  }

  function postId(article) {
    const a = article.querySelector('a[href*="/status/"] time')?.closest("a");
    const m = a && /\/status\/(\d+)/.exec(a.getAttribute("href"));
    return m ? m[1] : null;
  }

  function ownHandle() {
    const m = HANDLE_PATH.exec(document.querySelector('a[data-testid="AppTabBar_Profile_Link"]')?.getAttribute("href") || "");
    return m ? m[1] : null;
  }

  // On someone's profile or one of their posts, their own posts are never hidden.
  const pageOwner = () => location.pathname.split("/")[1] || null;

  // ---------- drawing ----------

  function tag(article, h) {
    const name = article.querySelector('[data-testid="User-Name"]');
    if (!name) return;
    let el = name.querySelector(":scope > .smm-tag");
    if (!settings.showTags || !settings.enabled) { el?.remove(); return; }
    const r = mem.get(h);
    const text = !r ? (stopped || Date.now() < rlUntil ? "" : "…") : r.c ? `${flagFor(r.c)} ${r.c}` : "No country shown";
    const title = !r ? "Checking where this account is based" : r.c ? `Account based in ${r.c} (from X's About this account)` : "X doesn't show a country for this account";
    if (!text) { el?.remove(); return; }
    if (!el) {
      el = document.createElement("span");
      el.className = "smm-tag";
      name.append(el);
    }
    if (el.textContent !== text) el.textContent = text;
    if (el.title !== title) el.title = title;
  }

  function render(article) {
    const handle = handleOf(article);
    if (!handle) return null;
    const h = norm(handle);
    want(h);
    const cell = article.closest('[data-testid="cellInnerDiv"]') || article.parentElement;
    const id = postId(article) || h;
    let v = decide(h, mem.get(h), settings, { own: ownHandle(), pageOwner: pageOwner() });
    if (v === "hide" && revealed.has(id)) v = "show";
    tag(article, h);

    const state = v === "hide" ? `${settings.hideStyle}|${id}` : "";
    if ((cell.dataset.smm || "") === state) return v;
    cell.querySelector(":scope > .smm-bar")?.remove();
    cell.classList.remove("smm-hide", "smm-remove");
    if (state) {
      cell.dataset.smm = state;
      if (settings.hideStyle === "remove") {
        cell.classList.add("smm-remove");
      } else {
        const c = mem.get(h)?.c;
        const bar = document.createElement("div");
        bar.className = "smm-bar";
        bar.innerHTML = `<span></span><button type="button">Show</button>`;
        bar.firstChild.textContent = `Hidden post from @${handle} · ${c ? `${flagFor(c)} ${c}` : "no country shown"}`;
        bar.lastChild.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          revealed.add(id);
          scan();
        });
        cell.prepend(bar);
        cell.classList.add("smm-hide");
      }
    } else {
      delete cell.dataset.smm;
    }
    return v;
  }

  let lastStatus = "";
  function scan() {
    try {
      let hidden = 0, checking = 0;
      for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
        const v = render(article);
        if (v === "hide") hidden++;
        else if (v === "pending" && settings.enabled) checking++;
      }
      const status = JSON.stringify({ hidden, checking, stopped, rlUntil });
      if (status !== lastStatus) {
        lastStatus = status;
        try { chrome.runtime.sendMessage({ type: "tabStatus", hidden, checking, stopped, rlUntil }).catch(() => {}); } catch {}
      }
    } catch (e) {
      report("SM-201", e.stack || e);
    }
  }

  // ---------- looking up countries ----------

  // A handle is first read from the cache; only a miss (or stale entry) goes to X.
  function want(h) {
    if (mem.has(h) && fresh(mem.get(h))) return;
    if (loading.has(h) || queue.has(h)) return;
    if (mem.has(h)) { enqueue(h); return; }
    loading.add(h);
    loadSoon();
  }

  let loadTimer = null;
  function loadSoon() {
    if (loadTimer) return;
    loadTimer = setTimeout(async () => {
      loadTimer = null;
      const handles = [...loading];
      try {
        const got = await chrome.storage.local.get(handles.map((h) => KEY + h));
        for (const h of handles) {
          loading.delete(h);
          const r = got[KEY + h];
          if (r) mem.set(h, r);
          if (!fresh(r)) enqueue(h);
        }
      } catch (e) {
        handles.forEach((h) => loading.delete(h));
        report("SM-301", e.stack || e);
      }
      scan();
    }, 50);
  }

  function enqueue(h) {
    if (Date.now() - (failedAt.get(h) || 0) < RETRY_MS) return;
    queue.add(h);
    pump();
  }

  // Prefer accounts whose posts are on screen right now.
  function next() {
    for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
      const r = article.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const h = norm(handleOf(article));
      if (queue.has(h)) return h;
    }
    return queue.values().next().value;
  }

  let pumping = false, wakeTimer = null;
  async function pump() {
    if (pumping || !settings.enabled) return;
    pumping = true;
    try {
      while (queue.size && !stopped) {
        const wait = rlUntil - Date.now();
        if (wait > 0) {
          clearTimeout(wakeTimer);
          wakeTimer = setTimeout(pump, wait + 1000);
          break;
        }
        const h = next();
        queue.delete(h);
        await lookup(h);
        scan();
        await new Promise((r) => setTimeout(r, GAP_MS));
      }
    } finally {
      pumping = false;
    }
  }

  async function setRateLimit(until) {
    rlUntil = until;
    try { await chrome.storage.local.set({ rl: until }); } catch {}
  }

  function stop(code, details) {
    stopped = code;
    report(code, details);
    scan();
  }

  async function lookup(h) {
    const csrf = /(?:^|;\s*)ct0=([^;]+)/.exec(document.cookie)?.[1];
    if (!csrf) { queue.add(h); stop("SM-202", "No ct0 cookie on x.com, so this browser isn't signed in to X."); return; }
    const url = `/i/api/graphql/${qid}/AboutAccountQuery?variables=${encodeURIComponent(JSON.stringify({ screenName: h }))}`;
    let res;
    try {
      res = await fetch(url, {
        credentials: "include",
        headers: {
          authorization: BEARER,
          "content-type": "application/json",
          "x-csrf-token": csrf,
          "x-twitter-active-user": "yes",
          "x-twitter-auth-type": "OAuth2Session",
          "x-twitter-client-language": document.documentElement.lang || "en",
        },
      });
    } catch (e) {
      failedAt.set(h, Date.now());
      return;
    }
    const reset = Number(res.headers.get("x-rate-limit-reset")) * 1000;
    if (res.status === 429) {
      queue.add(h);
      await setRateLimit(reset > Date.now() ? reset : Date.now() + 15 * 60e3);
      return;
    }
    if (res.headers.get("x-rate-limit-remaining") === "0" && reset > Date.now()) await setRateLimit(reset);
    if (res.status === 401 || res.status === 403) {
      queue.add(h);
      stop("SM-202", `HTTP ${res.status} from AboutAccountQuery`);
      return;
    }
    if (res.status === 400 || res.status === 404) {
      queue.add(h);
      if (!triedDiscover && (await discoverQueryId())) return;
      stop("SM-203", `HTTP ${res.status} from AboutAccountQuery with query id ${qid}`);
      return;
    }
    if (!res.ok) {
      failedAt.set(h, Date.now());
      return;
    }
    let data;
    try {
      data = await res.json();
    } catch (e) {
      failedAt.set(h, Date.now());
      report("SM-205", `${h}: ${e.message}`);
      return;
    }
    // A missing user (suspended, renamed, deleted) is stored as "no country".
    const user = data?.data?.user_result_by_screen_name?.result;
    const back = user?.core?.screen_name;
    if (back && norm(back) !== h) { failedAt.set(h, Date.now()); return; }
    const rec = { c: user?.about_profile?.account_based_in || null, t: Date.now() };
    mem.set(h, rec);
    try {
      await chrome.storage.local.set({ [KEY + h]: rec });
    } catch (e) {
      report(/quota/i.test(e.message) ? "SM-302" : "SM-301", e.stack || e);
    }
  }

  // X occasionally renames its query ids. The new one is in x.com's script bundles,
  // which the background worker can read (abs.twimg.com host permission).
  async function discoverQueryId() {
    triedDiscover = true;
    const urls = [...document.querySelectorAll('script[src*="abs.twimg.com/responsive-web/"]')].map((s) => s.src);
    try {
      const found = await chrome.runtime.sendMessage({ type: "discoverQueryId", urls });
      if (found && found !== qid) {
        qid = found;
        await chrome.storage.local.set({ qid: found });
        return true;
      }
    } catch {}
    return false;
  }

  // ---------- start ----------

  async function start() {
    try {
      const got = await chrome.storage.local.get(["settings", "rl", "qid"]);
      settings = { ...DEFAULTS, ...(got.settings || {}) };
      rlUntil = got.rl || 0;
      qid = settings.queryId || got.qid || DEFAULT_QID;
    } catch (e) {
      report("SM-301", e.stack || e);
    }

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      let dirty = false;
      for (const [k, { newValue }] of Object.entries(changes)) {
        if (k === "settings") {
          settings = { ...DEFAULTS, ...(newValue || {}) };
          if (settings.queryId) qid = settings.queryId;
          dirty = true;
        } else if (k === "rl") {
          rlUntil = newValue || 0;
        } else if (k === "qid" && newValue && !settings.queryId) {
          qid = newValue;
        } else if (k.startsWith(KEY)) {
          const h = k.slice(KEY.length);
          if (newValue) mem.set(h, newValue);
          else mem.delete(h);   // cache cleared from the popup
          queue.delete(h);
          dirty = true;
        }
      }
      if (dirty) { scan(); pump(); }
    });

    let frame = 0;
    new MutationObserver((muts) => {
      // Our own tags and bars don't need a rescan.
      if (muts.every((m) => [...m.addedNodes, ...m.removedNodes].every((n) => n.classList?.contains("smm-tag") || n.classList?.contains("smm-bar")) && m.type === "childList")) return;
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; scan(); });
    }).observe(document.body, { childList: true, subtree: true });
    addEventListener("scroll", () => queue.size && pump(), { passive: true });
    scan();
  }

  start();
})();
