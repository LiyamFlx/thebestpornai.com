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
  // Only *named* wide art — never assume every /blog-assets/ file is 16:9.
  // Portrait photos forced into a banner crop the face and then repeat in the body.
  return /(hero|banner|crew|wide|16x9|platforms-in-2026|wet-night)/i.test(c);
}

export function stripLeadingHeroDup(body, coverSrc = "") {
  const html = String(body || "");
  const m = html.match(LEADING_FEATURE_RE);
  if (m) {
    const chunk = m[0];
    const caption = ((chunk.match(/<div class="blog-media-caption">([\s\S]*?)<\/div>/i) || [])[1] || "")
      .replace(/<[^>]+>/g, "")
      .trim();
    return { body: html.slice(m[0].length).trimStart(), caption, stripped: true };
  }
  return stripMatchingCoverFigure(html, coverSrc);
}

/** Remove the first body figure/img that repeats the hero `cover` src. */
export function stripMatchingCoverFigure(body, coverSrc) {
  const html = String(body || "");
  const cover = normalizeSrc(coverSrc);
  if (!cover) return { body: html.trimStart(), caption: "", stripped: false };

  const figRe =
    /<figure\b[^>]*>[\s\S]*?<img\b[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/figure>/i;
  const m = html.match(figRe);
  if (m && normalizeSrc(m[1]) === cover) {
    const caption = ((m[0].match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i) || [])[1] || "")
      .replace(/<[^>]+>/g, "")
      .trim();
    return { body: html.replace(m[0], "").replace(/^\s+/, ""), caption, stripped: true };
  }
  return { body: html.trimStart(), caption: "", stripped: false };
}

function normalizeSrc(src) {
  return String(src || "")
    .split("?")[0]
    .replace(/^https?:\/\/www\.thebestpornai\.com/i, "")
    .replace(/\/+$/, "");
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
