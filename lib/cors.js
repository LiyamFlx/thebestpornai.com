/* Shared CORS handling for Vercel API functions — same allow-list/logic as
 * api/presign.js, api/save-upload.js, api/moderate-manifest.js used
 * independently before; factored here so new endpoints don't re-drift.
 * Returns true if the request is allowed to proceed, false if it was an
 * OPTIONS preflight (already responded to) or a disallowed origin (already
 * responded to with 403).
 */
const ALLOWED_ORIGINS = [
  "https://thebestpornai.com",
  "https://www.thebestpornai.com",
];

export function applyCors(req, res, { requireOrigin = false } = {}) {
  const origin = req.headers.origin;
  let isAllowed = false;
  if (origin) {
    isAllowed = ALLOWED_ORIGINS.includes(origin) ||
      /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
      /^https:\/\/.*\.vercel\.app$/.test(origin);
    if (isAllowed) res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    isAllowed = !requireOrigin;
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(204).end(); return false; }
  if (!isAllowed) { res.status(403).json({ error: "CORS not allowed" }); return false; }
  return true;
}
