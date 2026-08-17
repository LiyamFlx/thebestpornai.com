/** Shared header / footer / favicons for crawlable HTML pages. */

export const FAVICON_LINKS = `
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png"/>
<link rel="icon" type="image/png" sizes="64x64" href="/favicon-64.png"/>
<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
<link rel="manifest" href="/site.webmanifest"/>
`.trim();

export function sharedHeaderHtml(activeNav = "") {
  const on = (id) => (activeNav === id ? " active" : "");
  return `
  <header class="site-header">
    <div class="site-header-inner">
      <a class="site-brand" href="/" aria-label="thebestpornai home">
        <img class="site-brand-img" src="/logo-wordmark.png" alt="thebestpornai" width="160" height="24"/>
      </a>
      <nav class="site-nav" aria-label="Primary">
        <a class="site-nav-link${on("home")}" href="/">Home</a>
        <a class="site-nav-link${on("pornstars")}" href="/pornstars/">AI Pornstars</a>
        <a class="site-nav-link${on("categories")}" href="/categories/">Categories</a>
        <a class="site-nav-link${on("blog")}" href="/blog/"${activeNav === "blog" ? ' aria-current="page"' : ""}>Editorial &amp; Guides</a>
      </nav>
      <div class="site-header-actions">
        <a class="btn-primary" href="/search">Search videos</a>
      </div>
    </div>
  </header>`;
}

const ICO = {
  home: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9"/></svg>`,
  shorts: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z"/></svg>`,
  save: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.5L5 21V4.5a1 1 0 0 1 1-1Z"/></svg>`,
  subs: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M8 3h8"/></svg>`,
  explore: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="m15 9-3.5 6.5L8 12l3.5-6.5L15 9Z"/></svg>`,
  you: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></svg>`,
  comment: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/></svg>`,
  search: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`,
};

export function appShellHtml(activeNav, bodyContent) {
  const on = (id) => (activeNav === id ? " active" : "");
  return `
<div class="app">
  <aside class="sidebar">
    <a class="brand" href="/" aria-label="thebestpornai home"><img src="/favicon-64.png" width="32" height="32" alt="thebestpornai"/></a>
    <nav class="nav" aria-label="Primary">
      <a href="/" class="${on("home")}" aria-label="Home"${activeNav === "home" ? ' aria-current="page"' : ""}>${ICO.home}<span class="nav-label">Home</span></a>
      <a href="/shorts" aria-label="Shorts">${ICO.shorts}<span class="nav-label">Shorts</span></a>
      <a href="/library" aria-label="Library">${ICO.save}<span class="nav-label">Library</span></a>
      <a href="/subscriptions" aria-label="Subscriptions">${ICO.subs}<span class="nav-label">Subs</span></a>
      <a href="/explore" aria-label="Explore">${ICO.explore}<span class="nav-label">Explore</span></a>
      <a href="/pornstars/" class="${on("pornstars")}" aria-label="Pornstars"${activeNav === "pornstars" ? ' aria-current="page"' : ""}>${ICO.you}<span class="nav-label">Stars</span></a>
      <a href="/blog/" class="nav-link-out${on("blog")}" aria-label="Blog"${activeNav === "blog" ? ' aria-current="page"' : ""}>${ICO.comment}<span class="nav-label">Blog</span></a>
    </nav>
  </aside>
  <div class="main">
    <div class="topbar">
      <div class="left">
        <a href="/" class="topbar-brand" aria-label="thebestpornai home">
          <img src="/logo-wordmark.png" alt="thebestpornai" width="160" height="24"/>
        </a>
      </div>
      <div class="topbar-actions">
        <form class="search-wrap" action="/search" method="get" role="search">
          <input class="search-input" type="search" name="q" placeholder="Search videos, creators, tags…" aria-label="Search" autocomplete="off"/>
          <button class="search-go" type="submit" aria-label="Search">${ICO.search}</button>
        </form>
      </div>
    </div>
    <div class="content" id="main-content">
      ${bodyContent}
      <p class="shell-legal">18+ only ·
        <a href="/legal/terms.html">Terms</a>
        <a href="/legal/privacy.html">Privacy</a>
        <a href="/legal/dmca.html">DMCA</a>
        <a href="/legal/2257.html">2257</a>
      </p>
    </div>
  </div>
</div>`;
}

export function sharedFooterHtml() {
  return `
  <footer class="site-footer">
    <div class="site-footer-inner">
      <div class="site-footer-brand">
        <img class="site-footer-logo" src="/logo-wordmark.png" alt="thebestpornai" width="160" height="24"/>
        <p class="site-footer-tagline">Curated AI adult entertainment and high-definition streaming.</p>
        <p class="site-footer-compliance">18+ only. All performers are 100% synthetically generated AI personas.</p>
      </div>
      <div class="site-footer-links">
        <div class="site-footer-col">
          <strong>Explore</strong>
          <a href="/">Home</a>
          <a href="/pornstars/">AI Pornstars</a>
          <a href="/categories/">Categories</a>
          <a href="/blog/">Editorial &amp; Guides</a>
        </div>
        <div class="site-footer-col">
          <strong>Legal &amp; trust</strong>
          <a href="/legal/terms.html">Terms of Service</a>
          <a href="/legal/privacy.html">Privacy Policy</a>
          <a href="/legal/dmca.html">DMCA Notice</a>
          <a href="/legal/2257.html">18 U.S.C. 2257</a>
        </div>
      </div>
    </div>
  </footer>`;
}
