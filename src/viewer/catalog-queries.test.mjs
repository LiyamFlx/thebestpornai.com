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
} from "./catalog-queries.js";

test("catalog queries - visible filter", (t) => {
  assert.equal(visible({ status: "public" }), true);
  assert.equal(visible({ status: "private" }), false);
  assert.equal(visible(null), null);
});

test("catalog queries - pubVideos lists only public videos", (t) => {
  const origVideos = DATA.videos;
  DATA.videos = [
    { id: 1, status: "public", title: "Public Video" },
    { id: 2, status: "private", title: "Private Video" },
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
    { id: 1, status: "public", likes: 10, views: 100 },
    { id: 2, status: "public", likes: 20, views: 50 },
  ];
  
  try {
    const trend = trending();
    assert.equal(trend[0].id, 2); // 20 * 1.2 + 50 * 0.01 = 24.5 vs 10 * 1.2 + 100 * 0.01 = 13
  } finally {
    DATA.videos = origVideos;
  }
});

test("catalog queries - byUploadedDesc tolerates missing uploaded date", (t) => {
  const origVideos = DATA.videos;
  DATA.videos = [
    { id: 1, status: "public", uploaded: "2026-01-01" },
    { id: 2, status: "public" },                          // no `uploaded` at all — live/incomplete entry
    { id: 3, status: "public", uploaded: "2026-02-01" },
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
  DATA.videos = [{ id: 1, status: "public", title: "First" }];

  try {
    assert.equal(videoById(1)?.title, "First");
    assert.equal(videoById(2), undefined);

    // Simulate loadFullCatalog()/mergeLiveUploads() appending after first use.
    DATA.videos.push({ id: 2, status: "public", title: "Second" });
    assert.equal(videoById(2)?.title, "Second");
  } finally {
    DATA.videos = origVideos;
  }
});

test("catalog queries - movies and scenes grouping", (t) => {
  const origVideos = DATA.videos;
  DATA.videos = [
    { id: 1, status: "public", movieTitle: "The Matrix", level: "movie" },
    { id: 2, status: "public", movieTitle: "The Matrix", level: "scene", sceneNumber: 1 },
    { id: 3, status: "public", movieTitle: "The Matrix", level: "scene", sceneNumber: 2 },
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
