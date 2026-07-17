import { verifyUser } from "./upload.js";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

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

  // Hard gate verifyUser
  try {
    await verifyUser(req);
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized", detail: err.message });
  }

  const entry = req.body;
  if (!entry || !entry.src) {
    return res.status(400).json({ error: "invalid catalog entry metadata" });
  }

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
      if (!existing.some(item => item.src === entry.src)) {
        existing.unshift(entry);
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

    // 2. Save to Supabase (forwarding the user JWT so RLS handles permissions)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const dbRes = await fetch(`${supabaseUrl}/rest/v1/uploads_legacy`, {
          method: "POST",
          headers: {
            "apikey": supabaseKey,
            "Authorization": req.headers["authorization"],
            "Content-Type": "application/json",
            "Prefer": "return=representation"
          },
          body: JSON.stringify({
            title: entry.title,
            creator: entry.creator,
            src: entry.src,
            category: entry.category,
            categories: entry.categories,
            tags: entry.tags,
            duration: entry.duration,
            views_seed: entry.views,
            likes_seed: entry.likes,
            status: entry.status || "public",
            thumb: entry.thumb || ""
          })
        });

        if (!dbRes.ok) {
          const dbErr = await dbRes.text().catch(() => "");
          console.warn("Supabase database insert failed:", dbRes.status, dbErr);
        }
      } catch (dbErr) {
        console.warn("Supabase connection failed:", dbErr);
      }
    }

    return res.status(200).json({ ok: true });

  } catch (e) {
    return res.status(500).json({ error: "save upload error", detail: String(e?.message || e) });
  }
}
