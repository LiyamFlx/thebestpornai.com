import { VIDEOS } from "../../src/shared/catalog-videos.js";
import { parseVideoId } from "../../tools/content-manager/lib/video.mjs";
import { requireAuthed, rateLimited, clientIp, noStore } from "./_shared.js";

function findVideo(id) {
  return VIDEOS.find((v) => v.id === id) || null;
}

export default function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  if (!requireAuthed(req, res)) return;
  if (rateLimited("resolve:" + clientIp(req), 60, 60 * 60 * 1000)) {
    return res.status(429).json({ error: "Rate limit — try again later" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const id = parseVideoId(body.url || body.id);
  if (id == null) return res.status(400).json({ error: "Valid thebestpornai video URL required (#video/N)" });

  const v = findVideo(id);
  if (!v) return res.status(404).json({ error: `Video id ${id} not found in catalog` });

  res.status(200).json({
    id: v.id,
    title: v.title,
    duration: v.duration,
    category: v.category,
    thumb: v.thumb,
    watchUrl: `https://www.thebestpornai.com/#video/${v.id}`,
  });
}
