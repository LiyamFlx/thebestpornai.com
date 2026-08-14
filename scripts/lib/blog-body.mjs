/**
 * Article-body helpers for gen-blog-posts.js.
 * Leading .blog-feature-media blocks duplicate the generated header hero.
 */

const LEADING_FEATURE_RE =
  /^\s*<div class="blog-feature-media">\s*<img\b[^>]*>\s*(?:<div class="blog-media-caption">[\s\S]*?<\/div>\s*)?<\/div>\s*/i;

export function isLandscapeCover(post) {
  if (!post) return false;
  if (post.coverLayout === "landscape") return true;
  if (post.coverLayout === "portrait") return false;
  const c = String(post.cover || "");
  return /blog-assets\/|media\/blog\//i.test(c);
}

export function stripLeadingHeroDup(body) {
  const html = String(body || "");
  const m = html.match(LEADING_FEATURE_RE);
  if (!m) return { body: html.trimStart(), caption: "", stripped: false };
  const chunk = m[0];
  const caption = ((chunk.match(/<div class="blog-media-caption">([\s\S]*?)<\/div>/i) || [])[1] || "")
    .replace(/<[^>]+>/g, "")
    .trim();
  return { body: html.slice(m[0].length).trimStart(), caption, stripped: true };
}

export function toInlineFigures(body) {
  return String(body || "").replace(
    /<div class="blog-feature-media">\s*(<img\b[\s\S]*?>)\s*(?:<div class="blog-media-caption">([\s\S]*?)<\/div>\s*)?<\/div>/gi,
    (_, img, cap) => {
      const lazy = String(img).replace(/\sloading="eager"/i, "").replace(/\sfetchpriority="high"/i, "");
      const withLazy = /\bloading=/.test(lazy)
        ? lazy
        : lazy.replace(/<img\b/i, '<img loading="lazy" decoding="async"');
      const caption = cap
        ? `<figcaption class="blog-media-caption">${cap.trim()}</figcaption>`
        : "";
      return `<figure class="blog-inline-figure">${withLazy}${caption}</figure>`;
    }
  );
}

export function absoluteUrl(origin, src) {
  if (!src) return origin;
  if (/^https?:\/\//i.test(src)) return src;
  const path = src.startsWith("/") ? src : `/${src}`;
  return String(origin).replace(/\/$/, "") + path;
}
