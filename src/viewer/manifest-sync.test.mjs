import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { DATA } from "../shared/catalog.js";
import { mergeManifest } from "./manifest-sync.js";

test("manifest sync - mergeManifest deduplication and validation", (t) => {
  const origVideos = DATA.videos;
  
  DATA.videos = [
    { id: 100, src: "existing-1.mp4", title: "Existing Video" }
  ];

  try {
    const uploads = [
      // Valid fresh entry
      { id: 101, src: "new-1.mp4", title: "New Video 1" },
      // Duplicate src
      { id: 102, src: "existing-1.mp4", title: "Dup Src" },
      // Duplicate id
      { id: 100, src: "new-2.mp4", title: "Dup ID" },
      // Invalid entries
      null,
      { src: "no-id.mp4", title: "No ID" },
      { id: 103, src: "", title: "Empty Src" },
      // Duplicate within the uploads array itself
      { id: 104, src: "dup-internal.mp4", title: "Internal Dup" },
      { id: 104, src: "dup-internal-2.mp4", title: "Internal Dup ID" },
      { id: 105, src: "dup-internal.mp4", title: "Internal Dup Src" },
    ];

    const added = mergeManifest(uploads);
    
    // Only 101 and 104 (first one) should be added
    assert.equal(added, 2);
    assert.equal(DATA.videos[0].id, 101);
    assert.equal(DATA.videos[1].id, 104);
  } finally {
    DATA.videos = origVideos;
  }
});
