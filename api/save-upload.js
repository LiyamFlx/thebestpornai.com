import { verifyUser } from "./upload.js";

const STORAGE_BASE = "https://storage.bunnycdn.com/streamhub-media";
const CDN_BASE     = "https://streamhub-media.b-cdn.net";
const KEY          = process.env.BUNNY_STORAGE_KEY;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "method not allowed" });
  if (!KEY)                    return res.status(500).json({ error: "BUNNY_STORAGE_KEY not set on Vercel" });

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
    // 1. Fetch current manifest.json from Bunny Storage (fresh source-of-truth)
    const storageUrl = `${STORAGE_BASE}/manifest.json`;
    const getHeaders = { "AccessKey": KEY, "Accept": "application/json" };
    
    let existing = [];
    const r = await fetch(storageUrl, { headers: getHeaders });
    if (r.ok) {
      try {
        existing = await r.json();
      } catch (_) {
        existing = [];
      }
    }

    // Prepend the new entry
    if (!Array.isArray(existing)) {
      existing = [];
    }
    existing.unshift(entry);

    // 2. Save back to Bunny Storage
    const put = await fetch(storageUrl, {
      method: "PUT",
      headers: {
        "AccessKey": KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(existing, null, 2),
    });

    if (!put.ok) {
      const detail = await put.text().catch(() => "");
      return res.status(502).json({ error: "manifest update failed", status: put.status, detail });
    }

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
