# thebestpornai.com/blog — Design Spec

Date: 2026-07-30

## Goal

Add a high-end, cinematic adult blog at `thebestpornai.com/blog`, matching the
"Matte-Black Ferrari" brand system already designed in
`stitch_the_best_porn_ai_interface/` (Stitch mockups: `blog_index_thebestpornai`,
`blog_feed_mobile_thebestpornai`, `obsidian_velocity/DESIGN.md`). A feed page
lists posts; each post gets its own indexable page with related videos pulled
from the existing video catalog.

## Stack decision (deviates from original request)

The original prompt specified Next.js/TypeScript/Tailwind/MDX. This repo is a
**Vite multi-page vanilla JS/CSS site** (`vite.config.js` defines HTML entries
for `index`, `choose`, `creator`, `manager`, `viewer`, legal pages — no React,
no TS, no Tailwind anywhere in the codebase). Introducing a second framework
just for one section would mean a second build system, a second deploy
surface, and duplicated brand/theme logic. Decision (confirmed with user):
**match the existing stack** — plain JS/CSS, new Vite entries, same deploy
pipeline (`git push` → GitHub Actions → Vercel).

## SEO/AEO/GEO requirement (drove the routing design)

Initial draft used `blog/post.html?slug=x` as a single client-rendered
template for all posts. Verified against current SEO/GEO best practice: query-
string-only routing with JS-injected content is bad for indexing (weak
canonicalization, no per-URL meta/OG baked into initial HTML) and bad for AI
Overview / LLM-citation readiness (crawlers and AI fetchers favor clean,
unique, pre-resolved URLs with content present in the initial response).
**Fix**: generate one static HTML file per post at build time, each with its
own URL, `<title>`, meta description, canonical link, OG tags, and
Article/BlogPosting JSON-LD baked directly into the served HTML — matching how
`index.html` already ships static Organization JSON-LD instead of relying on
`render.js` to inject it.

## Architecture

```
src/blog/
  posts.js              POSTS[] data source
  blog.css              brand tokens layered on theme.css (--red, --red-hover,
                         pure black backgrounds, sharp/no-radius corners)
  feed.js                renders blog/index.html: hero, category pills, card
                         list, "Load more fantasies"
  post-render.js         shared render helpers for a post's article body +
                         related-videos + related-posts sections (used by the
                         generated static pages for hydration/interactivity
                         only — content itself is baked into the HTML)
  card.js                 shared postCard(post) renderer used by feed + related

blog/
  index.html              feed page shell (hand-written, Vite entry)
  <slug>.html              GENERATED per post by scripts/gen-blog-posts.js —
                           not hand-edited

scripts/
  gen-blog-posts.js        reads src/blog/posts.js, writes blog/<slug>.html
                           per entry with baked-in title/meta/canonical/OG/
                           JSON-LD, full article HTML in the initial markup,
                           and a script tag to hydrate related-video cards
                           from catalog-videos.js client-side
```

### Data model (`src/blog/posts.js`)

```js
export const POSTS = [
  {
    id: 1,
    slug: 'synthetic-lust',
    title: 'Synthetic Lust: The Algorithm of her Ecstasy',
    category: 'AI Fantasy',        // one of: Stories, Fantasies (AI Fantasy), Confessions, Kink Lab
    excerpt: '...',                 // 2-line teaser for cards
    microcopy: '...',               // red one-liner under the post hero title
    date: '2026-07-28',
    readMins: 4,
    strokes: 2100,                  // "engagement" stat shown in meta row
    coverVideoId: 101,              // resolves to VIDEOS.find(v => v.id === 101).thumb
    relatedVideoIds: [101, 102, 103],
    body: `<p>...</p><blockquote>...</blockquote><p>...</p>`, // full article HTML
  },
  // ...
];
```

Covers and related-video cards resolve against the existing
`src/shared/catalog-videos.js` `VIDEOS` array — no new media assets needed.

### Build integration

`vite.config.js` `rollupOptions.input` gains:
- `blogIndex: resolve(__dirname, 'blog/index.html')`
- one entry per generated `blog/<slug>.html`, discovered via
  `fs.readdirSync('blog')` at config-eval time (same style already used for
  legal pages, just dynamic instead of hardcoded since post count will grow).

`package.json` build script becomes:
```
"build": "node scripts/gen-blog-posts.js && vite build"
```
(`gen-blog-posts.js` runs before Vite so the generated files exist as inputs
when Vite's config is evaluated.)

## Pages

### Feed (`blog/index.html`)
Client-rendered by `feed.js`, matching the Stitch `blog_index_thebestpornai`
mockup: sticky top bar (logo, search, avatar), category pill nav (Stories ·
Fantasies · Confessions · Kink Lab, client-side filter), featured hero (first
post), "Latest Desires" section title, vertical card stack, "Load more
fantasies" button (paginates client-side over `POSTS`). No JSON-LD needed
beyond static Organization schema already in the root layout pattern — this
page is a hub, not a unique-content target.

### Single post (`blog/<slug>.html`, generated)
Matches the single-post spec from the original request: sticky "← Back to
Blog" bar, full-bleed hero image (post's cover, from catalog thumb) with
bottom gradient, category pill + title + red microcopy + meta row, article
body (max-width ~680px, pull quotes in Ferrari red via `<blockquote>` styling),
large red CTA ("Watch this exact fantasy →") linking to the first related
video, "Ready to stroke the real thing?" section with 3-4 related video cards
(resolved from `relatedVideoIds`), "Related Stories" section (other posts
sharing the same category), all content present in the static HTML — only
click/hover interactivity is JS-hydrated.

## Style

New CSS custom properties in `blog.css`, imported after `theme.css`:
```css
--red: #FF2800;
--red-hover: #FF4D1A;
--red-soft: rgba(255, 40, 0, 0.12);
--red-glow: 0 0 24px rgba(255, 40, 0, 0.55);
--black: #000000;
--black-soft: #0A0A0A;
--black-card: #111111;
```
Sharp corners (no `border-radius`) throughout, per `obsidian_velocity/
DESIGN.md` — an intentional visual departure from the rounded look elsewhere
on the site, since the blog is a distinct editorial sub-brand. Single-column,
max-width 720–780px, centered. Inter font (already the site's font stack via
`theme.css`).

## Seed content

4 sample posts written in the specified voice (adult, clever, lightly
arrogant, openly horny — never crude for its own sake), covering all four
category pills:
1. **Synthetic Lust: The Algorithm of her Ecstasy** — AI Fantasy
2. **The Boardroom After-Hours: Unspoken Contracts** — Confessions
3. **Velocity & Verve: The Mechanics of Pleasure** — Kink Lab
4. One additional post tagged **Stories** to cover the fourth pill

Each links `relatedVideoIds` to real existing catalog entries (chosen by
category/tag match at implementation time).

## Out of scope

- No Next.js/React/TypeScript/Tailwind/MDX — none exist in this repo.
- No CMS/headless integration — `posts.js` is the source of truth for now;
  swapping to a CMS later means changing how `POSTS` is populated, not the
  rendering/generation pipeline.
- No comment system / anonymous confession box backend — if kept in the UI at
  all, it's a static mailto/placeholder form, not wired to Supabase in this
  pass.
