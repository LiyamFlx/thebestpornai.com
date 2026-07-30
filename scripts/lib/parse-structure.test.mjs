import test from "node:test";
import assert from "node:assert/strict";
import { parseStructure } from "./parse-structure.js";

// Guards a real bug: this function used to set level="scene" as soon as it
// saw a Scene-N segment and never revisit it, so a genuine clip filename
// (Scene-N + Clip-N together) came out mistagged level:"scene" — invisible
// to clipsFor() (catalog-queries.js), which filters strictly on
// level==="clip". Was duplicated identically (and buggy identically) in
// both publish-folder.js and gen-catalog-from-local.js before being
// consolidated into this one module.

test("parseStructure - plain filename (no __ separators) has no structure", () => {
  const s = parseStructure("just-a-flat-video.mp4");
  assert.deepEqual(s, { movieTitle: null, level: null, sceneNumber: null, clipNumber: null, actName: null });
});

test("parseStructure - Full-Movie segment => level:movie", () => {
  const s = parseStructure("Beach-House__Full-Movie.mp4");
  assert.equal(s.movieTitle, "Beach House");
  assert.equal(s.level, "movie");
});

test("parseStructure - Scene-N alone (no Clip-N) => level:scene", () => {
  const s = parseStructure("Beach-House__Scene-1.mp4");
  assert.equal(s.level, "scene");
  assert.equal(s.sceneNumber, 1);
  assert.equal(s.clipNumber, null);
});

test("parseStructure - Scene-N + Clip-N => level:clip, NOT scene (the regression this guards)", () => {
  const s1 = parseStructure("Beach-House__Scene-1__Clip-1.mp4");
  assert.equal(s1.level, "clip");
  assert.equal(s1.sceneNumber, 1);
  assert.equal(s1.clipNumber, 1);

  const s2 = parseStructure("Beach-House__Scene-2__Clip-3.mp4");
  assert.equal(s2.level, "clip");
  assert.equal(s2.sceneNumber, 2);
  assert.equal(s2.clipNumber, 3);
});

test("parseStructure - Act-Name segment => level:act, actName captured", () => {
  const s = parseStructure("Beach-House__Act-Foreplay__Clip-1.mp4");
  assert.equal(s.level, "act");
  assert.equal(s.actName, "Foreplay");
});

test("parseStructure - Highlight segment => level:highlight", () => {
  const s = parseStructure("Beach-House__Highlight.mp4");
  assert.equal(s.level, "highlight");
});

test("parseStructure - matches the one real catalog example (Amazing Blond with Huge Naturals)", () => {
  // Mirrors src/shared/catalog-videos.js id:472/473 — the only hand-authored
  // movie/scene/clip example in the live catalog today.
  const scene = parseStructure("Amazing-Blond-with-Huge-Naturals__Scene-1.mp4");
  assert.equal(scene.level, "scene");
  assert.equal(scene.sceneNumber, 1);

  const clip = parseStructure("Amazing-Blond-with-Huge-Naturals__Scene-1__Clip-1.mp4");
  assert.equal(clip.level, "clip");
  assert.equal(clip.sceneNumber, 1);
  assert.equal(clip.clipNumber, 1);
});
