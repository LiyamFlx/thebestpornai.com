import { serviceRequest } from "../lib/supabase-service.js";

export const config = { maxDuration: 15 };

// In-memory rate limiting map (IP -> timestamp)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_CONFESSIONS_PER_MIN = 3;

export default async function handler(req, res) {
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
    isAllowed = true;
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (!isAllowed) return res.status(403).json({ error: "CORS not allowed" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "anon";
    const now = Date.now();
    const timestamps = rateLimitMap.get(ip) || [];
    const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (validTimestamps.length >= MAX_CONFESSIONS_PER_MIN) {
      return res.status(429).json({ error: "Too many confessions submitted. Please wait a minute." });
    }
    validTimestamps.push(now);
    rateLimitMap.set(ip, validTimestamps);

    const bodyData = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const confessionText = String(bodyData?.body || "").trim();
    const postSlug = String(bodyData?.post_slug || "").trim().slice(0, 150);

    if (!confessionText || confessionText.length < 5) {
      return res.status(400).json({ error: "Confession must be at least 5 characters long." });
    }
    if (confessionText.length > 2000) {
      return res.status(400).json({ error: "Confession cannot exceed 2000 characters." });
    }

    // Insert into Supabase table
    const r = await serviceRequest("/confessions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: {
        body: confessionText,
        post_slug: postSlug || null,
        status: "pending"
      }
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error("Supabase insert confession failed:", r.status, errText);
      // Even if database has an issue, provide safe response
      return res.status(500).json({ error: "Could not save confession. Please try again later." });
    }

    return res.status(200).json({
      success: true,
      message: "Your confession has been received anonymously."
    });
  } catch (err) {
    console.error("Error processing confession:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}
