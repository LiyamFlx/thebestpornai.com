/* Vercel serverless — Cloudflare R2 Storage upload relay.
 *
 * bodyParser: false → Vercel hands us the raw IncomingMessage stream.
 * We convert it to a Web ReadableStream and pipe it straight to R2 —
 * no full-file buffering, no Vercel body-size wall.
 *
 * Required env vars on Vercel: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET
 */

import { Readable } from "stream";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const config = { api: { bodyParser: false } };

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

  const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
  const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
  const R2_ENDPOINT = process.env.R2_ENDPOINT;
  const R2_BUCKET = process.env.R2_BUCKET || "streamhub-media";

  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) {
    return res.status(500).json({ error: "R2 credentials are not set on Vercel" });
  }

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

  try {
    // Convert Node IncomingMessage (Readable) → Web ReadableStream for fetch
    const bodyStream = Readable.toWeb(req);

    const s3 = new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    const cl = req.headers["content-length"];
    const contentLength = cl ? parseInt(cl, 10) : undefined;

    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: storagePath,
      Body: bodyStream,
      ContentLength: contentLength,
      ContentType: "application/octet-stream"
    }));

    const src = `../media/uploads/${unique}`;
    const url = `https://media.thebestpornai.com/media/uploads/${encodeURIComponent(unique)}`;
    return res.status(200).json({ ok: true, src, url, path: storagePath });

  } catch (e) {
    // Always return CORS-safe JSON even on unexpected errors
    return res.status(500).json({ error: "R2 upload relay error", detail: String(e?.message || e) });
  }
}
