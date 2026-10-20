// node tests/rules.test.mjs
import assert from "node:assert/strict";
import "../src/shared/countries.js";
import "../src/shared/rules.js";

const { decide, flagFor, norm } = globalThis.SMRules;
const ca = { c: "Canada" }, us = { c: "United States" }, none = { c: null };
const only = { mode: "only", countries: ["Canada"] };

assert.equal(decide("a", ca, only), "show");
assert.equal(decide("a", us, only), "hide");
assert.equal(decide("a", { c: "CANADA " }, only), "show", "country match ignores case and spaces");
assert.equal(decide("a", undefined, only), "pending");
assert.equal(decide("a", none, only), "show", "unknown shown by default");
assert.equal(decide("a", none, { ...only, unknown: "hide" }), "hide");
assert.equal(decide("a", us, { mode: "hide", countries: ["United States"] }), "hide");
assert.equal(decide("a", ca, { mode: "hide", countries: ["United States"] }), "show");
assert.equal(decide("a", us, { ...only, enabled: false }), "show");
assert.equal(decide("Bob", us, { ...only, allow: ["@bob"] }), "show", "allow list, with @ and any case");
assert.equal(decide("bob", us, only, { own: "Bob" }), "show", "own posts");
assert.equal(decide("bob", us, only, { pageOwner: "BOB" }), "show", "on their own profile");
assert.equal(decide("a", us, { mode: "only", countries: [] }), "hide");
assert.equal(decide("a", { c: "Europe" }, { mode: "only", countries: ["Europe"] }), "show", "regions match by name");
// Reposts: judged by the author, plus the reposter when hideReposts is on.
const recs = { local: ca, foreign: us };
const look = (h) => recs[h];
const { decidePost } = globalThis.SMRules;
assert.deepEqual(decidePost("local", "foreign", look, only), { v: "show", by: "author" }, "toggle off: reposter ignored");
assert.deepEqual(decidePost("local", "foreign", look, { ...only, hideReposts: true }), { v: "hide", by: "reposter" });
assert.deepEqual(decidePost("foreign", "local", look, { ...only, hideReposts: true }), { v: "hide", by: "author" });
assert.deepEqual(decidePost("local", "local", look, { ...only, hideReposts: true }), { v: "show", by: "author" });
assert.deepEqual(decidePost("local", "newbie", look, { ...only, hideReposts: true }), { v: "pending", by: "author" });
assert.deepEqual(decidePost("local", "foreign", look, { ...only, hideReposts: true }, { pageOwner: "foreign" }), { v: "show", by: "author" }, "on the reposter's own profile");
assert.equal(flagFor("Canada"), "🇨🇦");
assert.equal(flagFor("United Kingdom"), "🇬🇧");
assert.equal(flagFor("Europe"), "🌐");
assert.equal(norm(" @Jon_Pike "), "jon_pike");
console.log("rules: all passed");
// Followed accounts
const follows = (h) => h === "friend";
assert.equal(decide("friend", us, only, { follows }), "show", "followed account shown");
assert.equal(decide("friend", us, { ...only, showFollowed: false }, { follows }), "hide", "unless the setting is off");
assert.equal(decide("friend", undefined, only, { follows }), "show", "followed: shown before the lookup");
assert.equal(decide("stranger", us, only, { follows }), "hide");
console.log("follows: all passed");
