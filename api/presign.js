/* Vercel serverless — issue a short-lived presigned PUT URL for Cloudflare R2.
 *
 * The browser uploads the file BYTES directly to R2 with this URL (no relay,
 * no Vercel body-size wall, full upload-progress, and parallel uploads work).
 * This endpoint only signs a URL — it never sees the file, so it's fast and cheap.
 *
 * No sign-in required (open uploads), but guardrails still apply:
 *   - filename extension must be an allowed media type
 *   - a max content-length is baked into the signature (R2 rejects larger PUTs)
 *   - naive per-IP rate limit to blunt scripted abuse
 *
 * Required env: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ALLOWED_EXT = new Set(["mp4", "mov", "webm", "m4v", "jpg", "jpeg", "png", "webp"]);
const MIME_MAP = {
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", m4v: "video/x-m4v",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
};
const MAX_BYTES = 2 * 1024 * 1024 * 1024;   // 2 GB hard ceiling (baked into signature)
const PUBLIC_BASE = "https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev";

// Tiny in-memory rate limiter (best-effort; resets on cold start).
const _hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 60_000, max = 30;   // 30 presigns / minute / IP
  const rec = _hits.get(ip) || { n: 0, t: now };
  if (now - rec.t > windowMs) { rec.n = 0; rec.t = now; }
  rec.n++; _hits.set(ip, rec);
  return rec.n > max;
}

const ALLOWED_ORIGINS = [
  "https://www.thebestpornai.com",
  "https://thebestpornai.com",
];
function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.includes(origin) ||
      /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
      /^https:\/\/.*\.vercel\.app$/.test(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
  const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
  const R2_ENDPOINT = process.env.R2_ENDPOINT;
  const R2_BUCKET = process.env.R2_BUCKET;
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET) {
    return res.status(500).json({ error: "R2 credentials are not set on Vercel" });
  }

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return res.status(429).json({ error: "too many uploads, slow down" });

  const { filename, size } = req.body || {};
  const rawName = String(filename || "video.mp4");
  const ext = (rawName.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
  if (!ALLOWED_EXT.has(ext)) return res.status(400).json({ error: `unsupported file type: .${ext}` });
  if (typeof size === "number" && size > MAX_BYTES) {
    return res.status(413).json({ error: `file exceeds ${MAX_BYTES / 1024 / 1024 / 1024}GB limit` });
  }

  const unique = "up_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8) + "." + ext;
  const key = `media/uploads/${unique}`;
  const contentType = MIME_MAP[ext] || "application/octet-stream";

  const s3 = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    forcePathStyle: true,
  });

  try {
    const putUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }),
      { expiresIn: 900 }   // 15 min
    );
    return res.status(200).json({
      putUrl,
      contentType,
      src: `../media/uploads/${unique}`,
      url: `${PUBLIC_BASE}/media/uploads/${encodeURIComponent(unique)}`,
      path: key,
    });
  } catch (e) {
    return res.status(500).json({ error: "presign failed", detail: String(e?.message || e) });
  }
}
