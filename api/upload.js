/* Vercel serverless function — Bunny Storage upload relay.
 *
 * Uploads go to the EXISTING Bunny Storage zone (streamhub-media), same place the
 * 180 catalog videos live. The storage write key must stay server-side, so the
 * browser POSTs the file here and this function streams it to Bunny Storage under
 * media/uploads/<unique>.<ext>. The public playback URL is the usual CDN path.
 *
 * Required Vercel env var:
 *   BUNNY_STORAGE_KEY   the streamhub-media storage password (SECRET)
 *
 * Note: requires a higher body size limit (videos are several MB). See
 * vercel.json -> functions config, and the bodyParser sizeLimit below.
 */

export const config = { api: { bodyParser: { sizeLimit: "60mb" } } };

const STORAGE_BASE = "https://storage.bunnycdn.com/streamhub-media";
const CDN_BASE     = "https://streamhub-media.b-cdn.net";
const KEY          = process.env.BUNNY_STORAGE_KEY;
const ALLOWED_EXT  = new Set(["mp4", "mov", "webm", "m4v"]);

export default async function handler(req, res){
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Filename");
  if(req.method === "OPTIONS") return res.status(204).end();
  if(req.method !== "POST")    return res.status(405).json({ error:"method not allowed" });
  if(!KEY)                     return res.status(500).json({ error:"server not configured: set BUNNY_STORAGE_KEY" });

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
