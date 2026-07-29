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
        <span>${post.readMins} min read</span>
        <span class="dot"></span>
        <span>${(post.strokes / 1000).toFixed(1)}k strokes</span>
        <span class="dot"></span>
        <span>${esc(formatDate(post.date))}</span>
      </div>
      <span class="blog-card-read">Read &amp; get wet →</span>
    </a>
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
