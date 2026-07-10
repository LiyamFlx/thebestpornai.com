// src/upload/attestation.test.mjs
import assert from "node:assert";
import { attestationState } from "./attestation.js";

// pure state machine: given (sessionAttested, tier) -> gate mode
assert.strictEqual(attestationState(false, 0), "per-upload", "tier0 always per-upload");
assert.strictEqual(attestationState(true, 1), "ok", "verified + session flag => ok");
assert.strictEqual(attestationState(false, 1), "once", "verified needs once/session");

console.log("attestation state OK");
