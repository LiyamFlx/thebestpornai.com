import "./blog.css";
import { esc } from "../shared/catalog.js";
import { POSTS } from "./posts.js";
import { postCardHtml, postCardSkeletonHtml, postCoverUrl, formatDate } from "./card.js";

const PAGE_SIZE = 3;
const CATEGORIES = ["Stories", "Fantasies", "Confessions", "Kink Lab"];
const SKELETON_DELAY_MS = 400; // brief, intentional — long enough to read as a loading state, short enough not to feel slow

const ICON_CLOCK = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;
const ICON_FLAME = `<svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 3-3 4-3 8a3 3 0 0 0 6 0c1.5 1 2 3 2 4.5a5 5 0 0 1-10 0C7 10 9 8 12 2Z"/></svg>`;

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
  el.innerHTML = `
    <a href="/blog/${esc(featured.slug)}.html" class="blog-hero">
      <div class="blog-hero-img" style="background-image:url('${postCoverUrl(featured)}')"></div>
      <div class="blog-hero-overlay">
        <span class="blog-hero-eyebrow">A new high-velocity fantasy</span>
        <h1 class="blog-hero-title">${esc(featured.title)}</h1>
        <div class="blog-hero-footer">
          <span class="blog-cta">Read the fantasy</span>
          <div class="blog-hero-meta">
            <span>${ICON_CLOCK}${featured.readMins} min read</span>
            <span class="dot"></span>
            <span>${ICON_FLAME}${(featured.strokes / 1000).toFixed(1)}k strokes</span>
          </div>
        </div>
      </div>
    </a>
  `;
}

function filteredPosts() {
  let list = activeCategory === "all" ? rest : rest.filter((p) => p.category === activeCategory);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }
  return list;
}

function renderCards() {
  const el = document.getElementById("blog-cards");
  const loadMoreBtn = document.getElementById("blog-loadmore");
  if (!el) return;
  const list = filteredPosts();
  const visible = list.slice(0, visibleCount);
  if (!visible.length) {
    el.innerHTML = `<div class="blog-empty-state">No fantasies match that search yet.</div>`;
  } else {
    el.innerHTML = visible.map(postCardHtml).join("");
  }
  if (loadMoreBtn) loadMoreBtn.hidden = visibleCount >= list.length;
}

function renderPills() {
  const el = document.getElementById("blog-pillnav");
  if (!el) return;
  el.innerHTML = CATEGORIES.map(
    (cat) => `
      <button class="blog-pill${activeCategory === cat ? " active" : ""}" data-category="${esc(cat)}">
        ${esc(cat.toUpperCase())}
      </button>
    `
  ).join("");
  el.querySelectorAll("[data-category]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.category;
      activeCategory = activeCategory === cat ? "all" : cat;
      visibleCount = PAGE_SIZE;
      renderPills();
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
      renderCards();
    }
  });

  let debounceTimer;
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = input.value.trim();
      visibleCount = PAGE_SIZE;
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
