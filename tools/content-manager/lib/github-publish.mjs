/**
 * Optional remote publish: commit writer-posts.js via GitHub Contents API.
 * Requires GITHUB_TOKEN (contents:write) + GITHUB_REPO (owner/name).
 * Generated blog HTML is produced by Vercel build (gen-blog-posts).
 */
import fs from "fs";
import { WRITER_POSTS_PATH } from "./posts-io.mjs";

async function gh(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "thebestpornai-content-manager",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`GitHub ${method} ${path}: ${res.status} ${text.slice(0, 300)}`);
  return json;
}

export async function commitWriterPostsFile({ env, message }) {
  const token = env.GITHUB_TOKEN || env.WRITER_GITHUB_TOKEN;
  const repo = env.GITHUB_REPO || env.WRITER_GITHUB_REPO; // owner/repo
  const branch = env.WRITER_GITHUB_BRANCH || "main";
  if (!token || !repo) {
    return { skipped: true, reason: "GITHUB_TOKEN or GITHUB_REPO not set" };
  }

  const content = fs.readFileSync(WRITER_POSTS_PATH, "utf8");
  const filePath = "src/blog/writer-posts.js";
  let sha;
  try {
    const existing = await gh(`/repos/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`, { token });
    sha = existing.sha;
  } catch {
    sha = undefined;
  }

  const result = await gh(`/repos/${repo}/contents/${filePath}`, {
    method: "PUT",
    token,
    body: {
      message: message || "content(writer): update writer-posts",
      content: Buffer.from(content, "utf8").toString("base64"),
      branch,
      ...(sha ? { sha } : {}),
    },
  });

  return {
    skipped: false,
    commit: result.commit?.sha,
    htmlUrl: result.content?.html_url,
    branch,
  };
}
