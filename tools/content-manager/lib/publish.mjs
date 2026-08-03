import { spawn } from "child_process";
import path from "path";
import {
  REPO_ROOT,
  loadAllPosts,
  writeWriterPosts,
  nextPostId,
  readWriterPostsLocal,
} from "./posts-io.mjs";
import { slugify } from "./slug.mjs";
import { sanitizeBodyHtml, validateGenerated } from "./generate.mjs";
import { commitWriterPostsJson, fetchWriterPostsFromGithub } from "./github-publish.mjs";

function runNode(scriptRel) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(REPO_ROOT, scriptRel)], {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`${scriptRel} failed (${code}): ${err || out}`));
    });
  });
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

/**
 * @param {'local'|'github'} mode
 *  local  = write JSON + run gen-blog-posts (dev laptop)
 *  github = commit JSON to GitHub; Vercel build generates HTML (production)
 */
export async function publishPost({ draft, video, category, dryRun = false, mode = "local", env = process.env, seedPosts = null }) {
  const validated = validateGenerated({
    title: draft.title,
    excerpt: draft.excerpt,
    microcopy: draft.microcopy,
    body: draft.body,
    faqs: draft.faqs,
    tags: draft.tags,
    readMins: draft.readMins,
  });

  let posts;
  let writer;
  let ghMeta = null;

  if (mode === "github") {
    ghMeta = await fetchWriterPostsFromGithub(env);
    writer = ghMeta.posts;
    // seedPosts should be passed from API (import SEED_POSTS) to compute next id
    const seed = seedPosts || [];
    posts = [...writer, ...seed];
  } else {
    const all = await loadAllPosts();
    posts = all.posts;
    writer = all.writer;
  }

  const existingSlugs = new Set(posts.map((p) => p.slug));
  const baseSlug = slugify(validated.title);
  const slug = uniqueSlug(baseSlug, existingSlugs);
  const today = new Date().toISOString().slice(0, 10);
  const id = nextPostId(posts);

  const post = {
    id,
    slug,
    title: validated.title,
    category,
    excerpt: validated.excerpt,
    microcopy: validated.microcopy,
    date: today,
    dateModified: today,
    readMins: validated.readMins,
    coverVideoId: Number(video.id),
    relatedVideoIds: [Number(video.id)],
    tags: validated.tags.length ? validated.tags : [category, "AI"],
    body: `\n${sanitizeBodyHtml(validated.body)}\n`,
    faqs: validated.faqs,
  };

  if (dryRun) {
    return { dryRun: true, post, path: `/blog/${slug}.html` };
  }

  const nextWriter = writer.filter((p) => p.slug !== slug);
  nextWriter.unshift(post);

  let github = null;

  if (mode === "github") {
    github = await commitWriterPostsJson({
      env,
      posts: nextWriter,
      message: `content(writer): ${slug}`,
      sha: ghMeta?.sha,
    });
    if (github.skipped) {
      throw new Error(
        github.reason ||
          "GitHub publish required on Vercel. Set GITHUB_TOKEN + GITHUB_REPO (and WRITER_GITHUB_PUBLISH=1)."
      );
    }
    return {
      dryRun: false,
      post,
      path: `/blog/${slug}.html`,
      absolute: `https://www.thebestpornai.com/blog/${slug}.html`,
      mode: "github",
      github,
      nextSteps: [
        "GitHub commit created — Vercel will rebuild in ~1–2 minutes.",
        `Live URL: https://www.thebestpornai.com/blog/${slug}.html`,
      ],
    };
  }

  // local filesystem
  const prev = readWriterPostsLocal();
  writeWriterPosts(nextWriter);
  try {
    await runNode("scripts/gen-blog-posts.js");
    await runNode("scripts/gen-sitemap.js");
  } catch (e) {
    writeWriterPosts(prev);
    throw e;
  }

  // optional also push to github
  if (env.WRITER_GITHUB_PUBLISH === "1" || env.GITHUB_TOKEN) {
    try {
      github = await commitWriterPostsJson({
        env,
        posts: nextWriter,
        message: `content(writer): ${slug}`,
      });
    } catch (e) {
      github = { error: e.message };
    }
  }

  return {
    dryRun: false,
    post,
    path: `/blog/${slug}.html`,
    absolute: `https://www.thebestpornai.com/blog/${slug}.html`,
    mode: "local",
    github,
    nextSteps: [
      "Files written locally under blog/ and src/blog/writer-posts.json",
      github && !github.skipped && !github.error
        ? "Also committed to GitHub — Vercel will deploy."
        : "git add src/blog/writer-posts.json blog/ public/blog public/sitemap.xml && git commit && git push",
    ],
  };
}
