# media/

> **This file previously described a Bunny CDN-based workflow that has been
> fully replaced.** Bunny was disabled; the live system is Cloudflare R2 +
> Vercel, per `../CLAUDE.md`. Corrected below.

Video files are **not** tracked in this repository — `.gitignore` excludes
`media/**/*.mp4` (and `.vercelignore` excludes `media/*.mp4`). The only
tracked videos are the royalty-free `media/sample-*.mp4` used for local
placeholder playback.

**Real videos live on Cloudflare R2 (bucket `streamhub-media`), not here.**
This local `media/` folder is not what the deployed site reads from —
`MEDIA_BASE` in `src/shared/catalog.js` points at the R2 public dev URL
(`https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev/media`), so playback
works locally too without any files present here.

**Basename collisions are real** — multiple different files with the same
name already exist across different subfolders here (e.g. two distinct
`cumshot1.mp4`). Any tooling that matches local files to catalog entries by
bare filename alone can silently pick the wrong one; the scripts below match
by full relative path (or skip ambiguous matches) to avoid that.

## To actually add a video to the site

See `../CLAUDE.md` under "Adding videos" for the full, current flow. Short
version — prefer the bulk path:

```bash
npm run publish -- "media/<folder>" --category "AI" --tags "Big Ass,POV"
```

This scans the folder, skips anything already published, uploads new files
to R2 in parallel, generates catalog entries, and inserts them into
`src/shared/catalog-videos.js` with automatic backup + post-write
verification. Then `npm run build && git add -A && git commit && git push`.

For a single video by hand, see `../CLAUDE.md`'s "Manual path" section.

## Historical incident (pre-R2 migration, kept for context)

Before the move to R2, a Bunny-era script (`add-bunny-folder.js`, since
removed) silently inserted new video entries into the wrong array in
`catalog.js` due to an ambiguous string search for the insertion point —
215 already-uploaded videos never appeared on the site, with no error.
`scripts/publish-folder.js` (the current tool) fixes this class of bug
structurally: it locates the `VIDEOS` array explicitly by name, writes a
`.bak` backup before editing, and re-imports the file after writing to
verify the array actually grew by the expected count before declaring
success — auto-restoring the backup if verification fails.
