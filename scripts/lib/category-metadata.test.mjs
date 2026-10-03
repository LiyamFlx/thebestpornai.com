import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TOP_CATEGORIES } from "./category-metadata.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "../..");
const BLOG_DIR = path.join(REPO, "blog");

test("TOP_CATEGORIES has 16 comprehensive category definitions", () => {
  assert.equal(TOP_CATEGORIES.length, 16);
});

test("Each category has complete SEO & AEO metadata and valid blog guide links", () => {
  const seenSlugs = new Set();
  for (const cat of TOP_CATEGORIES) {
    assert.ok(cat.name, "Category must have a name");
    assert.ok(cat.slug, `Category ${cat.name} must have a slug`);
    assert.ok(!seenSlugs.has(cat.slug), `Duplicate slug: ${cat.slug}`);
    seenSlugs.add(cat.slug);

    assert.ok(cat.headline, `Category ${cat.name} must have a headline`);
    assert.ok(cat.desc, `Category ${cat.name} must have a meta description`);
    assert.ok(cat.lead, `Category ${cat.name} must have an intro lead`);
    assert.ok(cat.editorial1, `Category ${cat.name} must have editorial paragraph 1`);
    assert.ok(cat.editorial2, `Category ${cat.name} must have editorial paragraph 2`);

    // Verify blog guide file exists on disk
    assert.ok(cat.guideSlug, `Category ${cat.name} must have a guideSlug`);
    const guidePath = path.join(BLOG_DIR, `${cat.guideSlug}.html`);
    assert.ok(fs.existsSync(guidePath), `Guide file ${guidePath} must exist on disk`);

    // Verify FAQs
    assert.ok(Array.isArray(cat.faqs), `Category ${cat.name} must have faqs array`);
    assert.ok(cat.faqs.length >= 2, `Category ${cat.name} must have at least 2 FAQs`);

    for (const faq of cat.faqs) {
      assert.ok(faq.q, "FAQ question must be non-empty");
      assert.ok(faq.a, "FAQ answer must be non-empty");
      assert.ok(!faq.a.includes("http://") && !faq.a.includes("https://"), "FAQ answer should not contain bare URLs");
      const wordCount = faq.a.split(/\s+/).filter(Boolean).length;
      assert.ok(wordCount >= 25 && wordCount <= 90, `FAQ answer length (${wordCount} words) should be AEO-calibrated (25-90 words)`);
    }
  }
});
