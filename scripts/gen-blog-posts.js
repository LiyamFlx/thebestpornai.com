#!/usr/bin/env node
/**
 * Generate:
 *   - blog/<slug>.html        one static, indexable page per post
 *   - blog/index.html         prerendered hub (cards + hero in initial HTML)
 *   - public/blog/rss.xml     RSS 2.0 for readers / automation
 *
 * Why static per-post pages: each needs its own URL, canonical, meta, OG,
 * Twitter, and BlogPosting JSON-LD in the first HTML response — better for
 * Google, social crawlers, and AI citation readiness.
 *
 * Run:  node scripts/gen-blog-posts.js
 * Auto: package.json "build" runs this before vite build.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { POSTS, BLOG_AUTHOR } from "../src/blog/posts.js";
import { VIDEOS } from "../src/shared/catalog-videos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const BLOG_DIR = path.join(REPO, "blog");
const PUBLIC_BLOG = path.join(REPO, "public", "blog");
const ORIGIN = "https://www.thebestpornai.com";
const MEDIA_BASE = "https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev/media";
const LOGO = `${ORIGIN}/logo.png`;

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

/** Canonical watch deep-link used site-wide (hash router on the main viewer). */
function videoWatchUrl(id) {
  return `/#video/${Number(id)}`;
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function plainText(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&hellip;/g, "…")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(html) {
  const t = plainText(html);
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function postCoverUrl(post) {
  if (post.cover) return mediaUrl(post.cover);
  const v = findVideo(post.coverVideoId);
  return v && v.thumb ? mediaUrl(v.thumb) : LOGO;
}

function postUrl(post) {
  return `${ORIGIN}/blog/${post.slug}.html`;
}

const ICON_CLOCK = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;
const ICON_CALENDAR = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="1.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>`;
const ICON_TAG = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12 12 4H4v8l8 8 8-8Z"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/></svg>`;
const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="rgba(255,255,255,0.92)" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.4)"/><path d="M9.5 8v8l7-4-7-4Z"/></svg>`;

function postCardHtml(post, { eager = false } = {}) {
  const cover = postCoverUrl(post);
  const loading = eager ? "eager" : "lazy";
  return `
    <a class="blog-card" href="/blog/${esc(post.slug)}.html" data-category="${esc(post.category)}" data-slug="${esc(post.slug)}">
      <div class="blog-card-media">
        <img src="${esc(cover)}" alt="${esc(post.title)}" loading="${loading}" width="780" height="440"/>
        <span class="blog-card-pill">${esc(post.category)}</span>
      </div>
      <h3 class="blog-card-title">${esc(post.title)}</h3>
      <p class="blog-card-excerpt">${esc(post.excerpt)}</p>
      <div class="blog-card-meta">
        <span>${ICON_CLOCK}${post.readMins} min read</span>
        <span class="dot"></span>
        <span>${ICON_TAG}${esc(post.category)}</span>
        <span class="dot"></span>
        <span>${ICON_CALENDAR}${esc(formatDate(post.date))}</span>
      </div>
      <span class="blog-card-read">Read the fantasy →</span>
    </a>
  `;
}

function videoCardHtml(videoId) {
  const v = findVideo(videoId);
  if (!v) return "";
  const thumb = v.thumb ? mediaUrl(v.thumb) : "";
  return `
    <a class="blog-video-card" href="${videoWatchUrl(v.id)}">
      <div class="blog-video-card-media">
        ${thumb ? `<img src="${esc(thumb)}" alt="${esc(v.title)}" loading="lazy" />` : `<div class="blog-video-card-ph"></div>`}
        <div class="blog-video-card-play">${ICON_PLAY}</div>
        ${v.duration ? `<span class="blog-video-card-duration">${esc(v.duration)}</span>` : ""}
      </div>
      <div class="blog-video-card-title">${esc(v.title)}</div>
    </a>
  `;
}

function faqHtml(faqs) {
  if (!faqs || !faqs.length) return "";
  return `
  <section class="blog-faq" id="faq">
    <h2>Frequently asked questions</h2>
    <div class="blog-faq-list">
      ${faqs
        .map(
          (f, i) => `
        <details class="blog-faq-item"${i === 0 ? " open" : ""}>
          <summary>${esc(f.q)}</summary>
          <p>${esc(f.a)}</p>
        </details>`
        )
        .join("")}
    </div>
  </section>`;
}

function shareHtml(post) {
  const url = encodeURIComponent(postUrl(post));
  const text = encodeURIComponent(`${post.title} — thebestpornai Blog`);
  return `
  <div class="blog-share" role="group" aria-label="Share this article">
    <span class="blog-share-label">Share</span>
    <button type="button" class="blog-share-btn" data-share="copy" data-url="${esc(postUrl(post))}">Copy link</button>
    <a class="blog-share-btn" href="https://twitter.com/intent/tweet?url=${url}&text=${text}" target="_blank" rel="noopener noreferrer">Post on X</a>
    <a class="blog-share-btn" href="https://reddit.com/submit?url=${url}&title=${text}" target="_blank" rel="noopener noreferrer">Reddit</a>
    <a class="blog-share-btn" href="https://t.me/share/url?url=${url}&text=${text}" target="_blank" rel="noopener noreferrer">Telegram</a>
  </div>`;
}

function prevNextHtml(post) {
  const sorted = [...POSTS].sort((a, b) => new Date(b.date) - new Date(a.date));
  const idx = sorted.findIndex((p) => p.slug === post.slug);
  const newer = idx > 0 ? sorted[idx - 1] : null;
  const older = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
  if (!newer && !older) return "";
  return `
  <nav class="blog-prevnext" aria-label="More articles">
    ${
      older
        ? `<a class="blog-prevnext-link older" href="/blog/${esc(older.slug)}.html"><span class="lbl">Older</span><span class="ttl">${esc(older.title)}</span></a>`
        : `<span class="blog-prevnext-link empty"></span>`
    }
    ${
      newer
        ? `<a class="blog-prevnext-link newer" href="/blog/${esc(newer.slug)}.html"><span class="lbl">Newer</span><span class="ttl">${esc(newer.title)}</span></a>`
        : `<span class="blog-prevnext-link empty"></span>`
    }
  </nav>`;
}

function jsonLdForPost(post, cover, words) {
  const url = postUrl(post);
  const description = plainText(post.excerpt).slice(0, 160);
  const graph = [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: ORIGIN + "/" },
        { "@type": "ListItem", position: 2, name: "Blog", item: ORIGIN + "/blog/" },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
    {
      "@type": "BlogPosting",
      headline: post.title,
      description,
      image: [cover],
      datePublished: post.date,
      dateModified: post.dateModified || post.date,
      articleSection: post.category,
      keywords: (post.tags || []).join(", "),
      wordCount: words,
      inLanguage: "en",
      isAccessibleForFree: true,
      author: {
        "@type": "Organization",
        name: BLOG_AUTHOR.name,
        url: BLOG_AUTHOR.url,
      },
      publisher: {
        "@type": "Organization",
        name: "thebestpornai",
        url: ORIGIN,
        logo: { "@type": "ImageObject", url: LOGO },
      },
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
    },
  ];
  if (post.faqs && post.faqs.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: post.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }
  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

function renderPost(post) {
  const cover = postCoverUrl(post);
  const url = postUrl(post);
  const description = plainText(post.excerpt).slice(0, 160);
  const related = (post.relatedVideoIds || []).slice(0, 4);
  const relatedPosts = POSTS.filter((p) => p.slug !== post.slug && p.category === post.category).slice(0, 3);
  const words = wordCount(post.body);
  const primaryVideo = related[0] || post.coverVideoId;
  const jsonLd = jsonLdForPost(post, cover, words);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${esc(post.title)} | thebestpornai Blog</title>
<meta name="description" content="${esc(description)}"/>
<meta name="theme-color" content="#000000"/>
<meta name="author" content="${esc(BLOG_AUTHOR.name)}"/>
<meta name="article:section" content="${esc(post.category)}"/>
<meta name="article:published_time" content="${esc(post.date)}"/>
<meta name="article:modified_time" content="${esc(post.dateModified || post.date)}"/>
<link rel="canonical" href="${url}"/>
<link rel="alternate" type="application/rss+xml" title="thebestpornai Blog" href="${ORIGIN}/blog/rss.xml"/>
<link rel="icon" type="image/png" href="/src/shared/assets/favicon-32.png"/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="thebestpornai"/>
<meta property="og:title" content="${esc(post.title)}"/>
<meta property="og:description" content="${esc(description)}"/>
<meta property="og:url" content="${url}"/>
<meta property="og:image" content="${esc(cover)}"/>
<meta property="og:image:alt" content="${esc(post.title)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(post.title)}"/>
<meta name="twitter:description" content="${esc(description)}"/>
<meta name="twitter:image" content="${esc(cover)}"/>
<meta name="robots" content="index,follow,max-image-preview:large"/>
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

<nav class="blog-breadcrumbs blog-container" aria-label="Breadcrumb">
  <a href="/">Home</a><span aria-hidden="true">/</span>
  <a href="/blog/">Blog</a><span aria-hidden="true">/</span>
  <span aria-current="page">${esc(post.category)}</span>
</nav>

<section class="blog-post-hero">
  <div class="blog-post-hero-img" style="background-image:url('${esc(cover)}')" role="img" aria-label="${esc(post.title)}"></div>
  <div class="blog-post-hero-overlay">
    <div class="blog-post-hero-inner">
      <span class="blog-article-eyebrow">${esc(post.category)}</span>
      <h1 class="blog-article-title">${esc(post.title)}</h1>
    </div>
  </div>
</section>

<main class="blog-container">
  <article class="blog-article" itemscope itemtype="https://schema.org/BlogPosting">
    <p class="blog-article-microcopy">${esc(post.microcopy)}</p>
    <div class="blog-article-meta">
      <span>${ICON_CLOCK}${post.readMins} min read · ${words} words</span>
      <span class="dot"></span>
      <span>By <a href="${esc(BLOG_AUTHOR.url)}">${esc(BLOG_AUTHOR.name)}</a></span>
      <span class="dot"></span>
      <span>${ICON_CALENDAR}<time datetime="${esc(post.date)}">${esc(formatDate(post.date))}</time></span>
    </div>
    ${shareHtml(post)}
    <div class="blog-article-body" itemprop="articleBody">
      ${post.body}
    </div>
    <div class="blog-article-cta-wrap">
      <a class="blog-cta blog-cta-primary" href="${videoWatchUrl(primaryVideo)}">Watch this exact fantasy →</a>
      <a class="blog-cta blog-cta-ghost" href="/blog/">More stories</a>
    </div>
  </article>

  ${faqHtml(post.faqs)}

  ${
    related.length
      ? `
  <section class="blog-related">
    <h2>Ready to watch the real thing?</h2>
    <p class="blog-related-sub">Companion clips from the thebestpornai catalog — opens the main player.</p>
    <div class="blog-related-grid">
      ${related.map(videoCardHtml).join("")}
    </div>
  </section>
  `
      : ""
  }

  ${
    relatedPosts.length
      ? `
  <section class="blog-related">
    <h2>Related stories</h2>
    <div class="blog-related-posts">
      ${relatedPosts.map((p) => postCardHtml(p)).join("")}
    </div>
  </section>
  `
      : ""
  }

  ${prevNextHtml(post)}

  <section class="blog-confession">
    <h3>Anonymous confession</h3>
    <p>Tell us what you can't tell anyone else. Submissions are sent privately to our editorial inbox — no account required. Don't name real people without consent.</p>
    <form id="blog-confession-form" action="mailto:contact@thebestpornai.com?subject=Blog%20confession" method="post" enctype="text/plain">
      <div class="blog-confession-field">
        <label class="blog-confession-label" for="blog-confession-input">Your confession</label>
        <textarea id="blog-confession-input" name="body" placeholder="Type your confession…" maxlength="2000" required></textarea>
      </div>
      <button type="submit" class="blog-cta blog-confession-submit" id="blog-confession-submit">Send confession</button>
      <p class="blog-confession-note">Opens your email client with the message ready. Nothing is stored in the browser beyond what you type.</p>
    </form>
  </section>
</main>

<footer class="blog-footer">
  <div class="blog-container">
    <div class="blog-footer-brand">thebestpornai</div>
    <div class="blog-footer-links">
      <a href="/blog/">Blog</a>
      <a href="/blog/rss.xml">RSS</a>
      <a href="/">Watch</a>
      <a href="/legal/terms.html">Terms</a>
      <a href="/legal/privacy.html">Privacy</a>
      <a href="/legal/2257.html">2257</a>
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

function jsonLdForIndex(sorted) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        name: "thebestpornai Blog",
        url: ORIGIN + "/blog/",
        description:
          "Cinematic adult stories, AI fantasies, confessions and kink craft notes — then watch the matching scenes.",
        publisher: {
          "@type": "Organization",
          name: "thebestpornai",
          url: ORIGIN,
          logo: { "@type": "ImageObject", url: LOGO },
        },
        blogPost: sorted.map((p) => ({
          "@type": "BlogPosting",
          headline: p.title,
          url: postUrl(p),
          datePublished: p.date,
          dateModified: p.dateModified || p.date,
          articleSection: p.category,
        })),
      },
      {
        "@type": "ItemList",
        name: "Latest desires",
        itemListElement: sorted.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: postUrl(p),
          name: p.title,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: ORIGIN + "/" },
          { "@type": "ListItem", position: 2, name: "Blog", item: ORIGIN + "/blog/" },
        ],
      },
    ],
  };
}

