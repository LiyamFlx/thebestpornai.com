import { esc, mediaUrl, fmt } from "../shared/catalog.js";
import { VIDEOS } from "../shared/catalog-videos.js";
import { playPath } from "../shared/public-routes.js";

function findVideo(id) {
  return VIDEOS.find((v) => v.id === id);
}

/** In-app player URL (Watch or Shorts). */
export function videoWatchUrl(id) {
  const v = findVideo(id);
  return v ? playPath(v) : playPath(id);
}

export function postCoverUrl(post) {
  if (post.cover) {
    if (post.cover.startsWith("/") || /^https?:\/\//i.test(post.cover)) return post.cover;
    return mediaUrl(post.cover);
  }
  const v = findVideo(post.coverVideoId);
  return v && v.thumb ? mediaUrl(v.thumb) : "";
}

export function postCoverThumbUrl(post) {
  if (!post.cover) return postCoverUrl(post);
  if (post.cover.startsWith("/") || /^https?:\/\//i.test(post.cover)) return post.cover;
  if (post.cover.includes("media/blog/")) {
    const thumbRel = post.cover.replace(/\.(jpe?g|png)$/i, "-thumb.webp");
    return mediaUrl(thumbRel);
  }
  return mediaUrl(post.cover);
}

const ICON_CLOCK = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;
const ICON_CALENDAR = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="1.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>`;
const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="rgba(255,255,255,0.92)" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.45)"/><path d="M9.5 8v8l7-4-7-4Z"/></svg>`;

export function formatDate(iso) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function cleanTitle(str) {
  if (!str) return "";
  let clean = String(str).trim();
  // Strip trailing frame/numeric suffixes (00001, _001) — but never a year
  // like "2026", which is a meaningful part of editorial titles.
  if (!/(?:19|20)\d{2}$/.test(clean)) {
    clean = clean.replace(/(\d{4,}|_\d{2,}|\s+\d{4,})$/i, "").trim();
  }
  clean = clean.replace(/'([A-Z])\b/g, (_, char) => `'${char.toLowerCase()}`);
  return clean;
}

function wordCount(html) {
  const t = String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&hellip;/g, "…")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return t ? t.split(/\s+/).filter(Boolean).length : 0;
}

/* Grid / related post card */
export function postCardHtml(post, { eager = false, fetchpriority } = {}) {
  const cover = postCoverThumbUrl(post);
  const loading = eager ? "eager" : "lazy";
  const fpAttr = fetchpriority ? ` fetchpriority="${fetchpriority}"` : "";
  const words = wordCount(post.body);
  const readMins = Math.max(1, Math.ceil(words / 200));
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
          <span class="blog-card-read-more">${post.category === "Reviews" ? "Read review →" : "Read →"}</span>
        </div>
      </div>
    </a>
  `;
}

export function postCardSkeletonHtml() {
  return `
    <div class="blog-card blog-card-skeleton" aria-hidden="true">
      <div class="blog-card-media sk-shimmer"></div>
      <div class="sk-line sk-line-title sk-shimmer"></div>
      <div class="sk-line sk-shimmer"></div>
      <div class="sk-line sk-line-short sk-shimmer"></div>
    </div>
  `;
}

/* Elevated video conversion card */
export function videoCardHtml(videoId) {
  const v = findVideo(videoId);
  if (!v) return "";
  const thumb = v.thumb ? mediaUrl(v.thumb) : "";
  const views = typeof v.views === "number" ? fmt(v.views) + " views" : "";
  return `
    <a class="blog-video-card" href="${videoWatchUrl(v.id)}">
      <div class="blog-video-card-media">
        ${thumb ? `<img src="${esc(thumb)}" alt="${esc(v.title)}" loading="lazy" width="640" height="360" decoding="async"/>` : `<div class="blog-video-card-ph"></div>`}
        <div class="blog-video-card-play">${ICON_PLAY}</div>
        ${v.duration ? `<span class="blog-video-card-duration">${esc(v.duration)}</span>` : ""}
      </div>
      <div class="blog-video-card-body">
        <span class="blog-video-card-label">Watch on thebestpornai</span>
        <div class="blog-video-card-title">${esc(v.title)}</div>
        <div class="blog-video-card-meta">${[views, v.duration].filter(Boolean).join(" · ")}</div>
      </div>
    </a>
  `;
}
