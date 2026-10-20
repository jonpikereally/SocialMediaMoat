# Social Media Moat error codes

Every problem Social Media Moat can show you has a code like `SM-202`. Find yours below.

**Getting help from an AI assistant:** click **Copy Error Details** on the error, then paste it into ChatGPT, Claude or similar along with a link to this page. For a plain-text copy that's easy for AI assistants to read, use https://raw.githubusercontent.com/jonpikereally/SocialMediaMoat/main/ERRORS.md

Codes are grouped: `1xx` updates, `2xx` reading X and looking up countries, `3xx` saved data, `999` anything else. Codes are never reused or renumbered.

| Code | What happened | What to try |
|---|---|---|
| `SM-101` | Social Media Moat couldn't reach the update feed. | Check your internet connection. If you set a custom Update source in Settings, make sure the URL is right, or clear it. |
| `SM-102` | The update feed answered, but not with a valid `latest.json`. | Clear the Update source in Settings to go back to the built-in GitHub feed. If you're already on it, open an issue. |
| `SM-201` | Reading an X page failed. X may have changed its page layout. | Reload the page. If it keeps happening, copy the details and open an issue. |
| `SM-202` | X refused the country lookups (no sign-in cookie, or HTTP 401/403). Lookups stop until you reload. | Sign in to X in this browser, then reload the page. |
| `SM-203` | X's "About this account" query wasn't found (HTTP 400/404), and Social Media Moat couldn't find its new query id in x.com's scripts. Posts are shown unfiltered meanwhile. | Check for an update (Settings → Check for Updates). If you know the new `AboutAccountQuery` id, paste it in Settings → X lookup query id. |
| `SM-204` | X is rate-limiting "About this account" lookups. Not a fault: lookups resume at the time shown, and posts from accounts not yet checked are shown meanwhile. | Nothing. Countries already looked up are remembered, so this gets rarer the more you scroll. |
| `SM-205` | X answered a country lookup with something that isn't readable JSON. | Reload the page. If it keeps happening, copy the details and open an issue. |
| `SM-301` | Reading or saving settings or remembered countries failed. | Restart the browser. If it persists, copy the details. |
| `SM-302` | Saving failed because the browser's storage is full. | Free some disk space, or use Settings → Forget looked-up countries. |
| `SM-999` | Something unexpected went wrong. | Copy the details and paste them into an AI assistant with a link to this page, or open an issue. |
