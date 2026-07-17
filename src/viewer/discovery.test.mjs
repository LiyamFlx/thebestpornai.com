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
    { id: 1, status: "public", category: "Big Ass", categories: [], tags: [] },
    { id: 2, status: "public", category: "POV", categories: ["Big Ass"], tags: [] },
    { id: 3, status: "public", category: "POV", categories: [], tags: ["big ass"] },
    { id: 4, status: "public", category: "Anal", categories: [], tags: ["MILF"] },
  ];
  try {
    const ids = byCategoryFilter("Big Ass").map(v => v.id).sort();
    assert.deepEqual(ids, [1, 2, 3]);   // 4 excluded
  } finally { DATA.videos = orig; }
});

test("relatedTo - ranks by shared tag/category overlap, excludes self", () => {
  const orig = DATA.videos;
  DATA.videos = [
    { id: 1, status: "public", category: "Anal", categories: [], tags: ["MILF", "POV"], views: 0, likes: 0 },
    { id: 2, status: "public", category: "Anal", categories: [], tags: ["MILF", "POV"], views: 0, likes: 0 }, // 3 overlap
    { id: 3, status: "public", category: "POV", categories: [], tags: ["MILF"], views: 0, likes: 0 },          // 1 overlap
    { id: 4, status: "public", category: "Latina", categories: [], tags: ["Ebony"], views: 0, likes: 0 },      // 0 overlap
  ];
  try {
    const rel = relatedTo(DATA.videos[0]).map(v => v.id);
    assert.ok(!rel.includes(1), "excludes the source video");
    assert.equal(rel[0], 2, "most-overlapping first");
    assert.ok(!rel.includes(4), "zero-overlap excluded");
  } finally { DATA.videos = orig; }
});
