# StreamHub: Build Tooling, Deduplication & Reliability Pass

Date: 2026-07-03
Status: Approved (pending user review of this doc)

## Context

StreamHub (thebestpornai.com) is a hand-authored static site: three monolithic
HTML apps (`creator/creator-studio.html` ~937 lines, `manager/platform-manager.html`
~626 lines, `viewer/viewer-app.html` ~911 lines), each with inline `<style>` and
inline `<script>`, plus two shared runtime files loaded via manually
version-bumped `<script src="...?v=3">` tags (`catalog.js`, `streamhub-api.js`).
There is no build step, no bundler, no framework, no lint/test step. Deploy is
manual: upload files to Bunny Storage, purge the Bunny Pull Zone cache (30-day
TTL). This is documented in `CLAUDE.md` and must not change.

The three apps share several near-identical helper functions
(`go`, `render`, `metric`, `barChart`, `distRows`, `simplePage`) that were
copy-pasted rather than shared, and have already drifted: `manager`'s `metric()`
is missing the ▲/▼ trend arrow that `creator`'s has — a real, live bug caused by
duplication, not just an eyesore.

The user's goal: make the live site reliable, fast, and professional. This pass
covers (a) build tooling so cache-busting and file duplication stop being manual
error-prone steps, and (b) fixing concrete correctness/reliability bugs found in
an audit, without expanding scope into a rewrite, a framework migration, or
actual live-streaming/broadcast infrastructure (confirmed out of scope — the
site is on-demand video, and stays that way).

## Goals

1. Introduce Vite as a build tool, producing a `dist/` folder with
   content-hashed filenames, replacing manual `?v=N` cache-busting.
2. Split each of the three monolithic HTML files into real ES modules
   (view logic, styles, API calls) served from a `src/` tree.
3. Extract genuinely-shared helpers (`metric`, `barChart`, `distRows`) into
   `src/shared/ui.js`, fixing the `metric()` divergence by keeping the correct
   (arrow-including) version as canonical.
4. Fix the concrete bugs found in the audit that affect reliability or
   correctness on the live site (list below).
5. Update `CLAUDE.md`'s deploy checklist to reflect "upload `dist/` to Bunny"
   instead of "upload these 4 hand-tracked files."

## Non-goals

- No framework (React/Preact/Svelte) migration.
- No merge of creator/manager/viewer into one routed app.
- No Supabase schema/migration restructuring (separate future pass).
- No actual live/broadcast streaming capability.
- No CSS design-system unification beyond moving each app's inline `<style>`
  into its own `.css` file (a shared `theme.css` for the repeated CSS custom
  properties `--bg/--accent/--surface/...` is in scope since it's identical
  across all three files today).

## Structure after migration

```
platform/
  vite.config.js            # multi-page build, 3 HTML entries
  package.json
  src/
    shared/
      catalog.js             # moved from root, unchanged behavior
      streamhub-api.js        # moved from root, unchanged behavior + fixes below
      ui.js                   # NEW: metric(), barChart(), distRows()
      theme.css                # NEW: shared CSS custom properties
    creator/
      main.js                  # creator-studio's script logic as imports
      style.css                 # extracted inline <style>, minus theme vars
    manager/
      main.js
      style.css
    viewer/
      main.js
      style.css
  creator/index.html          # markup only, module script tag
  manager/index.html
  viewer/index.html
  index.html                  # landing/picker, unchanged
  api/upload.js                # unchanged except the fix below
  supabase/*.sql                # unchanged
  dist/                        # git-ignored; build output uploaded to Bunny
```

`go()`, `render()`, `simplePage()` remain per-app (different state shapes,
different page lists) — they will `import` the shared primitives rather than
redefining them, but are not force-merged into one function.

## Bug fixes bundled into this pass

Found during audit; each is a concrete production risk, not style:

1. **Double-fire likes/dislikes** (`viewer/viewer-app.html`): no debounce and no
   DB uniqueness constraint on `likes`, unlike `favorites` — rapid clicks
   silently inflate counts. Fix: disable the button for the duration of the
   in-flight request, add the missing unique constraint in a new
   `supabase/schema-likes-fix.sql`.
2. **Duplicate video on slow upload + re-click** (`creator/creator-studio.html`
   `uPublish()`): fix by disabling the publish button while the request is
   in-flight.
3. **Silent comment loss over 2000 chars** (`viewer/viewer-app.html`
   `addComment()`): DB rejects but UI already optimistically shows it as
   posted. Fix: client-side length validation before optimistic insert, and
   surface the DB error via existing `toast()` instead of swallowing it.
4. **No file-type allowlist on upload** (`api/upload.js`): any extension is
   accepted and served publicly from the CDN. Fix: allowlist video MIME
   types/extensions server-side before proxying to Bunny.
5. **Moderation actions swallow errors and optimistically mutate the queue**
   (`manager/platform-manager.html`): a failed persist silently
   un-does itself later with no operator feedback. Fix: only remove from the
   queue after confirmed success; show `toast()` on failure.
6. **Stale broken entry on failed creator upload**: no retry/remove affordance.
   Fix: on upload failure, mark the entry as failed in the UI with a remove
   action, don't leave a dangling unplayable row.
7. **`metric()` divergence**: canonicalize on the version with the ▲/▼ arrow.
8. **Manager's full-catalog table has no pagination**, unlike viewer's
   lazy-loaded lists. Fix: reuse a simple paginated/virtualized render for the
   video table (same technique viewer already uses, extracted into
   `shared/ui.js` if the logic is identical enough; otherwise kept local).
9. **Count queries fetch full rows to count client-side** in
   `streamhub-api.js`: switch to PostgREST's `count=exact` header pattern
   instead of fetching and counting rows.
10. Remove dead `onProgress` callback in creator upload that's wired but never
    displayed, or wire it to an actual progress indicator (pick based on
    whether upload progress is easy to surface with the current Bunny relay —
    default to removing the dead plumbing if not trivial).

Explicitly deferred (noted but not fixed this pass, to keep scope bounded):
- `fmt()`'s cosmetic 1000-boundary formatting inconsistency (cosmetic only).
- Any Supabase RLS policy audit beyond the one new unique constraint — a full
  RLS review is a separate, security-focused pass.

## Testing / verification approach

No existing test suite; this codebase has none today and adding a full test
harness is out of scope. Verification for this pass:
- `npm run build` succeeds and `dist/` contains three working HTML entries.
- Manually exercise each app locally via `vite preview` (or the existing
  `Start.command` pattern) covering: creator upload flow (including
  double-click guard), viewer like/dislike/comment flow (including the length
  cap and double-click guard), manager moderation action + full video table
  pagination.
- Confirm `catalog.js`/`streamhub-api.js` behavior is unchanged for all
  call sites not touched by the listed fixes (no regressions in existing
  rendering).
- Diff the built `dist/` output's visual appearance against the current live
  pages for all three apps (same layout/styling, just modularized).

## Deploy checklist update

`CLAUDE.md` gets updated: replace "upload catalog.js / viewer-app.html /
platform-manager.html / creator-studio.html / index.html individually" with
"run `npm run build`, upload the contents of `dist/` to Bunny storage (same
paths), purge the Pull Zone cache." The catalog-only fast path (edit
`catalog.js`, upload just that file, purge) is preserved since `catalog.js`
remains a standalone runtime file post-build.
