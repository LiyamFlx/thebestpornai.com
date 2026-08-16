/**
 * Focused Deep Regression & Edge-Case Test Suite
 * Tests catalog data contracts, query selectors, search edge cases, player controls safety,
 * DOM rendering edge cases, structured data validation, and build tooling stability.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");

let passed = 0;
let failed = 0;
const results = [];

function check(label, fn) {
  try {
    fn();
    passed++;
    results.push({ status: "PASS", label });
  } catch (err) {
    failed++;
    results.push({ status: "FAIL", label, error: err.message, stack: err.stack });
    console.error(`❌ FAIL: ${label}\n   ${err.message}`);
  }
}

async function asyncCheck(label, fn) {
  try {
    await fn();
    passed++;
    results.push({ status: "PASS", label });
  } catch (err) {
    failed++;
    results.push({ status: "FAIL", label, error: err.message, stack: err.stack });
    console.error(`❌ FAIL: ${label}\n   ${err.message}`);
  }
}

console.log("🚀 Starting Comprehensive Regression & Edge-Case Test Suite...\n");

// --- SECTION 1: Catalog Integrity & Edge Case Resilience ---
const { DATA } = await import("../src/shared/catalog.js");
const { VIDEOS } = await import("../src/shared/catalog-videos.js");
const {
  pubVideos,
  trending,
  byCat,
  sortedVideos,
  movies,
  scenesFor,
  clipsFor,
  clipsByAct,
  actNames,
  highlights,
  originals,
  byIdDesc,
  byViewsDesc,
  byUploadedDesc,
  videoById,
  searchCatalog,
  bumpCatalogGeneration,
} = await import("../src/viewer/catalog-queries.js");

check("Catalog has 5,000+ videos with valid positive integer IDs", () => {
  assert(VIDEOS.length >= 5000, `Expected >= 5000 videos, got ${VIDEOS.length}`);
  const idSet = new Set();
  for (const v of VIDEOS) {
    assert(Number.isInteger(v.id) && v.id > 0, `Invalid ID: ${v.id}`);
    assert(!idSet.has(v.id), `Duplicate ID found: ${v.id}`);
    idSet.add(v.id);
  }
});

const { loadFullCatalog } = await import("../src/shared/catalog.js");

check("videoById works on initial seed catalog before full catalog loads", () => {
  const seedId = DATA.videos[0]?.id;
  assert(seedId, "Must have seed videos");
  const v = videoById(seedId);
  assert(v && v.id === seedId, "Must find seed video");
});

await asyncCheck("loadFullCatalog hydrates all 5,141 videos and videoById finds any video", async () => {
  await loadFullCatalog();
  assert(DATA.videos.length >= 5000, `Expected full catalog hydrated, got ${DATA.videos.length}`);
  const sampleIds = [VIDEOS[0].id, VIDEOS[Math.floor(VIDEOS.length / 2)].id, VIDEOS[VIDEOS.length - 1].id];
  for (const id of sampleIds) {
    const v = videoById(id);
    assert(v, `videoById failed for ID ${id}`);
    assert.equal(v.id, id);
  }
});

check("All query selectors tolerate minimalist edge-case video objects (null/undefined fields)", () => {
  const orig = DATA.videos;
  try {
    DATA.videos = [
      { id: 999901 }, // bare minimum
      { id: 999902, title: null, views: null, likes: null, tags: null, categories: null, status: "published" },
      { id: 999903, title: "Edge Case", views: NaN, likes: undefined, status: "private" },
      { id: 999904, movieTitle: "Movie X", level: "scene", sceneNumber: 1, status: "published" },
      { id: 999905, movieTitle: "Movie X", level: "movie", status: "published" },
      { id: 999906, movieTitle: "Movie X", level: "clip", sceneNumber: 1, clipNumber: 1, tags: ["Act A"], status: "published" },
      { id: 999907, movieTitle: "Movie X", level: "clip", sceneNumber: 1, clipNumber: 2, tags: ["Act A"], status: "published" },
      { id: 999908, type: "original", status: "published" },
      { id: 999909, level: "highlight", status: "published" },
    ];
    bumpCatalogGeneration();

    assert.doesNotThrow(() => pubVideos());
    assert.doesNotThrow(() => trending());
    assert.doesNotThrow(() => byCat("Blonde"));
    assert.doesNotThrow(() => byIdDesc());
    assert.doesNotThrow(() => byViewsDesc());
    assert.doesNotThrow(() => byUploadedDesc());
    assert.doesNotThrow(() => sortedVideos("views"));
    assert.doesNotThrow(() => sortedVideos("likes"));
    assert.doesNotThrow(() => sortedVideos("newest"));
    assert.doesNotThrow(() => movies());
    assert.doesNotThrow(() => scenesFor("Movie X"));
    assert.doesNotThrow(() => clipsFor("Movie X", 1));
    assert.doesNotThrow(() => clipsByAct("Act A"));
    assert.doesNotThrow(() => actNames());
    assert.doesNotThrow(() => highlights());
    assert.doesNotThrow(() => originals());
    assert.doesNotThrow(() => searchCatalog("Edge"));
  } finally {
    DATA.videos = orig;
    bumpCatalogGeneration();
  }
});

// --- SECTION 2: Search Index Edge Cases & Benchmarking ---
check("searchCatalog handles hostile / extreme input strings safely", () => {
  const hostileQueries = [
    "",
    "   ",
    "a", // 1 char
    "---",
    "[.*+?^${}()|[\\]\\]", // regex bombs
    "<script>alert(1)</script>",
    "'; DROP TABLE videos; --",
    "null",
    "undefined",
    "NaN",
    "🔥🍑🍆", // emojis
    "日本語", // non-latin
    "verylongstringwithnospacesthatwillnotmatchanythinginanycatalogitemevercreated1234567890",
    "milf blonde big tits latina redhead ebony asian pov anal blowjob amateur homemade", // 13 terms
  ];

  for (const q of hostileQueries) {
    const res = searchCatalog(q);
    assert(Array.isArray(res), `searchCatalog("${q}") must return an array`);
  }
});

check("searchCatalog ranking order and popularity tiebreaker work correctly", () => {
  const orig = DATA.videos;
  try {
    DATA.videos = [
      { id: 101, title: "Unrelated Video", category: "Anal", tags: ["anal"], views: 10, likes: 0, status: "published" },
      { id: 102, title: "Blonde Girl Dancing", category: "Dance", tags: ["dancing"], views: 100, likes: 5, status: "published" },
      { id: 103, title: "Solo Blonde Model", category: "Blonde", tags: ["blonde", "solo"], views: 50000, likes: 2000, status: "published" },
      { id: 104, title: "Blonde Supermodel", category: "Blonde", tags: ["blonde"], views: 1000, likes: 50, status: "published" },
    ];
    bumpCatalogGeneration();

    const results = searchCatalog("blonde");
    assert.equal(results.length, 3, "Should match exactly 3 blonde entries");
    assert.equal(results[0].id, 103, "Exact category + high views/likes should rank first");
    assert.equal(results[1].id, 104, "Exact category should rank second");
    assert.equal(results[2].id, 102, "Title substring should rank third");
  } finally {
    DATA.videos = orig;
    bumpCatalogGeneration();
  }
});

check("Search performance benchmark (1,000 queries)", () => {
  const terms = ["milf", "blonde", "latina", "pov", "anal", "twerk", "redhead", "big ass", "blowjob", "asian"];
  const t0 = performance.now();
  const iterations = 1000;
  for (let i = 0; i < iterations; i++) {
    const q = terms[i % terms.length];
    searchCatalog(q);
  }
  const t1 = performance.now();
  const totalMs = t1 - t0;
  const avgMs = totalMs / iterations;
  console.log(`   ⚡ 1,000 searches completed in ${totalMs.toFixed(2)}ms (avg ${avgMs.toFixed(3)}ms / query)`);
  assert(avgMs < 2.0, `Average search query time must be < 2.0ms, got ${avgMs.toFixed(3)}ms`);
});

// --- SECTION 3: UI Component Rendering & Resilience ---
const { videoCard, tagChips, playerEmbed } = await import("../src/shared/ui.js");

check("videoCard renders valid markup for complete video object", () => {
  const v = {
    id: 42,
    title: "Test Video 42",
    creator: "c1",
    category: "Blonde",
    views: 12500,
    duration: "12:34",
    uploaded: "2026-05-01",
    thumb: "../media/thumbs/test.jpg",
    src: "../media/test.mp4",
    tags: ["blonde", "4k"],
  };
  const html = videoCard(v);
  assert(html.includes('data-action="open-video"'), "Must include data-action=open-video");
  assert(html.includes('data-video-id="42"'), "Must include data-video-id=42");
  assert(html.includes('data-action="toggle-fav"'), "Must include data-action=toggle-fav");
  assert(html.includes('data-action="toggle-later"'), "Must include data-action=toggle-later");
  assert(html.includes('data-action="share-video"'), "Must include data-action=share-video");
  assert(html.includes("12:34"), "Must include duration badge");
});

check("videoCard gracefully handles missing/null attributes without crashing", () => {
  const bareVideo = { id: 777 };
  assert.doesNotThrow(() => {
    const html = videoCard(bareVideo);
    assert(html.includes('data-video-id="777"'));
  });

  const nullVideo = {
    id: 778,
    title: null,
    creator: null,
    category: null,
    views: null,
    duration: null,
    uploaded: null,
    thumb: null,
    src: null,
    tags: null,
  };
  assert.doesNotThrow(() => {
    const html = videoCard(nullVideo);
    assert(html.includes('data-video-id="778"'));
  });
});

check("tagChips handles empty/malformed tag arrays", () => {
  assert.equal(tagChips([]), "");
  assert.equal(tagChips(null), "");
  assert.equal(tagChips(undefined), "");
  assert.equal(tagChips("not-an-array"), "");
  const valid = tagChips(["milf", "blonde"]);
  assert(valid.includes('data-action="search-tag"'));
  assert(valid.includes('data-tag="milf"'));
});

check("playerEmbed handles YouTube, R2, and empty sources", () => {
  const ytVid = { id: 1, title: "YT", src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" };
  const ytHtml = playerEmbed(ytVid);
  assert(ytHtml.includes("iframe") && ytHtml.includes("dQw4w9WgXcQ"));

  const r2Vid = { id: 2, title: "R2", src: "../media/test.mp4", thumb: "../media/thumbs/test.jpg" };
  const r2Html = playerEmbed(r2Vid);
  assert(r2Html.includes("<video") && r2Html.includes("test.mp4"));

  const emptyVid = { id: 3, title: "Empty", src: "" };
  const emptyHtml = playerEmbed(emptyVid);
  assert(emptyHtml.includes("VIDEO STREAM"));
});

// --- SECTION 4: Static Landing Pages & Structured Data Validation ---
check("Generated pornstar and category HTML pages contain valid JSON-LD", () => {
  const pornstarFiles = [
    "pornstars/index.html",
    "pornstars/mia-nympo.html",
    "pornstars/sabrina-ass.html",
    "pornstars/marsha-banks.html",
  ];
  const categoryFiles = [
    "categories/index.html",
    "categories/blonde.html",
    "categories/latina.html",
    "categories/big-ass.html",
    "categories/milf.html",
    "categories/pov.html",
  ];

  for (const rel of [...pornstarFiles, ...categoryFiles]) {
    const filePath = path.join(REPO, rel);
    assert(fs.existsSync(filePath), `Static file ${rel} must exist`);
    const content = fs.readFileSync(filePath, "utf8");
    assert(content.includes("<!DOCTYPE html>"), `${rel} must have DOCTYPE`);
    assert(content.includes("<link rel=\"canonical\""), `${rel} must have canonical tag`);

    // Extract and validate JSON-LD
    const match = content.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert(match, `${rel} must contain Schema.org JSON-LD script block`);
    let parsed;
    assert.doesNotThrow(() => {
      parsed = JSON.parse(match[1]);
    }, `${rel} JSON-LD must parse cleanly`);
    assert(parsed["@context"] === "https://schema.org", `${rel} context must be schema.org`);
    assert(parsed["@type"], `${rel} must define @type`);
  }
});

check("Sitemap contains all indexable static routes and valid XML", () => {
  const sitemapPath = path.join(REPO, "public", "sitemap.xml");
  assert(fs.existsSync(sitemapPath), "public/sitemap.xml must exist");
  const xml = fs.readFileSync(sitemapPath, "utf8");
  assert(xml.includes('<?xml version="1.0" encoding="UTF-8"?>'), "Must be valid XML declaration");
  assert(xml.includes("<urlset"), "Must have urlset root");
  assert(xml.includes("/pornstars/"), "Must include /pornstars/");
  assert(xml.includes("/pornstars/mia-nympo.html"), "Must include Mia Nympo profile");
  assert(xml.includes("/categories/"), "Must include /categories/");
  assert(xml.includes("/categories/blonde.html"), "Must include Blonde category");
  assert(xml.includes("/blog/"), "Must include /blog/");
});

// --- SECTION 5: Social Unfurl Gateway & PWA Validation ---
await asyncCheck("Social unfurl gateway (api/video-share.js) generates complete OpenGraph & Twitter player metadata", async () => {
  const { default: videoShareHandler } = await import("../api/video-share.js");
  
  let statusCode = 200;
  let headers = {};
  let body = "";
  const res = {
    status(s) { statusCode = s; return this; },
    setHeader(k, v) { headers[k] = v; },
    send(html) { body = html; }
  };

  // Test with valid video ID 1
  videoShareHandler({ query: { id: "1" } }, res);
  assert.equal(statusCode, 200);
  assert(headers["Content-Type"].includes("text/html"));
  assert(body.includes('property="og:title"'));
  assert(body.includes('property="og:video"'));
  assert(body.includes('name="twitter:card" content="player"'));
  assert(body.includes('name="twitter:player"'));
  assert(body.includes('https://schema.org'));
  assert(body.includes('/watch/1'));

  // Test with invalid ID (safe fallback)
  videoShareHandler({ query: { id: "999999999" } }, res);
  assert.equal(statusCode, 200);
  assert(body.includes('thebestpornai'));
});

check("PWA manifest is valid JSON and contains all required icons and shortcuts", () => {
  const manifestPath = path.join(REPO, "public", "site.webmanifest");
  assert(fs.existsSync(manifestPath), "public/site.webmanifest must exist");
  const raw = fs.readFileSync(manifestPath, "utf8");
  let json;
  assert.doesNotThrow(() => { json = JSON.parse(raw); }, "Manifest must be valid JSON");
  assert.equal(json.display, "standalone");
  assert(Array.isArray(json.icons) && json.icons.length >= 4, "Must have standard icons");
  assert(Array.isArray(json.shortcuts) && json.shortcuts.length >= 1, "Must have shortcuts");
  
  // Verify all icon paths exist in public/
  for (const icon of json.icons) {
    const iconRel = icon.src.replace(/^\//, "");
    const iconPath = path.join(REPO, "public", iconRel);
    assert(fs.existsSync(iconPath), `Icon file ${iconRel} must exist in public/`);
  }
});

check("Service worker (public/sw.js) contains required event listeners", () => {
  const swPath = path.join(REPO, "public", "sw.js");
  assert(fs.existsSync(swPath), "public/sw.js must exist");
  const content = fs.readFileSync(swPath, "utf8");
  assert(content.includes('addEventListener("install"'), "Must handle install event");
  assert(content.includes('addEventListener("activate"'), "Must handle activate event");
  assert(content.includes('addEventListener("fetch"'), "Must handle fetch event");
  assert(content.includes('.mp4'), "Must bypass video media from cache");
});

// --- SECTION 6: Tooling & CLI Scripts Non-Destructive Invariance ---
await asyncCheck("Publish doctor script runs with zero errors", async () => {
  const { execSync } = await import("node:child_process");
  const output = execSync("node scripts/publish-doctor.js", { cwd: REPO, encoding: "utf8" });
  assert(output.includes("Catalog structure looks healthy"), "publish-doctor must pass");
});

await asyncCheck("Check catalog IDs script runs with zero errors", async () => {
  const { execSync } = await import("node:child_process");
  const output = execSync("node scripts/check-catalog-ids.js", { cwd: REPO, encoding: "utf8" });
  assert(output.includes("unique video ids, no duplicates"), "check-catalog-ids must pass");
});

// --- SUMMARY ---
console.log("\n==================================================");
console.log(`Regression Test Summary: ${passed} PASSED, ${failed} FAILED`);
console.log("==================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("✨ All regression & edge-case tests passed with 100% stability!");
}
