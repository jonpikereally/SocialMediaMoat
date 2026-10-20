# Brief for anyone (human or AI) working on Social Media Moat

Manifest V3 extension (Chrome/Brave/Edge). Plain JS, no build step, no dependencies. Sibling of FakeSale and Marketplace Lens (jonpikereally), with the same release and error-code conventions.

- **Country source:** X's GraphQL `AboutAccountQuery` (`/i/api/graphql/<queryId>/AboutAccountQuery?variables={"screenName":…}`), called from the content script as a same-origin fetch with the web app's public bearer token and the `ct0` cookie as `x-csrf-token`. Answer: `data.user_result_by_screen_name.result.about_profile.account_based_in` (a country name, sometimes a region, sometimes absent). Default query id `XRqGa7EeokUU5kppkh13EA`; on 400/404 the background tries to find the new id in x.com's bundles on abs.twimg.com, then `SM-203`. Settings → X lookup query id overrides it.
- **Rate limits:** one lookup at a time, 400 ms apart, on-screen posts first. On 429 (or `x-rate-limit-remaining: 0`) the reset time is stored as `rl` and shared by all tabs. Unchecked posts are shown, never hidden, while waiting.
- **Storage** (`chrome.storage.local`): `c:<handle lower case>` = `{ c: country | null, t: checkedAt }` (re-checked after 30 days, or 3 days when null; pruned after 60 days), `settings`, `rl`, `qid`, `errors`, `update`. `storage.session` `tab:<id>` holds the popup's per-tab counts. Never rename keys without a migration.
- **Rules** live in `src/shared/rules.js` (`decide()`), shared by content script, popup and `tests/rules.test.mjs`.
- **Page reading:** posts are `article[data-testid="tweet"]`; the author is the first `/handle` link inside the first `[data-testid="User-Name"]` (quoted posts come later in the DOM). The hidden element is the `[data-testid="cellInnerDiv"]`. Never rely on X's generated class names.
- **DOM writes must be idempotent** (`data-smm` state on the cell, tag text compared before writing). The MutationObserver rescans on every change, so a non-idempotent write loops forever.
- **Errors:** every user-facing error has an `SM-###` code in `src/shared/errors.js`, documented in `ERRORS.md`; `scripts/check-errors.sh` enforces this.
- **Testing:** `node tests/rules.test.mjs`; `tests/fake-x.html` and `tests/popup-harness.html` over http. Lookups against real x.com can only be tested in a signed-in browser with the extension loaded.
- **Releases:** bump `manifest.json` version + `RELEASE_NOTES.txt`, push to `main`; the Action builds `updates/`.
