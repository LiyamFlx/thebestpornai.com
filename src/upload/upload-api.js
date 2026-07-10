// src/upload/upload-api.js
// Client-side upload API: talks to the Supabase edge functions (metadata) and
// the existing Vercel /api/upload relay (file bytes -> Bunny Storage).
import { ShAuth } from "../shared/streamhub-api.js";

const EDGE_BASE = "https://dabfxysxcngijcxxekzc.supabase.co/functions/v1";
const UPLOAD_RELAY = "/api/upload"; // existing Vercel Bunny Storage relay

/* attribute-safe transport (repo's jsq/jsdec convention) */
export const jsq = (s) => encodeURIComponent(String(s));
export const jsdec = (s) => decodeURIComponent(String(s));

/* magic-byte sniff on a byte view (sync, testable).
   MP4/MOV: 'ftyp' box type at bytes 4-7. WebM/Matroska: EBML header 1A 45 DF A3. */
export function sniffBytes(u8) {
  if (u8.length >= 4 && u8[0] === 0x1A && u8[1] === 0x45 && u8[2] === 0xDF && u8[3] === 0xA3) return "webm";
  if (u8.length >= 8 && u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) {
    return "mp4"; // MOV also uses an ftyp box; Bunny serves both, so mp4-family is fine.
  }
  return null;
}

export async function sniffVideo(file) {
  const buf = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  return sniffBytes(buf);
}

export async function sha256Head(file) {
  const buf = await file.slice(0, 8 * 1024 * 1024).arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function tok() {
  const s = ShAuth && ShAuth.session();
  if (!s) throw new Error("sign in required");
  return s.access_token;
}

async function edge(path, body) {
  const r = await fetch(`${EDGE_BASE}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, ...j };
}

export const ShUpload = {
  dupCheck: (sha256_head) => edge("dup-check", { sha256_head }),
  createUpload: (meta) => edge("create-upload", meta),
  finalize: (uploadId) => edge("finalize-upload", { uploadId }),
  // Bunny Storage has no TUS: "resume" = retry the PUT (handled by the manager),
  // not byte-range resume. Sends the whole file via the Vercel /api/upload relay,
  // which generates the final storage path and returns it as { src, path, url }.
  // The returned `src` (e.g. "../media/uploads/up_...mp4") is what the catalog uses.
  putBytes(file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", UPLOAD_RELAY, true);
      xhr.setRequestHeader("Authorization", `Bearer ${tok()}`);
      xhr.setRequestHeader("X-Filename", file.name);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({}); }
        } else reject(new Error("upload " + xhr.status));
      };
      xhr.onerror = () => reject(new Error("network"));
      xhr.send(file);
    });
  },
};
