import test from "node:test";
import assert from "node:assert/strict";
import { ourdreamUrl, OURDREAM } from "./affiliates.js";

test("CPA homepage and create landings", () => {
  assert.match(OURDREAM.home, /2CTPL\/\?uid=3$/);
  assert.match(OURDREAM.create, /2CTPL\/\?uid=172$/);
  assert.match(ourdreamUrl("create", "watch"), /uid=172&s1=watch$/);
  assert.match(ourdreamUrl("home", "blog"), /uid=3&s1=blog$/);
  assert.equal(ourdreamUrl("home"), OURDREAM.home);
});
