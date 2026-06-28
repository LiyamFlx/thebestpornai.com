# StreamHub — Hybrid Video Platform

Three independent web applications that share one design system and data model,
simulating a premium hybrid video platform (YouTube + Netflix style).

| App | File | Role |
|-----|------|------|
| **Viewer** | `viewer/viewer-app.html` | Premium streaming experience — browse, watch, favorite, comment, playlists |
| **Creator Studio** | `creator/creator-studio.html` | Upload wizard, analytics, revenue, subscribers, AI tools, APIs |
| **Platform Manager** | `manager/platform-manager.html` | The company OS — users, moderation, recommendations, homepage builder, infra & governance |

Start from **`index.html`** — a persona selector linking to all three.

## Run it

**Mac:** double-click `Start.command` · **Windows:** double-click `Start.bat`

Either launcher serves the folder locally and opens the persona selector in your
browser (a local server gives smooth video playback). Requires Python 3
(preinstalled on macOS).

You can also open any `*.html` directly, but video scrubbing is smoother via the launcher.

## Architecture

The three apps are **self-contained HTML** — the shared design system and data
are inlined at build time, so each file opens on its own.

```
index.html                      Persona selector
viewer/   creator/   manager/   The three apps + their *.src.html sources
media/                          Shared video files (not committed — see media/README.md)
_shared.css                     Design system: colors, components, layout
_data.js                        Sample data model + shared components/helpers
build.js                        Inlines _shared.css + _data.js into each app
```

### Editing

Edit `_shared.css` (design) or `_data.js` (data/components), or the per-app
`*.src.html` sources, then rebuild:

```bash
node build.js
```

This regenerates the three self-contained app files. The shared design system
means a single change propagates to all three apps — no drift.

## Notes

- **Videos are not included in this repo** (`.gitignore`). Add your own `.mp4`
  files to `media/` — see [`media/README.md`](media/README.md).
- Design language: dark theme, red accent (`#E50914`), white text — one cohesive
  ecosystem across all three personas.
