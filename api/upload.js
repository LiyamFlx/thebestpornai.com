/* Vercel serverless — Bunny Storage upload relay.
 *
 * bodyParser: false → Vercel hands us the raw IncomingMessage stream.
 * We convert it to a Web ReadableStream and pipe it straight to Bunny —
 * no full-file buffering, no Vercel body-size wall.
 *
 * Required env var on Vercel: BUNNY_STORAGE_KEY
 */

import { Readable } from "stream";

export const config = { api: { bodyParser: false } };

const STORAGE_BASE = "https://storage.bunnycdn.com/streamhub-media";
const CDN_BASE     = "https://streamhub-media.b-cdn.net";
const KEY          = process.env.BUNNY_STORAGE_KEY;
const ALLOWED_EXT  = new Set(["mp4", "mov", "webm", "m4v", "jpg", "jpeg", "png", "webp"]);

export async function verifyUser(req) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) throw new Error("authorization token required");

  const supabaseUrl = process.env.SUPABASE_URL || "https://dabfxysxcngijcxxekzc.supabase.co";
  const supabaseKey = process.env.SUPABASE_KEY || "sb_publishable_moBiV9AidT0XkL-L6wilYw_Jfn25YDr";

  const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      "apikey": supabaseKey,
      "Authorization": authHeader
    }
  });

  if (!verifyRes.ok) {
    throw new Error("invalid or expired token");
  }

  return await verifyRes.json();
}

export default async function handler(req, res) {
  // CORS headers first — always, so browser never sees a naked error
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Filename, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "method not allowed" });
  if (!KEY)                    return res.status(500).json({ error: "BUNNY_STORAGE_KEY not set on Vercel" });

  // TEMP: Auth/email verification removed for now to unblock creator uploads.
  // In production you should re-enable this.
  try {
    await verifyUser(req);
  } catch (err) {
    console.warn("Upload auth skipped (temp):", err.message);
    // continue without verified user for now
  }

  const rawName = (req.headers["x-filename"] || "video.mp4").toString();
  const ext = (rawName.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
  if (!ALLOWED_EXT.has(ext))
    return res.status(400).json({ error: `unsupported file type: .${ext}` });

  const unique      = "up_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8) + "." + ext;
  const storagePath = `media/uploads/${unique}`;

  const putHeaders  = { "AccessKey": KEY, "Content-Type": "application/octet-stream" };
  const cl = req.headers["content-length"];
  if (cl) putHeaders["Content-Length"] = cl;

  try {
    // Convert Node IncomingMessage (Readable) → Web ReadableStream for fetch
    const bodyStream = Readable.toWeb(req);

    const put = await fetch(`${STORAGE_BASE}/${storagePath}`, {
      method:  "PUT",
      headers: putHeaders,
      body:    bodyStream,
      duplex:  "half",
    });

    if (!put.ok) {
      const detail = await put.text().catch(() => "");
      return res.status(502).json({ error: "bunny PUT failed", status: put.status, detail });
    }

    const src = `../media/uploads/${unique}`;
    // Files are stored under media/uploads/ (storagePath above), so the public
    // CDN URL must include that same media/ prefix — otherwise the returned URL
    // 404s while the file sits one level deeper. (Bug: url dropped `media/`.)
    const url = `${CDN_BASE}/media/uploads/${encodeURIComponent(unique)}`;
    return res.status(200).json({ ok: true, src, url, path: storagePath });

  } catch (e) {
    // Always return CORS-safe JSON even on unexpected errors
    return res.status(500).json({ error: "relay error", detail: String(e?.message || e) });
  }
}
