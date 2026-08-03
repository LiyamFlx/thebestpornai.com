/* (req, res)-shaped helpers for the writer tool's single Vercel serverless
   dispatcher (api/internal-writer.js). Lives under tools/content-manager/lib
   rather than under api/ — any .js file directly under api/ (not prefixed
   with "_") counts as its own Serverless Function against Vercel's
   per-deployment limit (12 on the Hobby plan). This directory is outside
   api/'s function-discovery scope, so importing from here costs nothing
   extra regardless of how many helpers it holds.

   Session state: Vercel serverless functions are stateless between
   invocations (no shared in-memory Map like the standalone server.mjs
   uses), so auth uses auth.mjs's signed HMAC token instead of a
   server-side session store — the token itself carries and proves its
   own validity, no lookup needed. */
import {
  getCredentials,
  timingSafeEqualStr,
  createSessionToken,
  verifySessionToken,
  sessionCookie,
  parseCookies,
} from "./auth.mjs";

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
