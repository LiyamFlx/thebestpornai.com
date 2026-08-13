/**
 * thebestpornai blog feed
 * Category filters · search · featured hero · paginated cards · URL state
 */
import "./blog.css";
import { esc } from "../shared/catalog.js";
import { POSTS, getFeaturedPost, postsForHub } from "./posts.js";
import { postCardHtml, postCardSkeletonHtml, postCoverUrl, formatDate } from "./card.js";

const PAGE_SIZE = 6;
const CATEGORIES = ["All", "Guides", "Stories", "Fantasies", "Confessions", "Kink Lab"];
const SKELETON_DELAY_MS = 220;
const SEARCH_DEBOUNCE_MS = 160;

const ICON_CLOCK = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;
const ICON_CALENDAR = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="1.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>`;

let activeCategory = "all";
let visibleCount = PAGE_SIZE;
let searchQuery = "";
let loadingMore = false;
let searchDebounceTimer = null;

// Newest first for filters/search. Hub order can pin the featured generators guide.
const sorted = [...POSTS].sort((a, b) => new Date(b.date) - new Date(a.date));
const featured = getFeaturedPost(sorted);
const rest = postsForHub(sorted).filter((p) => p.slug !== featured?.slug);

function plain(html) {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function readMinsFor(post) {
  if (post.readMins) return post.readMins;
  const words = plain(post.body).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function heroIsVisible() {
  return !searchQuery && (activeCategory === "all" || featured?.category === activeCategory);
}

function filteredPosts() {
  // Grid excludes featured when it is shown in the hero (no duplicate card).
  const showHero = heroIsVisible();
  let list;

  if (activeCategory === "all") {
    list = showHero ? rest : sorted;
  } else {
    list = sorted.filter(
      (p) => p.category === activeCategory && (!showHero || p.slug !== featured?.slug)
    );
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const pool =
      activeCategory === "all" ? sorted : sorted.filter((p) => p.category === activeCategory);
    list = pool.filter((p) => {
      if (p.title.toLowerCase().includes(q)) return true;
      if (p.excerpt.toLowerCase().includes(q)) return true;
      if (p.category.toLowerCase().includes(q)) return true;
      if ((p.tags || []).some((t) => String(t).toLowerCase().includes(q))) return true;
      // Full body only if query is longer — keeps short queries snappy
      if (q.length >= 3 && plain(p.body).toLowerCase().includes(q)) return true;
      return false;
    });
  }

  return list;
}

function renderHero() {
  const el = document.getElementById("blog-hero");
  if (!el || !featured) return;

  if (!heroIsVisible()) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }

  const title = featured.title || "";
  const ctaLabel =
    featured.category === "Guides"
      ? "Read guide"
      : featured.category === "Stories" || featured.category === "Fantasies"
        ? "Read story"
        : "Read";

  el.hidden = false;
  el.innerHTML = `
    <a href="/blog/${esc(featured.slug)}.html" class="blog-hero" aria-label="Featured: ${esc(title)}">
      <div class="blog-hero-img" style="background-image:url('${postCoverUrl(featured)}')"></div>
      <div class="blog-hero-overlay">
        <span class="blog-hero-eyebrow">Featured · ${esc(featured.category)}</span>
        <h2 class="blog-hero-title">${esc(title)}</h2>
        <p class="blog-hero-excerpt">${esc(featured.excerpt)}</p>
        <div class="blog-hero-footer">
          <span class="blog-cta blog-cta-primary">${ctaLabel}</span>
          <div class="blog-hero-meta">
            <span>${ICON_CLOCK}${readMinsFor(featured)} min read</span>
            <span class="dot"></span>
            <span>${ICON_CALENDAR}${esc(formatDate(featured.date))}</span>
          </div>
        </div>
      </div>
    </a>
  `;
}

function updateSectionHead(count) {
  const headTitle = document.querySelector(".blog-section-head h2");
  if (!headTitle) return;

  if (searchQuery) {
    headTitle.textContent = `Search: “${searchQuery}” (${count})`;
  } else if (activeCategory !== "all") {
    headTitle.textContent = `${activeCategory} (${count})`;
  } else {
    headTitle.textContent = "Latest desires";
  }
}

function announce(msg) {
  const live = document.getElementById("blog-live");
  if (live) live.textContent = msg;
}

function renderCards() {
  const el = document.getElementById("blog-cards");
  const loadMoreBtn = document.getElementById("blog-loadmore");
  if (!el) return;

  const list = filteredPosts();
  updateSectionHead(list.length);
  const visible = list.slice(0, visibleCount);

  if (!visible.length) {
    el.innerHTML = `
      <div class="blog-empty-state" role="status">
        No stories match.
        <button type="button" class="blog-text-btn" id="blog-clear-filters">Clear filters</button>
      </div>`;
    document.getElementById("blog-clear-filters")?.addEventListener("click", clearFilters);
    announce("No stories match your filters.");
  } else {
    el.innerHTML = visible
      .map((p, idx) =>
        postCardHtml(p, {
          eager: idx < 3,
          fetchpriority: idx === 0 ? "high" : undefined,
        })
      )
      .join("");
    announce(`${list.length} ${list.length === 1 ? "post" : "posts"} shown.`);
  }

  if (loadMoreBtn) {
    loadMoreBtn.hidden = visibleCount >= list.length;
    loadMoreBtn.disabled = false;
  }
}

function clearFilters() {
  activeCategory = "all";
  searchQuery = "";
  visibleCount = PAGE_SIZE;
  const input = document.getElementById("blog-search-input");
  if (input) input.value = "";
  const wrap = document.getElementById("blog-search-wrap");
  const toggleBtn = document.getElementById("blog-search-toggle");
  wrap?.classList.remove("open");
  toggleBtn?.setAttribute("aria-expanded", "false");
  writeUrlState();
  renderPills();
  renderHero();
  renderCards();
}

function renderPills() {
  const el = document.getElementById("blog-pillnav");
  if (!el) return;

  el.innerHTML = CATEGORIES.map((cat) => {
    const data = cat === "All" ? "all" : cat;
    const isActive = activeCategory === data;
    return `<button type="button" class="blog-pill${isActive ? " active" : ""}" data-category="${esc(data)}" aria-pressed="${isActive ? "true" : "false"}">${esc(cat)}</button>`;
  }).join("");

  el.querySelectorAll("[data-category]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.category || "all";
      visibleCount = PAGE_SIZE;
      writeUrlState();
      renderPills();
      renderHero();
      renderCards();
      // Keep focus on the active pill for keyboard users
      const safeCat = window.CSS?.escape ? CSS.escape(activeCategory) : activeCategory.replace(/"/g, '\\"');
      el.querySelector(`[data-category="${safeCat}"]`)?.focus();
    });
  });
}

