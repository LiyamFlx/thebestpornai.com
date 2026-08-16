/* Catalog dates are YYYY-MM-DD. Schema.org VideoObject uploadDate must be
   an ISO 8601 datetime with timezone — a bare date is flagged as invalid. */

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isoUploadDate(d) {
  if (!d || typeof d !== "string") return undefined;
  const s = d.trim();
  if (!s) return undefined;
  if (DAY.test(s)) return s + "T00:00:00Z";
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return undefined;
  return s;
}
