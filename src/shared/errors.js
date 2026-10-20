// Every error a user can see has a stable code. Never reuse or renumber.
// The public list lives in ERRORS.md; scripts/check-errors.sh fails the
// build if a code used in src/ or app/ is missing from it.
//   1xx updates   2xx reading X / country lookups   3xx saved data   999 unexpected

export const REPO = "jonpikereally/SocialMediaMoat";
export const ERROR_LIST_URL = `https://github.com/${REPO}/blob/main/ERRORS.md`;
export const ERROR_LIST_RAW = `https://raw.githubusercontent.com/${REPO}/main/ERRORS.md`;
export const ERROR_HOVER = `Look this code up on the Social Media Moat error list: ${ERROR_LIST_URL}`;

export const ERRORS = {
  "SM-101": ["Couldn't reach the update feed.", "Check your internet connection, or the Update source in Settings."],
  "SM-102": ["The update feed returned something unreadable.", "Clear the Update source in Settings to go back to the built-in feed."],
  "SM-201": ["Something went wrong while reading an X page.", "Reload the page. If it keeps happening, X may have changed its layout: copy the details."],
  "SM-202": ["X refused the country lookups.", "Make sure you're signed in to X in this browser, then reload the page."],
  "SM-203": ["X changed how account details are looked up, and Social Media Moat couldn't find the new way.", "Check for a Social Media Moat update. Until then, posts are shown unfiltered."],
  "SM-204": ["X is limiting how many accounts can be looked up right now.", "Nothing to fix: lookups resume on their own. Posts from accounts not yet checked are shown meanwhile."],
  "SM-205": ["X answered a country lookup with something unreadable.", "Reload the page. If it keeps happening, copy the details."],
  "SM-301": ["Couldn't read or save Social Media Moat's settings or saved countries.", "Restart the browser. If it persists, copy the details."],
  "SM-302": ["Couldn't save: the browser's storage is full.", "Free some disk space, or use Settings → Forget looked-up countries."],
  "SM-999": ["Something unexpected went wrong.", "Copy the details and paste them into an AI assistant along with the error list link."],
};

export function describe(code) {
  const [summary, hint] = ERRORS[code] || ERRORS["SM-999"];
  return { code: ERRORS[code] ? code : "SM-999", summary, hint };
}

export function detailsText(err, version) {
  const d = describe(err.code);
  return [
    `Social Media Moat error ${d.code}: ${d.summary}`,
    `What to try: ${d.hint}`,
    err.details ? `Details: ${err.details}` : null,
    `When: ${new Date(err.t || Date.now()).toISOString()}`,
    `Social Media Moat version: ${version}`,
    `Browser: ${navigator.userAgent}`,
    `Error list: ${ERROR_LIST_URL}`,
    `Error list (plain text for AI assistants): ${ERROR_LIST_RAW}`,
  ].filter(Boolean).join("\n");
}

export async function logError(code, details) {
  const { errors = [] } = await chrome.storage.local.get("errors");
  errors.push({ code, details: details ? String(details).slice(0, 2000) : null, t: Date.now() });
  await chrome.storage.local.set({ errors: errors.slice(-100) });
  console.warn(`Social Media Moat ${code}`, details || "");
}
