#!/usr/bin/env node
/**
 * Generate:
 *   - blog/<slug>.html        one static, indexable page per post
 *   - blog/index.html         prerendered hub (cards + hero in initial HTML)
 *   - public/blog/rss.xml     RSS 2.0 for readers / automation
 *
 * Why static per-post pages: each needs its own URL, canonical, meta, OG,
 * Twitter, and BlogPosting JSON-LD in the first HTML response —
 * optimized for Google, social crawlers, and AI citation readiness.
 *
 * Run:  node scripts/gen-blog-posts.js
 * Auto: package.json "build" runs this before vite build.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { POSTS, BLOG_AUTHOR, getFeaturedPost, postsForHub } from "../src/blog/posts.js";
import { VIDEOS } from "../src/shared/catalog-videos.js";
import {
  stripLeadingHeroDup,
  toInlineFigures,
  absoluteUrl,
} from "./lib/blog-body.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const BLOG_DIR = path.join(REPO, "blog");
const PUBLIC_BLOG = path.join(REPO, "public", "blog");
const ORIGIN = "https://www.thebestpornai.com";
// Same-origin proxy (vercel.json /r2/* → R2). Google's URL Inspection /
// PageSpeed often fail to fetch pub-*.r2.dev ("Other error") even when the
// object is a 200 for browsers.
const MEDIA_BASE = `${ORIGIN}/r2/media`;
const SUPABASE_ORIGIN = "https://dabfxysxcngijcxxekzc.supabase.co";
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

/**
 * Clean naive title-case artifacts and strip trailing frame/numeric suffixes.
 * - 'S -> 's, 'T -> 't, 'Re -> 're, 'Ve -> 've, 'Ll -> 'll, 'D -> 'd, 'M -> 'm
 * - Trailing frame suffixes like 00001, 00002, _001 stripped from alt text.
 */
