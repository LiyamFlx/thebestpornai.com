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

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase credentials (SUPABASE_URL, SUPABASE_KEY) are not set");
  }

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

const MIME_MAP = {
  "mp4": "video/mp4",
  "mov": "video/quicktime",
  "webm": "video/webm",
  "m4v": "video/x-m4v",
  "jpg": "image/jpeg",
  "jpeg": "image/jpeg",
  "png": "image/png",
  "webp": "image/webp"
};

export default async function handler(req, res) {
  // Strict CORS checking
  const allowedOrigins = [
    "https://thebestpornai.com",
    "https://www.thebestpornai.com"
  ];
  const origin = req.headers.origin;
  let isAllowed = false;
  if (origin) {
    isAllowed = allowedOrigins.includes(origin) || 
                /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
                /^https:\/\/.*\.vercel\.app$/.test(origin);
    if (isAllowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
  } else {
    // Non-browser clients
    isAllowed = true;
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Filename, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();

  if (!isAllowed) {
    return res.status(403).json({ error: "CORS not allowed" });
  }

  if (req.method !== "POST")   return res.status(405).json({ error: "method not allowed" });

  const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
  const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
  const R2_ENDPOINT = process.env.R2_ENDPOINT;
  const R2_BUCKET = process.env.R2_BUCKET;

  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET) {
    return res.status(500).json({ error: "R2 credentials or bucket name are not set on Vercel" });
  }

  // Hard gate verifyUser
  try {
    await verifyUser(req);
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized", detail: err.message });
  }

  const rawName = (req.headers["x-filename"] || "video.mp4").toString();
  const ext = (rawName.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
  if (!ALLOWED_EXT.has(ext))
    return res.status(400).json({ error: `unsupported file type: .${ext}` });

  // Server-side size validation
  const cl = req.headers["content-length"];
  const contentLength = cl ? parseInt(cl, 10) : undefined;
  const MAX_BYTES = 100 * 1024 * 1024; // 100MB server-side limit
  if (contentLength && contentLength > MAX_BYTES) {
    return res.status(413).json({ error: `File size exceeds server limit of ${MAX_BYTES / (1024 * 1024)}MB` });
  }

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
      forcePathStyle: true,
    });

    const contentType = MIME_MAP[ext] || "application/octet-stream";

    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: storagePath,
      Body: bodyStream,
      ContentLength: contentLength,
      ContentType: contentType
    }));

    const src = `../media/uploads/${unique}`;
    const url = `https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev/media/uploads/${encodeURIComponent(unique)}`;
    return res.status(200).json({ ok: true, src, url, path: storagePath });

  } catch (e) {
    // Always return CORS-safe JSON even on unexpected errors
    return res.status(500).json({ error: "R2 upload relay error", detail: String(e?.message || e) });
  }
}
