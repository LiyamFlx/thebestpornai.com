import test from "node:test";
import assert from "node:assert/strict";
import { vstate } from "./state.js";
import { displayViews, displayLikes } from "./display-metrics.js";

test("displayViews returns seed views when live state is absent", () => {
  delete vstate.live[99991];
  assert.equal(displayViews({ id: 99991, views: 1250 }), 1250);
  assert.equal(displayViews({ id: 99991 }), 0);
  assert.equal(displayViews(null), 0);
});

test("displayViews prioritizes live state views over seed views", () => {
  vstate.live[1285] = { views: 3 };
  assert.equal(displayViews({ id: 1285, views: 0 }), 3);
  assert.equal(displayViews(1285), 3);
  delete vstate.live[1285];
});

test("displayViews edge cases - handles null, undefined, strings, NaN gracefully", () => {
  assert.equal(displayViews(null), 0);
  assert.equal(displayViews(undefined), 0);
  assert.equal(displayViews(0), 0);
  assert.equal(displayViews("not-a-valid-id"), 0);
  assert.equal(displayViews({ id: 99993, views: "abc" }), 0);
  assert.equal(displayViews({ id: 99993, views: NaN }), 0);
  assert.equal(displayViews({ id: 99993, views: "42" }), 42);
});

test("displayLikes edge cases - handles null, undefined, strings, NaN gracefully", () => {
  assert.equal(displayLikes(null), 0);
  assert.equal(displayLikes(undefined), 0);
  assert.equal(displayLikes(0), 0);
  assert.equal(displayLikes("not-a-valid-id"), 0);
  assert.equal(displayLikes({ id: 99994, likes: "abc" }), 0);
  assert.equal(displayLikes({ id: 99994, likes: NaN }), 0);
  assert.equal(displayLikes({ id: 99994, likes: "15" }), 15);
});
