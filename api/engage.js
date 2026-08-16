import { serviceRequest } from "../lib/supabase-service.js";

export const config = { maxDuration: 10 };

const rate = new Map();
const WINDOW = 60_000;

function limited(ip, max) {
  const now = Date.now();
  const hits = (rate.get(ip) || []).filter((t) => now - t < WINDOW);
  if (hits.length >= max) return true;
  hits.push(now);
  rate.set(ip, hits);
  return false;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false });

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "anon").split(",")[0].trim();
  if (limited(ip, 40)) return res.status(429).json({ ok: false, rateLimited: true });

  let payload = req.body;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { payload = {}; }
  }
  const action = String(payload?.action || "");
  const videoId = Number(payload?.videoId);
  const clientId = String(payload?.clientId || "anon").slice(0, 80);
  if (!Number.isFinite(videoId) || videoId <= 0) return res.status(400).json({ ok: false });

  try {
    if (action === "like") {
      const kind = payload?.kind === "dislike" ? "dislike" : "like";
      const body = { video_id: videoId, kind, client_id: clientId };
      let r = await serviceRequest("/likes?on_conflict=video_id,client_id,kind", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body,
      });
      if (r.status === 400) {
        r = await serviceRequest("/likes", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body,
        });
      }
      if (r.status === 400) {
        r = await serviceRequest("/likes", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: { video_id: videoId, kind },
        });
      }
      const ok = r.ok || r.status === 409;
      return res.status(ok ? 200 : 502).json({ ok });
    }

    if (action === "unlike") {
      const kind = payload?.kind === "dislike" ? "dislike" : "like";
      const cid = encodeURIComponent(clientId);
      const r = await serviceRequest(
        `/likes?video_id=eq.${videoId}&client_id=eq.${cid}&kind=eq.${kind}`,
        { method: "DELETE", headers: { Prefer: "return=minimal" } }
      );
      return res.status(r.ok ? 200 : 502).json({ ok: r.ok });
    }

    if (action === "comment") {
      const author = String(payload?.author || "Guest").slice(0, 80) || "Guest";
      const text = String(payload?.body || "").trim();
      if (text.length < 1 || text.length > 2000) return res.status(400).json({ ok: false });
      if (limited(ip + ":c", 4)) return res.status(429).json({ ok: false, rateLimited: true });

      let r = await serviceRequest("/comments", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: { video_id: videoId, author, body: text, client_id: clientId },
      });
      if (r.status === 400) {
        r = await serviceRequest("/comments", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: { video_id: videoId, author, body: text },
        });
      }
      if (!r.ok) {
        const err = await r.text().catch(() => "");
        console.error("engage comment failed", r.status, err.slice(0, 300));
        return res.status(r.status === 409 || r.status === 401 || r.status === 403 ? 429 : 502)
          .json({ ok: false, rateLimited: r.status === 409 || r.status === 401 || r.status === 403 });
      }
      const raw = await r.json().catch(() => null);
      const row = Array.isArray(raw) ? raw[0] : raw;
      return res.status(200).json({ ok: true, row });
    }

    return res.status(400).json({ ok: false });
  } catch (err) {
    console.error("engage error", err);
    return res.status(500).json({ ok: false });
  }
}
