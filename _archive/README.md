# Archived build pipeline (do not use)

These files are **abandoned** and kept only for historical reference.

## What they were

`build.js` inlined `_shared.css` + `_data.js` into the `*.src.html` templates to
produce the served HTML (`viewer/viewer-app.html`, `creator/creator-studio.html`,
`manager/platform-manager.html`).

## Why they're archived

The pipeline was never wired into CI, Vercel, or any npm script, and the team has
edited the **built** HTML files directly for a long time. As a result the templates
drifted badly behind the real pages — by the time they were archived (2026-06-30)
they were missing, among other things:

- per-video hash routing (`applyHash`/`setHash`)
- Bunny CDN lazy-load thumbnails
- the mobile responsive layout / bottom tab bar

## The trap this removes

Running `node build.js` would have **overwritten the live HTML files with the stale
template output**, silently wiping all of the above. Moving these out of the working
tree makes that impossible by accident.

`_data.js` is also here. It was the "source of truth" the build pipeline inlined,
but it too drifted (its helper functions lagged the live pages) and was never loaded
at runtime. It is superseded by `../catalog.js`, which the pages now load directly.

## The catalog is now in one place

The 4-file catalog sync was solved (2026-06-30): the catalog moved to
`../catalog.js`, loaded at runtime by every page. See `../CLAUDE.md`. Do not revive
`build.js`, the `*.src.html` templates, or `_data.js`.