function cleanTitle(str) {
  if (!str) return "";
  let clean = String(str).replace(/(\d{4,}|_\d{2,}|\s+\d{4,})$/i, "").trim();
  clean = clean.replace(/'([A-Z])\b/g, (_, char) => `'${char.toLowerCase()}`);
  return clean;
}

function mediaUrl(src) {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("/")) return src;
  const rel = src.replace(/^(\.\.\/)?media\//, "");
  const path_ = rel
    .split("/")
    .map((seg) => encodeURIComponent(seg).replace(/'/g, "%27"))
    .join("/");
  return MEDIA_BASE.replace(/\/$/, "") + "/" + path_;
}

function findVideo(id) {
  return VIDEOS.find((v) => v.id === Number(id));
}

/** Crawlable watch URL. Hash routes (#video/n) are not video watch pages
 *  for Google; /video/n.html is the dedicated player landing. */
function videoWatchUrl(id) {
  return `/video/${Number(id)}.html`;
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDateLong(iso) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function fmtViews(n) {
  n = Number(n) || 0;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

function siteHeader({ mode = "index" } = {}) {
  return `
<header class="blog-topbar">
  <div class="blog-topbar-inner">
    <a class="blog-logo" href="/">
      <img src="/src/shared/assets/favicon-64.png" width="28" height="28" alt=""/>
      <span>thebestpornai</span>
    </a>
    <nav class="blog-topnav" aria-label="Primary">
      <a href="/blog/" class="${mode === "index" ? "is-active" : ""}">Blog</a>
      <a href="/">Watch</a>
      <a href="/blog/rss.xml">RSS</a>
    </nav>
    <div class="blog-topbar-actions">
      <a class="blog-cta-watch" href="/">Watch Now</a>
    </div>
  </div>
</header>`;
}

function siteFooter() {
  return `
<footer class="blog-footer">
  <div class="blog-shell">
    <div class="blog-footer-brand">thebestpornai</div>
    <div class="blog-footer-links">
      <a href="/blog/">Blog</a>
      <a href="/blog/rss.xml">RSS</a>
      <a href="/">Watch</a>
      <a href="/legal/terms.html">Terms</a>
      <a href="/legal/privacy.html">Privacy</a>
      <a href="/legal/2257.html">2257</a>
      <a href="/legal/dmca.html">DMCA</a>
      <a href="mailto:contact@thebestpornai.com">Contact</a>
    </div>
    <p class="blog-footer-copy">© 2026 THEBESTPORNAI. Read the fantasy. Watch the real thing.</p>
    <p class="blog-footer-age">18+ ONLY · Adult content · By entering you confirm you are of legal age</p>
  </div>
</footer>`;
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

/** Derived reading time at ~200wpm, minimum 1 min. */
function calcReadMins(words) {
  return Math.max(1, Math.ceil((words || 0) / 200));
}

function postCoverUrl(post) {
  if (post.cover) {
    if (post.cover.startsWith("/") || /^https?:\/\//i.test(post.cover)) return post.cover;
    return mediaUrl(post.cover);
  }
  const v = findVideo(post.coverVideoId);
  return v && v.thumb ? mediaUrl(v.thumb) : LOGO;
}

/**
 * Small WebP variant for card/grid contexts (166-640px wide), generated by
 * scripts/gen-blog-thumbs.js. Full-res `cover` stays reserved for the post's
 * own hero banner and og:image, where the extra resolution is actually used.
 */
function postCoverThumbUrl(post) {
  if (!post.cover) return postCoverUrl(post);
  if (post.cover.startsWith("/") || /^https?:\/\//i.test(post.cover)) return post.cover;
  if (post.cover.includes("media/blog/")) {
    const thumbRel = post.cover.replace(/\.(jpe?g|png)$/i, "-thumb.webp");
    return mediaUrl(thumbRel);
  }
  return mediaUrl(post.cover);
}

function postUrl(post) {
  return `${ORIGIN}/blog/${post.slug}.html`;
}

const ICON_CLOCK = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;
const ICON_CALENDAR = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="1.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>`;
const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="rgba(255,255,255,0.92)" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.45)"/><path d="M9.5 8v8l7-4-7-4Z"/></svg>`;

function postCardHtml(post, { eager = false, fetchpriority } = {}) {
  const cover = postCoverThumbUrl(post);
  const loading = eager ? "eager" : "lazy";
  const fpAttr = fetchpriority ? ` fetchpriority="${fetchpriority}"` : "";
  const words = wordCount(post.body);
  const readMins = calcReadMins(words);
  const title = cleanTitle(post.title);
  return `
    <a class="blog-card" href="/blog/${esc(post.slug)}.html" data-category="${esc(post.category)}" data-slug="${esc(post.slug)}">
      <div class="blog-card-media">
        <img src="${esc(cover)}" alt="${esc(title)}" loading="${loading}"${fpAttr} width="640" height="380" decoding="async"/>
        <div class="blog-card-media-gradient"></div>
        <span class="blog-card-pill">${esc(post.category)}</span>
        <span class="blog-card-badge-read">${ICON_CLOCK}${readMins} min</span>
      </div>
      <div class="blog-card-body">
        <h3 class="blog-card-title">${esc(title)}</h3>
        <p class="blog-card-excerpt">${esc(post.excerpt)}</p>
        <div class="blog-card-meta">
          <span class="blog-card-byline">Editorial</span>
          <span class="dot"></span>
          <span>${ICON_CALENDAR}${esc(formatDate(post.date))}</span>
          <span class="blog-card-read-more">Read story →</span>
        </div>
      </div>
    </a>
  `;
}

function videoCardHtml(v) {
  if (!v) return "";
  const thumb = v.thumb ? mediaUrl(v.thumb) : "";
  const views = typeof v.views === "number" ? fmtViews(v.views) + " views" : "";
  const title = cleanTitle(v.title);
  return `
    <a class="blog-video-card" href="${videoWatchUrl(v.id)}">
      <div class="blog-video-card-media">
        ${thumb ? `<img src="${esc(thumb)}" alt="${esc(title)}" loading="lazy" width="640" height="360" decoding="async"/>` : `<div class="blog-video-card-ph"></div>`}
        <div class="blog-video-card-play">${ICON_PLAY}</div>
        ${v.duration ? `<span class="blog-video-card-duration">${esc(v.duration)}</span>` : ""}
      </div>
      <div class="blog-video-card-body">
        <span class="blog-video-card-label">Watch on thebestpornai</span>
        <div class="blog-video-card-title">${esc(title)}</div>
        <div class="blog-video-card-meta">${[views, v.duration].filter(Boolean).join(" · ")}</div>
      </div>
    </a>
  `;
}

/**
 * Deduplicate related videos so near-duplicate sequential fragment clips
 * (e.g. dancing in the dark 00001, 00002, 00003) do not crowd out diverse scenes.
 */
function getDeduplicatedRelatedVideos(post) {
  const pool = [];
  const seenBases = new Set();

  const getBase = (title) =>
    cleanTitle(title)
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const addVid = (id) => {
    const v = findVideo(id);
    if (!v) return;
    const base = getBase(v.title);
    if (seenBases.has(base)) return;
    seenBases.add(base);
    pool.push(v);
  };

  (post.relatedVideoIds || []).forEach(addVid);

  if (pool.length < 4) {
    const catVideos = VIDEOS.filter(
      (v) =>
        (v.category === post.category || (v.categories || []).includes(post.category)) &&
        v.id !== post.coverVideoId
    );
    for (const cv of catVideos) {
      if (pool.length >= 4) break;
      addVid(cv.id);
    }
  }

  return pool.slice(0, 4);
}

function getRelatedPostsSpread(post) {
  const sorted = [...POSTS].sort((a, b) => new Date(b.date) - new Date(a.date));
  const sameCat = sorted.filter((p) => p.slug !== post.slug && p.category === post.category);
  const otherCat = sorted.filter((p) => p.slug !== post.slug && p.category !== post.category);
  return [...sameCat, ...otherCat].slice(0, 6);
}

function slugifyHeading(html) {
  return plainText(html)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "section";
}

function withHeadingIds(html) {
  const used = new Set();
  return String(html || "").replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi, (_, attrs, inner) => {
    if (/\sid=/.test(attrs)) return `<h2${attrs}>${inner}</h2>`;
    let id = slugifyHeading(inner);
    let n = 2;
    while (used.has(id)) id = `${slugifyHeading(inner)}-${n++}`;
    used.add(id);
    return `<h2${attrs} id="${esc(id)}">${inner}</h2>`;
  });
}

