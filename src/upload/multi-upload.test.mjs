import test from "node:test";
import assert from "node:assert/strict";

function cleanTitle(filename) {
  let clean = (filename || "Video")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function filterVideoFiles(files) {
  return files.filter(f => f.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(f.name));
}

test("multi-upload: filters non-video files and keeps supported media formats", () => {
  const mockFiles = [
    { name: "scene_01.mp4", type: "video/mp4" },
    { name: "notes.txt", type: "text/plain" },
    { name: ".DS_Store", type: "" },
    { name: "clip_intro.MOV", type: "video/quicktime" },
    { name: "teaser.webm", type: "video/webm" },
    { name: "cover.jpg", type: "image/jpeg" },
    { name: "episode.m4v", type: "video/x-m4v" },
  ];

  const filtered = filterVideoFiles(mockFiles);
  assert.equal(filtered.length, 4);
  assert.deepEqual(filtered.map(f => f.name), [
    "scene_01.mp4",
    "clip_intro.MOV",
    "teaser.webm",
    "episode.m4v"
  ]);
});

test("multi-upload: sanitizes filename to clean title", () => {
  assert.equal(cleanTitle("Mia_Nympo__Outdoor_Sunset_04.mp4"), "Mia Nympo Outdoor Sunset 04");
  assert.equal(cleanTitle("hardcore-anal-creampie-scene-1080p.mov"), "Hardcore anal creampie scene 1080p");
  assert.equal(cleanTitle("vixen_model_intro.webm"), "Vixen model intro");
});

test("multi-upload: batch category and visibility propagation", () => {
  const queue = [
    { id: "q1", title: "Vid 1", category: "Amateur", categories: ["Amateur"], visibility: "public" },
    { id: "q2", title: "Vid 2", category: "Amateur", categories: ["Amateur"], visibility: "public" },
    { id: "q3", title: "Vid 3", category: "Amateur", categories: ["Amateur"], visibility: "public" },
  ];

  // Batch apply category
  const targetCategory = "AI Generated";
  queue.forEach(item => {
    item.category = targetCategory;
    item.categories = [targetCategory];
  });
  assert.ok(queue.every(i => i.category === "AI Generated" && i.categories[0] === "AI Generated"));

  // Batch apply visibility
  const targetVisibility = "unlisted";
  queue.forEach(item => {
    item.visibility = targetVisibility;
  });
  assert.ok(queue.every(i => i.visibility === "unlisted"));
});

test("multi-upload: queue removal and boundary conditions", () => {
  let queue = [
    { id: "q1", title: "Vid 1" },
    { id: "q2", title: "Vid 2" },
    { id: "q3", title: "Vid 3" },
  ];

  // Remove middle item
  queue = queue.filter(i => i.id !== "q2");
  assert.equal(queue.length, 2);
  assert.equal(queue[0].id, "q1");
  assert.equal(queue[1].id, "q3");

  // Clear all
  queue = [];
  assert.equal(queue.length, 0);
});
