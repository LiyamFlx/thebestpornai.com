import { esc, mediaUrl } from "../shared/catalog.js";
import { VIDEOS } from "../shared/catalog-videos.js";

function findVideo(id) {
  return VIDEOS.find((v) => v.id === id);
}

export function postCoverUrl(post) {
  if (post.cover) return mediaUrl(post.cover);
  const v = findVideo(post.coverVideoId);
  return v && v.thumb ? mediaUrl(v.thumb) : "";
}

const ICON_CLOCK = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;
const ICON_FLAME = `<svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 3-3 4-3 8a3 3 0 0 0 6 0c1.5 1 2 3 2 4.5a5 5 0 0 1-10 0C7 10 9 8 12 2Z"/></svg>`;
const ICON_CALENDAR = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="1.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>`;

/* Renders a post card for the feed / related-posts sections. */
export function postCardHtml(post) {
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

/* Skeleton placeholder card shown briefly after "Load more fantasies" while
   the next page of real cards is prepared, so new content doesn't pop in
   abruptly. Mirrors postCardHtml's structure/aspect-ratio so layout doesn't
   shift when the real card swaps in. */
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

/* Renders a related-video card, resolving against the live catalog. */
export function videoCardHtml(videoId) {
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

export function formatDate(iso) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}
