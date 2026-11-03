# Action Plan — thebestpornai.com

## Critical
_None. Nothing blocks indexing or triggers a penalty._

## High (within 1 week)
1. **Expand the video sitemap.** `scripts/gen-sitemap.js:30` `VIDEO_SITEMAP_LIMIT = 500` → cover all ~7,000 videos, chunk at ≤10k per file, list each chunk in `sitemap-index.xml`, add `<video:duration>`.
2. **Move media off `r2.dev`.** Attach a custom domain to the `streamhub-media` bucket; update `MEDIA_BASE`, regenerate sitemap-video, VideoObject `contentUrl`/`thumbnailUrl`, and `og:image` fields. Keep old URLs working.

## Medium (within 1 month)
3. Add an `<h1>` (and a couple of `<h2>`s) to `/pornstars/`.
4. Use real `lastmod` values (content modified date) instead of the build date for blog/profile/category URLs.
5. Remove or fix the WebSite `SearchAction` (target `/search` is robots-blocked; feature retired by Google).
6. Fix VideoObject: boolean `isFamilyFriendly`, a real `embedUrl` (or drop it), real view counts.
7. Differentiate templated profile/category copy; add methodology + disclosure + review dates to the pillar comparison page; consider more than one author.
8. Audit homepage JS (~450 KB gz): confirm `card-*.js` isn't carrying catalog data; target < 200 KB initial.
9. Move CSP to a response header; plan to remove `'unsafe-inline'` script-src.
10. Connect Search Console / PageSpeed (seo-google) to get real indexation and CWV data.

## Low (backlog)
11. Trim homepage title to ~60 chars and drop "Watch, Stroke, Repeat"; shorten homepage meta description to ≤155 chars; branded 1200×630 OG image.
12. Add `Permissions-Policy` header and `/.well-known/security.txt`.
13. Mirror `Disallow: /watch/ /search/ /shorts/` in the AI-bot robots group; explicitly list `OAI-SearchBot`, `Claude-SearchBot`, `Google-Extended`.
14. Add `sameAs` to Organization and Person schemas; `llms-full.txt`.
15. WebP/AVIF poster variants; `s-maxage`/`stale-while-revalidate` on static-ish HTML.
