import "./blog.css";
import { esc } from "../shared/catalog.js";
import { POSTS } from "./posts.js";
import { postCardHtml, postCardSkeletonHtml, postCoverUrl, formatDate } from "./card.js";

const PAGE_SIZE = 6;
const CATEGORIES = ["All", "Stories", "Fantasies", "Confessions", "Kink Lab"];
const SKELETON_DELAY_MS = 280;

const ICON_CLOCK = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;
const ICON_CALENDAR = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="1.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>`;

let activeCategory = "all";
let visibleCount = PAGE_SIZE;
let searchQuery = "";
let loadingMore = false;

const sorted = [...POSTS].sort((a, b) => new Date(b.date) - new Date(a.date));
const featured = sorted[0];
const rest = sorted.slice(1);

function renderHero() {
  const el = document.getElementById("blog-hero");
  if (!el || !featured) return;
  // Hide featured when filtering away from its category
  if (activeCategory !== "all" && featured.category !== activeCategory) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  el.innerHTML = `
    <a href="/blog/${esc(featured.slug)}.html" class="blog-hero">
      <div class="blog-hero-img" style="background-image:url('${postCoverUrl(featured)}')"></div>
      <div class="blog-hero-overlay">
        <span class="blog-hero-eyebrow">${esc(featured.category)}</span>
        <h2 class="blog-hero-title">${esc(featured.title)}</h2>
        <p class="blog-hero-excerpt">${esc(featured.excerpt)}</p>
        <div class="blog-hero-footer">
          <span class="blog-cta blog-cta-primary">Read story</span>
          <div class="blog-hero-meta">
            <span>${ICON_CLOCK}${featured.readMins} min</span>
            <span class="dot"></span>
            <span>${ICON_CALENDAR}${esc(formatDate(featured.date))}</span>
          </div>
        </div>
      </div>
    </a>
  `;
}

function filteredPosts() {
  // Grid excludes featured when it is shown in the hero (avoids duplicate cards).
  let list =
    activeCategory === "all"
      ? rest
      : sorted.filter((p) => p.category === activeCategory && p.slug !== featured?.slug);

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const pool =
      activeCategory === "all" ? sorted : sorted.filter((p) => p.category === activeCategory);
    list = pool.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.tags || []).some((t) => String(t).toLowerCase().includes(q)) ||
        plain(p.body).toLowerCase().includes(q)
    );
    const hero = document.getElementById("blog-hero");
    if (hero) hero.hidden = true;
  }

  return list;
}

function plain(html) {
  return String(html || "").replace(/<[^>]+>/g, " ");
}

function renderCards() {
  const el = document.getElementById("blog-cards");
  const loadMoreBtn = document.getElementById("blog-loadmore");
  if (!el) return;
  const list = filteredPosts();
  const visible = list.slice(0, visibleCount);
  if (!visible.length) {
    el.innerHTML = `<div class="blog-empty-state">No stories match. <button type="button" class="blog-text-btn" id="blog-clear-filters">Clear filters</button></div>`;
    document.getElementById("blog-clear-filters")?.addEventListener("click", () => {
      activeCategory = "all";
      searchQuery = "";
      const input = document.getElementById("blog-search-input");
      if (input) input.value = "";
      visibleCount = PAGE_SIZE;
      renderPills();
      renderHero();
      renderCards();
    });
  } else {
    el.innerHTML = visible.map(postCardHtml).join("");
  }
  if (loadMoreBtn) loadMoreBtn.hidden = visibleCount >= list.length;
}

function renderPills() {
  const el = document.getElementById("blog-pillnav");
  if (!el) return;
  el.innerHTML = CATEGORIES.map((cat) => {
    const data = cat === "All" ? "all" : cat;
    const active = activeCategory === data || (cat === "All" && activeCategory === "all") ? " active" : "";
    return `<button type="button" class="blog-pill${active}" data-category="${esc(data)}">${esc(cat)}</button>`;
  }).join("");
  el.querySelectorAll("[data-category]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.category || "all";
      visibleCount = PAGE_SIZE;
      renderPills();
      renderHero();
      renderCards();
    });
  });
}

function initSearch() {
  const toggleBtn = document.getElementById("blog-search-toggle");
  const wrap = document.getElementById("blog-search-wrap");
  const input = document.getElementById("blog-search-input");
  if (!toggleBtn || !wrap || !input) return;

  toggleBtn.addEventListener("click", () => {
    const willOpen = !wrap.classList.contains("open");
    wrap.classList.toggle("open", willOpen);
    toggleBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    if (willOpen) input.focus();
    else {
      input.value = "";
      searchQuery = "";
      visibleCount = PAGE_SIZE;
      renderHero();
      renderCards();
    }
  });

  let debounceTimer;
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = input.value.trim();
      visibleCount = PAGE_SIZE;
      if (!searchQuery) renderHero();
      renderCards();
    }, 200);
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
    const skeletonCount = Math.max(1, Math.min(PAGE_SIZE, filteredPosts().length - visibleCount));
    if (cardsEl) {
      const wrap = document.createElement("div");
      wrap.innerHTML = Array(skeletonCount).fill(postCardSkeletonHtml()).join("");
      cardsEl.append(...wrap.children);
    }
    setTimeout(() => {
      visibleCount += PAGE_SIZE;
      renderCards();
      loadingMore = false;
      btn.disabled = false;
    }, SKELETON_DELAY_MS);
  });
}

renderHero();
renderPills();
renderCards();
initSearch();
initLoadMore();

export { formatDate };