function tocFromBody(html) {
  const items = [];
  const re = /<h2([^>]*)>([\s\S]*?)<\/h2>/gi;
  let m;
  while ((m = re.exec(html))) {
    const idMatch = m[1].match(/\sid=["']([^"']+)["']/);
    const id = idMatch ? idMatch[1] : slugifyHeading(m[2]);
    items.push({ id, title: plainText(m[2]) });
  }
  return items;
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
  const text = encodeURIComponent(`${cleanTitle(post.title)} — thebestpornai Blog`);
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
        ? `<a class="blog-prevnext-link older" href="/blog/${esc(older.slug)}.html"><span class="lbl">Older</span><span class="ttl">${esc(cleanTitle(older.title))}</span></a>`
        : `<span class="blog-prevnext-link empty"></span>`
    }
    ${
      newer
        ? `<a class="blog-prevnext-link newer" href="/blog/${esc(newer.slug)}.html"><span class="lbl">Newer</span><span class="ttl">${esc(cleanTitle(newer.title))}</span></a>`
        : `<span class="blog-prevnext-link empty"></span>`
    }
  </nav>`;
}

function jsonLdForPost(post, cover, words, relatedVideos = []) {
  const url = postUrl(post);
  const description = plainText(post.excerpt).slice(0, 160);
  const cleanPostTitle = cleanTitle(post.title);

  const graph = [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: ORIGIN + "/" },
        { "@type": "ListItem", position: 2, name: "Blog", item: ORIGIN + "/blog/" },
        { "@type": "ListItem", position: 3, name: cleanPostTitle, item: url },
      ],
    },
    {
      "@type": "BlogPosting",
      headline: cleanPostTitle,
      description,
      image: {
        "@type": "ImageObject",
        url: cover,
        caption: post._heroCaption || cleanPostTitle,
      },
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

  if (post.itemList && post.itemList.length) {
    graph.push({
      "@type": "ItemList",
      itemListElement: post.itemList,
    });
  }

  // Do not emit VideoObject on articles. Google then treats the post as a
  // watch page, merges related clips into one video, and rejects indexing
  // ("Video isn't on a watch page" / multiple video URLs).

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

function primaryCta(post, primaryVideo) {
  if (post.ctaHref && post.ctaLabel) {
    return {
      href: post.ctaHref,
      label: post.ctaLabel,
      external: /^https?:\/\//i.test(post.ctaHref),
    };
  }
  const blob = `${post.slug || ""} ${(post.tags || []).join(" ")}`;
  if (/ourdream/i.test(blob)) {
    return {
      href: "https://ourdream.ai/?ref=thebestpornai",
      label: "Try OurDream.ai →",
      external: true,
    };
  }
  return { href: videoWatchUrl(primaryVideo), label: "Watch this fantasy →", external: false };
}

function renderPost(post) {
  const coverRel = postCoverUrl(post);
  const cover = absoluteUrl(ORIGIN, coverRel);
  const stripped = stripLeadingHeroDup(post.body, coverRel);
  const articleBody = withHeadingIds(toInlineFigures(stripped.body));
  const toc = tocFromBody(articleBody);
  const url = postUrl(post);
  const description = plainText(post.excerpt).slice(0, 160);
  const words = wordCount(articleBody);
  const readMins = calcReadMins(words);
  const relatedVideos = getDeduplicatedRelatedVideos(post);
  const relatedPosts = getRelatedPostsSpread(post);
  const primaryVideo = relatedVideos[0]?.id || post.coverVideoId;
  const cta = primaryCta(post, primaryVideo);
  const jsonLd = jsonLdForPost(
    { ...post, _heroCaption: stripped.caption },
    cover,
    words,
    relatedVideos
  );
  const cleanPostTitle = cleanTitle(post.title);
  const heroAlt = stripped.caption
    ? `${cleanPostTitle}. ${plainText(stripped.caption)}`
    : `${cleanPostTitle} — editorial cover`;
  const figcaption = stripped.caption
    ? `<figcaption class="blog-media-caption">${stripped.caption}</figcaption>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${esc(cleanPostTitle)} | thebestpornai Blog</title>
