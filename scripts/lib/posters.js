/* Shared poster-image helpers, used by gen-posters.js (backfill) and
   publish-folder.js (new uploads).

   A "poster" is a single JPEG frame grabbed from a video, shown as the grid/
   card thumbnail instead of loading the video itself. A <video> thumbnail
   downloads real media bytes and spins up a hardware decoder just to paint one
   frame — expensive on mobile in bandwidth, memory, and battery. A ~30 KB JPEG
   is dramatically cheaper and is what videoCard() prefers when an entry has a
   `thumb`.

   Path convention — a video at
     ../media/<rel>.mp4      (catalog `src`)   → key  media/<rel>.mp4
   gets a poster at
     ../media/thumbs/<rel>.jpg (catalog `thumb`) → key  media/thumbs/<rel>.jpg
   i.e. mirrored under a `thumbs/` root with the extension swapped to .jpg, so
   the R2 layout is easy to list and prune alongside the source tree. */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const PUBLIC_BASE = "https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev";

/* Strip the "../media/" or "media/" prefix from a catalog src/path. */
export function relFromSrc(src) {
  return String(src || "").replace(/^(\.\.\/)?media\//, "");
}

/* Given a video's catalog src (e.g. "../media/foo/bar.mp4"), return the poster's
   catalog `thumb` path, R2 object key, and public URL. */
export function posterPaths(videoSrc) {
  const rel = relFromSrc(videoSrc);
  const relJpg = rel.replace(/\.[^./]+$/, "") + ".jpg";
  return {
    thumb: `../media/thumbs/${relJpg}`,
    key: `media/thumbs/${relJpg}`,
    publicUrl: `${PUBLIC_BASE}/media/thumbs/${relJpg.split("/").map(encodeURIComponent).join("/")}`,
    relJpg,
  };
}

/* Is ffmpeg available on PATH? Poster generation needs it. */
export function hasFfmpeg() {
  try { execSync("ffmpeg -version", { stdio: "ignore" }); return true; }
  catch { return false; }
}

/* Grab one frame from `localVideoPath` into `outJpgPath` (a local .jpg path).
   Seeks a little into the clip to avoid black intro frames, scales down to a
   card-sized width, and writes a reasonably compressed JPEG. Creates parent
   dirs. Returns true on success. `seek` is seconds (default 1); short clips
   safely fall back because ffmpeg clamps to the last frame. */
export function generatePoster(localVideoPath, outJpgPath, opts = {}) {
  // Coerce to numbers — these are interpolated into the shell command unquoted,
  // so they must never carry shell metacharacters (paths are shq()-quoted).
  const width = Number(opts.width) || 480;
  const seek = Number.isFinite(Number(opts.seek)) ? Number(opts.seek) : 1;
  fs.mkdirSync(path.dirname(outJpgPath), { recursive: true });
  // -ss before -i = fast seek; -frames:v 1 = single frame; scale keeps aspect
  // (-2 → even height); -q:v 4 ≈ good quality / small file. -y overwrites.
  const cmd = `ffmpeg -y -ss ${seek} -i ${shq(localVideoPath)} -frames:v 1 ` +
              `-vf ${shq(`scale=${width}:-2`)} -q:v 4 ${shq(outJpgPath)}`;
  execSync(cmd, { stdio: "ignore" });
  if (!fs.existsSync(outJpgPath) || fs.statSync(outJpgPath).size === 0) {
    throw new Error("ffmpeg produced no output frame");
  }
  return true;
}

/* Shell-quote a single argument (POSIX). */
function shq(s) { return `'${String(s).replace(/'/g, `'\\''`)}'`; }
