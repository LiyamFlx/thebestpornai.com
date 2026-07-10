// src/upload/upload-api.test.mjs
import assert from "node:assert";
import { jsq, jsdec, sniffBytes } from "./upload-api.js";

// round-trip encode
const s = 'a"b&c<>d é';
assert.strictEqual(jsdec(jsq(s)), s, "jsq/jsdec round-trip");

// magic bytes: MP4 ftyp at offset 4
const mp4 = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]); // ....ftyp
assert.strictEqual(sniffBytes(mp4), "mp4", "mp4 ftyp");

const webm = new Uint8Array([0x1A, 0x45, 0xDF, 0xA3]);
assert.strictEqual(sniffBytes(webm), "webm", "webm ebml");

const bogus = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
assert.strictEqual(sniffBytes(bogus), null, "pdf rejected");

console.log("upload-api helpers OK");
