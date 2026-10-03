import test from "node:test";
import assert from "node:assert/strict";
import { appShellHtml } from "./site-chrome.mjs";

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
