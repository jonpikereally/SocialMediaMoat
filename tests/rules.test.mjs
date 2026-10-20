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
assert.equal(flagFor("Canada"), "🇨🇦");
assert.equal(flagFor("United Kingdom"), "🇬🇧");
assert.equal(flagFor("Europe"), "🌐");
assert.equal(norm(" @Jon_Pike "), "jon_pike");
console.log("rules: all passed");