function initSearch() {
  const toggleBtn = document.getElementById("blog-search-toggle");
  const wrap = document.getElementById("blog-search-wrap");
  const input = document.getElementById("blog-search-input");
  if (!toggleBtn || !wrap || !input) return;

  const closeSearch = () => {
    wrap.classList.remove("open");
    toggleBtn.setAttribute("aria-expanded", "false");
    input.value = "";
    if (searchQuery) {
      searchQuery = "";
      visibleCount = PAGE_SIZE;
      writeUrlState();
      renderHero();
      renderCards();
    }
  };

  toggleBtn.addEventListener("click", () => {
    const willOpen = !wrap.classList.contains("open");
    wrap.classList.toggle("open", willOpen);
    toggleBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    if (willOpen) {
      input.focus();
    } else {
      closeSearch();
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeSearch();
      toggleBtn.focus();
    }
  });

  input.addEventListener("input", () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      searchQuery = input.value.trim();
      visibleCount = PAGE_SIZE;
      writeUrlState();
      renderHero();
      renderCards();
    }, SEARCH_DEBOUNCE_MS);
  });
}

function initLoadMore() {
  const btn = document.getElementById("blog-loadmore");
  if (!btn) return;

  btn.addEventListener("click", () => {
    if (loadingMore) return;
    loadingMore = true;
    btn.disabled = true;

    const cardsEl = document.getElementById("blog-cards");
    const remaining = filteredPosts().length - visibleCount;
    const skeletonCount = Math.max(1, Math.min(PAGE_SIZE, remaining));

    if (cardsEl && remaining > 0) {
      const frag = document.createDocumentFragment();
      const wrap = document.createElement("div");
      wrap.innerHTML = Array(skeletonCount).fill(postCardSkeletonHtml()).join("");
      while (wrap.firstChild) frag.appendChild(wrap.firstChild);
      cardsEl.appendChild(frag);
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduceMotion ? 0 : SKELETON_DELAY_MS;

    setTimeout(() => {
      visibleCount += PAGE_SIZE;
      renderCards();
      loadingMore = false;
      btn.disabled = false;
    }, delay);
  });
}

/** Shareable category + search via query string (no full reload). */
function readUrlState() {
  try {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("cat");
    const q = params.get("q");
    if (cat && (cat === "all" || CATEGORIES.includes(cat))) {
      activeCategory = cat;
    }
    if (q) {
      searchQuery = q;
      const input = document.getElementById("blog-search-input");
      const wrap = document.getElementById("blog-search-wrap");
      const toggleBtn = document.getElementById("blog-search-toggle");
      if (input) input.value = q;
      wrap?.classList.add("open");
      toggleBtn?.setAttribute("aria-expanded", "true");
    }
  } catch {
    /* ignore malformed URL */
  }
}

function writeUrlState() {
  try {
    const params = new URLSearchParams();
    if (activeCategory && activeCategory !== "all") params.set("cat", activeCategory);
    if (searchQuery) params.set("q", searchQuery);
    const qs = params.toString();
    const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", next);
  } catch {
    /* ignore */
  }
}

function ensureLiveRegion() {
  if (document.getElementById("blog-live")) return;
  const live = document.createElement("div");
  live.id = "blog-live";
  live.className = "sr-only";
  live.setAttribute("aria-live", "polite");
  live.setAttribute("aria-atomic", "true");
  document.body.appendChild(live);
}

// Boot
ensureLiveRegion();
readUrlState();
renderHero();
renderPills();
renderCards();
initSearch();
initLoadMore();

export { formatDate };
