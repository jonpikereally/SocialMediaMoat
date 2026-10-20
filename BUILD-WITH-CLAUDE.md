# Build Social Media Moat yourself (with Claude or another AI)

Social Media Moat is a browser extension that filters your X (Twitter) timeline by the country each account is based in. This page has two prompts:

- **Prompt 1** rebuilds the whole tool from scratch. It describes what to build and the details about X that took research to find, so an AI coding assistant can write it without copying this repo. Use it if you'd rather own the code, or want your own version (a different design, other countries, other features).
- **Prompt 2** just installs this repo's version, with an AI walking you through it.

Both work best in an AI that can write files and run commands, such as **Claude Code** (`claude` in a terminal). In a chat-only assistant, ask it to give you each file in full and save them yourself.

---

## Prompt 1: build it from scratch

Copy everything in the box into your AI assistant. Edit the defaults in **Settings** first if you like, for example your country.

````text
Build me a Manifest V3 browser extension for Chrome/Brave/Edge called "Social Media Moat". It filters
X (x.com, formerly Twitter) so I see posts only from accounts based in the countries I choose. Plain
JavaScript, no build step, no dependencies, loadable with "Load unpacked". Put it in a folder called
SocialMediaMoat.

WHERE THE COUNTRY COMES FROM
X shows "Account based in <country>" on every account's "About this account" page. The web app gets it
from X's internal GraphQL API, and the extension must call it the same way:

  GET https://x.com/i/api/graphql/<queryId>/AboutAccountQuery?variables=<url-encoded {"screenName":"<handle>"}>
  queryId (as of late 2025 / 2026): XRqGa7EeokUU5kppkh13EA
  Answer: data.user_result_by_screen_name.result.about_profile.account_based_in
          (a country name like "Canada"; sometimes a region like "Europe"; sometimes missing).
          result.core.screen_name is the handle; ignore the answer if it doesn't match the one asked for.
          A missing result means the account is gone or suspended: treat it as "no country".

Make the request from the content script as a same-origin fetch (relative URL, credentials: "include")
so the user's own X session is used. Headers:
  authorization: Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA
    (the public token x.com's own web app sends with every request; it is not a secret)
  x-csrf-token: the value of the ct0 cookie (readable from document.cookie; no ct0 = not signed in)
  x-twitter-active-user: yes
  x-twitter-auth-type: OAuth2Session
  x-twitter-client-language: the page's <html lang>, or "en"
  content-type: application/json

X renames query ids now and then. If the request returns 400 or 404, have the background service worker
(host permission https://abs.twimg.com/*) download the page's script bundles
(script[src*="abs.twimg.com/responsive-web/"]) and search them for
  queryId:"<id>",operationName:"AboutAccountQuery"
then retry with the new id. Also offer an advanced setting to paste an id by hand.

RATE LIMITS (the hardest part)
X allows only a limited number of these lookups in a short time. So:
- Cache every answer in chrome.storage.local, one key per account: "c:<handle lower case>" =
  { c: country or null, t: when checked }. Re-check after 30 days (3 days if null). Prune entries older
  than 60 days once a day.
- Look up one account at a time, about 400 ms apart, choosing accounts whose posts are on screen first.
- On HTTP 429, or when the x-rate-limit-remaining header is "0", read x-rate-limit-reset (Unix seconds),
  store it as "rl" so every tab respects it, and pause until then (15 minutes if the header is missing).
- While an account hasn't been checked yet, show its posts. Never hide a post just because the lookup
  hasn't happened.
- On 401/403, or with no ct0 cookie, stop lookups for that page and show an error saying to sign in.

READING THE PAGE (never rely on X's generated class names)
- A post is article[data-testid="tweet"]. Its author is the first link inside the first
  [data-testid="User-Name"] whose href is exactly "/<handle>" (1-15 letters, digits or underscores).
  Quoted posts sit later in the same article, so the first match is the real author.
- The element to hide is the post's closest [data-testid="cellInnerDiv"].
- A repost has a "<name> reposted" line: [data-testid="socialContext"] inside a link to the reposter's
  profile ("Pinned" uses the same testid without a link).
- The post id is in the link around the post's <time> element (/status/<digits>).
- My own handle is the href of a[data-testid="AppTabBar_Profile_Link"].
- Watch for new posts with a MutationObserver, batched with requestAnimationFrame. Every DOM write must be
  idempotent (only write when something differs, and ignore mutations of the extension's own elements).
  Otherwise the observer re-triggers itself forever.

FILTER RULES (put these in one pure function so they can be unit tested)
- Mode "only": show accounts whose country is in my list. Mode "hide": hide accounts whose country is in
  my list. Compare country names ignoring case and surrounding spaces.
- Never hide: my own posts, posts by the account whose profile or post page I'm on (first path segment
  of the URL), and handles in an "always show" list (accept "@name" or "name", any case).
- Reposts are judged by the post's author. A setting "Also hide reposts by filtered accounts" (off by
  default) also hides a repost when the reposter would be hidden; only look reposters up when it's on.
- Accounts with no country: follow the "no country" setting (show by default).
- Not checked yet: show.

WHAT I SEE ON X
- Hidden posts become a thin strip: "Hidden post from @handle · 🇺🇸 United States" with a "Show" button
  that reveals that one post until the page reloads. Optional setting: remove hidden posts completely.
- A small pill next to each author's name with a flag and the country, e.g. "🇨🇦 Canada".
  "…" while checking, "No country shown" when X has none, nothing while rate-limited.
  Hover text: "Account based in Canada (from X's About this account)". Can be turned off.
- Muted styling that suits X's light, dim and dark themes (grey text, X's blue for the button).
- The toolbar badge shows how many posts are hidden on the current tab.

THE POPUP (about 380 px wide, light and dark mode)
- On/off switch.
- "N posts hidden on this page", plus a status line: checking N accounts / rate-limited until <time> /
  the current error.
- Mode choice ("Only from accounts based in these countries" / "From everywhere except these countries").
- My countries as removable chips (flag + name), and an input with autocomplete over every country name
  plus every value seen so far. Adding a name that isn't a known country is allowed, with a note that it
  must match X's label exactly (that's how regions such as "Europe" work).
