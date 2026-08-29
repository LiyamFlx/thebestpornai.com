#!/usr/bin/env node
/**
 * Generate author/anna-k.html — E-E-A-T author profile for Google search
 * credibility and reader transparency.
 *
 * Run: node scripts/gen-author.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { FAVICON_LINKS, appShellHtml } from "./lib/site-chrome.mjs";
import { POSTS } from "../src/blog/posts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const AUTHOR_DIR = path.join(REPO, "author");
const ORIGIN = "https://www.thebestpornai.com";

fs.mkdirSync(AUTHOR_DIR, { recursive: true });

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function generateAuthorPage() {
  const reviews = POSTS.filter(
    (p) => p.category === "Reviews" || p.slug.includes("review") || p.slug.includes("ranking")
  ).slice(0, 6);

  const guides = POSTS.filter(
    (p) => p.category === "Guides" && !p.slug.includes("review")
  ).slice(0, 6);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": ORIGIN + "/" },
          { "@type": "ListItem", "position": 2, "name": "Authors", "item": ORIGIN + "/blog/" },
          { "@type": "ListItem", "position": 3, "name": "Anna K.", "item": ORIGIN + "/author/anna-k.html" }
        ]
      },
      {
        "@type": "Person",
        "@id": `${ORIGIN}/author/anna-k.html#person`,
        "name": "Anna K.",
        "jobTitle": "Reviews Editor & Adult AI Benchmark Lead",
        "worksFor": {
          "@type": "Organization",
          "name": "thebestpornai",
          "url": ORIGIN
        },
        "description": "Reviews editor at thebestpornai specializing in generative media benchmarks, companion AI memory evaluation, prompt compliance, and data privacy audits.",
        "url": `${ORIGIN}/author/anna-k.html`,
        "sameAs": [
          `${ORIGIN}/The-Best-Porn-AI-in-2026#how-we-test`
        ]
      }
    ]
  };

  const bodyContent = `
  <div class="cluster-page author-page" style="max-width:980px;margin:0 auto;padding:24px 16px 64px;">
    <!-- Breadcrumb -->
    <nav class="breadcrumb" aria-label="Breadcrumb" style="display:flex;align-items:center;gap:8px;font-size:13px;color:#8c93a0;margin-bottom:24px;">
      <a href="/" style="color:#8c93a0;text-decoration:none;">Home</a>
      <span>/</span>
      <a href="/blog/" style="color:#8c93a0;text-decoration:none;">Blog</a>
      <span>/</span>
      <span style="color:#fff;">Anna K.</span>
    </nav>

    <!-- Author Profile Header -->
    <header class="author-header" style="background:#111116;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px 24px;margin-bottom:36px;display:flex;flex-direction:column;gap:20px;">
      <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
        <div class="bp-avatar bp-avatar--lg" style="width:76px;height:76px;border-radius:50%;background:linear-gradient(135deg,#ff2d55,#9b51e0);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:#fff;box-shadow:0 8px 24px rgba(255,45,85,0.3);">AK</div>
        <div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
            <h1 style="font-size:28px;font-weight:800;color:#fff;margin:0;">Anna K.</h1>
            <span style="display:inline-flex;align-items:center;gap:4px;background:rgba(255,45,85,0.12);color:#ff2d55;border:1px solid rgba(255,45,85,0.3);font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;">✓ Verified Editor</span>
          </div>
          <p style="font-size:15px;color:#a1a1aa;margin:0;">Reviews Editor &amp; Adult AI Benchmark Lead at thebestpornai</p>
        </div>
      </div>
      <p style="font-size:15px;line-height:1.6;color:#d4d4d8;margin:0;max-width:780px;">
        Anna leads benchmarking, reverse-prompt evaluation, and long-term memory audits across 40+ generative adult AI platforms and companion chat engines. Every tool reviewed on this site is tested hands-on on a paid account for a minimum of 7 days before receiving a final score.
      </p>
    </header>

    <!-- Testing Methodology & Ethics -->
    <section style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:28px;margin-bottom:40px;">
      <h2 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 16px;">Editorial &amp; Testing Methodology</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;">
        <div style="background:#0e0e12;padding:18px;border-radius:12px;border:1px solid rgba(255,255,255,0.05);">
          <strong style="color:#ff2d55;display:block;font-size:14px;margin-bottom:6px;">1. Paid-Tier Testing Protocol</strong>
          <p style="font-size:13.5px;color:#a1a1aa;line-height:1.5;margin:0;">We never score platforms based on free trials or marketing claims. All evaluations are conducted on active paid tiers to test real GPU queue speeds, uncensored filters, and 4K diffusion output.</p>
        </div>
        <div style="background:#0e0e12;padding:18px;border-radius:12px;border:1px solid rgba(255,255,255,0.05);">
          <strong style="color:#ff2d55;display:block;font-size:14px;margin-bottom:6px;">2. Multi-Session Memory Probes</strong>
          <p style="font-size:13.5px;color:#a1a1aa;line-height:1.5;margin:0;">Companion models are tested over 7+ consecutive days with seeded conversational details (inside jokes, relationship milestones) to measure authentic context retention vs marketing hype.</p>
        </div>
        <div style="background:#0e0e12;padding:18px;border-radius:12px;border:1px solid rgba(255,255,255,0.05);">
          <strong style="color:#ff2d55;display:block;font-size:14px;margin-bottom:6px;">3. Privacy &amp; Anonymity Verification</strong>
          <p style="font-size:13.5px;color:#a1a1aa;line-height:1.5;margin:0;">Every tool is audited for discreet billing descriptors, SSL encryption standards, and live account/chat deletion compliance before being recommended.</p>
        </div>
      </div>
      <div style="margin-top:20px;text-align:right;">
        <a href="/The-Best-Porn-AI-in-2026#how-we-test" style="color:#ff2d55;font-size:13.5px;font-weight:600;text-decoration:none;">Read full testing framework &amp; score weights &rarr;</a>
      </div>
    </section>

    <!-- Top Reviews by Anna K. -->
    <section style="margin-bottom:40px;">
      <h2 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 18px;">Latest Benchmark Reviews by Anna</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">
        ${reviews
          .map(
            (p) => `
          <a href="/blog/${esc(p.slug)}.html" style="background:#111116;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:18px;text-decoration:none;display:flex;flex-direction:column;justify-content:space-between;transition:border-color .15s ease;" onmouseover="this.style.borderColor='#ff2d55'" onmouseout="this.style.borderColor='rgba(255,255,255,0.08)'">
            <div>
              <span style="display:inline-block;font-size:11px;font-weight:700;color:#ff2d55;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">${esc(p.category || "Review")}</span>
              <h3 style="font-size:15.5px;font-weight:700;color:#fff;margin:0 0 8px;line-height:1.35;">${esc(p.title)}</h3>
              <p style="font-size:13px;color:#8c93a0;line-height:1.45;margin:0 0 12px;">${esc(p.excerpt?.slice(0, 110))}…</p>
            </div>
            <span style="font-size:12px;color:#ff2d55;font-weight:600;">Read review &rarr;</span>
          </a>
        `
          )
          .join("")}
      </div>
    </section>

    <!-- Top Guides by Anna K. -->
    <section style="margin-bottom:40px;">
      <h2 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 18px;">Essential Buyer Guides by Anna</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">
        ${guides
          .map(
            (p) => `
          <a href="/blog/${esc(p.slug)}.html" style="background:#111116;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:18px;text-decoration:none;display:flex;flex-direction:column;justify-content:space-between;transition:border-color .15s ease;" onmouseover="this.style.borderColor='#ff2d55'" onmouseout="this.style.borderColor='rgba(255,255,255,0.08)'">
            <div>
              <span style="display:inline-block;font-size:11px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">${esc(p.category || "Guide")}</span>
              <h3 style="font-size:15.5px;font-weight:700;color:#fff;margin:0 0 8px;line-height:1.35;">${esc(p.title)}</h3>
              <p style="font-size:13px;color:#8c93a0;line-height:1.45;margin:0 0 12px;">${esc(p.excerpt?.slice(0, 110))}…</p>
            </div>
            <span style="font-size:12px;color:#3b82f6;font-weight:600;">Read guide &rarr;</span>
          </a>
        `
          )
          .join("")}
      </div>
    </section>

    <!-- Leaderboard CTA -->
    <div style="background:linear-gradient(135deg,rgba(255,45,85,0.12),rgba(155,81,224,0.12));border:1px solid rgba(255,45,85,0.3);border-radius:16px;padding:28px;text-align:center;">
      <h3 style="font-size:20px;font-weight:800;color:#fff;margin:0 0 10px;">Explore the Complete 2026 Benchmark Leaderboard</h3>
      <p style="font-size:14px;color:#a1a1aa;margin:0 0 18px;max-width:540px;margin-left:auto;margin-right:auto;">
        See how all 42 adult AI generators, sex chat apps, and diffusion engines scored across quality, memory, prompt control, and pricing.
      </p>
      <a href="/The-Best-Porn-AI-in-2026" class="btn btn-primary" style="display:inline-block;background:#ff2d55;color:#fff;padding:10px 24px;border-radius:8px;font-weight:700;text-decoration:none;">View 2026 Rankings &rarr;</a>
    </div>
  </div>
  `;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Anna K. — Reviews Editor &amp; Adult AI Benchmark Lead | thebestpornai</title>
<meta name="description" content="Meet Anna K., Reviews Editor at thebestpornai. Dedicated 7-day paid testing protocol, ethical guidelines, and in-depth benchmarks of 40+ adult generative AI platforms."/>
<meta name="theme-color" content="#0A0A0A"/>
<link rel="canonical" href="${ORIGIN}/author/anna-k.html"/>
${FAVICON_LINKS}
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link rel="preconnect" href="https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev" crossorigin/>
<meta property="og:type" content="profile"/>
<meta property="og:site_name" content="thebestpornai"/>
<meta property="og:title" content="Anna K. — Reviews Editor &amp; Adult AI Benchmark Lead"/>
<meta property="og:description" content="Meet Anna K., Reviews Editor at thebestpornai. Dedicated 7-day paid testing protocol, ethical guidelines, and in-depth benchmarks of 40+ adult generative AI platforms."/>
<meta property="og:url" content="${ORIGIN}/author/anna-k.html"/>
<meta property="og:image" content="${ORIGIN}/logo.png"/>
<meta name="twitter:card" content="summary"/>
<meta name="twitter:title" content="Anna K. — Reviews Editor &amp; Adult AI Benchmark Lead"/>
<meta name="twitter:description" content="Reviews Editor at thebestpornai specializing in generative adult AI platforms and companion memory benchmarks."/>
<meta name="twitter:image" content="${ORIGIN}/logo.png"/>
<meta name="robots" content="index,follow"/>
<script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
</script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="/src/shared/theme.css"/>
<link rel="stylesheet" href="/app-shell.css"/>
<link rel="stylesheet" href="/site-chrome.css"/>
<link rel="stylesheet" href="/cluster.css"/>
</head>
<body class="blog-body cluster-ui">
${appShellHtml("blog", bodyContent)}
</body>
</html>
`;

  fs.writeFileSync(path.join(AUTHOR_DIR, "anna-k.html"), html, "utf8");
  console.log("wrote author/anna-k.html (E-E-A-T profile page)");
}

generateAuthorPage();
