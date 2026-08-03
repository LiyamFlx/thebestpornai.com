/**
 * Commit src/blog/writer-posts.json via GitHub Contents API.
 * Requires GITHUB_TOKEN (contents:write) + GITHUB_REPO (owner/name).
 * Vercel build runs gen-blog-posts on push → live HTML.
 */

async function gh(apiPath, { method = "GET", token, body } = {}) {
  const res = await fetch(`https://api.github.com${apiPath}`, {
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
  if (!res.ok) throw new Error(`GitHub ${method} ${apiPath}: ${res.status} ${text.slice(0, 400)}`);
  return json;
}

export async function fetchWriterPostsFromGithub(env) {
  const token = env.GITHUB_TOKEN || env.WRITER_GITHUB_TOKEN;
  const repo = env.GITHUB_REPO || env.WRITER_GITHUB_REPO;
  const branch = env.WRITER_GITHUB_BRANCH || "main";
  if (!token || !repo) return { posts: [], sha: null, token: null, repo: null, branch };

  const filePath = "src/blog/writer-posts.json";
  try {
    const existing = await gh(`/repos/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`, { token });
    const content = Buffer.from(existing.content || "", "base64").toString("utf8");
    const posts = JSON.parse(content);
    return {
      posts: Array.isArray(posts) ? posts : [],
      sha: existing.sha,
      token,
      repo,
      branch,
    };
  } catch {
    return { posts: [], sha: null, token, repo, branch };
  }
}

export async function commitWriterPostsJson({ env, posts, message, sha }) {
  const token = env.GITHUB_TOKEN || env.WRITER_GITHUB_TOKEN;
  const repo = env.GITHUB_REPO || env.WRITER_GITHUB_REPO;
  const branch = env.WRITER_GITHUB_BRANCH || "main";
  if (!token || !repo) {
    return { skipped: true, reason: "GITHUB_TOKEN or GITHUB_REPO not set" };
  }

  const filePath = "src/blog/writer-posts.json";
  let fileSha = sha;
  if (!fileSha) {
    try {
      const existing = await gh(`/repos/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`, { token });
      fileSha = existing.sha;
    } catch {
      fileSha = undefined;
    }
  }

  const content = JSON.stringify(posts, null, 2) + "\n";
  const result = await gh(`/repos/${repo}/contents/${filePath}`, {
    method: "PUT",
    token,
    body: {
      message: message || "content(writer): update writer-posts",
      content: Buffer.from(content, "utf8").toString("base64"),
      branch,
      ...(fileSha ? { sha: fileSha } : {}),
    },
  });

  return {
    skipped: false,
    commit: result.commit?.sha,
    htmlUrl: result.content?.html_url,
    branch,
  };
}

/** @deprecated use commitWriterPostsJson */
export async function commitWriterPostsFile({ env, message }) {
  const { readWriterPostsLocal } = await import("./posts-io.mjs");
  return commitWriterPostsJson({ env, posts: readWriterPostsLocal(), message });
}
