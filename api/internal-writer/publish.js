/* Publishes via GitHub Contents API only — Vercel serverless functions have
   no writable/persistent filesystem, so the "local" mode in
   tools/content-manager/lib/publish.mjs (fs.writeFileSync + spawning
   scripts/gen-blog-posts.js as a child process) cannot work here. A commit
   to src/blog/writer-posts.json triggers Vercel's own git-push build, which
   already runs gen-blog-posts.js as part of `npm run build` — same
   generator, same output, just triggered by a real commit instead of a
   local script run. Requires GITHUB_TOKEN + GITHUB_REPO to be set; without
   them this endpoint has no way to actually publish anything and says so. */
import { SEED_POSTS } from "../../src/blog/posts.js";
import { validateGenerated, sanitizeBodyHtml } from "../../tools/content-manager/lib/generate.mjs";
import { slugify } from "../../tools/content-manager/lib/slug.mjs";
import { nextPostId } from "../../tools/content-manager/lib/posts-io.mjs";
import { commitWriterPostsJson, fetchWriterPostsFromGithub } from "../../tools/content-manager/lib/github-publish.mjs";
import { parseVideoId } from "../../tools/content-manager/lib/video.mjs";
import { VIDEOS } from "../../src/shared/catalog-videos.js";
import { requireAuthed, rateLimited, clientIp, noStore } from "./_shared.js";

const CATEGORIES = ["Guides", "Stories", "Fantasies", "Confessions", "Kink Lab"];

function findVideo(id) {
  return VIDEOS.find((v) => v.id === id) || null;
}

function uniqueSlug(base, existingSlugs) {
  let s = base;
  let i = 2;
  while (existingSlugs.has(s)) {
    s = `${base}-${i}`;
    i += 1;
  }
  return s;
}

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  if (!requireAuthed(req, res)) return;
  const ip = clientIp(req);
  if (rateLimited("pub:" + ip, 40, 60 * 60 * 1000)) {
    return res.status(429).json({ error: "Rate limit — try again later" });
  }

  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
    return res.status(500).json({
      error: "Publish is not configured on this deployment. Set GITHUB_TOKEN (contents:write) and GITHUB_REPO in Vercel's project environment variables.",
    });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const category = String(body.category || "Guides").trim();
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: "Invalid category" });

  const id = parseVideoId(body.videoUrl || body.videoId || body.coverVideoId);
  if (id == null) return res.status(400).json({ error: "Valid video id required" });
  const v = findVideo(id);
  if (!v) return res.status(404).json({ error: `Video id ${id} not found` });

  let draft;
  try {
    draft = validateGenerated({
      title: body.title,
      excerpt: body.excerpt,
      microcopy: body.microcopy,
      body: sanitizeBodyHtml(body.body),
      faqs: body.faqs,
      tags: body.tags,
      readMins: body.readMins,
    });
  } catch (e) {
    return res.status(400).json({ error: e.message || "Invalid article content" });
  }

  const dryRun = Boolean(body.dryRun);

  try {
    const ghMeta = await fetchWriterPostsFromGithub(process.env);
    const writer = ghMeta.posts;
    const allExisting = [...writer, ...SEED_POSTS];

    const existingSlugs = new Set(allExisting.map((p) => p.slug));
    const baseSlug = slugify(draft.title);
    const slug = uniqueSlug(baseSlug, existingSlugs);
    const today = new Date().toISOString().slice(0, 10);
    const postId = nextPostId(allExisting);

    const post = {
      id: postId,
      slug,
      title: draft.title,
      category,
      excerpt: draft.excerpt,
      microcopy: draft.microcopy,
      date: today,
      dateModified: today,
      readMins: draft.readMins,
      coverVideoId: Number(v.id),
      relatedVideoIds: [Number(v.id)],
      tags: draft.tags.length ? draft.tags : [category, "AI"],
      body: `\n${draft.body}\n`,
      faqs: draft.faqs,
    };

    if (dryRun) {
      return res.status(200).json({ ok: true, dryRun: true, post, path: `/blog/${slug}.html` });
    }

    const nextWriter = writer.filter((p) => p.slug !== slug);
    nextWriter.unshift(post);

    const github = await commitWriterPostsJson({
      env: process.env,
      posts: nextWriter,
      message: `content(writer): ${slug}`,
      sha: ghMeta.sha,
    });

    if (github.skipped) {
      return res.status(500).json({ error: github.reason || "GitHub publish failed" });
    }

    res.status(200).json({
      ok: true,
      dryRun: false,
      post,
      path: `/blog/${slug}.html`,
      absolute: `https://www.thebestpornai.com/blog/${slug}.html`,
      github,
      nextSteps: [
        "GitHub commit created — Vercel will rebuild in ~1–2 minutes.",
        `Live URL: https://www.thebestpornai.com/blog/${slug}.html`,
      ],
    });
  } catch (e) {
    res.status(502).json({ error: e.message || "Publish failed" });
  }
}
