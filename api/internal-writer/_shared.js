/* Shared helpers for the internal writer tool's Vercel serverless functions
   (api/internal-writer/*.js). Kept separate from tools/content-manager/lib
   because that directory's code targets the standalone `node server.mjs`
   path (raw Node http, in-memory session Map) — this file targets Vercel's
   (req, res) handler shape instead, reusing the same underlying logic from
   tools/content-manager/lib where it's already framework-agnostic (auth
   token signing, video parsing, generation, publish).

   Session state: Vercel serverless functions are stateless between
   invocations (no shared in-memory Map, unlike server.mjs), so auth uses
   tools/content-manager/lib/auth.mjs's signed HMAC token instead of a
   server-side session store — the token itself carries and proves its
   own validity, no lookup needed. */
import {
  getCredentials,
  timingSafeEqualStr,
  createSessionToken,
  verifySessionToken,
  sessionCookie,
  parseCookies,
} from "../../tools/content-manager/lib/auth.mjs";

export {
  getCredentials,
  timingSafeEqualStr,
  createSessionToken,
  verifySessionToken,
  sessionCookie,
  parseCookies,
};

export function noStore(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
}

export function isAuthed(req) {
  const { password } = getCredentials(process.env);
  if (!password) return true; // dev-open, same convention as server.mjs
  const cookies = parseCookies(req.headers.cookie || req.headers.Cookie);
  return Boolean(verifySessionToken(cookies.writer_session, process.env));
}

export function requireAuthed(req, res) {
  if (isAuthed(req)) return true;
  noStore(res);
  res.status(401).json({ error: "Unauthorized — log in first" });
  return false;
}

/* Best-effort per-IP rate limit. Resets on cold start (Vercel serverless
   has no persistent process between invocations) — acceptable here since
   this is a private, password-gated single-writer tool, not public-facing;
   it still stops a casual runaway loop within one warm instance. */
const hits = new Map();
export function rateLimited(key, limit, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) return true;
  arr.push(now);
  hits.set(key, arr);
  return false;
}

export function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}
