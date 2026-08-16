import test from "node:test";
import assert from "node:assert/strict";
import { parseVideoId } from "./video.mjs";

test("parseVideoId accepts hash and query forms", () => {
  assert.equal(parseVideoId("https://www.thebestpornai.com/#video/4301"), 4301);
  assert.equal(parseVideoId("https://www.thebestpornai.com/watch/4301"), 4301);
  assert.equal(parseVideoId("https://www.thebestpornai.com/?video=99"), 99);
  assert.equal(parseVideoId("#video/12"), 12);
  assert.equal(parseVideoId("4301"), 4301);
  assert.equal(parseVideoId("not-a-video"), null);
});
