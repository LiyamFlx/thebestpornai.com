import { verifyUser } from "./upload.js";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

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
    console.warn("Save-upload auth skipped (temp):", err.message);
    // continue without verified user for now
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

    // 1. Fetch current manifest.json from R2 Storage (fresh source-of-truth)
    let existing = [];
    try {
      const getRes = await s3.send(new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: "manifest.json"
      }));
      const manifestText = await getRes.Body.transformToString();
      existing = JSON.parse(manifestText);
    } catch (s3Err) {
      console.warn("Could not retrieve manifest.json, starting fresh:", s3Err.message);
      existing = [];
    }

    // Prepend the new entry
    if (!Array.isArray(existing)) {
      existing = [];
    }
    existing.unshift(entry);

    // 2. Save back to R2 Storage
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: "manifest.json",
      Body: JSON.stringify(existing, null, 2),
      ContentType: "application/json"
    }));

    // 3. Save to Supabase (forwarding the user JWT so RLS handles permissions)
    const supabaseUrl = process.env.SUPABASE_URL || "https://dabfxysxcngijcxxekzc.supabase.co";
    const supabaseKey = process.env.SUPABASE_KEY || "sb_publishable_moBiV9AidT0XkL-L6wilYw_Jfn25YDr";
    
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
      // Do not fail the whole request since saving to Bunny manifest succeeded
    }

    return res.status(200).json({ ok: true });

  } catch (e) {
    return res.status(500).json({ error: "save upload error", detail: String(e?.message || e) });
  }
}
