import test from "node:test";
import assert from "node:assert/strict";
import { appShellHtml } from "../../scripts/lib/site-chrome.mjs";

test("appShellHtml handles positional arguments correctly", () => {
  const html = appShellHtml("blog", "<article>Positional content</article>");
  assert.ok(html.includes("Positional content"));
  assert.ok(!html.includes("undefined"));
  assert.ok(html.includes('href="/blog/" class=" active"'));
});

test("appShellHtml handles options object argument correctly", () => {
  const html = appShellHtml({ activeNav: "blog", bodyContent: "<article>Object content</article>" });
  assert.ok(html.includes("Object content"));
  assert.ok(!html.includes("undefined"));
  assert.ok(html.includes('href="/blog/" class=" active"'));
});

test("appShellHtml renders complete mobile navigation structure (drawer, bottom nav, toggle, escape key)", () => {
  const html = appShellHtml("home", "<main>Main Feed</main>");
  // Mobile drawer toggle & container
  assert.ok(html.includes('class="topbar-drawer-toggle"'), "Must include drawer toggle button");
  assert.ok(html.includes('id="staticDrawer"'), "Must include mobile drawer");
  assert.ok(html.includes('id="staticBackdrop"'), "Must include drawer backdrop");
  assert.ok(html.includes('role="dialog"'), "Drawer must have dialog role for accessibility");

  // Mobile bottom navigation bar
  assert.ok(html.includes('class="bottom-nav"'), "Must include mobile bottom nav");
  assert.ok(html.includes('class="bottom-nav-item active"'), "Home nav item must be active when activeNav=home");
  assert.ok(html.includes('href="/shorts"'), "Bottom nav must link to Shorts");
  assert.ok(html.includes('href="/categories/"'), "Bottom nav must link to Categories");
  assert.ok(html.includes('href="/pornstars/"'), "Bottom nav must link to Stars");
  assert.ok(html.includes('href="/blog/"'), "Bottom nav must link to Blog");

  // Escape key handler script
  assert.ok(html.includes('e.key==="Escape"'), "Must include keyboard accessibility handler for Escape key");
});

test("appShellHtml gracefully handles unusual / edge-case inputs", () => {
  // Empty activeNav
  const emptyNav = appShellHtml("", "<p>Content</p>");
  assert.ok(emptyNav.includes("<p>Content</p>"));
  assert.ok(!emptyNav.includes("undefined"));

  // Null activeNav
  const nullNav = appShellHtml(null, "<p>Content</p>");
  assert.ok(nullNav.includes("<p>Content</p>"));
  assert.ok(!nullNav.includes("null active"));

  // Undefined bodyContent
  const noBody = appShellHtml("home");
  assert.ok(noBody.includes('class="bottom-nav"'));

  // Content with quotes, HTML tags, and special unicode
  const specialContent = `<section data-meta="test &amp; run">🔥 100% 4K "Super" &lt;Special&gt;</section>`;
  const specialHtml = appShellHtml("compare", specialContent);
  assert.ok(specialHtml.includes(specialContent));
});
