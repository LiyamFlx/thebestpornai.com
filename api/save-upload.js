import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { serviceRequest } from "../lib/supabase-service.js";

// Up to 5 read-modify-write round trips to R2 with jittered backoff under
// contention — give it real headroom rather than relying on platform
// defaults, matching api/verify-upload.js.
export const config = { maxDuration: 60 };

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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

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

  // Open uploads: no sign-in required. Validate the entry shape instead.
  const entry = req.body;
  if (!entry || typeof entry !== "object" || typeof entry.src !== "string" || !entry.src) {
    return res.status(400).json({ error: "invalid catalog entry metadata" });
  }

  // Compliance gate: every manifest write must point at a clean, verified
  // uploads row from /api/verify-upload — no more trusting caller-supplied
  // status/visibility directly. This is what actually closes the old bypass
  // (POST straight to this endpoint, skip attestation/hash-check/CSAM
  // entirely, land as "published" immediately).
  if (!entry.uploadId || typeof entry.uploadId !== "string") {
    return res.status(400).json({ error: "uploadId is required — call /api/verify-upload first" });
  }
  let uploadRow;
  try {
    const r = await serviceRequest(`/uploads?id=eq.${encodeURIComponent(entry.uploadId)}&select=id,status,client_id`);
    if (!r.ok) return res.status(502).json({ error: "uploads lookup failed" });
    const rows = await r.json();
    uploadRow = rows?.[0];
  } catch (e) {
    return res.status(500).json({ error: "uploads lookup error", detail: String(e?.message || e) });
  }
  if (!uploadRow) return res.status(403).json({ error: "unknown uploadId" });
  if (uploadRow.status === "rejected" || uploadRow.status === "processing") {
    return res.status(403).json({ error: "upload has not cleared compliance checks" });
  }

  // Whitelist + cap fields so a caller can't bloat/poison the manifest.
  // status/visibility now come from the verified Postgres row, never from
  // the caller: 'live' -> published, anything else ('held') -> pending
  // review in the manager queue.
  const safeEntry = {
    id: entry.id,
    title: String(entry.title || "Untitled").slice(0, 200),
    creator: String(entry.creator || "").slice(0, 80),
    type: entry.type === "original" ? "original" : "ugc",
    src: String(entry.src).slice(0, 500),
    thumb: String(entry.thumb || "").slice(0, 500),
    category: String(entry.category || "Amateur").slice(0, 60),
    categories: Array.isArray(entry.categories) ? entry.categories.slice(0, 8).map(c => String(c).slice(0, 60)) : [],
    tags: Array.isArray(entry.tags) ? entry.tags.slice(0, 20).map(t => String(t).slice(0, 60)) : [],
    duration: String(entry.duration || "").slice(0, 12),
    uploaded: String(entry.uploaded || new Date().toISOString().slice(0, 10)).slice(0, 10),
    views: Number(entry.views) || 0,
    likes: Number(entry.likes) || 0,
    dislikes: Number(entry.dislikes) || 0,
    comments: 0,
    favorites: 0,
    status: (entry.visibility === "private")
      ? "private"
      : (uploadRow.status === "live" ? "published" : "pending"),
    flagged: false,
    orientation: (entry.orientation === "vertical") ? "vertical" : "horizontal",
  };

  try {
    const s3 = new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });

    // 1. Fetch, modify, and write with Optimistic Concurrency Control (OCC)
    let retries = 5;
    let success = false;
    while (retries > 0 && !success) {
      let existing = [];
      let etag = undefined;
      try {
        const getRes = await s3.send(new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: "manifest.json"
        }));
        const manifestText = await getRes.Body.transformToString();
        existing = JSON.parse(manifestText);
        etag = getRes.ETag;
      } catch (s3Err) {
        if (s3Err.name === "NoSuchKey" || s3Err.code === "NoSuchKey") {
          existing = [];
        } else {
          throw s3Err;
        }
      }

      if (!Array.isArray(existing)) {
        existing = [];
      }

      // Prepend the new entry if not already present by src
      if (!existing.some(item => item.src === safeEntry.src)) {
        existing.unshift(safeEntry);
      }

      try {
        const putParams = {
          Bucket: R2_BUCKET,
          Key: "manifest.json",
          Body: JSON.stringify(existing, null, 2),
          ContentType: "application/json",
        };
        if (etag) {
          putParams.IfMatch = etag;
        }
        await s3.send(new PutObjectCommand(putParams));
        success = true;
      } catch (putErr) {
        if (putErr.name === "PreconditionFailed" || putErr.code === "PreconditionFailed" || putErr.$metadata?.httpStatusCode === 412) {
          retries--;
          if (retries === 0) {
            throw new Error("Failed to update manifest.json due to concurrent writes after maximum retries");
          }
          // Backoff
          await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));
        } else {
          throw putErr;
        }
      }
    }

    // The R2 manifest is the single source of truth for open uploads. New
    // entries land as status:"pending" — they're written to manifest.json now
    // but stay hidden from the public viewer (see visible() in
    // catalog-queries.js) until a moderator approves them via
    // api/moderate-manifest.js, which flips status to "published" in place.
    return res.status(200).json({ ok: true, entry: safeEntry });

  } catch (e) {
    return res.status(500).json({ error: "save upload error", detail: String(e?.message || e) });
  }
}
