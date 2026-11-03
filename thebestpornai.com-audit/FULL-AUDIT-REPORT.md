# SEO Audit — thebestpornai.com (2026-10-12)

**Business type:** Adult video platform + editorial blog + AI-companion comparison hub (publisher / media)
**SEO Health Score: 74 / 100**
**Method:** inline audit via curl on 12 URL types (home, video, blog, category, directory, pillar, sitemaps, robots, llms.txt, 404). Not a 500-page crawl; the skill's render/Playwright/Google-API scripts are not installed, so there are **no CWV field data, screenshots or GSC/GA4 data**. Performance scoring is an estimate from bundle sizes.

| Category | Weight | Score |
|---|---|---|
| Technical SEO | 22% | 78 |
| Content Quality | 23% | 72 |
| On-Page SEO | 20% | 74 |
| Schema | 10% | 70 |
| Performance (est.) | 10% | 62 |
| AI Search Readiness | 10% | 82 |
| Images | 5% | 80 |

## Executive summary

### Top issues
1. **[High] Video sitemap covers ~500 of ~7,000 videos (≈7%).** `scripts/gen-sitemap.js:30` `VIDEO_SITEMAP_LIMIT = 500`. Google's limit is 50,000 URLs/file, so the cap is self-imposed. ~6,500 `/video/N.html` pages (which are indexable and carry full VideoObject schema) are not submitted via sitemap, and `sitemap.xml` has no `/video/` URLs either.
2. **[High] Video assets served from the `r2.dev` public dev URL.** Sitemap `thumbnail_loc`/`content_loc`, VideoObject `thumbnailUrl`/`contentUrl` and `og:image` on video/category pages all point at `pub-b281….r2.dev`. Cloudflare rate-limits r2.dev and documents it as non-production; Googlebot fetch failures there would silently kill video rich results/thumbnails. Put a custom domain (e.g. `media.thebestpornai.com`) on the bucket. The blog already uses a first-party `/r2/media/…` path, so a proxy pattern exists.
3. **[Medium] `/pornstars/` has no `<h1>`** (82 KB page, 4.5k words, zero H1/H2). Add one.
4. **[Medium] Sitemap `lastmod` is partly fake freshness:** 104/227 URLs stamped today (build date) while 44 share 2026-09-22. Google learns to ignore lastmod when it's unreliable. Use real content-modified dates.
5. **[Medium] Homepage schema is thin and the SearchAction is dead:** only Organization + WebSite. SearchAction targets `/search?q=`, but `/search/` is `Disallow`ed in robots.txt, and Google retired the sitelinks search box. Remove it or allow the path.

### Quick wins
- Raise `VIDEO_SITEMAP_LIMIT` (split into `sitemap-video-1.xml…` by 10k) and add `<video:duration>` (you already have it in the VideoObject).
- Add an `<h1>` to `/pornstars/`.
- Drop the SearchAction block (or point it at an indexable search page).
- Align homepage `<title>` ("AI Porn & Community Videos | Watch, Stroke, Repeat") and H1 ("Free 4K AI Porn & Uncensored Adult Streaming") around one primary keyword; "Watch, Stroke, Repeat" burns title space with no query value.
- Add `Permissions-Policy` header and `/.well-known/security.txt` (404 now).

