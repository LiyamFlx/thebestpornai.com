import test from "node:test";
import assert from "node:assert/strict";
import { deriveOrientation } from "./orientation.js";

test("deriveOrientation - taller than wide => vertical", () => {
  assert.equal(deriveOrientation(1080, 1920), "vertical");
});

test("deriveOrientation - wider than tall => horizontal", () => {
  assert.equal(deriveOrientation(1920, 1080), "horizontal");
});

test("deriveOrientation - exactly square => horizontal (not > width)", () => {
  assert.equal(deriveOrientation(1080, 1080), "horizontal");
});

test("deriveOrientation - missing/non-finite dimensions => undefined, not a guess", () => {
  assert.equal(deriveOrientation(undefined, 1920), undefined);
  assert.equal(deriveOrientation(1080, undefined), undefined);
  assert.equal(deriveOrientation(NaN, 1920), undefined);
  assert.equal(deriveOrientation(1080, NaN), undefined);
  assert.equal(deriveOrientation(null, null), undefined);
});
