import { REPO, logError } from "./shared/errors.js";

const FEED = `https://raw.githubusercontent.com/${REPO}/main/updates/latest.json`;
const VERSION = chrome.runtime.getManifest().version;

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const tabId = sender.tab && sender.tab.id;
  if (msg.type === "tabStatus" && tabId != null) {
    // The toolbar badge shows how many posts are hidden on the current tab.
    const n = msg.hidden;
    chrome.action.setBadgeText({ tabId, text: n > 0 ? String(n > 999 ? "999+" : n) : "" }).catch(() => {});
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#5b5b5b" }).catch(() => {});
    chrome.action.setTitle({ tabId, title: n ? `Social Media Moat: ${n} post${n === 1 ? "" : "s"} hidden` : "Social Media Moat" }).catch(() => {});
    chrome.storage.session.set({ [`tab:${tabId}`]: { hidden: msg.hidden, checking: msg.checking, stopped: msg.stopped } }).catch(() => {});
  } else if (msg.type === "error") {
    logError(msg.code, msg.details);
  } else if (msg.type === "checkUpdates") {
    checkForUpdates(true).then(reply);
    return true;
  } else if (msg.type === "discoverQueryId") {
    discoverQueryId(msg.urls || []).then(reply);
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(`tab:${tabId}`).catch(() => {}));

// ---------- X query id ----------
// x.com's bundles contain entries like {queryId:"XRqGa7…",operationName:"AboutAccountQuery",…}.
// The operation may live in a lazily loaded chunk, so also follow chunk names
// listed in the main bundle when the loaded scripts don't have it.

async function discoverQueryId(urls) {
  const re = /queryId:"([\w-]+)",operationName:"AboutAccountQuery"/;
  const seen = new Set();
  const tryUrl = async (u) => {
    if (seen.has(u) || !u.startsWith("https://abs.twimg.com/")) return null;
    seen.add(u);
    try {
      const text = await (await fetch(u)).text();
      return [re.exec(text)?.[1] || null, text];
    } catch {
      return null;
    }
  };
  const texts = [];
  for (const u of urls) {
    const got = await tryUrl(u);
    if (got?.[0]) return got[0];
    if (got) texts.push([u, got[1]]);
  }
  // Lazily loaded chunks: "<name>":"<hash>" pairs in the runtime/main bundle.
  for (const [u, text] of texts) {
    const base = u.slice(0, u.lastIndexOf("/") + 1);
    for (const m of text.matchAll(/"(bundle\.[\w.-]*About[\w.-]*|[\w.-]*AboutAccount[\w.-]*)":"([0-9a-f]{6,})"/g)) {
      // Chunk file names have been seen both with and without a trailing "a".
      for (const name of [`${m[1]}.${m[2]}a.js`, `${m[1]}.${m[2]}.js`]) {
        const got = await tryUrl(base + name);
        if (got?.[0]) return got[0];
      }
    }
  }
  return null;
}

// ---------- cache pruning ----------
// Country lookups older than 60 days are dropped once a day.

async function prune() {
  const store = await chrome.storage.local.get(null);
  const old = Object.entries(store).filter(([k, v]) => k.startsWith("c:") && Date.now() - (v?.t || 0) > 60 * 864e5).map(([k]) => k);
  if (old.length) await chrome.storage.local.remove(old);
}

// ---------- updates ----------
// Unpacked extensions can't replace their own files, so this only tells you
// a newer version exists; the popup shows how to install it.

function newer(a, b) {
  const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

async function checkForUpdates(manual = false) {
  const { settings = {} } = await chrome.storage.local.get("settings");
  const feed = settings.updateSource || FEED;
  let state;
  try {
    let res;
    try {
      res = await fetch(feed, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      throw Object.assign(new Error(`${feed}: ${e.message}`), { code: "SM-101" });
    }
    let latest;
    try {
      latest = await res.json();
      if (!latest.version) throw new Error("no version field");
    } catch (e) {
      throw Object.assign(new Error(`${feed}: ${e.message}`), { code: "SM-102" });
    }
    state = {
      checkedAt: Date.now(),
      current: VERSION,
      latest: latest.version,
      available: newer(latest.version, VERSION),
      notes: latest.notes || "",
      url: latest.url ? new URL(latest.url, feed).toString() : null,
    };
  } catch (e) {
    state = { checkedAt: Date.now(), current: VERSION, available: false, error: { code: e.code || "SM-999", details: e.message } };
    if (manual) await logError(state.error.code, state.error.details);
  }
  await chrome.storage.local.set({ update: state });
  return state;
}

chrome.alarms.create("updates", { periodInMinutes: 6 * 60 });
chrome.alarms.create("prune", { periodInMinutes: 24 * 60 });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "updates") checkForUpdates();
  else if (a.name === "prune") prune().catch((e) => logError("SM-301", e.stack || e));
});
chrome.runtime.onStartup.addListener(() => setTimeout(checkForUpdates, 5000));
chrome.runtime.onInstalled.addListener(() => setTimeout(checkForUpdates, 5000));
