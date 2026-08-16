# thebestpornai design system

One product. Two jobs. Same clothes.

This file is the contract. Tokens, chrome, and components come from here.
Pages may differ in **layout purpose**. They may not differ in **color, type, radius, or header**.

---

## The problem (your two screenshots)

| | `/pornstars/` (and categories, blog, `/video/*`) | `/` Home viewer |
|---|---|---|
| Job | SEO / landing / directory | Watch / browse / library |
| Shell | Full-width marketing header, no rail | 72px icon rail + app topbar |
| Accent | Pink → purple gradient `#ff2d55 → #9b51e0` | Netflix red `#E50914` |
| Background | Cool navy `#0b0c10` | True black `#0A0A0A` |
| Buttons | Pill gradient “Search 5,000+” | Flat red Play, ghost icon buttons |
| Cards | 16px marketing tiles + avatar overlap | 14px browse tiles, 4K badge, play hover |
| Type | Centered hero, editorial width | Left-aligned rows, cinematic hero |

They share a wordmark now. Everything under it is still two brands.

**Do not** make Home look like the pornstars landing. You would lose Shorts, Library, Continue Watching, and the player.

**Do not** wrap pornstars in the app rail. That page should stay a clean, crawlable directory.

Unify **chrome + tokens + components**. Keep **layout jobs** different.

---

## North star

> Same header. Same red. Same cards. Different body.

- **Public pages** (pornstars, categories, blog, video landings): marketing canvas. No sidebar. Centered 1200px. Hero + grid.
- **App pages** (Home, Shorts, Watch, Library, Search): product canvas. Rail + topbar stay. Rows, player, filters stay.

A user who clicks **AI Pornstars** then **Home** should feel they never left the site. Only the *mode* changed: “read / pick a face” vs “watch / browse.”

---

## Tokens (one `:root`, no exceptions)

Source of truth: `src/shared/theme.css`. Marketing CSS (`site-chrome.css`, `blog.css`, inline static styles) must **import these names**, not invent new hex.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0A0A0A` | Page |
| `--surface` | `#141414` | Cards, rail, panels |
| `--surface2` | `#1E1E1E` | Hover, chips, search field |
| `--text` | `#FFFFFF` | Headings, titles |
| `--muted` | `#A0A0A0` | Nav idle, meta, bios |
| `--accent` | `#E50914` | Primary CTA, active, play |
| `--accent2` | `#FF3B3B` | Hover / hot |
| `--border` | `rgba(255,255,255,0.10)` | Hairlines |
| `--radius` | `14px` | Cards, inputs |
| `--radius-pill` | `999px` | Search CTA, chips |

**Kill on marketing pages:**

- `#ff2d55` / `#9b51e0` gradient buttons
- `#0b0c10` / `#13151b` navy surfaces
- Purple hero wash

Wordmark red *is* the brand. Purple was leftover from an older landing template.

---

## Chrome (identical everywhere except Watch / Shorts)

```
[ wordmark ]     Home   AI Pornstars   Categories   Editorial & Guides     [ action ]
```

| Slot | Public pages | App (Home) |
|---|---|---|
| Wordmark | `/logo-wordmark.png` 26px | same, 24px |
| Four links | `/`, `/pornstars/`, `/categories/`, `/blog/` | same URLs |
| Action | Red pill → `/#search` | Search field + upload + library (app tools) |
| Rail | None | Keep (Shorts / Library / You) |
| Footer | Wordmark + Explore + Legal | App: legal in account menu only |

Watch and Shorts may collapse the four links to save height. They must keep the wordmark.

Active link: white, no underline, no pill. Idle: `--muted`.

---

## Components (one recipe)

### Primary button
Solid `--accent`, white text, 8×16 padding, `--radius-pill`. Hover: `--accent2`. No purple.

### Card
`--surface`, 1px `--border`, `--radius`, 16:9 thumb, title 14/600, meta `--muted` 12. Hover: lift 2–3px, border lightens. Play glyph is the red triangle favicon language, not a new shape.

### Directory card (pornstars)
Same card chrome. Banner 120px. Avatar 72px overlapping. Name + 2-line bio. One primary button, not a second visual system.

### Hero
- Public: short centered title + one line + optional CTA. No purple radial.
- Home: keep the cinematic featured clip. Restyle Play to the same red pill as marketing.

### Type
System UI / Inter everywhere on product + directories. Playfair only inside long blog articles (body), never in the header.

---

## URL + UX map (so chrome matches intent)

| User wants | URL | Shell |
|---|---|---|
| Watch / browse | `/` `#video` `#shorts` `#library` | App |
| Pick a star | `/pornstars/` `/pornstars/{slug}.html` | Public |
| Pick a genre | `/categories/` `/categories/{slug}.html` | Public |
| Read | `/blog/` | Public |
| Play this scene (SEO) | `/video/{id}.html` | Public header, then “Open in player” → `/#video/{id}` |

Hash routes stay the **player**. Path routes stay the **indexable page**. Same header, different body.

---

## Phased work (do not boil the ocean)

### Phase A — tokens (1 pass, high visual impact)
1. Point `site-chrome.css` + static page CSS at `theme.css` tokens.
2. Replace gradient pills with solid red.
3. Align `--bg` / `--surface` on `/pornstars` and `/categories` to Home.

After A, the two screenshots should look like the same nightclub, different rooms.

### Phase B — chrome polish
1. Public header and app topbar share `site-chrome.css` (already started).
2. App search field uses the same height/radius as the marketing pill.
3. Favicon play mark is the only square brand mark (rail, tab, PWA).

### Phase C — cards
1. One `.v-card` / `.media-card` class used by Home rows, category grids, video landings.
2. Pornstar cards keep the avatar treatment but inherit the same border/radius/hover.

### Phase D — copy/SEO only
Unique intro on each category. No more design drift.

---

## What we will not do

- Put the left rail on `/pornstars` or `/blog`.
- Rebuild Home as a centered marketing page.
- Add a third accent (gold, purple, neon).
- Ship a new header per generator (`gen-blog-posts`, `gen-static-routes`, `index.html`) that does not import this file’s tokens.

---

## Check before a PR

- [ ] Header links and wordmark match Home vs `/pornstars/`
- [ ] No `#9b51e0` / `#ff2d55` on new or regenerated pages
- [ ] Buttons are solid red, not gradient
- [ ] Card radius and border match Home
- [ ] Watch/Shorts still immersive (rail may shrink, wordmark stays)
