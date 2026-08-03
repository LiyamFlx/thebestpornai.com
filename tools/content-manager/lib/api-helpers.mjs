import { getCredentials, timingSafeEqualStr, createSessionToken, verifySessionToken, sessionCookie, parseCookies, isAuthenticated } from "./auth.mjs";
import { parseVideoId, videoWatchUrl } from "./video.mjs";
import { generateArticle, sanitizeBodyHtml, validateGenerated } from "./generate.mjs";
import { publishPost } from "./publish.mjs";

export const CATEGORIES = ["Guides", "Stories", "Fantasies", "Confessions", "Kink Lab"];

export function readJson(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 2_000_000) reject(new Error("Body too large"));
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

export function setNoStore(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
}

export function requireAuth(req, res, env = process.env) {
  if (isAuthenticated(req, env)) return true;
  setNoStore(res);
  res.status(401).json({ error: "Unauthorized — log in first" });
  return false;
}

export {
  getCredentials,
  timingSafeEqualStr,
  createSessionToken,
  verifySessionToken,
  sessionCookie,
  parseCookies,
  isAuthenticated,
  parseVideoId,
  videoWatchUrl,
  generateArticle,
  sanitizeBodyHtml,
  validateGenerated,
  publishPost,
};
