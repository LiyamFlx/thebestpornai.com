import test from "node:test";
import assert from "node:assert/strict";
import { ourdreamUrl, OURDREAM, affiliateChoiceHtml, AFFILIATE_REL } from "./affiliates.js";

test("CPA homepage and create landings", () => {
  assert.match(OURDREAM.home, /\?p=HWH86HD1$/);
  assert.match(OURDREAM.create, /\?p=HWH86HD1$/);
  assert.match(ourdreamUrl("create", "watch"), /p=HWH86HD1&sub1=watch$/);
  assert.match(ourdreamUrl("home", "blog"), /p=HWH86HD1&sub1=blog$/);
  assert.equal(ourdreamUrl("home"), OURDREAM.home);
});

test("affiliate choice names both partners and marks the links sponsored", () => {
  const html = affiliateChoiceHtml("blog");
  assert.match(html, /OurDream/);
  assert.match(html, /Candy AI/);
  assert.match(html, /sub1=blog-ourdream/);
  assert.match(html, /utm_source=blog-candy/);
  assert.match(html, new RegExp(AFFILIATE_REL.replace(/ /g, " ")));
  assert.match(html, /commission/);
});
