import { describe, detailsText, logError, ERROR_HOVER, ERROR_LIST_URL, REPO } from "../src/shared/errors.js";

const { DEFAULTS, norm, flagFor } = globalThis.SMRules;
const VERSION = chrome.runtime.getManifest().version;
const KEY = "c:";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const time = (t) => new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

let settings = { ...DEFAULTS };
const save = (patch) => guard("SM-301", async () => {
  settings = { ...settings, ...patch };
  await chrome.storage.local.set({ settings });
})();

// ---------- errors: code, hover text, "?" link, Copy Details ----------

function errorBanner(err, onDismiss) {
  const d = describe(err.code);
  const el = document.createElement("div");
  el.className = "banner error";
  el.title = ERROR_HOVER;
  el.innerHTML = `
    <span class="grow" title="${esc(ERROR_HOVER)}">⚠️ <span class="err-code" title="${esc(ERROR_HOVER)}">Error code: ${esc(d.code)}</span>
      <a class="help" href="${ERROR_LIST_URL}" target="_blank" title="${esc(ERROR_HOVER)}">?</a><br>
      <span title="${esc(ERROR_HOVER)}">${esc(d.summary)} ${esc(d.hint)}</span></span>
    <button class="btn copy">Copy Error Details</button>
    ${onDismiss !== false ? `<button class="btn dismiss">Dismiss</button>` : ""}`;
  el.querySelector(".copy").onclick = async (e) => {
    await navigator.clipboard.writeText(detailsText(err, VERSION));
    e.target.textContent = "Copied";
  };
  const dismiss = el.querySelector(".dismiss");
  if (dismiss) dismiss.onclick = () => { el.remove(); onDismiss && onDismiss(); };
  return el;
}

function guard(code, fn) {
  return async (...args) => {
    try { return await fn(...args); } catch (e) {
      const c = e.code || (/quota/i.test(e.message) ? "SM-302" : code);
      await logError(c, e.stack || String(e)).catch(() => {});
      $("#banners").prepend(errorBanner({ code: c, details: e.stack || String(e), t: Date.now() }));
    }
  };
}

function updateBanner(u) {
  const el = document.createElement("div");
  el.className = "banner update";
  el.innerHTML = `<span class="grow">⬆︎ <strong>Social Media Moat v${esc(u.latest)} is available</strong> (you have v${esc(u.current)}).
    ${u.notes ? `<br>${esc(u.notes)}` : ""}
    <br>To install: download it, replace your SocialMediaMoat folder with the new one, then click ↻ on Social Media Moat in chrome://extensions.
    If you cloned the repo, run <code>git pull</code> instead. Your settings are kept either way.</span>
    ${u.url ? `<a class="btn" href="${esc(u.url)}" target="_blank">Download</a>` : ""}`;
  return el;
}

async function renderBanners(store) {
  const box = $("#banners");
  box.innerHTML = "";
  const seen = settings.errorsSeenAt || 0;
  // Rate limiting (SM-204) is a passing state, shown in the tab card instead.
  for (const err of (store.errors || []).filter((e) => e.t > seen && e.code !== "SM-204").slice(-3).reverse()) {
    box.append(errorBanner(err, () => save({ errorsSeenAt: err.t })));
  }
  if (store.update && store.update.available) box.prepend(updateBanner(store.update));
}

// ---------- main view ----------

const listed = (c) => settings.countries.some((x) => norm(x) === norm(c));

function renderCountries(counts) {
  $("#chips").innerHTML = settings.countries.map((c, i) =>
    `<li class="chip">${flagFor(c)} ${esc(c)} <button type="button" data-i="${i}" title="Remove ${esc(c)}" aria-label="Remove ${esc(c)}">×</button></li>`).join("")
    || `<li class="muted">${settings.mode === "only" ? "No countries yet, so every account with a known country is hidden." : "No countries yet, so nothing is hidden."}</li>`;
  for (const b of $("#chips").querySelectorAll("button")) b.onclick = () => {
    const countries = settings.countries.filter((_, i) => i !== Number(b.dataset.i));
    save({ countries }).then(render);
  };
  const names = new Set([...globalThis.SM_COUNTRY_NAMES, ...counts.keys()]);
  $("#countryList").innerHTML = [...names].sort().map((n) => `<option value="${esc(n)}">`).join("");

  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((n, [, k]) => n + k, 0);
  $("#seenTotal").textContent = total ? `(${total.toLocaleString()} accounts)` : "";
  $("#noSeen").hidden = rows.length > 0;
  $("#seen").innerHTML = rows.slice(0, 40).map(([c, n]) => {
    const on = listed(c);
    const shown = settings.mode === "only" ? on : !on;
    return `<li><button type="button" class="seen-row ${shown ? "shown" : "hidden"}" data-c="${esc(c)}"
      title="${on ? "Remove from" : "Add to"} your list">
      <span>${flagFor(c)} ${esc(c)}</span><span class="n">${n.toLocaleString()}</span>
      <span class="state">${shown ? "Shown" : "Hidden"}</span></button></li>`;
  }).join("");
  for (const b of $("#seen").querySelectorAll("button")) b.onclick = () => {
    const c = b.dataset.c;
    const countries = listed(c) ? settings.countries.filter((x) => norm(x) !== norm(c)) : [...settings.countries, c];
    save({ countries }).then(render);
  };
}

