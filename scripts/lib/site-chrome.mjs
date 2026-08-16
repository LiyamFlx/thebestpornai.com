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
        <a class="site-nav-link${on("blog")}" href="/blog/">Editorial &amp; Guides</a>
      </nav>
      <div class="site-header-actions">
        <a class="btn-primary" href="/#search">Search 5,000+ Videos</a>
      </div>
    </div>
  </header>`;
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
