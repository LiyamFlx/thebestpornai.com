// Standard rule: taller than wide => vertical (Shorts-style feed), otherwise
// horizontal. Mirrors src/viewer/catalog-queries.js's pubVideos()/
// pubVerticalVideos() split (v.orientation === "vertical" vs not) and the
// uploads.orientation column's own default/check constraint
// (schema: text default 'horizontal', check in ('horizontal','vertical')).
// Returns undefined (not a guessed default) when either dimension is
// missing/non-finite — callers should omit the field entirely in that case
// and let the column's own default apply, rather than writing a guess.
export function deriveOrientation(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;
  return height > width ? "vertical" : "horizontal";
}