function renderIndex() {
  const sorted = [...POSTS].sort((a, b) => new Date(b.date) - new Date(a.date));
  const featured = sorted[0];
  const rest = sorted.slice(1);
  const cover = postCoverUrl(featured);
  const jsonLd = jsonLdForIndex(sorted);
  const categories = ["Stories", "Fantasies", "Confessions", "Kink Lab"];

  // Static crawler list (also used as no-JS fallback); feed.js enhances.
  const staticCards = rest.map((p, i) => postCardHtml(p, { eager: i < 2 })).join("");
  const allLinks = sorted
    .map((p) => `<li><a href="/blog/${esc(p.slug)}.html">${esc(p.title)}</a> — ${esc(p.category)} · ${esc(p.date)}</li>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Blog | thebestpornai — Stories, Fantasies, Confessions &amp; Kink Lab</title>
<meta name="description" content="Cinematic adult stories, AI fantasies, confessions and kink deep-dives from thebestpornai. Read the fantasy, then watch it on the main player."/>
<meta name="theme-color" content="#000000"/>
<link rel="canonical" href="${ORIGIN}/blog/"/>
<link rel="alternate" type="application/rss+xml" title="thebestpornai Blog" href="${ORIGIN}/blog/rss.xml"/>
<link rel="icon" type="image/png" href="/src/shared/assets/favicon-32.png"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="thebestpornai"/>
<meta property="og:title" content="Blog | thebestpornai"/>
<meta property="og:description" content="Cinematic adult stories, AI fantasies, confessions and kink deep-dives. Read the fantasy, then watch it."/>
<meta property="og:url" content="${ORIGIN}/blog/"/>
<meta property="og:image" content="${esc(cover)}"/>
<meta property="og:image:alt" content="thebestpornai Blog"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="Blog | thebestpornai"/>
<meta name="twitter:description" content="Cinematic adult stories, AI fantasies, confessions and kink deep-dives."/>
<meta name="twitter:image" content="${esc(cover)}"/>
<meta name="robots" content="index,follow,max-image-preview:large"/>
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
    <a class="blog-logo" href="/blog/">
      <img src="/src/shared/assets/favicon-64.png" alt="thebestpornai"/>
      <span>thebestpornai</span>
    </a>
    <div class="blog-topbar-actions">
      <div class="blog-search-wrap" id="blog-search-wrap">
        <input class="blog-search-input" id="blog-search-input" type="search" placeholder="Search fantasies…" aria-label="Search posts"/>
      </div>
      <button class="blog-icon-btn" id="blog-search-toggle" aria-label="Search" aria-expanded="false" type="button">⌕</button>
      <a href="/blog/rss.xml" class="blog-icon-btn" aria-label="RSS feed" title="RSS">RSS</a>
      <a href="/" class="blog-icon-btn" aria-label="Back to site">⟵ Site</a>
    </div>
  </div>
</header>

<main class="blog-container">
  <nav class="blog-pillnav" id="blog-pillnav" aria-label="Blog categories">
    ${categories
      .map(
        (cat) =>
          `<button type="button" class="blog-pill" data-category="${esc(cat)}">${esc(cat.toUpperCase())}</button>`
      )
      .join("")}
  </nav>

  <div id="blog-hero">
    <a href="/blog/${esc(featured.slug)}.html" class="blog-hero">
      <div class="blog-hero-img" style="background-image:url('${esc(cover)}')"></div>
      <div class="blog-hero-overlay">
        <span class="blog-hero-eyebrow">Featured · ${esc(featured.category)}</span>
        <h1 class="blog-hero-title">${esc(featured.title)}</h1>
        <p class="blog-hero-excerpt">${esc(featured.excerpt)}</p>
        <div class="blog-hero-footer">
          <span class="blog-cta">Read the fantasy</span>
          <div class="blog-hero-meta">
            <span>${ICON_CLOCK}${featured.readMins} min read</span>
            <span class="dot"></span>
            <span>${ICON_CALENDAR}${esc(formatDate(featured.date))}</span>
          </div>
        </div>
      </div>
    </a>
  </div>

  <div class="blog-section-title">
    <h2>Latest desires</h2>
    <div class="blog-section-rule"></div>
  </div>

  <div class="blog-cards" id="blog-cards">
    ${staticCards}
  </div>

  <div class="blog-loadmore-wrap">
    <button class="blog-loadmore" id="blog-loadmore" type="button" hidden>
      Load more fantasies
    </button>
  </div>

  <!-- Always in the document for crawlers / no-JS: full post index -->
  <section class="blog-crawl-index" aria-label="All blog posts">
    <h2>All posts</h2>
    <ol>
      ${allLinks}
    </ol>
  </section>
</main>

<footer class="blog-footer">
  <div class="blog-container">
    <div class="blog-footer-brand">thebestpornai</div>
    <div class="blog-footer-links">
      <a href="/blog/">Blog</a>
      <a href="/blog/rss.xml">RSS</a>
      <a href="/">Watch</a>
      <a href="/legal/terms.html">Terms of Service</a>
      <a href="/legal/privacy.html">Privacy Policy</a>
      <a href="/legal/2257.html">2257 Compliance</a>
      <a href="mailto:contact@thebestpornai.com">Contact</a>
    </div>
    <p class="blog-footer-copy">© 2026 THEBESTPORNAI. UNAPOLOGETIC PERFORMANCE.</p>
  </div>
</footer>

<script type="module" src="/src/blog/feed.js"></script>
</body>
</html>
`;
}

function renderRss(sorted) {
  const items = sorted
    .map((p) => {
      const desc = esc(plainText(p.excerpt));
      const body = esc(plainText(p.body).slice(0, 500)) + "…";
      return `    <item>
      <title>${esc(p.title)}</title>
      <link>${postUrl(p)}</link>
      <guid isPermaLink="true">${postUrl(p)}</guid>
      <pubDate>${new Date(p.date + "T12:00:00Z").toUTCString()}</pubDate>
      <category>${esc(p.category)}</category>
      <description>${desc} ${body}</description>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>thebestpornai Blog</title>
    <link>${ORIGIN}/blog/</link>
    <atom:link href="${ORIGIN}/blog/rss.xml" rel="self" type="application/rss+xml"/>
    <description>Stories, AI fantasies, confessions and kink craft from thebestpornai — read then watch.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

function main() {
  fs.mkdirSync(BLOG_DIR, { recursive: true });
  fs.mkdirSync(PUBLIC_BLOG, { recursive: true });

  const sorted = [...POSTS].sort((a, b) => new Date(b.date) - new Date(a.date));

  for (const post of POSTS) {
    const outPath = path.join(BLOG_DIR, `${post.slug}.html`);
    fs.writeFileSync(outPath, renderPost(post));
    console.log(`wrote blog/${post.slug}.html (${wordCount(post.body)} words)`);
  }

  fs.writeFileSync(path.join(BLOG_DIR, "index.html"), renderIndex());
  console.log("wrote blog/index.html (prerendered hub)");

  fs.writeFileSync(path.join(PUBLIC_BLOG, "rss.xml"), renderRss(sorted));
  console.log("wrote public/blog/rss.xml");
}

main();
