#!/usr/bin/env node
/**
 * Generate public/The-Best-Porn-AI-in-2026.html from cleaned SSOT.
 * Does not touch the catalog or player.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { appShellHtml, FAVICON_LINKS } from "./lib/site-chrome.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = "https://www.thebestpornai.com";
const CANONICAL = `${ORIGIN}/The-Best-Porn-AI-in-2026`;
const tools = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../src/cluster/tools-ssot.json"), "utf8")
);

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function relAttr(url) {
  return /ourdream|kupid/i.test(url) ? "noopener sponsored nofollow" : "noopener nofollow";
}

const featured = tools
  .filter((t) =>
    ["candy-ai", "xotic-ai", "ourdream-ai", "seduced-ai", "promptchan", "joi-ai"].includes(t.slug)
  )
  .sort((a, b) => Number(b.score) - Number(a.score));

function stars(score) {
  const n = Math.max(1, Math.min(5, Math.round(Number(score) / 2)));
  return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
}

function hasRealReview(t) {
  return Boolean(t.reviewUrl) && !/#directory/.test(t.reviewUrl);
}

function card(t) {
  const tags = (t.tags || []).map((x) => `<span class="tag-item">${esc(x)}</span>`).join("");
  const linked = hasRealReview(t);
  const inner = `
    <div class="tool-header">
      <h3>${esc(t.name)}</h3>
      <div class="tool-rating-box">${esc(t.score)}<span> / 10</span></div>
    </div>
    <span class="tag-item">${esc(t.bestFor || t.category)}</span>
    <p class="tool-desc">${esc(t.desc)}</p>
    <div class="tool-tags">${tags}</div>
    <div class="tool-cta">${linked ? "Open review →" : "Not yet reviewed"}</div>`;
  return linked
    ? `
  <a class="tool-card" href="${esc(t.reviewUrl)}" data-category="${esc(t.category)}" data-name="${esc(t.name)}" data-rating="${esc(t.score)}">${inner}
  </a>`
    : `
  <div class="tool-card" data-category="${esc(t.category)}" data-name="${esc(t.name)}" data-rating="${esc(t.score)}">${inner}
  </div>`;
}

function podiumCard(t, place) {
  const winner = place === 1;
  return `
  <a class="podium-card${winner ? " is-winner" : ""}" href="${esc(t.reviewUrl)}">
    ${winner ? `<span class="winner-ribbon">Winner</span>` : ""}
    <div class="podium-rank">${winner ? "Best rank · #1" : "#" + place}</div>
    <div class="podium-stars" aria-label="${stars(t.score)}">${stars(t.score)}</div>
    <h3 class="podium-name">${esc(t.name)}</h3>
    <div class="podium-score">${esc(t.score)}<span> / 10</span></div>
    <p class="tool-desc">${esc(t.bestFor || t.desc)}</p>
    <div class="tool-cta">${winner ? "See why it won →" : "Read review →"}</div>
  </a>`;
}

const matrixRows = [...tools]
  .sort((a, b) => b.score - a.score)
  .slice(0, 12)
  .map(
    (t) => `<tr>
      <td>${hasRealReview(t) ? `<a href="${esc(t.reviewUrl)}">${esc(t.name)}</a>` : esc(t.name)}</td>
      <td>${esc(t.score)}</td>
      <td>${esc(t.quality)}</td>
      <td>${esc(t.features)}</td>
      <td>${esc(t.customization)}</td>
      <td>${esc(t.privacy)}</td>
      <td>${esc(t.value)}</td>
      <td>${esc(t.bestFor)}</td>
    </tr>`
  )
  .join("");

const HUB_FAQS = [
  {
    q: "What is the best porn AI in 2026?",
    a: "It depends on the job — but our 2026 benchmark crowns OurDream AI #1 overall at 9.8/10, with Candy AI (9.7, best photorealism) and Xotic AI (9.5) completing the podium. If you want finished scenes instead of prompting, thebestpornai itself is the watch library.",
  },
  {
    q: "Who writes and tests these reviews?",
    a: "All scored reviews are written by Anna K., our New York-based reviews editor, from hands-on testing on paid accounts. Each platform is tested for at least 7 days against the six weighted criteria described in the methodology on this page.",
  },
  {
    q: "Is thebestpornai a generator?",
    a: "No. thebestpornai is a curated streaming catalog of finished AI adult video. This page is the create/compare aisle: it ranks third-party generators and companions.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": CANONICAL + "#webpage",
      url: CANONICAL,
      name: "The Best Porn AI in 2026",
      description:
        "Compare the best porn AI tools in 2026: generators, companions, and video. Independent scores plus a watch-library path on thebestpornai.",
      isPartOf: { "@type": "WebSite", name: "thebestpornai", url: ORIGIN + "/" },
      dateModified: new Date().toISOString().slice(0, 10),
      author: {
        "@type": "Person",
        name: "Anna K.",
        url: ORIGIN + "/author/anna-k.html",
      },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: ORIGIN + "/" },
        { "@type": "ListItem", position: 2, name: "The Best Porn AI in 2026", item: CANONICAL },
      ],
    },
    {
      "@type": "ItemList",
      name: "Top rated AI porn tools 2026",
      itemListElement: featured.map((t, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: t.name,
        url: ORIGIN + t.reviewUrl,
      })),
    },
    {
      "@type": "FAQPage",
      mainEntity: HUB_FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

const body = `
<div class="cluster">
  <section>
    <div class="editorial-tag">2026 benchmark · create aisle</div>
    <h1 class="hero-title">The Best Porn AI <span class="text-red">in 2026</span></h1>
    <p class="hero-subtitle">Independent scores for generators and companions. Different channel, different verdicts than our watch-first essays — on purpose. Want heat without a prompt? Stream the catalog.</p>
    <p class="section-desc" style="margin-top:0.5rem">Reviewed by <a href="/author/anna-k.html">Anna K.</a> · <a href="#how-we-test">How we test</a> · Updated August 23, 2026</p>
    <div class="cta-row">
      <a class="btn btn-primary" href="/">Watch free scenes →</a>
      <a class="btn btn-secondary" href="/blog/the-best-porn-ai-2026.html">Watch vs create essay</a>
    </div>
    <div class="search-box-wrapper" style="margin-top:1.25rem">
      <input id="toolSearchInput" type="search" placeholder="Search ${tools.length} platforms…" aria-label="Search tools"/>
    </div>
    <div class="quick-categories">
      <button type="button" class="quick-pill active" data-filter="all">All</button>
      <button type="button" class="quick-pill" data-filter="images">Image</button>
      <button type="button" class="quick-pill" data-filter="videos">Video</button>
      <button type="button" class="quick-pill" data-filter="chats">Chat</button>
      <button type="button" class="quick-pill" data-filter="faceswap">Face swap</button>
      <button type="button" class="quick-pill" data-filter="undress">Undress</button>
    </div>
    <div class="hero-stats">
      <div class="stat-item"><h4>${esc(featured[0]?.score || "9.9")}<span>/10</span></h4><p>Top score this channel</p></div>
      <div class="stat-item"><h4>${tools.length}</h4><p>Platforms listed</p></div>
      <div class="stat-item"><h4>2</h4><p>Editorial channels</p></div>
      <div class="stat-item"><h4>18+</h4><p>Adult only</p></div>
    </div>
  </section>

  <section id="ranking" class="section-wrapper">
    <div class="editorial-tag">Podium</div>
    <h2 class="section-title">The winner and top 3</h2>
    <p class="section-desc">Highest scores in this channel. The middle card is #1. Tap a card to open the full review.</p>
    <div class="podium">
      ${podiumCard(featured[1] || featured[0], 2)}
      ${podiumCard(featured[0], 1)}
      ${podiumCard(featured[2] || featured[0], 3)}
    </div>
  </section>

  <section id="comparison" class="section-wrapper">
    <div class="editorial-tag">Matrix</div>
    <h2 class="section-title">Compare top tools</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Tool</th><th>Score</th><th>Quality</th><th>Features</th><th>Custom</th><th>Privacy</th><th>Value</th><th>Best for</th></tr></thead>
        <tbody>${matrixRows}</tbody>
      </table>
    </div>
  </section>

  <section id="directory" class="section-wrapper">
    <div class="editorial-tag">Directory</div>
    <h2 class="section-title">${tools.length} platforms</h2>
    <div class="tool-grid" id="toolGrid">${tools.map(card).join("")}</div>
  </section>

  <section id="how-we-test" class="section-wrapper">
    <div class="editorial-tag">Methodology</div>
    <h2 class="section-title">How we test</h2>
    <p class="section-desc">Every scored platform is tested hands-on by <a href="/author/anna-k.html">Anna K.</a> on a paid account for a minimum of 7 days — never from marketing pages or press kits. Scores are a weighted average of six criteria:</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Criterion</th><th>Weight</th><th>What we measure</th></tr></thead>
        <tbody>
          <tr><td>Visual Quality &amp; Fidelity</td><td>30%</td><td>Anatomy accuracy, skin texture, identity consistency across poses and angles</td></tr>
          <tr><td>Conversational Depth &amp; Memory</td><td>20%</td><td>Multi-day context retention, personality drift, escalation control</td></tr>
          <tr><td>Customization Depth</td><td>15%</td><td>Character creator granularity, body and style controls, scenario options</td></tr>
          <tr><td>Privacy &amp; Data Security</td><td>15%</td><td>Billing descriptors, deletion paths, log and retention policies</td></tr>
          <tr><td>Pricing &amp; Credit Value</td><td>10%</td><td>Real cost per usable image, video clip, or chat session</td></tr>
          <tr><td>UX &amp; Generation Latency</td><td>10%</td><td>Queue times, interface friction, mobile browser behavior</td></tr>
        </tbody>
      </table>
    </div>
    <p class="section-desc">Testing includes fresh characters per platform, identical prompt sets for image and video comparisons, and privacy verification against each platform's live billing and deletion flows. Outbound links on this site — including links to our top pick — may earn affiliate commission; the disclosure appears on every review. Platforms without a published full review carry a directory score only and are marked "Not yet reviewed."</p>
  </section>

  <section id="hub-faq" class="section-wrapper">
    <div class="editorial-tag">FAQ</div>
    <h2 class="section-title">Frequently asked questions</h2>
    <div class="faq-list">
      ${HUB_FAQS.map(
        (f) => `<div class="faq-item">
          <div class="faq-q">${esc(f.q)}</div>
          <div class="faq-a">${esc(f.a)}</div>
        </div>`
      ).join("\n      ")}
    </div>
  </section>

  <section class="watch-callout">
    <h2>Already know what you want to watch?</h2>
    <p>Skip the credit grind. House scenes and Shorts stay on the player — this page does not change playback.</p>
    <div class="cta-row">
      <a class="btn btn-primary" href="/">Open the catalog</a>
      <a class="btn btn-secondary" href="/shorts">Shorts</a>
      <a class="btn btn-secondary" href="/blog/">Editorial &amp; guides</a>
    </div>
  </section>
</div>
<script>
(function(){
  var input = document.getElementById("toolSearchInput");
  var grid = document.getElementById("toolGrid");
  if(!input || !grid) return;
  var pills = document.querySelectorAll(".quick-pill");
  var filter = "all";
  function apply(){
    var q = (input.value || "").toLowerCase().trim();
    grid.querySelectorAll(".tool-card").forEach(function(card){
      var cat = card.getAttribute("data-category") || "";
      var name = (card.getAttribute("data-name") || "") + " " + (card.textContent || "");
      var okCat = filter === "all" || cat === filter;
      var okQ = !q || name.toLowerCase().indexOf(q) !== -1;
      card.hidden = !(okCat && okQ);
    });
  }
  input.addEventListener("input", apply);
  pills.forEach(function(p){
    p.addEventListener("click", function(){
      pills.forEach(function(x){ x.classList.remove("active"); });
      p.classList.add("active");
      filter = p.getAttribute("data-filter") || "all";
      apply();
    });
  });
})();
</script>
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
  <title>The Best Porn AI in 2026 — Compare Tools | thebestpornai</title>
  <meta name="description" content="The best porn AI in 2026: compare 42 generators and companions. Independent scores, reviews, and a path to watch finished scenes free."/>
  <meta name="robots" content="index, follow, max-image-preview:large"/>
  <meta name="rating" content="RTA-5042-1996-1400-1577-RTA"/>
  <meta name="theme-color" content="#0A0A0A"/>
  <link rel="canonical" href="${CANONICAL}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:site_name" content="thebestpornai"/>
  <meta property="og:title" content="The Best Porn AI in 2026"/>
  <meta property="og:description" content="Compare the best porn AI tools in 2026. Generators, companions, and a watch library."/>
  <meta property="og:url" content="${CANONICAL}"/>
  <meta property="og:image" content="${ORIGIN}/logo-wordmark.png"/>
  <meta name="twitter:card" content="summary_large_image"/>
  ${FAVICON_LINKS}
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="/src/shared/theme.css"/>
  <link rel="stylesheet" href="/app-shell.css"/>
  <link rel="stylesheet" href="/cluster.css"/>
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
${appShellHtml("blog", body)}
</body>
</html>
`;

const out = path.join(__dirname, "../public/The-Best-Porn-AI-in-2026.html");
fs.writeFileSync(out, html);
console.log("wrote", out, "tools", tools.length);
