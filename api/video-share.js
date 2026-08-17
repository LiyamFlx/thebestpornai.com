import { VIDEOS } from "../src/shared/catalog-videos.js";
import { isoUploadDate } from "../src/shared/dates.js";
import { playPath } from "../src/shared/public-routes.js";

const ORIGIN = "https://www.thebestpornai.com";
const MEDIA_BASE = "https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev/media";
const LOGO = `${ORIGIN}/logo.png`;

function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mediaUrl(src) {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  const rel = src.replace(/^(\.\.\/)?media\//, "");
  const path_ = rel.split("/").map(encodeURIComponent).join("/");
  return MEDIA_BASE.replace(/\/$/, "") + "/" + path_;
}

export default function handler(req, res) {
  const { id } = req.query;
  const videoId = parseInt(id, 10);
  const v = Number.isInteger(videoId) ? VIDEOS.find((item) => item.id === videoId) : null;

  if (!v) {
    // Video not found fallback
    const fallbackHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>thebestpornai — AI Porn &amp; Adult Streaming</title>
  <meta name="description" content="Stream thousands of high-definition AI-generated porn videos and clips."/>
  <meta property="og:title" content="thebestpornai — AI Porn &amp; Adult Streaming"/>
  <meta property="og:description" content="Stream thousands of high-definition AI-generated porn videos and clips."/>
  <meta property="og:image" content="${LOGO}"/>
  <meta property="og:url" content="${ORIGIN}"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta http-equiv="refresh" content="0; url=/"/>
  <script>window.location.replace("/");</script>
</head>
<body style="background:#0b0c10;color:#fff;font-family:sans-serif;text-align:center;padding:40px">
  <p>Redirecting to <a href="/" style="color:#E50914">thebestpornai.com</a>...</p>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(fallbackHtml);
  }

  const title = v.title || "AI Video";
  const desc = v.desc || `Watch ${title} in 4K on thebestpornai.`;
  const thumbUrl = v.thumb ? mediaUrl(v.thumb) : LOGO;
  const videoStreamUrl = v.src ? mediaUrl(v.src) : "";
  const shareUrl = `${ORIGIN}/v/${v.id}`;
  const directWatchUrl = `${ORIGIN}${playPath(v)}`;
  const embedUrl = `${ORIGIN}${playPath(v)}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": title,
    "description": desc,
    "thumbnailUrl": [thumbUrl],
    "uploadDate": isoUploadDate(v.uploaded),
    "url": `${ORIGIN}/video/${v.id}.html`,
    "contentUrl": videoStreamUrl || `${ORIGIN}/video/${v.id}.html`,
    "embedUrl": embedUrl,
    "publisher": {
      "@type": "Organization",
      "name": "thebestpornai",
      "logo": {
        "@type": "ImageObject",
        "url": LOGO
      }
    }
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(title)} — thebestpornai</title>
  <meta name="description" content="${esc(desc)}"/>
  <link rel="canonical" href="${shareUrl}"/>
  
  <!-- OpenGraph Metadata (Discord, Telegram, WhatsApp, Facebook, iMessage) -->
  <meta property="og:site_name" content="thebestpornai"/>
  <meta property="og:type" content="video.other"/>
  <meta property="og:title" content="${esc(title)}"/>
  <meta property="og:description" content="${esc(desc)}"/>
  <meta property="og:url" content="${shareUrl}"/>
  <meta property="og:image" content="${thumbUrl}"/>
  <meta property="og:image:secure_url" content="${thumbUrl}"/>
  <meta property="og:image:type" content="image/jpeg"/>
  <meta property="og:image:width" content="1280"/>
  <meta property="og:image:height" content="720"/>
  ${videoStreamUrl ? `
  <meta property="og:video" content="${videoStreamUrl}"/>
  <meta property="og:video:secure_url" content="${videoStreamUrl}"/>
  <meta property="og:video:type" content="video/mp4"/>
  <meta property="og:video:width" content="1280"/>
  <meta property="og:video:height" content="720"/>` : ""}

  <!-- Twitter Player Card Metadata (Twitter/X) -->
  <meta name="twitter:card" content="player"/>
  <meta name="twitter:site" content="@thebestpornai"/>
  <meta name="twitter:title" content="${esc(title)}"/>
  <meta name="twitter:description" content="${esc(desc)}"/>
  <meta name="twitter:image" content="${thumbUrl}"/>
  <meta name="twitter:player" content="${embedUrl}"/>
  <meta name="twitter:player:width" content="1280"/>
  <meta name="twitter:player:height" content="720"/>

  <!-- Schema.org JSON-LD -->
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>

  <!-- Instant Client-Side Redirect to Web App Player -->
  <meta http-equiv="refresh" content="0; url=${directWatchUrl}"/>
  <script>
    if (!/bot|crawler|spider|facebookexternalhit|twitterbot|discordbot|telegrambot|whatsapp/i.test(navigator.userAgent)) {
      window.location.replace("${directWatchUrl}");
    }
  </script>

  <style>
    body {
      background: #0A0A0A;
      color: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      background: #141414;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      max-width: 480px;
      width: 100%;
      overflow: hidden;
      box-shadow: 0 12px 32px rgba(0,0,0,0.5);
      text-align: center;
    }
    .thumb-wrap {
      position: relative;
      aspect-ratio: 16/9;
      background: #000;
    }
    .thumb-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .play-btn {
      position: absolute;
      inset: 0;
      margin: auto;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(229,9,20,0.92);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      text-decoration: none;
    }
    .info {
      padding: 24px;
    }
    h1 {
      font-size: 18px;
      margin: 0 0 8px;
      color: #fff;
    }
    p {
      font-size: 13px;
      color: #8c93a0;
      margin: 0 0 20px;
    }
    .btn {
      display: inline-block;
      background: #E50914;
      color: #fff;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="thumb-wrap">
      <img src="${thumbUrl}" alt="${esc(title)}"/>
      <a class="play-btn" href="${directWatchUrl}">▶</a>
    </div>
    <div class="info">
      <h1>${esc(title)}</h1>
      <p>${esc(desc)}</p>
      <a class="btn" href="${directWatchUrl}">Watch in Full Player</a>
    </div>
  </div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).send(html);
}
