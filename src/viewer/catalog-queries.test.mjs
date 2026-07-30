import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { DATA } from "../shared/catalog.js";
import {
  pubVideos,
  visible,
  trending,
  byCat,
  sortedVideos,
  movies,
  scenesFor,
  clipsFor,
  clipsByAct,
  byUploadedDesc,
  videoById,
  bumpCatalogGeneration,
} from "./catalog-queries.js";

// Fixtures use the real production status vocabulary — api/save-upload.js
// writes "published" or "pending" (never "public"), and visible() is a
// deny-list (excludes "private"/"pending" only), so a fixture using the
// fictional "public" status passed for the wrong reason: ANY unrecognized
// status string is treated as visible by default-allow, not because
// "public" is specifically handled anywhere in the real code.
test("catalog queries - visible filter uses the real status vocabulary", (t) => {
  assert.equal(visible({ status: "published" }), true);
  assert.equal(visible({ status: "private" }), false);
  assert.equal(visible({ status: "pending" }), false);
  // Deny-list behavior, called out explicitly: an unrecognized/missing status
  // is NOT hidden by default. This is documented current behavior, not an
  // endorsement — see the "Deny-list visibility" anti-pattern note.
  assert.equal(visible({ status: "some-future-status" }), true);
  assert.equal(visible({}), true);
  assert.equal(visible(null), null);
});

test("catalog queries - pubVideos excludes private AND pending, keeps published", (t) => {
  const origVideos = DATA.videos;
  DATA.videos = [
    { id: 1, status: "published", title: "Published Video" },
    { id: 2, status: "private", title: "Private Video" },
    { id: 3, status: "pending", title: "Pending Moderation" },
  ];

  try {
    const pub = pubVideos();
    assert.equal(pub.length, 1);
    assert.equal(pub[0].id, 1);
  } finally {
    DATA.videos = origVideos;
  }
});

test("catalog queries - trending sorts correctly", (t) => {
  const origVideos = DATA.videos;
  DATA.videos = [
    { id: 1, status: "published", likes: 10, views: 100 },
    { id: 2, status: "published", likes: 20, views: 50 },
  ];

  try {
    const trend = trending();
    assert.equal(trend[0].id, 2); // 20 * 1.2 + 50 * 0.01 = 24.5 vs 10 * 1.2 + 100 * 0.01 = 13
  } finally {
    DATA.videos = origVideos;
  }
});

test("catalog queries - memo cache invalidates on in-place mutation via bumpCatalogGeneration()", (t) => {
  const origVideos = DATA.videos;
  DATA.videos = [
    { id: 1, status: "published", title: "A" },
    { id: 2, status: "published", title: "B" },
  ];

  try {
    assert.equal(pubVideos().length, 2); // populates the cache

    // In-place field mutation: same array reference, same length — the
    // length/identity check alone would miss this (the bug this test guards
    // against). A moderation action flipping status after catalog load is
    // exactly this shape.
    DATA.videos[1].status = "private";
    assert.equal(pubVideos().length, 2, "stale cache before bump (expected — documents the gap)");

    bumpCatalogGeneration();
    assert.equal(pubVideos().length, 1, "cache reflects the mutation after bump");
  } finally {
    DATA.videos = origVideos;
    bumpCatalogGeneration(); // leave the counter clean for subsequent tests
  }
});

test("catalog queries - byUploadedDesc tolerates missing uploaded date", (t) => {
  const origVideos = DATA.videos;
  DATA.videos = [
    { id: 1, status: "published", uploaded: "2026-01-01" },
    { id: 2, status: "published" },                          // no `uploaded` at all — live/incomplete entry
    { id: 3, status: "published", uploaded: "2026-02-01" },
  ];

  try {
    assert.doesNotThrow(() => byUploadedDesc());
    const sorted = byUploadedDesc();
    assert.equal(sorted.length, 3);
    assert.equal(sorted[0].id, 3); // latest real date first
  } finally {
    DATA.videos = origVideos;
  }
});

test("catalog queries - videoById reflects live catalog growth (not frozen at first call)", (t) => {
  const origVideos = DATA.videos;
  DATA.videos = [{ id: 1, status: "published", title: "First" }];

  try {
    assert.equal(videoById(1)?.title, "First");
    assert.equal(videoById(2), undefined);

    // Simulate loadFullCatalog()/mergeLiveUploads() appending after first use.
    DATA.videos.push({ id: 2, status: "published", title: "Second" });
    assert.equal(videoById(2)?.title, "Second");
  } finally {
    DATA.videos = origVideos;
  }
});

test("catalog queries - movies and scenes grouping", (t) => {
  const origVideos = DATA.videos;
  DATA.videos = [
    { id: 1, status: "published", movieTitle: "The Matrix", level: "movie" },
    { id: 2, status: "published", movieTitle: "The Matrix", level: "scene", sceneNumber: 1 },
    { id: 3, status: "published", movieTitle: "The Matrix", level: "scene", sceneNumber: 2 },
  ];
  
  try {
    const movs = movies();
    assert.equal(movs.length, 1);
    assert.equal(movs[0].title, "The Matrix");
    assert.equal(movs[0].scenes.length, 2);
    assert.equal(movs[0].scenes[0].sceneNumber, 1);
  } finally {
    DATA.videos = origVideos;
  }
});
