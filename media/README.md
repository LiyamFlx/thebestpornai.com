# media/

Video files are **not** tracked in this repository — `.gitignore` excludes
`media/**/*.mp4` (and `.vercelignore` excludes `media/*.mp4`). The only
tracked videos are the royalty-free `media/sample-*.mp4` used for local
placeholder playback.

**Real videos live on Bunny storage (zone `streamhub-media`), not here.**
This local `media/` folder is not what the deployed site reads from —
`MEDIA_BASE` in `src/shared/catalog.js` always points at the Bunny CDN
(`https://streamhub-media.b-cdn.net`), so playback works locally too without
any files present here.

## To actually add a video to the site

This is the step that has silently gone wrong before — follow it exactly.
Full detail lives in `../CLAUDE.md` under "Adding videos"; short version:

1. **Upload the `.mp4` to Bunny storage** (dashboard, or PUT to
   `https://storage.bunnycdn.com/streamhub-media/...`).
2. **List the storage zone and copy the exact filename** — do not guess or
   assume sequential numbering. Filenames with spaces, gaps in numbering
   (`00016`/`00018` skipped, etc.) are common.
   ```bash
   curl -s -H "AccessKey: $BUNNY_STORAGE_KEY" -H "Accept: application/json" \
     "https://storage.bunnycdn.com/streamhub-media/"
   ```
3. **Add an entry to `DATA.videos` in `src/shared/catalog.js`** — the single
   source of truth, imported by all three apps. The catalog `src` field must
   exactly match the Bunny filename (`mediaUrl()` URL-encodes it automatically,
   including subfolders).
4. **Verify the CDN URL resolves before deploying**:
   ```bash
   curl -sI "https://streamhub-media.b-cdn.net/<urlencoded filename>"
   ```
5. `npm run build`, then `npm run deploy:apply`, then **purge the Bunny Pull
   Zone cache** (30-day TTL — the #1 cause of "I uploaded but it's not live").

## Known incident: `scripts/add-bunny-folder.js --patch` silently corrupting the catalog

On 2026-07-09, three whole folders of already-uploaded Bunny videos (215
files total, one batch sitting unused for 11 days) never appeared on the
site. Root cause: `add-bunny-folder.js`'s `--patch` mode located the
insertion point with `content.lastIndexOf('  ],')` over the *entire*
`catalog.js` file — which finds whichever array happens to close last in the
file text (the `users:` array, immediately before `flags:`), **not**
`DATA.videos` specifically. Every run silently inserted new video entries
into `DATA.flags` instead, where nothing reads them — no error, no visible
symptom other than the homepage's video count never moving.

The script now locates `videos: [` explicitly and inserts before *that*
array's own closing bracket. But **always sanity-check after running
`--patch`**, whether using the script or editing by hand:

```bash
node -e "
const fs = require('fs');
const src = fs.readFileSync('src/shared/catalog.js', 'utf8')
  .replace('const DATA = {', 'global.DATA = {')
  .replace(/export \{[^}]*\};?\s*\$/, '');
eval(src);
console.log('videos:', DATA.videos.length);
console.log('flags:', DATA.flags.length);   // should stay 5 unless you intentionally changed a flag
"
```

If `videos:` didn't grow by the number of files you added, or `flags:` grew
at all, the insertion landed in the wrong place — stop and inspect the diff
before building/deploying.
