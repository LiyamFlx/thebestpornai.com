/* ---- Safe string transport for inline onclick attributes ----
   esc() protects HTML context only; the browser entity-decodes attribute
   values BEFORE the JS engine parses them, so esc'd quotes still break out of
   the JS string literal (XSS via manifest-supplied titles/ids). jsq() URI-
   encodes the value (incl. apostrophes, which encodeURIComponent leaves raw);
   the receiving function decodes with jsdec(). Output is [A-Za-z0-9%.\-_~]
   only — inert in both HTML-attribute and JS-string contexts. */
export const jsq = s => encodeURIComponent(String(s)).replace(/'/g, "%27");
export const jsdec = s => { try { return decodeURIComponent(s); } catch(_) { return String(s); } };

/* Relative date for cards/meta. Accepts "YYYY-MM-DD" or full ISO. */
export function relativeTime(iso){
  if(iso == null || iso === "") return "";
  const raw = String(iso);
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + "T12:00:00Z" : raw);
  if(!Number.isFinite(t)) return raw;
  const sec = Math.round((Date.now() - t) / 1000);
  if(sec < -86400) return "soon";
  if(sec < 3600) return "just now";
  if(sec < 86400) return Math.max(1, Math.floor(sec / 3600)) + "h ago";
  const days = Math.floor(sec / 86400);
  if(days === 1) return "yesterday";
  if(days < 7) return days + "d ago";
  if(days < 30) return Math.floor(days / 7) + "w ago";
  if(days < 365) return Math.floor(days / 30) + "mo ago";
  const years = Math.floor(days / 365);
  return years + (years === 1 ? "y ago" : "y ago");
}