## Technical SEO (78)
**Working:** HTTPS + HSTS preload; http→https and apex→www 308 redirects (apex resolves to www, so the apex-DNS issue in memory looks resolved from the HTTP side); real 404 status on unknown URLs; canonical on every sampled page, self-referencing and absolute; `robots` meta with `max-image-preview:large, max-snippet:-1, max-video-preview:-1` on video/category pages; sitemap index + 3 sitemaps declared in robots.txt; Brotli on HTML; X-Content-Type-Options, X-Frame-Options, Referrer-Policy present.
**Issues:**
- *Medium* HTML `cache-control: max-age=0, must-revalidate` + `x-vercel-cache: MISS` on `/` and `last-modified` = request time: every request is regenerated/revalidated; fine for freshness, but consider `s-maxage` + `stale-while-revalidate` for static-ish pages (categories, blog).
- *Medium* CSP is only in a `<meta>` tag (not a response header) and keeps `'unsafe-inline'` for scripts. Meta CSP can't cover `frame-ancestors` and is weaker. Move to a header when the inline `onclick` handlers are removed.
- *Low* AI-bot robots group omits `Disallow: /watch/ /search/ /shorts/` that the `*` group has, so GPTBot/ClaudeBot may crawl thin utility URLs the main group blocks.
- *Low* `/search?q=` is advertised in schema yet blocked.
- *Low* Mixed asset hostnames (`/r2/media/…` first-party vs `r2.dev`), see top issue 2.
**Adult-specific:** RTA label present; `/legal/2257.html`, `dmca`, `privacy`, `terms` linked from home. No age-gate markup detected in raw HTML (confirm it doesn't block Googlebot; a JS interstitial is fine, a server-side block is not).

## Content Quality (72)
- 142 blog URLs (63% of sitemap.xml), 65 pornstar profiles, 17 category pages, 1 pillar (`/The-Best-Porn-AI-in-2026`, 2,004 words, FAQ + ItemList, 42 tools compared). Sampled blog post 1,380 words, category page 2,753 words, video page 1,455 words, so no thin-content problem on sampled pages.
- *Medium* Risk of **template/doorway pattern**: profile and category pages follow one template with swapped nouns ("Fiery redhead AI star — …"). Differentiate with unique editorial detail per profile, or consolidate low-traffic ones.
- *Medium* **E-E-A-T:** author page exists (`/author/anna-k.html`, one author for the whole blog) and the pillar page claims "independent scores". Add methodology/testing disclosure, a real review date, and affiliate/commercial disclosure if the comparison page earns referral revenue (YMYL-adjacent trust signal).
- *Low* Meta copy tone ("cum harder", "Stroke, Repeat") is fine for the audience but risks snippet filtering/SafeSearch demotion for non-explicit queries; keep the explicit phrasing off titles of editorial pages you want ranking for tool-comparison queries.
- Date consistency: `uploaded` 2026-05/07 on video pages vs sitemap dates; fine.

## On-Page SEO (74)
- Titles are unique and descriptive on all sampled templates (video, category, directory, pillar). Descriptions present and unique, though some end mid-sentence with an ellipsis (blog sample) and the homepage description is ~190 chars (truncates at ~155).
- *Medium* Homepage: single H1 ✔ but only one H2 in raw HTML; most sections are JS-rendered cards (H-level text appears as video titles).
- *Medium* `/pornstars/`: no H1/H2 (see above).
- Internal linking is strong: 32 links on a video page, 52 on blog, 93 on category pages; breadcrumbs on blog/category/pillar. The homepage links all 17 categories, blog, legal pages.
- *Low* Video page has H1 + only 1 H2; add "Related videos" / "Scenes with {performer}" headings to carry topical text.
- `og:title` differs from `<title>` on home (acceptable); OG image on home is `logo.png` rather than a branded 1200×630 share image.

## Schema (70)
- Home: Organization + WebSite (static, good for name/logo). Organization lacks `sameAs`; logo should be ≥112px square and Google-crawlable.
- Video: VideoObject complete (name, description, thumbnailUrl, uploadDate, duration, contentUrl, embedUrl, isFamilyFriendly, interactionStatistic). Notes: `isFamilyFriendly` is the string `"false"`, not boolean `false`; `embedUrl` equals the page URL (should be a player/embed URL or omitted); `contentUrl`/`thumbnailUrl` on r2.dev (see issue 2); `userInteractionCount` should be real counts.
- Blog: BlogPosting + Person + FAQPage + BreadcrumbList + ImageObject, solid. FAQPage rich results are limited to gov/health sites since 2023, so it won't render, but still harmless for AI extraction.
- Category/directory: CollectionPage + ItemList ✔.
- Missing: `ProfilePage`/`Person` `sameAs` on profiles; `Review`/`SoftwareApplication` ItemList entries on the pillar comparison (it uses ItemList only).

## Performance (62, estimated, not measured)
Gzipped homepage JS: `index` 41 KB + `card` 191 KB + `catalog-videos` 195 KB + `catalog-data` 14 KB + `shared`/`api` ≈ 10 KB → **≈ 450 KB gz of JS** before first meaningful render, plus 19 KB CSS. The `catalog-videos` chunk is described in CLAUDE.md as lazy-loaded, but `card-*.js` (191 KB gz) being separate and equal in size suggests the catalog data is also bundled into it. Worth checking with the Vite bundle visualizer. CWV field data unavailable. Run `seo-google` (CrUX/PageSpeed) once API credentials are configured. 8 of 11 homepage images lazy-loaded (good); poster thumbnails used instead of `<video>` (good).

## Images (80)
0 images missing alt across all 5 sampled templates. Thumbnails are JPEG posters mirrored under `media/thumbs/`. Gaps: no WebP/AVIF variants, home OG image is a logo, video-page `og:image` is on r2.dev.

## AI Search Readiness (82)
Strong: `llms.txt` (200, structured with pillar-first guidance), GPTBot/ChatGPT-User/PerplexityBot/ClaudeBot/Applebot-Extended explicitly allowed, RSS feed, FAQ/Answer markup, a citable comparison pillar. Gaps: `OAI-SearchBot`, `Claude-SearchBot`, `Google-Extended`, `PerplexityBot` coverage should be explicit about search vs training bots; no `llms-full.txt`; no brand `sameAs` entity links for entity resolution; blog has one author persona.

## Not assessed (tooling/data unavailable)
CWV field data, GSC indexation/coverage (check "Crawled – not indexed" for the ~6,500 un-sitemapped video pages), backlink profile, GA4, screenshots/mobile visual, full 500-page crawl, drift baseline. Recommend connecting Search Console first; it will confirm whether issue 1 is costing impressions.
