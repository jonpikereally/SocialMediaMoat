# Social Media Moat

A Chrome / Brave / Edge extension that filters your X (Twitter) timeline by **where each account is based**, so you can see only posts from your own country (or hide posts from countries you pick).

The country comes from X itself: every account's **About this account** page shows "Account based in …". Social Media Moat asks X for that the same way x.com does, using your signed-in session, and remembers the answer so each account is looked up at most once a month.

![icon](icons/icon128.png)

## What it does

- **Only show these countries** (default: Canada), or **hide these countries**.
- Hidden posts become a thin strip, "Hidden post from @name · 🇺🇸 United States", with a **Show** button. Or remove them completely.
- A small country tag (🇨🇦 Canada) next to each name.
- **Reposts** are judged by who wrote the post. Turn on **Also hide reposts by filtered accounts** to also hide them when the account that reposted is filtered.
- Accounts X shows no country for: show or hide them (Settings).
- **Accounts you follow are always shown** (can be turned off). It learns who you follow from what X already loads as you browse; scroll your own Following list once to teach it quickly.
- **Always show** list for accounts you never want hidden. Your own posts, and anyone's posts while you're on their profile, are never hidden.
- The popup lists every country it has seen on your timeline with a count. Click one to add or remove it.
- The toolbar badge shows how many posts are hidden on the current tab.

## Install

1. Download this repo (Code → Download ZIP) and unzip it, or `git clone https://github.com/jonpikereally/SocialMediaMoat`.
2. Open `chrome://extensions` (or `brave://extensions`), turn on **Developer mode**, click **Load unpacked** and pick the `SocialMediaMoat` folder.
3. Open x.com while signed in.

**Build it yourself:** [BUILD-WITH-CLAUDE.md](BUILD-WITH-CLAUDE.md) has a prompt you can give Claude (or another AI coding assistant) to rebuild the whole extension from scratch, plus a shorter one to install this version with an AI walking you through it.

Updates: the popup tells you when a new version exists. Download it again (or `git pull`) and click ↻ on Social Media Moat in the extensions page.

## Good to know

- **X limits how many accounts can be looked up** in a short time. When it says stop, Social Media Moat waits until X's reset time and shows posts from not-yet-checked accounts in the meantime. Since answers are remembered, this gets rarer the more you scroll.
- Some accounts show only a **region** ("Europe", "South Asia") instead of a country. They count as "not in your list" unless you add the region by name.
- X's "based in" can be wrong (VPNs, travel). X marks some as possibly inaccurate; Social Media Moat uses what X shows.
- Nothing leaves your browser except the lookups to x.com. To learn who you follow, a small script inside the x.com page reads X's own responses and passes on only "handle: followed or not". Remembered countries are stored locally (`chrome.storage.local`).
- If X changes how lookups work, the extension tries to find the new way in x.com's own scripts; if it can't, you'll see error `SM-203` and posts are shown unfiltered.

## Errors

Every problem shows a code like `SM-202`. See [ERRORS.md](ERRORS.md).

## Development

No build step. `node tests/rules.test.mjs` tests the filtering rules. To try the content script and popup without x.com, serve the folder over http (`python3 -m http.server`) and open `tests/fake-x.html` (fake timeline with mocked X responses, rate limits and errors) or `tests/popup-harness.html` (`?rl`, `?err`, `?stopped`).

Releasing: bump `version` in `manifest.json`, update `RELEASE_NOTES.txt`, push to `main`. The Release action builds `updates/`.

MIT licence.