<meta name="description" content="${esc(description)}"/>
<meta name="theme-color" content="#09090b"/>

<meta name="author" content="${esc(BLOG_AUTHOR.name)}"/>
<meta name="article:section" content="${esc(post.category)}"/>
<meta name="article:published_time" content="${esc(post.date)}"/>
<meta name="article:modified_time" content="${esc(post.dateModified || post.date)}"/>
<link rel="canonical" href="${url}"/>
<link rel="alternate" type="application/rss+xml" title="thebestpornai Blog" href="${ORIGIN}/blog/rss.xml"/>
<link rel="icon" type="image/png" href="/src/shared/assets/favicon-32.png"/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="thebestpornai"/>
<meta property="og:title" content="${esc(cleanPostTitle)}"/>
<meta property="og:description" content="${esc(description)}"/>
<meta property="og:url" content="${url}"/>
<meta property="og:image" content="${esc(cover)}"/>
<meta property="og:image:alt" content="${esc(cleanPostTitle)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(cleanPostTitle)}"/>
<meta name="twitter:description" content="${esc(description)}"/>
<meta name="twitter:image" content="${esc(cover)}"/>
<meta name="robots" content="index,follow,max-image-preview:large"/>
<script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
</script>
<meta http-equiv="Content-Security-Policy" content="default-src 'self' https: blob: data:; base-uri 'self'; form-action 'self' mailto:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https: blob:; media-src 'self' https: blob:; connect-src 'self' ${SUPABASE_ORIGIN} https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev; frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com;">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="/src/shared/theme.css"/>
</head>
<body class="blog-body">
<div class="blog-progress" aria-hidden="true"><i id="blog-progress-bar"></i></div>
${siteHeader({ mode: "post" })}

