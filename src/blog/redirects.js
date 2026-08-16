/** Old slugs that now 301 to a living hub. Keep this the only map. */
export const BLOG_REDIRECTS = {
  "best-ai-porn-sites-2026": "best-ai-porn-sites-2026-ranking",
};

export function isRedirectedSlug(slug) {
  return Boolean(BLOG_REDIRECTS[slug]);
}
