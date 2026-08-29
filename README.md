# thebestpornai.com — StreamHub Video Platform & SEO Engine

A self-contained, high-performance web platform featuring three unified web apps sharing a single catalog, design system, and serverless backend:

* **Viewer**: Full-featured adult video streaming SPA (browse, watch, search, favorites, playlists, comments, vertical Shorts, and mobile PWA).
* **Creator Studio**: Video upload wizard, video analytics, subscriber metrics, and channel manager.
* **Platform Manager**: Administrative dashboard for content moderation, system infrastructure, and homepage configuration.
* **SEO & Content Engine**: Static route generator producing crawlable, schema-enriched landing pages for blog posts, creator profiles, category hubs, and video pages.

Live at **[https://www.thebestpornai.com](https://www.thebestpornai.com)**.

---

## 🚀 App Suite Overview

| App | Entry Point | Route | Primary Role |
| :--- | :--- | :--- | :--- |
| **Viewer** | `index.html` | `/` | Main video discovery, playback, comments, & social interactions |
| **Creator Studio** | `creator/index.html` | `/creator/` | Multi-file direct upload, channel customization, and metrics |
| **Platform Manager** | `manager/index.html` | `/manager/` | Moderation queue, user management, and catalog controls |
| **Persona Picker** | `choose.html` | `/choose.html` | Switch between Viewer, Creator, and Manager personas |

---

## ⚡ Tech Stack & Architecture

- **Frontend**: Vanilla JavaScript (ES Modules), Custom CSS Design System, Responsive HTML5 Video & PWA support.
- **Bundler & Dev Server**: [Vite](https://vitejs.dev/) with code splitting and multi-page entry points.
- **Backend & Hosting**: **Vercel** (Serverless Node functions & client hosting).
- **Media CDN & Storage**: **Cloudflare R2** (`streamhub-media` bucket) for videos, posters, and thumbnails.
- **Database & Auth**: **Supabase** (PostgREST API for persistent likes, comments, views, and authentication).
- **Testing**: Built-in Node.js native test runner (`node --test`), catalog ID integrity checks, and regression suite.

```
thebestpornai.com ──► Vercel (HTML/JS Pages & Serverless APIs in api/)
media requests    ──► Cloudflare R2 Bucket (streamhub-media)
data persistence  ──► Supabase PostgREST (likes, views, comments, auth)
```

---

## 📁 Repository Structure

```
├── api/                    # Vercel Serverless Functions
│   ├── attest.js           # Rights & age attestation verification
│   ├── presign.js          # Direct-to-R2 presigned upload URL generator
│   ├── verify-upload.js    # SHA-256 byte verification & CSAM screening
│   ├── save-upload.js      # Manifest & upload record persistence
│   └── engage.js           # Server-side engagement handling (likes/comments)
├── src/
│   ├── shared/             # Single Source of Truth
│   │   ├── catalog.js      # Core catalog state, mediaUrl() resolver, & helpers
│   │   ├── catalog-videos.js # ~5k Video entries (lazily code-split)
│   │   ├── taxonomy.js     # Taxonomy, tags, categories definition
│   │   ├── streamhub-api.js# Supabase REST client wrapper
│   │   └── ui.js           # Shared component templates (videoCard, playerEmbed)
│   ├── viewer/             # Main video streaming app logic & pages
│   ├── creator/            # Creator studio logic & upload UI
│   ├── manager/            # Admin manager dashboard
│   └── upload/             # Dynamic live upload overlay integration
├── scripts/                # Build, Publish, & SEO Generators
│   ├── publish-folder.js   # Bulk publishing script (uploads to R2, extracts posters, updates catalog)
│   ├── gen-static-routes.js# Generates static SEO pages for /pornstars/, /categories/, /video/
│   ├── gen-blog-posts.js   # Compiles markdown & JSON blog posts to /blog/*.html
│   ├── gen-sitemap.js      # Generates sitemap.xml and sitemap-video.xml
│   └── upload-catalog-to-r2.js # R2 asset sync tool
├── tools/                  # Internal Content Manager GUI ("Writer")
├── blog/                   # Generated static blog pages
├── pornstars/              # Generated static creator/star landing pages
└── categories/             # Generated static category hub pages
```

---

## 🛠️ Development & Workflow

### 1. Installation & Local Development

```bash
# Install dependencies
npm install

# Start Vite local development server
npm run dev
```

During local development, `MEDIA_BASE` points directly to the Cloudflare R2 bucket dev URL, enabling full video playback without needing local `.mp4` media files.

### 2. Running Tests & Quality Suite

```bash
# Run catalog ID checks, publication diagnostics, unit tests, and regression suite
npm test

# Run regression test suite only
npm run test:regression
```

### 3. Building for Production

```bash
# Run all pre-build generators and Vite production compilation
npm run build
```

The build pipeline automatically executes all content generators (`gen-author`, `gen-local-webp`, `gen-cluster-hub`, `gen-blog-posts`, `gen-static-routes`, `gen-sitemap`) before compiling static client assets via Vite.

---

## 📹 Video Publishing Pipeline

Media files (`.mp4`) live exclusively on Cloudflare R2 and are ignored from Git via `.gitignore` / `.vercelignore`.

### Bulk Folder Publish (Recommended)

To publish a folder of raw videos:

```bash
# Dry run to inspect files and category matching without modifying state
npm run publish -- "media/<folder_name>" --category "AI" --dry-run

# Publish folder: uploads missing videos to R2, generates posters, and updates catalog-videos.js
npm run publish -- "media/<folder_name>" --category "AI" --tags "POV,Babe"

# Run publication health doctor to verify catalog IDs and media coverage
npm run publish:doctor
```

### Poster Thumbnail Backfill

```bash
# Check for catalog entries missing poster images
npm run posters -- --dry-run

# Generate frame thumbnails with ffmpeg, upload to R2, and assign `thumb` properties
npm run posters
```

---

## 🌐 Serverless APIs & Database Integration

The Vercel Serverless Function endpoints in `api/` provide secure backend capability:
- **`presign.js`**: Grants short-lived S3 PUT URLs so browsers upload files directly to Cloudflare R2 without hitting serverless payload size limits.
- **`verify-upload.js`**: Performs server-side byte hashing (SHA-256), duplicate check, and compliance verification.
- **`save-upload.js`**: Merges newly verified user uploads into the live catalog manifest.
- **`engage.js`**: Rate-limits and processes likes, comments, and views.

For complete deployment details, R2 bucket credentials, and production maintenance guidelines, see [`CLAUDE.md`](CLAUDE.md).

---

## 📄 License & Notes

- Site Code: Private / Proprietary
- Media Assets: Hosted on Cloudflare R2 (`streamhub-media` bucket)
- Site URL: [https://www.thebestpornai.com](https://www.thebestpornai.com)
