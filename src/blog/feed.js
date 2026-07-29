import "./blog.css";
import { esc } from "../shared/catalog.js";
import { POSTS } from "./posts.js";
import { postCardHtml, postCoverUrl, formatDate } from "./card.js";

const PAGE_SIZE = 3;
const CATEGORIES = ["Stories", "Fantasies", "Confessions", "Kink Lab"];

let activeCategory = "all";
let visibleCount = PAGE_SIZE;

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
        <span class="blog-cta">Read the fantasy</span>
      </div>
    </a>
  `;
}

function filteredPosts() {
  if (activeCategory === "all") return rest;
  return rest.filter((p) => p.category === activeCategory);
}

function renderCards() {
  const el = document.getElementById("blog-cards");
  const loadMoreBtn = document.getElementById("blog-loadmore");
  if (!el) return;
  const list = filteredPosts();
  const visible = list.slice(0, visibleCount);
  el.innerHTML = visible.map(postCardHtml).join("");
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

document.getElementById("blog-loadmore")?.addEventListener("click", () => {
  visibleCount += PAGE_SIZE;
  renderCards();
});

renderHero();
renderPills();
renderCards();

export { formatDate };
