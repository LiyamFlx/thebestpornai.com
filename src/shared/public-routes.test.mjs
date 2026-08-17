import test from "node:test";
import assert from "node:assert/strict";
import {
  watchPath,
  shortsPath,
  playPath,
  searchPath,
  hashToPath,
} from "./public-routes.js";

test("watchPath / shortsPath reject NaN and non-positive ids", () => {
  assert.equal(watchPath(12), "/watch/12");
  assert.equal(watchPath("12"), "/watch/12");
  assert.equal(watchPath(undefined), "/");
  assert.equal(watchPath(null), "/");
  assert.equal(watchPath("NaN"), "/");
  assert.equal(watchPath(0), "/");
  assert.equal(shortsPath(), "/shorts");
  assert.equal(shortsPath(9), "/shorts/9");
  assert.equal(shortsPath("nope"), "/shorts");
});

test("playPath sends vertical clips to Shorts", () => {
  assert.equal(playPath({ id: 5, orientation: "vertical" }), "/shorts/5");
  assert.equal(playPath({ id: 5 }), "/watch/5");
  assert.equal(playPath(5), "/watch/5");
  assert.equal(playPath(null), "/");
});

test("hashToPath migrates legacy hashes to paths", () => {
  assert.equal(hashToPath("video/99"), "/watch/99");
  assert.equal(hashToPath("#shorts/8"), "/shorts/8");
  assert.equal(hashToPath("feed/8"), "/shorts/8");
  assert.equal(hashToPath("shorts"), "/shorts");
  assert.equal(hashToPath("search/Big Ass"), "/search/Big%20Ass");
  assert.equal(hashToPath("search/Big%20Ass"), "/search/Big%20Ass");
  assert.equal(hashToPath("search/%E0%A4%A"), "/search/%E0%A4%A");
  assert.equal(hashToPath("creator/ps-mia-nympo"), "/creator/ps-mia-nympo");
  assert.equal(hashToPath("library/favorites"), "/library/favorites");
  assert.equal(hashToPath("later"), "/library/later");
  assert.equal(hashToPath(""), "/");
});

test("searchPath encodes queries", () => {
  assert.equal(searchPath(""), "/search");
  assert.equal(searchPath("  POV  "), "/search/POV");
});
