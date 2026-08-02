import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { uuidToStableInt, rowToVideo } from "./catalog-overlay.js";

// uploads.id is a uuid (schema-global-upload.sql). A prior fix here assumed
// it was a numeric bigint (confusing it with the unrelated upload_attempts
// table) and did `Number(r.id)`, which is NaN for a real uuid — every live
// upload would render with id: NaN and break every downstream +id/Number(id)
// comparison (openVideo, vote, router, favorites...). These tests guard
// against that regression recurring.
test("uuidToStableInt - deterministic for the same uuid", () => {
  const uuid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
  assert.equal(uuidToStableInt(uuid), uuidToStableInt(uuid));
});

test("uuidToStableInt - always a finite, non-negative integer (never NaN)", () => {
  const uuids = [
    "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "00000000-0000-0000-0000-000000000000",
    "11111111-1111-1111-1111-111111111111",
    "ffffffff-ffff-ffff-ffff-ffffffffffff",
  ];
  for (const u of uuids) {
    const n = uuidToStableInt(u);
    assert.ok(Number.isInteger(n), `${u} -> ${n} should be an integer`);
    assert.ok(n >= 0, `${u} -> ${n} should be non-negative`);
  }
});

test("uuidToStableInt - different uuids produce different ids (spot check, not exhaustive)", () => {
  const a = uuidToStableInt("f47ac10b-58cc-4372-a567-0e02b2c3d479");
  const b = uuidToStableInt("11111111-1111-1111-1111-111111111111");
  assert.notEqual(a, b);
});

test("rowToVideo - numeric id, offset above the seed catalog's id range", () => {
  const row = {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    title: "Test Upload",
    user_id: "some-creator-uuid",
    bunny_path: "media/uploads/up_123.mp4",
  };
  const video = rowToVideo(row);
  assert.equal(typeof video.id, "number");
  assert.ok(Number.isFinite(video.id), "id must not be NaN");
  assert.ok(video.id > 1_000_000_000, "id must be offset into the reserved live-upload namespace");
});

test("rowToVideo - same uuid always maps to the same numeric id across calls", () => {
  const row = { id: "f47ac10b-58cc-4372-a567-0e02b2c3d479", bunny_path: "media/x.mp4" };
  assert.equal(rowToVideo(row).id, rowToVideo(row).id);
});

test("rowToVideo - rejects missing id or bunny_path (never injects NaN/undefined src)", () => {
  assert.equal(rowToVideo(null), null);
  assert.equal(rowToVideo({}), null);
  assert.equal(rowToVideo({ id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" }), null);
  assert.equal(rowToVideo({ id: "f47ac10b-58cc-4372-a567-0e02b2c3d479", bunny_path: "" }), null);
  assert.equal(rowToVideo({ id: "", bunny_path: "media/x.mp4" }), null);
});

test("rowToVideo - normalizes bare and catalog-style paths", () => {
  const uuid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
  assert.equal(rowToVideo({ id: uuid, bunny_path: "media/uploads/a.mp4" }).src, "../media/uploads/a.mp4");
  assert.equal(rowToVideo({ id: uuid, bunny_path: "../media/uploads/a.mp4" }).src, "../media/uploads/a.mp4");
  assert.equal(rowToVideo({ id: uuid, bunny_path: "up_only.mp4" }).src, "../media/uploads/up_only.mp4");
});
