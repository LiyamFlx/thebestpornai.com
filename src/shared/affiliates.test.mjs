import test from "node:test";
import assert from "node:assert/strict";
import { ourdreamUrl, OURDREAM, affiliateChoiceHtml, AFFILIATE_REL } from "./affiliates.js";

test("CPA homepage and create landings", () => {
  assert.match(OURDREAM.home, /2CTPL\/\?uid=3$/);
  assert.match(OURDREAM.create, /2CTPL\/\?uid=172$/);
  assert.match(ourdreamUrl("create", "watch"), /uid=172&s1=watch$/);
  assert.match(ourdreamUrl("home", "blog"), /uid=3&s1=blog$/);
  assert.equal(ourdreamUrl("home"), OURDREAM.home);
});

test("affiliate choice names both partners and marks the links sponsored", () => {
  const html = affiliateChoiceHtml("blog");
  assert.match(html, /OurDream/);
  assert.match(html, /Candy AI/);
  assert.match(html, /s1=blog-ourdream/);
  assert.match(html, /utm_source=blog-candy/);
  assert.match(html, new RegExp(AFFILIATE_REL.replace(/ /g, " ")));
  assert.match(html, /commission/);
});