<main class="bp-page">
  <article class="blog-post" itemscope itemtype="https://schema.org/BlogPosting">
    <div class="bp-layout">
      <div class="bp-main">
        <header class="bp-header">
          <nav class="blog-breadcrumbs" aria-label="Breadcrumb">
            <a href="/">Home</a><span aria-hidden="true">/</span>
            <a href="/blog/">Blog</a><span aria-hidden="true">/</span>
            <span aria-current="page">${esc(post.category)}</span>
          </nav>
          <span class="blog-article-pill">${esc(post.category)}</span>
          <h1 class="bp-title" itemprop="headline">${esc(cleanPostTitle)}</h1>
          ${post.microcopy ? `<p class="bp-deck">${esc(post.microcopy)}</p>` : ""}
          <div class="bp-meta">
            <span class="bp-author"><span class="bp-avatar" aria-hidden="true">TB</span><a href="${esc(BLOG_AUTHOR.url)}" rel="author">${esc(BLOG_AUTHOR.name)}</a></span>
            <span>${ICON_CALENDAR}<time datetime="${esc(post.date)}" itemprop="datePublished">${esc(formatDateLong(post.date))}</time></span>
            <span>${ICON_CLOCK}${readMins} min read</span>
          </div>
        </header>

        <figure class="bp-featured">
          <img src="${esc(coverRel)}" alt="${esc(heroAlt)}" width="1600" height="900" decoding="async" fetchpriority="high"/>
          ${figcaption}
        </figure>
        ${shareHtml(post)}

        <div class="blog-article-body blog-article-body--plain" itemprop="articleBody">
          ${articleBody}
        </div>

        <div class="blog-article-cta-wrap">
          <a class="blog-cta blog-cta-primary"${cta.external ? ' target="_blank" rel="noopener sponsored nofollow"' : ""} href="${esc(cta.href)}">${esc(cta.label)}</a>
          <a class="blog-cta blog-cta-ghost" href="/blog/">More stories</a>
        </div>

        ${faqHtml(post.faqs)}

        <aside class="bp-author-box">
          <div class="bp-avatar bp-avatar--lg" aria-hidden="true">TB</div>
          <div>
            <h3>thebestpornai Editorial</h3>
            <p>We review AI adult platforms and stream finished scenes. Read the guide, then watch on thebestpornai — or try the tool if you want to generate.</p>
          </div>
        </aside>
      </div>

      <aside class="bp-side">
        ${
          toc.length
            ? `<nav class="bp-card" aria-label="In this article">
          <h3>In this article</h3>
          <div class="bp-toc" id="blog-toc">
            ${toc.map((t) => `<a href="#${esc(t.id)}">${esc(t.title)}</a>`).join("")}
            ${post.faqs && post.faqs.length ? `<a href="#faq">FAQ</a>` : ""}
          </div>
        </nav>`
            : ""
        }
        <div class="bp-card bp-cta">
          <h3>${esc(cta.external ? "Try this platform" : "Watch on thebestpornai")}</h3>
          <p>${esc(cta.external ? "Open the reviewed tool in a new tab. 18+ only." : "Stream the matching scene on thebestpornai — free, no credits.")}</p>
          <a class="blog-cta blog-cta-primary"${cta.external ? ' target="_blank" rel="noopener sponsored nofollow"' : ""} href="${esc(cta.href)}">${esc(cta.label)}</a>
        </div>
        ${
          relatedPosts.length
            ? `<div class="bp-card">
          <h3>Related posts</h3>
          <div class="bp-related">
            ${relatedPosts.slice(0, 3).map((p) => {
              const thumb = postCoverThumbUrl(p);
              return `<a class="bp-related-item" href="/blog/${esc(p.slug)}.html">
                <img class="bp-related-thumb" src="${esc(thumb)}" alt="" width="144" height="108" loading="lazy"/>
                <span>
                  <span class="bp-related-title">${esc(cleanTitle(p.title))}</span>
                  <span class="bp-related-meta">${calcReadMins(wordCount(p.body))} min read</span>
                </span>
              </a>`;
            }).join("")}
          </div>
        </div>`
            : ""
        }
      </aside>
    </div>

    <div class="bp-below">
      ${
        relatedVideos.length
          ? `
      <section class="blog-related" aria-labelledby="watch-heading">
        <h2 id="watch-heading">Ready to watch the real thing?</h2>
        <p class="blog-related-sub">Companion clips from the thebestpornai catalog — opens the main player.</p>
        <div class="blog-related-grid">
          ${relatedVideos.map(videoCardHtml).join("")}
        </div>
      </section>
      `
          : ""
      }

      ${
        relatedPosts.length
          ? `
      <section class="blog-related" aria-labelledby="related-heading">
        <div class="blog-section-head">
          <h2 id="related-heading">More Stories &amp; Articles</h2>
          <div class="blog-section-rule" aria-hidden="true"></div>
        </div>
        <p class="blog-related-sub">Explore uncensored fantasies, in-depth guides, and creator deep-dives.</p>
        <div class="blog-cards blog-related-cards">
          ${relatedPosts.map((p) => postCardHtml(p)).join("")}
        </div>
        <div class="blog-topic-bar">
          <span class="blog-topic-label">Browse Topics:</span>
          <a href="/blog/" class="blog-topic-pill">All</a>
          <a href="/blog/#guides" class="blog-topic-pill">Guides</a>
          <a href="/blog/#fantasies" class="blog-topic-pill">Fantasies</a>
          <a href="/blog/#stories" class="blog-topic-pill">Stories</a>
          <a href="/blog/#confessions" class="blog-topic-pill">Confessions</a>
          <a href="/blog/#kink-lab" class="blog-topic-pill">Kink Lab</a>
        </div>
      </section>
      `
          : ""
      }

      ${prevNextHtml(post)}

      <section class="blog-confession">
        <h3>Anonymous confession</h3>
        <p>Tell us what you can't tell anyone else. Submitted securely &amp; anonymously — no account required.</p>
        <form id="blog-confession-form" action="/api/confession" method="post">
          <div class="blog-confession-field">
            <label class="blog-confession-label" for="blog-confession-input">Your confession</label>
            <textarea id="blog-confession-input" name="body" placeholder="Type your confession…" maxlength="2000" required></textarea>
          </div>
          <button type="submit" class="blog-cta blog-cta-primary blog-confession-submit" id="blog-confession-submit">Send confession</button>
          <p class="blog-confession-note">Nothing is stored in your browser. Submissions are moderated for safety.</p>
        </form>
      </section>
    </div>
  </article>
