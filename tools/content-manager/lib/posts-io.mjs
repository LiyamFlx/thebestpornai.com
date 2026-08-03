import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../../..");
export const WRITER_POSTS_PATH = path.join(REPO_ROOT, "src/blog/writer-posts.js");

function serializePost(post) {
  return JSON.stringify(post, null, 2)
    .split("\n")
    .map((line, i) => (i === 0 ? line : "  " + line))
    .join("\n");
}

/** Write full WRITER_POSTS array to disk (with backup). */
export function writeWriterPosts(posts) {
  const bak = WRITER_POSTS_PATH + ".bak";
  if (fs.existsSync(WRITER_POSTS_PATH)) fs.copyFileSync(WRITER_POSTS_PATH, bak);
  const body = posts.map((p) => serializePost(p)).join(",\n");
  const file = `/* ============================================================
   WRITER_POSTS — posts created by tools/content-manager.
   Appended by the Content Manager publish flow. Prefer the writer UI.
   Seed (hand-authored) posts live in posts.js as SEED_POSTS.
   ============================================================ */

export const WRITER_POSTS = [
${body ? body + "\n" : ""}];
`;
  fs.writeFileSync(WRITER_POSTS_PATH, file, "utf8");
}

export async function loadAllPosts() {
  const mod = await import(pathToFileURL(path.join(REPO_ROOT, "src/blog/posts.js")).href + "?t=" + Date.now());
  return {
    posts: mod.POSTS,
    seed: mod.SEED_POSTS || [],
    writer: (await import(pathToFileURL(WRITER_POSTS_PATH).href + "?t=" + Date.now())).WRITER_POSTS || [],
  };
}

export async function loadWriterPosts() {
  const mod = await import(pathToFileURL(WRITER_POSTS_PATH).href + "?t=" + Date.now());
  return [...(mod.WRITER_POSTS || [])];
}

export function nextPostId(allPosts) {
  let max = 0;
  for (const p of allPosts) {
    const n = Number(p.id);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}
