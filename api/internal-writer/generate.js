import { VIDEOS } from "../../src/shared/catalog-videos.js";
import { parseVideoId, videoWatchUrl } from "../../tools/content-manager/lib/video.mjs";
import { generateArticle } from "../../tools/content-manager/lib/generate.mjs";
import { requireAuthed, rateLimited, clientIp, noStore } from "./_shared.js";

const CATEGORIES = ["Guides", "Stories", "Fantasies", "Confessions", "Kink Lab"];

function findVideo(id) {
  return VIDEOS.find((v) => v.id === id) || null;
}

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  if (!requireAuthed(req, res)) return;
  const ip = clientIp(req);
  if (rateLimited("gen:" + ip, 30, 60 * 60 * 1000)) {
    return res.status(429).json({ error: "Rate limit — try again later" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const title = String(body.title || "").trim();
  const category = String(body.category || "Guides").trim();
  const notes = String(body.notes || "").trim();
  if (!title) return res.status(400).json({ error: "Title is required" });
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: "Invalid category" });

  const id = parseVideoId(body.videoUrl || body.videoId);
  if (id == null) return res.status(400).json({ error: "Valid thebestpornai video URL required (#video/N)" });
  const v = findVideo(id);
  if (!v) return res.status(404).json({ error: `Video id ${id} not found in catalog` });

  try {
    const article = await generateArticle({
      title,
      category,
      notes,
      video: { id: v.id, title: v.title, duration: v.duration, category: v.category },
      env: process.env,
    });
    res.status(200).json({
      ok: true,
      article: {
        ...article,
        category,
        coverVideoId: v.id,
        video: { id: v.id, title: v.title, watchUrl: videoWatchUrl(v.id) },
      },
    });
  } catch (e) {
    res.status(502).json({ error: e.message || "Generation failed" });
  }
}