</main>

${siteFooter()}

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
          headline: cleanTitle(p.title),
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
          name: cleanTitle(p.title),
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
  const hub = postsForHub(sorted);
  const featured = getFeaturedPost(sorted) || hub[0];
  const rest = hub.filter((p) => p.slug !== featured?.slug);
  const cover = postCoverUrl(featured);
  const jsonLd = jsonLdForIndex(hub);
  const categories = ["All", "Guides", "Stories", "Fantasies", "Confessions", "Kink Lab"];

  const PAGE_SIZE = 9;
  const preview = rest.slice(0, PAGE_SIZE);
  const staticCards = preview.map((p, i) => postCardHtml(p, { eager: i < 3, fetchpriority: i === 0 ? "high" : undefined })).join("");
  const hasMore = rest.length > PAGE_SIZE;

  const featuredWords = wordCount(featured.body);
  const featuredReadMins = calcReadMins(featuredWords);
  const featuredTitle = cleanTitle(featured.title);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Blog | thebestpornai — AI Porn Guides, Fantasies &amp; Stories</title>
<meta name="description" content="AI porn guides, generator rankings, cinematic fantasies and confessions from thebestpornai. Read the story, then watch the matching scenes."/>
<meta name="theme-color" content="#09090b"/>

<link rel="canonical" href="${ORIGIN}/blog/"/>
<link rel="alternate" type="application/rss+xml" title="thebestpornai Blog" href="${ORIGIN}/blog/rss.xml"/>
<link rel="icon" type="image/png" href="/src/shared/assets/favicon-32.png"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="thebestpornai"/>
<meta property="og:title" content="Blog | thebestpornai — AI Porn Guides &amp; Fantasies"/>
<meta property="og:description" content="Cinematic adult stories, AI fantasies, confessions and kink deep-dives. Read the fantasy, then watch it."/>
<meta property="og:url" content="${ORIGIN}/blog/"/>
<meta property="og:image" content="${esc(cover)}"/>
<meta property="og:image:alt" content="thebestpornai Blog"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="Blog | thebestpornai — AI Porn Guides &amp; Fantasies"/>
<meta name="twitter:description" content="Cinematic adult stories, AI fantasies, confessions and kink deep-dives."/>
<meta name="twitter:image" content="${esc(cover)}"/>
<meta name="robots" content="index,follow,max-image-preview:large"/>
<script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
</script>
<meta http-equiv="Content-Security-Policy" content="default-src 'self' https: blob: data:; base-uri 'self'; form-action 'self' mailto:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https: blob:; media-src 'self' https: blob:; connect-src 'self' ${SUPABASE_ORIGIN} https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev; frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com;">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="/src/shared/theme.css"/>
</head>
<body class="blog-body">
${siteHeader({ mode: "index" })}