async function renderTab(store) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const onX = tab && /^https:\/\/(mobile\.)?(x|twitter)\.com\//.test(tab.url || "");
  const key = tab ? `tab:${tab.id}` : null;
  const s = (key && (await chrome.storage.session.get(key))[key]) || { hidden: 0, checking: 0 };
  $("#hiddenCount").textContent = s.hidden;
  $("#hiddenLabel").textContent = `post${s.hidden === 1 ? "" : "s"} hidden on this page`;
  const note = $("#tabNote");
  note.innerHTML = "";
  note.removeAttribute("title");
  if (!settings.enabled) note.textContent = "Filtering is off.";
  else if (!onX) note.textContent = "Open x.com to filter posts.";
  else if (s.stopped) note.append(errorBanner({ code: s.stopped, t: Date.now() }, false));
  else if ((store.rl || 0) > Date.now()) {
    // SM-204: X's lookup limit. Not a fault, but it still carries its code.
    note.title = ERROR_HOVER;
    note.innerHTML = `⏳ <span class="err-code">SM-204</span> <a class="help" href="${ERROR_LIST_URL}" target="_blank" title="${esc(ERROR_HOVER)}">?</a>
      X is limiting lookups until ${esc(time(store.rl))}. ${s.checking ? `${s.checking} post${s.checking === 1 ? "" : "s"} from unchecked accounts are shown until then.` : ""}`;
  } else if (s.checking) note.textContent = `Checking where ${s.checking} more account${s.checking === 1 ? " is" : "s are"} based…`;
}

async function render() {
  const store = await chrome.storage.local.get(null);
  settings = { ...DEFAULTS, ...(store.settings || {}) };
  const counts = new Map();
  let total = 0;
  for (const [k, v] of Object.entries(store)) {
    if (!k.startsWith(KEY)) continue;
    total++;
    if (v && v.c) counts.set(v.c, (counts.get(v.c) || 0) + 1);
  }

  $("#enabled").checked = settings.enabled;
  for (const name of ["mode", "unknown", "hideStyle"]) {
    for (const r of document.querySelectorAll(`input[name="${name}"]`)) r.checked = r.value === settings[name];
  }
  $("#showTags").checked = settings.showTags;
  $("#hideReposts").checked = settings.hideReposts;
  $("#showFollowed").checked = settings.showFollowed;
  const nFollows = Object.keys(store.follows?.f || {}).length;
  $("#followNote").textContent = nFollows
    ? `Knows you follow ${nFollows.toLocaleString()} account${nFollows === 1 ? "" : "s"} so far. It learns as you browse X, from posts and profiles you see.`
    : "It learns who you follow as you browse X. To teach it quickly, scroll through your own Following list (your profile → Following).";
  if (document.activeElement !== $("#allow")) $("#allow").value = settings.allow.map((h) => "@" + h).join("\n");
  $("#updateSource").value = settings.updateSource || "";
  $("#queryId").value = settings.queryId || "";
  $("#total").textContent = total.toLocaleString();
  $("#versionLine").textContent = `You have Social Media Moat v${VERSION}.`;
  $("#ghLink").href = `https://github.com/${REPO}`;
  $("#errLink").href = ERROR_LIST_URL;

  renderCountries(counts);
  await renderTab(store);
  await renderBanners(store);
}

// ---------- wiring ----------

$("#enabled").onchange = (e) => save({ enabled: e.target.checked }).then(render);
for (const name of ["mode", "unknown", "hideStyle"]) {
  for (const r of document.querySelectorAll(`input[name="${name}"]`)) r.onchange = (e) => save({ [name]: e.target.value }).then(render);
}
$("#showTags").onchange = (e) => save({ showTags: e.target.checked });
$("#hideReposts").onchange = (e) => save({ hideReposts: e.target.checked });
$("#showFollowed").onchange = (e) => save({ showFollowed: e.target.checked });
$("#allow").onchange = (e) => save({ allow: [...new Set(e.target.value.split(/[\s,]+/).map(norm).filter(Boolean))] });
$("#updateSource").onchange = (e) => save({ updateSource: e.target.value.trim() });
$("#queryId").onchange = (e) => save({ queryId: e.target.value.trim() });

$("#addForm").onsubmit = (e) => {
  e.preventDefault();
  const raw = $("#addCountry").value.trim();
  if (!raw) return;
  // Use X's spelling when the name matches one we know, whatever the case.
  const known = [...$("#countryList").options].map((o) => o.value).find((n) => norm(n) === norm(raw)) || raw;
  $("#addNote").hidden = known !== raw || !!globalThis.SM_COUNTRIES[norm(raw)];
  $("#addNote").textContent = `Added "${raw}". It isn't a country name Social Media Moat knows, so it only matches accounts X labels exactly "${raw}" (regions like "Europe" work this way).`;
  $("#addCountry").value = "";
  if (!listed(known)) save({ countries: [...settings.countries, known] }).then(render);
};

$("#forget").onclick = guard("SM-301", async () => {
  const store = await chrome.storage.local.get(null);
  const keys = Object.keys(store).filter((k) => k.startsWith(KEY));
  if (!confirm(`Forget where ${keys.length.toLocaleString()} accounts are based? They'll be looked up again as you scroll.`)) return;
  await chrome.storage.local.remove(keys);
  $("#dataResult").textContent = `Forgot ${keys.length.toLocaleString()} accounts.`;
  await render();
});

$("#checkUpdates").onclick = guard("SM-999", async (e) => {
  e.target.textContent = "Checking for Updates…";
  const u = await chrome.runtime.sendMessage({ type: "checkUpdates" });
  e.target.textContent = "Check for Updates…";
  const out = $("#updateResult");
  out.innerHTML = "";
  if (u.error) out.append(errorBanner({ ...u.error, t: u.checkedAt }));
  else if (u.available) out.append(updateBanner(u));
  else out.textContent = `Social Media Moat is up to date (v${VERSION}).`;
});

guard("SM-301", render)().then(() => requestAnimationFrame(() => document.body.classList.add("ready")));
