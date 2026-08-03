import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../../..");
export const WRITER_POSTS_JSON = path.join(REPO_ROOT, "src/blog/writer-posts.json");
export const WRITER_POSTS_PATH = WRITER_POSTS_JSON; // alias for github module

export function writeWriterPosts(posts) {
  const bak = WRITER_POSTS_JSON + ".bak";
  if (fs.existsSync(WRITER_POSTS_JSON)) fs.copyFileSync(WRITER_POSTS_JSON, bak);
  fs.writeFileSync(WRITER_POSTS_JSON, JSON.stringify(posts, null, 2) + "\n", "utf8");
}

export function readWriterPostsLocal() {
  try {
    const raw = fs.readFileSync(WRITER_POSTS_JSON, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function loadAllPosts() {
  const mod = await import(pathToFileURL(path.join(REPO_ROOT, "src/blog/posts.js")).href + "?t=" + Date.now());
  return {
    posts: mod.POSTS,
    seed: mod.SEED_POSTS || [],
    writer: readWriterPostsLocal(),
  };
}

export async function loadWriterPosts() {
  return readWriterPostsLocal();
}

export function nextPostId(allPosts) {
  let max = 0;
  for (const p of allPosts) {
    const n = Number(p.id);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

export function serializeWriterPostsFile(posts) {
  return JSON.stringify(posts, null, 2) + "\n";
}
