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
  const submitBtn = document.getElementById("blog-confession-submit");
  const textarea = document.getElementById("blog-confession-input");

  confessionForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!textarea || !textarea.value.trim() || !submitBtn || submitBtn.disabled) return;

    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="icon-spinner" aria-hidden="true"></span>Sending…`;

    // No backend endpoint for confessions exists yet — this simulates the
    // round-trip (spinner -> checkmark) the same way "Downloaded" feedback
    // does elsewhere on the site, without pretending it's stored anywhere.
    setTimeout(() => {
      submitBtn.classList.add("is-success");
      submitBtn.textContent = "✓ Sent";
      textarea.value = "";
      textarea.placeholder = "Confession received. We'll be in touch (or we won't).";

      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.classList.remove("is-success");
        submitBtn.textContent = originalLabel;
      }, 2200);
    }, 700);
  });
}
