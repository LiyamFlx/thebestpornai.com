#!/usr/bin/env node
/**
 * Generate one static HTML file per blog post into blog/<slug>.html.
 *
 * Why static per-post pages instead of a single post.html?slug= template:
 * each post needs its own indexable URL, canonical link, meta description,
 * OG tags, and Article/BlogPosting JSON-LD baked into the initial HTML
 * response — query-string routing with client-injected content weakens
 * canonicalization and hurts AI-overview/LLM citability. See
 * docs/superpowers/specs/2026-07-30-blog-design.md.
 *
 * Run:  node scripts/gen-blog-posts.js   (writes ./blog/<slug>.html)
 * Runs automatically before `vite build` (see package.json).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { POSTS } from "../src/blog/posts.js";
import { VIDEOS } from "../src/shared/catalog-videos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const BLOG_DIR = path.join(REPO, "blog");
const ORIGIN = "https://www.thebestpornai.com";
const MEDIA_BASE = "https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev/media";

function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mediaUrl(src) {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  const rel = src.replace(/^(\.\.\/)?media\//, "");
  const path_ = rel.split("/").map(encodeURIComponent).join("/");
  return MEDIA_BASE.replace(/\/$/, "") + "/" + path_;
}

function findVideo(id) {
  return VIDEOS.find((v) => v.id === id);
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function excerptToPlainText(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function postCoverUrl(post) {
  if (post.cover) return mediaUrl(post.cover);
  const v = findVideo(post.coverVideoId);
  return v && v.thumb ? mediaUrl(v.thumb) : "";
}

const ICON_CLOCK = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;
const ICON_FLAME = `<svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 3-3 4-3 8a3 3 0 0 0 6 0c1.5 1 2 3 2 4.5a5 5 0 0 1-10 0C7 10 9 8 12 2Z"/></svg>`;
const ICON_CALENDAR = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="1.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>`;

function postCardHtml(post) {
  const cover = postCoverUrl(post);
  return `
    <a class="blog-card" href="/blog/${esc(post.slug)}.html">
      <div class="blog-card-media">
        <img src="${cover}" alt="${esc(post.title)}" loading="lazy" />
        <span class="blog-card-pill">${esc(post.category)}</span>
      </div>
      <h3 class="blog-card-title">${esc(post.title)}</h3>
      <p class="blog-card-excerpt">${esc(post.excerpt)}</p>
      <div class="blog-card-meta">
        <span>${ICON_CLOCK}${post.readMins} min read</span>
        <span class="dot"></span>
        <span>${ICON_FLAME}${(post.strokes / 1000).toFixed(1)}k strokes</span>
        <span class="dot"></span>
        <span>${ICON_CALENDAR}${esc(formatDate(post.date))}</span>
      </div>
      <span class="blog-card-read">Read &amp; get wet →</span>
    </a>
  `;
}

function videoCardHtml(videoId) {
  const v = findVideo(videoId);
  if (!v) return "";
  return `
    <a class="blog-video-card" href="/viewer/index.html?video=${v.id}">
      <div class="blog-video-card-media">
        <img src="${mediaUrl(v.thumb)}" alt="${esc(v.title)}" loading="lazy" />
      </div>
      <div class="blog-video-card-title">${esc(v.title)}</div>
    </a>
  `;
}

function renderPost(post) {
  const cover = postCoverUrl(post);
  const url = `${ORIGIN}/blog/${post.slug}.html`;
  const description = excerptToPlainText(post.excerpt).slice(0, 160);
  const related = (post.relatedVideoIds || []).slice(0, 4);
  const relatedPosts = POSTS.filter((p) => p.slug !== post.slug && p.category === post.category).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description,
    image: cover,
    datePublished: post.date,
    dateModified: post.date,
    author: { "@type": "Organization", name: "thebestpornai" },
    publisher: { "@type": "Organization", name: "thebestpornai", url: ORIGIN },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${esc(post.title)} | thebestpornai Blog</title>
<meta name="description" content="${esc(description)}"/>
<meta name="theme-color" content="#000000"/>
<link rel="canonical" href="${url}"/>
<link rel="icon" type="image/png" href="/src/shared/assets/favicon-32.png"/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="thebestpornai"/>
<meta property="og:title" content="${esc(post.title)}"/>
<meta property="og:description" content="${esc(description)}"/>
<meta property="og:url" content="${url}"/>
<meta property="og:image" content="${cover}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="robots" content="index,follow"/>
<script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
</script>
<meta http-equiv="Content-Security-Policy" content="default-src 'self' https: blob: data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https: blob:; media-src 'self' https: blob:; connect-src 'self' https:; frame-src 'none';">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800;900&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="/src/shared/theme.css"/>
</head>
<body class="blog-body">
<header class="blog-topbar">
  <div class="blog-topbar-inner">
    <a class="blog-back" href="/blog/">← Back to Blog</a>
    <a class="blog-logo" href="/blog/"><span>thebestpornai</span></a>
  </div>
</header>

<section class="blog-post-hero">
  <div class="blog-post-hero-img" style="background-image:url('${cover}')"></div>
  <div class="blog-post-hero-overlay">
    <div class="blog-post-hero-inner">
      <span class="blog-article-eyebrow">${esc(post.category)}</span>
      <h1 class="blog-article-title">${esc(post.title)}</h1>
    </div>
  </div>
</section>

<main class="blog-container">
  <article class="blog-article">
    <p class="blog-article-microcopy">${esc(post.microcopy)}</p>
    <div class="blog-article-meta">
      <span>${ICON_CLOCK}${post.readMins} min read</span>
      <span class="dot"></span>
      <span>${ICON_FLAME}${(post.strokes / 1000).toFixed(1)}k strokes</span>
      <span class="dot"></span>
      <span>${ICON_CALENDAR}${esc(formatDate(post.date))}</span>
    </div>
    <div class="blog-article-body">
      ${post.body}
    </div>
    <div class="blog-article-cta-wrap">
      <a class="blog-cta" href="/viewer/index.html?video=${related[0] || post.coverVideoId}">Watch this exact fantasy →</a>
    </div>
  </article>

  ${related.length ? `
  <section class="blog-related">
    <h2>Ready to stroke the real thing?</h2>
    <div class="blog-related-grid">
      ${related.map(videoCardHtml).join("")}
    </div>
  </section>
  ` : ""}

  ${relatedPosts.length ? `
  <section class="blog-related">
    <h2>Related Stories</h2>
    <div class="blog-related-posts">
      ${relatedPosts.map(postCardHtml).join("")}
    </div>
  </section>
  ` : ""}

  <section class="blog-confession">
    <h3>Anonymous Confession</h3>
    <p>Tell us what you can't tell anyone else. It stays that way.</p>
    <form id="blog-confession-form">
      <textarea placeholder="Type your confession…" maxlength="1000"></textarea>
      <button type="submit" class="blog-cta">Confess</button>
    </form>
  </section>
</main>

<footer class="blog-footer">
  <div class="blog-container">
    <div class="blog-footer-brand">thebestpornai</div>
    <div class="blog-footer-links">
      <a href="/legal/terms.html">Terms of Service</a>
      <a href="/legal/privacy.html">Privacy Policy</a>
      <a href="/legal/2257.html">2257 Compliance</a>
      <a href="mailto:contact@thebestpornai.com">Contact</a>
    </div>
    <p class="blog-footer-copy">© 2026 THEBESTPORNAI. UNAPOLOGETIC PERFORMANCE.</p>
  </div>
</footer>

<script type="module" src="/src/blog/post-render.js"></script>
</body>
</html>
`;
}

function main() {
  fs.mkdirSync(BLOG_DIR, { recursive: true });
  for (const post of POSTS) {
    const outPath = path.join(BLOG_DIR, `${post.slug}.html`);
    fs.writeFileSync(outPath, renderPost(post));
    console.log(`wrote blog/${post.slug}.html`);
  }
}

main();
