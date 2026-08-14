import test from "node:test";
import assert from "node:assert/strict";
import {
  isLandscapeCover,
  stripLeadingHeroDup,
  toInlineFigures,
  absoluteUrl,
} from "./blog-body.mjs";

const DUP = `
      <div class="blog-feature-media">
        <img src="/blog-assets/best-ai-character-generators-workout-raw.jpg" alt="Best AI Character Generators in 2026: Quality, Speed &amp; Features" width="1024" height="576" loading="eager" fetchpriority="high"/>
        <div class="blog-media-caption">Benchmarking prompt accuracy.</div>
      </div>

      <p>As AI generative tools advance in 2026, finding platforms is essential.</p>
`;

test("stripLeadingHeroDup removes the first feature image and keeps the article", () => {
  const { body, caption, stripped } = stripLeadingHeroDup(DUP);
  assert.equal(stripped, true);
  assert.equal(caption, "Benchmarking prompt accuracy.");
  assert.match(body, /^<p>As AI generative tools/);
  assert.doesNotMatch(body, /blog-feature-media/);
});

test("stripLeadingHeroDup is a no-op when the body starts with copy", () => {
  const { body, stripped } = stripLeadingHeroDup("<p>Hello</p>");
  assert.equal(stripped, false);
  assert.equal(body, "<p>Hello</p>");
});

test("isLandscapeCover treats /blog-assets/ covers as banners", () => {
  assert.equal(isLandscapeCover({ cover: "/blog-assets/crew.jpg" }), true);
  assert.equal(isLandscapeCover({ coverLayout: "portrait", cover: "/blog-assets/x.jpg" }), false);
});

test("toInlineFigures makes remaining body images lazy figures", () => {
  const html = toInlineFigures(
    `<div class="blog-feature-media"><img src="/x.jpg" alt="Mid article photo" width="1024" height="576"/><div class="blog-media-caption">Caption</div></div>`
  );
  assert.match(html, /<figure class="blog-inline-figure">/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /<figcaption class="blog-media-caption">Caption<\/figcaption>/);
});

test("absoluteUrl prefixes site origin", () => {
  assert.equal(
    absoluteUrl("https://www.thebestpornai.com", "/blog-assets/x.jpg"),
    "https://www.thebestpornai.com/blog-assets/x.jpg"
  );
});