<main class="blog-shell">
  <header class="blog-masthead">
    <div class="blog-masthead-badge">
      <span class="pulse-dot"></span>
      <span>Editorial</span>
    </div>
    <h1>Guides, rankings &amp; stories</h1>
    <p class="blog-masthead-sub">Honest reviews of AI porn tools, plus the fantasies and scenes they pair with. Read first — then watch.</p>
  </header>

  <div class="blog-filter-bar">
    <nav class="blog-pillnav" id="blog-pillnav" aria-label="Blog categories">
      ${categories
        .map((cat) => {
          const active = cat === "All" ? " active" : "";
          const data = cat === "All" ? "all" : cat;
          const n = cat === "All" ? sorted.length : sorted.filter((p) => p.category === cat).length;
          return `<button type="button" class="blog-pill${active}" data-category="${esc(data)}">${esc(cat)} <span class="blog-pill-count">${n}</span></button>`;
        })
        .join("")}
    </nav>
    <label class="blog-filter-search">
      <span class="sr-only">Search the blog</span>
      <input class="blog-search-input" id="blog-filter-search" type="search" placeholder="Search guides and stories…" autocomplete="off"/>
    </label>
  </div>

  <div id="blog-hero">
    <a href="/blog/${esc(featured.slug)}.html" class="blog-hero" aria-label="Featured: ${esc(featuredTitle)}">
      <div class="blog-hero-copy">
        <div class="blog-hero-badge-row">
          <span class="blog-hero-eyebrow">Featured</span>
          <span class="blog-hero-stat">${esc(featured.category)}</span>
        </div>
        <h2 class="blog-hero-title">${esc(featuredTitle)}</h2>
        <p class="blog-hero-excerpt">${esc(featured.excerpt)}</p>
        <div class="blog-hero-footer">
          <span class="blog-cta blog-cta-primary">${featured.category === "Guides" ? "Read guide" : featured.category === "Stories" || featured.category === "Fantasies" ? "Read story" : "Read"}</span>
          <div class="blog-hero-meta">
            <span>${ICON_CLOCK}${featuredReadMins} min</span>
            <span class="dot"></span>
            <span>${ICON_CALENDAR}${esc(formatDate(featured.date))}</span>
          </div>
        </div>
      </div>
      <div class="blog-hero-visual">
        <div class="blog-hero-img" style="background-image:url('${esc(cover)}')"></div>
      </div>
    </a>
  </div>

  <div class="blog-section-head">
    <h2>Latest</h2>
    <div class="blog-section-rule" aria-hidden="true"></div>
  </div>

  <div class="blog-cards" id="blog-cards">
    ${staticCards}
  </div>

  <div class="blog-loadmore-wrap">
    <button class="blog-loadmore" id="blog-loadmore" type="button"${hasMore ? "" : " hidden"}>Load more</button>
  </div>

  <details class="blog-crawl-index">
    <summary>All ${sorted.length} articles</summary>
    <div class="blog-crawl-body">
      <p class="blog-crawl-desc">Full title list for browsing and search engines.</p>
      <div class="blog-crawl-grid">
      ${hub
        .map(
          (p) =>
            `<a class="blog-crawl-card" href="/blog/${esc(p.slug)}.html">
              <div class="blog-crawl-card-header">
                <span class="blog-crawl-card-cat">${esc(p.category)}</span>
                <span class="blog-crawl-card-date">${esc(formatDate(p.date))}</span>
              </div>
              <span class="blog-crawl-card-title">${esc(cleanTitle(p.title))}</span>
            </a>`
        )
        .join("\n")}
      </div>
    </div>
  </details>
</main>

<div class="blog-mob-dock" id="blog-mob-dock">
  <button type="button" id="blog-mob-search">Search</button>
  <button type="button" class="primary" id="blog-mob-filters">Filters</button>
</div>
<dialog class="blog-filter-dialog" id="blog-filter-dialog" aria-label="Filter posts">
  <p class="blog-series-label">Category</p>
  <div id="blog-dialog-pills"></div>
  <form method="dialog"><button class="blog-cta blog-cta-ghost" type="submit">Done</button></form>
</dialog>

${siteFooter()}

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
      <title>${esc(cleanTitle(p.title))}</title>
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
    const words = wordCount(post.body);
    const readMins = calcReadMins(words);
    fs.writeFileSync(outPath, renderPost(post));
    console.log(`wrote blog/${post.slug}.html (${words} words, ${readMins} min read)`);
  }

  fs.writeFileSync(path.join(BLOG_DIR, "index.html"), renderIndex());
  console.log("wrote blog/index.html (prerendered hub)");

  fs.writeFileSync(path.join(PUBLIC_BLOG, "rss.xml"), renderRss(sorted));
  console.log("wrote public/blog/rss.xml");
}

main();
