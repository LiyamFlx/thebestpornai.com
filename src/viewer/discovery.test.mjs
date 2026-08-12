import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { DATA } from "../shared/catalog.js";
import { byCategoryFilter, relatedTo } from "./catalog-queries.js";
import { ALL_TAGS, CATEGORIES, isPopularTag } from "../shared/taxonomy.js";

test("taxonomy - categories and tags are non-empty and de-duplicated", () => {
  assert.ok(CATEGORIES.length > 20);
  assert.equal(new Set(ALL_TAGS).size, ALL_TAGS.length, "ALL_TAGS must be unique");
  assert.equal(isPopularTag("big ass"), true);   // case-insensitive
  assert.equal(isPopularTag("nonexistent-xyz"), false);
});

test("byCategoryFilter - matches category, categories[], and tags (case-insensitive)", () => {
  const orig = DATA.videos;
  DATA.videos = [
    { id: 1, status: "published", category: "Big Ass", categories: [], tags: [] },
    { id: 2, status: "published", category: "POV", categories: ["Big Ass"], tags: [] },
    { id: 3, status: "published", category: "POV", categories: [], tags: ["big ass"] },
    { id: 4, status: "published", category: "Anal", categories: [], tags: ["MILF"] },
  ];
  try {
    const ids = byCategoryFilter("Big Ass").map(v => v.id).sort();
    assert.deepEqual(ids, [1, 2, 3]);   // 4 excluded
  } finally { DATA.videos = orig; }
});

test("relatedTo - ranks by shared tag/category overlap, excludes self", () => {
  const orig = DATA.videos;
  DATA.videos = [
    { id: 1, status: "published", category: "Anal", categories: [], tags: ["MILF", "POV"], views: 0, likes: 0 },
    { id: 2, status: "published", category: "Anal", categories: [], tags: ["MILF", "POV"], views: 0, likes: 0 }, // 3 overlap
    { id: 3, status: "published", category: "POV", categories: [], tags: ["MILF"], views: 0, likes: 0 },          // 1 overlap
    { id: 4, status: "published", category: "Latina", categories: [], tags: ["Ebony"], views: 0, likes: 0 },      // 0 overlap
  ];
  try {
    const rel = relatedTo(DATA.videos[0]).map(v => v.id);
    assert.ok(!rel.includes(1), "excludes the source video");
    assert.equal(rel[0], 2, "most-overlapping first");
    assert.ok(!rel.includes(4), "zero-overlap excluded");
  } finally { DATA.videos = orig; }
});

test("parseDurationSec & sortedVideos - handles all sort modes including duration and trending", async () => {
  const { parseDurationSec, sortedVideos } = await import("./catalog-queries.js");
  
  assert.equal(parseDurationSec("0:08"), 8);
  assert.equal(parseDurationSec("12:34"), 754);
  assert.equal(parseDurationSec("1:05:20"), 3920);
  assert.equal(parseDurationSec(null), 0);
  assert.equal(parseDurationSec("invalid"), 0);

  const sample = [
    { id: 1, status: "published", duration: "1:00", views: 50, likes: 10, uploaded: "2026-01-01" },
    { id: 2, status: "published", duration: "10:00", views: 500, likes: 100, uploaded: "2026-05-01" },
    { id: 3, status: "published", duration: "0:30", views: 10, likes: 5, uploaded: "2026-03-01" },
  ];

  const longest = sortedVideos("longest", sample).map(v => v.id);
  assert.deepEqual(longest, [2, 1, 3]);

  const shortest = sortedVideos("shortest", sample).map(v => v.id);
  assert.deepEqual(shortest, [3, 1, 2]);

  const latest = sortedVideos("latest", sample).map(v => v.id);
  assert.deepEqual(latest, [2, 3, 1]);

  const views = sortedVideos("views", sample).map(v => v.id);
  assert.deepEqual(views, [2, 1, 3]);

  const likes = sortedVideos("likes", sample).map(v => v.id);
  assert.deepEqual(likes, [2, 1, 3]);
});
