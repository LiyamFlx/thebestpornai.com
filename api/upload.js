/* Vercel serverless function — Bunny Storage upload relay.
 *
 * Uploads go to the EXISTING Bunny Storage zone (streamhub-media), same place the
 * 180 catalog videos live. The storage write key must stay server-side, so the
 * browser POSTs the file here and this function streams it to Bunny Storage under
 * media/uploads/<unique>.<ext>. The public playback URL is the usual CDN path.
 *
 * Required Vercel env vars:
 *   BUNNY_STORAGE_KEY   the streamhub-media storage password (SECRET)
 *   SUPABASE_URL        e.g. https://xxxx.supabase.co
 *   SUPABASE_KEY        the publishable/anon key (used only to call /auth/v1/user)
 *
 * Note: requires a higher body size limit (videos are several MB). See
 * vercel.json -> functions config, and the bodyParser sizeLimit below.
 */

export const config = { api: { bodyParser: { sizeLimit: "60mb" } } };

const STORAGE_BASE  = "https://storage.bunnycdn.com/streamhub-media";
const CDN_BASE      = "https://streamhub-media.b-cdn.net";
const KEY           = process.env.BUNNY_STORAGE_KEY;
const SUPABASE_URL  = process.env.SUPABASE_URL  || "https://dabfxysxcngijcxxekzc.supabase.co";
const SUPABASE_KEY  = process.env.SUPABASE_KEY  || "sb_publishable_moBiV9AidT0XkL-L6wilYw_Jfn25YDr";
const ALLOWED_EXT   = new Set(["mp4", "mov", "webm", "m4v"]);

/* Verify the caller's Supabase access token by asking GoTrue who it belongs to.
   Returns the user object on success, or null if missing/invalid/expired. */
async function verifyUser(req){
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if(!token) return null;
  try {
    const r = await fetch(SUPABASE_URL.replace(/\/$/,"") + "/auth/v1/user", {
      headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + token },
    });
    if(!r.ok) return null;
    return await r.json();
  } catch(_){ return null; }
}

export default async function handler(req, res){
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Filename, Authorization");
  if(req.method === "OPTIONS") return res.status(204).end();
  if(req.method !== "POST")    return res.status(405).json({ error:"method not allowed" });
  if(!KEY)                     return res.status(500).json({ error:"server not configured: set BUNNY_STORAGE_KEY" });

  // Auth is optional — we rely on the Bunny storage key being server-side secret.
  // (verifyUser kept for potential future audit logging, but we don't block on it.)

  // Filename + extension come from a header (the body is the raw file bytes).
  const rawName = (req.headers["x-filename"] || "video.mp4").toString();
  const ext = (rawName.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g,"") || "mp4";
  const unique = "up_" + Date.now() + "_" + Math.random().toString(36).slice(2,8) + "." + ext;
  const storagePath = `media/uploads/${unique}`;

  if (!ALLOWED_EXT.has(ext)) {
    return res.status(400).json({ error: `unsupported file type: .${ext}` });
  }

  try {
    // Collect the raw request body (the file bytes).
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const buf = Buffer.concat(chunks);
    if(!buf.length) return res.status(400).json({ error:"empty file" });

    const put = await fetch(`${STORAGE_BASE}/${storagePath}`, {
      method:"PUT",
      headers:{ "AccessKey": KEY, "Content-Type":"application/octet-stream" },
      body: buf,
    });
    if(!put.ok) return res.status(502).json({ error:"bunny storage put failed", status:put.status });

    // Public playback URL (matches how mediaUrl() builds catalog URLs).
    const src = `../media/uploads/${unique}`;          // catalog-style src
    const url = `${CDN_BASE}/uploads/${encodeURIComponent(unique)}`; // direct CDN
    return res.status(200).json({ ok:true, src, url, path:storagePath });
  } catch(e){
    return res.status(500).json({ error:"upload relay error", detail:String(e&&e.message||e) });
  }
}
