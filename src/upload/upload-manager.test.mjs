// src/upload/upload-manager.test.mjs
import assert from "node:assert";
import { computeBackoff, nextRunnable } from "./upload-manager.js";

assert.deepStrictEqual([0, 1, 2, 3].map(computeBackoff), [0, 3000, 10000, 30000], "backoff schedule");
assert.strictEqual(computeBackoff(4), null, "no retry after 4 attempts");

// nextRunnable: 2 uploading + max 3 => 1 free slot => 1 runnable
const jobs = [{ status: "uploading" }, { status: "uploading" }, { status: "queued" }, { status: "queued" }];
assert.strictEqual(nextRunnable(jobs, 3).length, 1, "one slot free -> one runnable");

console.log("upload-manager core OK");
