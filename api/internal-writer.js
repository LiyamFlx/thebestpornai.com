/* Single-file dispatcher for every internal writer tool endpoint.
   Vercel's Hobby plan caps a deployment at 12 Serverless Functions total,
   counted per FILE under api/ — not per route. The original version of
   this tool shipped 7 separate files (health/login/logout/session/
   resolve-video/generate/publish), which combined with the site's existing
   6 API files pushed the deployment to 13 and made every build fail
   outright ("No more than 12 Serverless Functions can be added... Hobby
   plan"). Collapsing all 7 routes into this one file costs exactly 1
   function slot instead of 7, with identical behavior — dispatched by
   ?route=<name> instead of by filename/path.
   Routes: health, login, logout, session, resolve-video, generate, publish */
import { VIDEOS } from "../src/shared/catalog-videos.js";
import { SEED_POSTS } from "../src/blog/posts.js";
import {
  getCredentials,
  timingSafeEqualStr,
  createSessionToken,
  sessionCookie,
  isAuthed,
  requireAuthed,
  rateLimited,
  clientIp,
  noStore,
} from "../tools/content-manager/lib/vercel-request-helpers.mjs";
import { parseVideoId, videoWatchUrl } from "../tools/content-manager/lib/video.mjs";
import { generateArticle, validateGenerated, sanitizeBodyHtml } from "../tools/content-manager/lib/generate.mjs";
import { slugify } from "../tools/content-manager/lib/slug.mjs";
import { nextPostId } from "../tools/content-manager/lib/posts-io.mjs";
import { commitWriterPostsJson, fetchWriterPostsFromGithub } from "../tools/content-manager/lib/github-publish.mjs";

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

function jsonBody(req) {
  return req.body && typeof req.body === "object" ? req.body : {};
}

function routeHealth(req, res) {
  const { password } = getCredentials(process.env);
  res.status(200).json({
    ok: true,
    passwordRequired: Boolean(password),
    githubPublish: Boolean(process.env.GITHUB_TOKEN),
  });
}

function routeLogin(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const { username, password } = getCredentials(process.env);
  const body = jsonBody(req);

  if (!password) {
    const token = createSessionToken(username, process.env);
    res.setHeader("Set-Cookie", sessionCookie(token, process.env));
    return res.status(200).json({ ok: true, devOpen: true });
  }
  if (!timingSafeEqualStr(String(body.password || ""), password)) {
    return res.status(401).json({ error: "Wrong password" });
  }
  const token = createSessionToken(username, process.env);
  res.setHeader("Set-Cookie", sessionCookie(token, process.env));
  res.status(200).json({ ok: true });
}

function routeLogout(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  res.setHeader("Set-Cookie", sessionCookie("", process.env, { clear: true }));
  res.status(200).json({ ok: true });
}

function routeSession(req, res) {
  const { password } = getCredentials(process.env);
  res.status(200).json({ authenticated: isAuthed(req), passwordRequired: Boolean(password) });
}

function routeResolveVideo(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  if (!requireAuthed(req, res)) return;
  if (rateLimited("resolve:" + clientIp(req), 60, 60 * 60 * 1000)) {
    return res.status(429).json({ error: "Rate limit — try again later" });
  }
  const body = jsonBody(req);
  const id = parseVideoId(body.url || body.id);
  if (id == null) return res.status(400).json({ error: "Valid thebestpornai video URL required (/watch/N or #video/N)" });
  const v = findVideo(id);
  if (!v) return res.status(404).json({ error: `Video id ${id} not found in catalog` });
  res.status(200).json({
    id: v.id,
    title: v.title,
    duration: v.duration,
    category: v.category,
    thumb: v.thumb,
    watchUrl: `https://www.thebestpornai.com/watch/${v.id}`,
  });
}

async function routeGenerate(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  if (!requireAuthed(req, res)) return;
  if (rateLimited("gen:" + clientIp(req), 30, 60 * 60 * 1000)) {
    return res.status(429).json({ error: "Rate limit — try again later" });
  }
  const body = jsonBody(req);
  const title = String(body.title || "").trim();
  const category = String(body.category || "Guides").trim();
  const notes = String(body.notes || "").trim();
  if (!title) return res.status(400).json({ error: "Title is required" });
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: "Invalid category" });
  const id = parseVideoId(body.videoUrl || body.videoId);
  if (id == null) return res.status(400).json({ error: "Valid thebestpornai video URL required (/watch/N or #video/N)" });
  const v = findVideo(id);
  if (!v) return res.status(404).json({ error: `Video id ${id} not found in catalog` });

  try {
    const article = await generateArticle({
      title, category, notes,
      video: { id: v.id, title: v.title, duration: v.duration, category: v.category },
      env: process.env,
    });
    res.status(200).json({
      ok: true,
      article: { ...article, category, coverVideoId: v.id, video: { id: v.id, title: v.title, watchUrl: videoWatchUrl(v.id) } },
    });
  } catch (e) {
    res.status(502).json({ error: e.message || "Generation failed" });
  }
}

async function routePublish(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  if (!requireAuthed(req, res)) return;
  if (rateLimited("pub:" + clientIp(req), 40, 60 * 60 * 1000)) {
    return res.status(429).json({ error: "Rate limit — try again later" });
  }
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
    return res.status(500).json({
      error: "Publish is not configured on this deployment. Set GITHUB_TOKEN (contents:write) and GITHUB_REPO in Vercel's project environment variables.",
    });
  }

  const body = jsonBody(req);
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

const ROUTES = {
  health: routeHealth,
  login: routeLogin,
  logout: routeLogout,
  session: routeSession,
  "resolve-video": routeResolveVideo,
  generate: routeGenerate,
  publish: routePublish,
};

export default async function handler(req, res) {
  noStore(res);
  const url = new URL(req.url || "/", "http://internal");
  const route = url.searchParams.get("route");
  const fn = ROUTES[route];
  if (!fn) return res.status(404).json({ error: `Unknown route: ${route || "(missing ?route=)"}` });
  await fn(req, res);
}
