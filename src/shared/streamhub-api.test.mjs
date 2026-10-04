import test from "node:test";
import assert from "node:assert/strict";
import { toDbVideoId } from "./streamhub-api.js";

test("toDbVideoId - preserves standard catalog IDs <= 2147483647", () => {
  assert.equal(toDbVideoId(1), 1);
  assert.equal(toDbVideoId(6524), 6524);
  assert.equal(toDbVideoId("6524"), 6524);
  assert.equal(toDbVideoId(2147483647), 2147483647);
});

test("toDbVideoId - folds timestamp IDs > 2147483647 deterministically into valid Postgres INT4", () => {
  const tsId = 1784510147745;
  const mapped1 = toDbVideoId(tsId);
  const mapped2 = toDbVideoId(tsId);
  assert.equal(mapped1, mapped2, "Must be deterministic");
  assert.ok(mapped1 > 0, "Must be positive");
  assert.ok(mapped1 <= 2147483647, "Must not exceed Postgres INT4 limit (2147483647)");
  assert.equal(toDbVideoId(String(tsId)), mapped1, "String form must match numeric form");
});

test("toDbVideoId - safely handles invalid or zero IDs", () => {
  assert.equal(toDbVideoId(0), 0);
  assert.equal(toDbVideoId(-10), 0);
  assert.equal(toDbVideoId(NaN), 0);
  assert.equal(toDbVideoId(null), 0);
  assert.equal(toDbVideoId(undefined), 0);
  assert.equal(toDbVideoId("abc"), 0);
});
