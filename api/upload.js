/* Vercel serverless — Bunny Storage upload relay.
 * Streams the request body directly to Bunny (no buffering) so large video
 * files aren't killed by Vercel's body-parser memory limit.
 * bodyParser: false → raw Node.js IncomingMessage stream passed to fetch body.
 */

export const config = { api: { bodyParser: false } };

const STORAGE_BASE = "https://storage.bunnycdn.com/streamhub-media";
const CDN_BASE     = "https://streamhub-media.b-cdn.net";
const KEY          = process.env.BUNNY_STORAGE_KEY;
const ALLOWED_EXT  = new Set(["mp4", "mov", "webm", "m4v"]);

export default async function handler(req, res){
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Filename, Authorization");
  if(req.method === "OPTIONS") return res.status(204).end();
  if(req.method !== "POST")    return res.status(405).json({ error:"method not allowed" });
  if(!KEY)                     return res.status(500).json({ error:"BUNNY_STORAGE_KEY not set on Vercel" });

  const rawName = (req.headers["x-filename"] || "video.mp4").toString();
  const ext = (rawName.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g,"") || "mp4";
  if(!ALLOWED_EXT.has(ext))
    return res.status(400).json({ error:`unsupported file type: .${ext}` });

  const unique      = "up_" + Date.now() + "_" + Math.random().toString(36).slice(2,8) + "." + ext;
  const storagePath = `media/uploads/${unique}`;

  // Build Bunny PUT headers — forward Content-Length so Bunny accepts the stream
  const putHeaders = { "AccessKey": KEY, "Content-Type": "application/octet-stream" };
  const cl = req.headers["content-length"];
  if(cl) putHeaders["Content-Length"] = cl;

  try {
    // Stream req directly to Bunny — no buffering, no 4.5 MB wall
    const put = await fetch(`${STORAGE_BASE}/${storagePath}`, {
      method:  "PUT",
      headers: putHeaders,
      body:    req,      // Node IncomingMessage is a ReadableStream
      duplex:  "half",   // required for request-body streaming in Node 18+
    });

    if(!put.ok){
      const txt = await put.text().catch(()=>"");
      return res.status(502).json({ error:"bunny PUT failed", status:put.status, detail:txt });
    }

    const src = `../media/uploads/${unique}`;
    const url = `${CDN_BASE}/uploads/${encodeURIComponent(unique)}`;
    return res.status(200).json({ ok:true, src, url, path:storagePath });

  } catch(e){
    return res.status(500).json({ error:"upload relay error", detail:String(e?.message||e) });
  }
}
