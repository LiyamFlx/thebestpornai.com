import { spawn } from "child_process";
import path from "path";
import { REPO_ROOT, loadAllPosts, loadWriterPosts, writeWriterPosts, nextPostId } from "./posts-io.mjs";
import { slugify } from "./slug.mjs";
import { sanitizeBodyHtml, validateGenerated } from "./generate.mjs";

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
 * @param {object} opts
 * @param {object} opts.draft - generated+edited fields
 * @param {object} opts.video - { id, title }
 * @param {string} opts.category
 * @param {boolean} opts.dryRun
 */
export async function publishPost({ draft, video, category, dryRun = false }) {
  const validated = validateGenerated({
    title: draft.title,
    excerpt: draft.excerpt,
    microcopy: draft.microcopy,
    body: draft.body,
    faqs: draft.faqs,
    tags: draft.tags,
    readMins: draft.readMins,
  });

  const { posts, writer } = await loadAllPosts();
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

  // Replace same slug in writer list if re-publish
  const nextWriter = writer.filter((p) => p.slug !== slug);
  nextWriter.unshift(post);
  writeWriterPosts(nextWriter);

  try {
    await runNode("scripts/gen-blog-posts.js");
    await runNode("scripts/gen-sitemap.js");
  } catch (e) {
    // rollback writer file to previous list
    writeWriterPosts(writer);
    throw e;
  }

  return {
    dryRun: false,
    post,
    path: `/blog/${slug}.html`,
    absolute: `https://www.thebestpornai.com/blog/${slug}.html`,
    nextSteps: [
      "Review the generated HTML under blog/",
      `git add src/blog/writer-posts.js blog/ public/blog/rss.xml public/sitemap.xml`,
      `git commit -m "content(writer): ${slug}"`,
      "git push origin main   # → Vercel production",
    ],
  };
}