- "Seen on X": every country in the cache with its account count and a Shown/Hidden pill. Clicking a row
  adds it to or removes it from my list.
- Settings: what to do with accounts that show no country, hide style, the repost toggle, country pills on/off,
  "always show" accounts (one @handle per line), how many accounts are remembered with a
  "Forget looked-up countries" button, the query id override, and the update section below.
- Settings changes apply to open X tabs immediately (listen to chrome.storage.onChanged).

SETTINGS (chrome.storage.local "settings", with these defaults)
  enabled: true, mode: "only", countries: ["Canada"], unknown: "show", hideStyle: "bar",
  showTags: true, hideReposts: false, allow: [], queryId: "", updateSource: ""

FLAGS
Include a table of about 200 country names (in X's English spelling, plus common alternatives such as
"Czech Republic" and "Czechia", "Türkiye" and "Turkey") mapped to ISO 3166 two-letter codes. Turn a code into a
flag emoji with regional indicator symbols (code point 0x1F1E6 + letter - 'A'). Unknown names and
regions get 🌐.

ERRORS
Every error a user can see gets a stable code with a prefix (SM-101, SM-202…), grouped by hundreds:
1xx updates, 2xx reading X / lookups (page layout broke, signed out, query id not found, rate-limited,
unreadable answer), 3xx saved data (read/write failed, storage full), 999 unexpected. Keep them in one
catalogue in code (code → summary + what to try) and in an ERRORS.md table (code | what happened | what to
try) that opens with a note on getting help from an AI assistant. Error banners in the popup show the code, a "?"
link and hover text pointing to ERRORS.md, and a "Copy Error Details" button that copies the code,
details, extension version, browser and the ERRORS.md link. Log errors to storage (last 100) without any
personal content. Add a script that fails if a code used in the source is missing from ERRORS.md.

UPDATES (optional; skip if you won't publish it on GitHub)
Unpacked extensions can't update themselves, so only notify: every 6 hours (and 5 s after start) fetch
updates/latest.json ({version, url, notes}) from the repo's raw.githubusercontent.com URL, compare dotted
versions numerically, and show a banner with the notes, a Download link, and the steps to install it
(replace the folder or git pull, then click reload in chrome://extensions). Add a "Check for Updates…"
button and an "Update source" override. A GitHub Action on main builds the zip and latest.json when the
manifest version changes.

TESTS
- A Node test for the filter function (node tests/rules.test.mjs).
- tests/fake-x.html: a fake dark-mode timeline using X's data-testid markup (including a quoted post and
  my own post) that mocks chrome.storage/runtime and window.fetch for AboutAccountQuery, with switches to
  make the fake API answer 429 (with x-rate-limit-reset), 404 and 403, and a "load more posts" button.
- tests/popup-harness.html: loads the popup with mocked chrome APIs and a few hundred made-up cached
  accounts.
Serve the folder with `python3 -m http.server` to open them. Run everything and fix what fails before
telling me it's done.

FINALLY
Write a README (what it does, how to install unpacked, rate limits, regions, privacy: nothing leaves the
browser except the lookups to x.com) and draw a simple icon in 16/32/48/128 px. Then tell me how to load
it: chrome://extensions → Developer mode → Load unpacked → pick the folder → open x.com while signed in.
````

**If it doesn't work on x.com:** X changes its internals from time to time. Tell your assistant what the popup says (or the error code), and ask it to check the request in the browser's DevTools → Network tab while you open an account's "About this account" page on x.com. The query id, headers and response there are the current ones.

---

## Prompt 2: install this repo's version

> Help me install the Social Media Moat browser extension from https://github.com/jonpikereally/SocialMediaMoat.
>
> 1. Read `README.md`, `AGENTS.md` and `ERRORS.md` in the repo first.
> 2. Clone it to `~/SocialMediaMoat` (or `git pull` if it's already there). The folder must stay put: the browser runs the extension from it.
> 3. If Node 18+ is installed, run `node tests/rules.test.mjs`.
> 4. Walk me through loading it: open `chrome://extensions` (`brave://extensions` in Brave), turn on Developer mode, click Load unpacked, pick the folder, pin it to the toolbar.
> 5. Have me open x.com while signed in, then click the extension and pick my countries.
>
> If anything shows an SM-### error code, look it up in `ERRORS.md` and help me fix it.
