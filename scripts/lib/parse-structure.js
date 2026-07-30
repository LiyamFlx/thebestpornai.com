import path from "path";

// Filename convention: MovieTitle__Scene-N__Clip-N.ext (double-underscore
// separated segments after the movie title). A plain filename with no "__"
// has no structure — leave everything null so it doesn't pollute the
// Movies/Scenes grouping. See CLAUDE.md's "Movie/Scene/Clip grouping"
// section for the full convention and examples.
//
// clipsFor()/scenesFor() (src/viewer/catalog-queries.js) key strictly on
// level:"clip" vs level:"scene" — a clip is never also a scene. An earlier
// version of this function (previously duplicated separately in
// publish-folder.js and gen-catalog-from-local.js) set level="scene" the
// moment it saw a Scene-N segment and never revisited it, so
// "Beach-House__Scene-1__Clip-1.mp4" (a real clip within scene 1) came out
// tagged level:"scene" with a stray clipNumber attached instead of
// level:"clip" — clipsFor() would never find it (it filters on
// level==="clip"), and scenesFor() would show a phantom "scene" that's
// actually clip content. Presence of a Clip-N segment now always wins.
// Consolidated into this one module so the fix (and any future change)
// only needs to happen once.
export function parseStructure(filename) {
  const parts = path.basename(filename, path.extname(filename)).split("__");
  if (parts.length < 2) return { movieTitle: null, level: null, sceneNumber: null, clipNumber: null, actName: null };
  const movieTitle = parts[0].replace(/[-_]/g, " ").trim() || null;
  let level = "clip", sceneNumber = null, clipNumber = null, actName = null, isScene = false;
  for (const p of parts.slice(1)) {
    if (p.startsWith("Scene-")) { isScene = true; sceneNumber = parseInt(p.replace("Scene-", "")); }
    if (p.startsWith("Clip-")) clipNumber = parseInt(p.replace("Clip-", ""));
    if (p.startsWith("Act-")) { level = "act"; actName = p.replace("Act-", ""); }
    if (p.includes("Full-Movie") || p.includes("Movie")) level = "movie";
    if (p.includes("Highlight")) level = "highlight";
  }
  // Scene-only (no Clip-N) => the scene's own combined video. Scene+Clip =>
  // an individual clip within that scene. Movie/Act/Highlight above always
  // win over either, since those are explicit top-level markers.
  if (level === "clip" && isScene) level = clipNumber != null ? "clip" : "scene";
  return { movieTitle, level, sceneNumber, clipNumber, actName };
}
