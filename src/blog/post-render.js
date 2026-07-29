/* Hydrates interactivity on a generated post page (blog/<slug>.html).
   The article content itself is already baked into the static HTML by
   scripts/gen-blog-posts.js — this only wires up client-side behavior. */
import "./blog.css";

document.querySelectorAll(".blog-video-card, .blog-card").forEach((el) => {
  el.addEventListener("mouseenter", () => {
    const img = el.querySelector("img");
    if (img) img.style.transform = "scale(1.05)";
  });
  el.addEventListener("mouseleave", () => {
    const img = el.querySelector("img");
    if (img) img.style.transform = "scale(1)";
  });
});

const confessionForm = document.getElementById("blog-confession-form");
if (confessionForm) {
  confessionForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const textarea = confessionForm.querySelector("textarea");
    if (textarea && textarea.value.trim()) {
      textarea.value = "";
      textarea.placeholder = "Confession received. We'll be in touch (or we won't).";
    }
  });
}
