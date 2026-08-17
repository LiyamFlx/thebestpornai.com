# thebestpornai design system

One product. One shell. Path URLs. Tokens from `src/shared/theme.css`.

This file is the live contract. If a page disagrees with it, the page is wrong.

---

## What shipped (2026)

The old split — marketing header on directories/blog vs app rail on Home — is gone.

Every public surface uses the **same app shell**:

- 72px left rail (Home, Shorts, Library, You)
- 24px wordmark (`/logo-wordmark.png`) in the topbar
- Search **field** (not a “Search 5,000+” pill)
- Red/black tokens from `theme.css`

Directories and blog still have **different bodies** (hero + grid, article). They must not invent a second header.

Watch and Shorts stay immersive (same chrome, no extra marketing nav).

---

## Tokens (one `:root`)

Source of truth: `src/shared/theme.css`. Generators import names, they do not invent hex.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0A0A0A` | Page |
| `--surface` | `#141414` | Cards, rail, panels |
| `--surface2` | `#1E1E1E` | Hover, chips, search field |
| `--text` | `#FFFFFF` | Headings, titles |
| `--muted` | `#A0A0A0` | Nav idle, meta |
| `--accent` | `#E50914` | Primary CTA, active, play |
| `--accent2` | `#FF3B3B` | Hover / hot |
| `--border` | `rgba(255,255,255,0.10)` | Hairlines |
| `--radius` | `14px` | Cards, inputs |
| `--radius-pill` | `999px` | Chips, search, CTAs |

**Do not ship:** pink/purple gradients (`#ff2d55`, `#9b51e0`), navy marketing surfaces (`#0b0c10`), a third accent.

---

## Chrome

Shared markup: `scripts/lib/site-chrome.mjs` → `appShellHtml`. CSS: `public/app-shell.css` + `theme.css`.

Home no longer has a four-link marketing nav. Those destinations live as **filters / rail / directories**:

| Slot | Behavior |
|---|---|
| Wordmark | Always `/`, 24px |
| Search | `/search` and `/search/{query}` |
| Rail Home | `/` |
| Rail Shorts | `/shorts` |
| Pornstars | `/pornstars/` |
| Categories | `/categories/` or `/categories/{slug}.html` |
| Blog | `/blog/` |

Active: white. Idle: `--muted`. No underline pills.

---

## URL map (canonical paths, not hashes)

Share and crawl these. Legacy `#video/N` still **migrates** via `hashToPath()` in `src/shared/public-routes.js` — do not emit new hashes.

| Intent | URL | Notes |
|---|---|---|
| Home | `/` | App |
| Watch | `/watch/{id}` | Horizontal / default player |
| Shorts | `/shorts` or `/shorts/{id}` | Vertical |
| Search | `/search` or `/search/{q}` | |
| Browse tag | `/browse/{slug}` | In-app when no SEO landing |
| Category landing | `/categories/{slug}.html` | Generated |
| Category hub | `/categories/` | |
| Pornstars hub | `/pornstars/` | |
| Creator | `/creator/{id}` | e.g. `/creator/ps-mia-nympo` |
| Movies / scenes / clips | `/movies` `/scenes` `/clips` | Home filters |
| Library | `/library` `/library/{tab}` | |
| Blog | `/blog/` `/blog/{slug}.html` | Generated |
| SEO video landing | `/video/{id}.html` | Share/API landing; Play opens `/watch` or `/shorts` |

Helpers (use these, do not hardcode):

- `playPath(video)` — Shorts if `orientation === "vertical"`, else Watch
- `searchPath(query)`
- `browsePath(name)` / `categoryPagePath(name)`
- `hashToPath(hash)` — one-way migrate

`vercel.json` rewrites those paths to `index.html` so the SPA can own them. Hash links in old emails still work.

---

## Components

### Primary button
Solid `--accent`, white text, pill radius. Hover `--accent2`. No gradient.

### Card
`--surface`, 1px `--border`, `--radius`, 16:9 thumb, title 14/600, meta 12 muted.

### Directory card (pornstars)
Same card chrome. Banner + overlapping avatar. One primary button language.

### Blog
Same shell. Article body may use Playfair. Header never does. Do **not** emit `VideoObject` on articles (Google treats the post as a watch page). Companion clips are HTML cards that `playPath` into the player.

---

## Generators

| Script | Writes |
|---|---|
| `scripts/gen-static-routes.js` | `/pornstars/`, `/categories/`, top `/video/{id}.html` |
| `scripts/gen-blog-posts.js` | `/blog/*.html`, hub, RSS |

After changing chrome or URLs, run both. Leftover `/#video` in old `video/*.html` files that the generator does not refresh must be rewritten or the file deleted.

Redirected slugs (`src/blog/redirects.js` + `vercel.json`) must **not** leave a static HTML file that wins over the 301.

---

## What we will not do

- A second marketing header on directories or blog
- Rebuild Home as a centered landing
- New hashes for play/share (`#video`, `#shorts`, `#search`)
- VideoObject on editorial posts
- A third accent color
- Commit raw `.mp4`s or `docs/SITE-ANALYSIS*` unless asked

---

## Check before a PR

- [ ] Wordmark + rail + search match Home vs `/pornstars/` vs `/blog/`
- [ ] Play / share hrefs are `/watch/{id}` or `/shorts/{id}`
- [ ] Search chips are `/search/{q}`
- [ ] No `#9b51e0` / `#ff2d55` on regenerated pages
- [ ] Articles have BlogPosting (+ FAQ if needed), not VideoObject
- [ ] `hashToPath` still maps leftover hashes so old links work
