/* Hydrates interactivity on a generated post page (blog/<slug>.html).
   Article content is baked into static HTML by scripts/gen-blog-posts.js. */
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

/* Share: copy link + toast-style button feedback */
document.querySelectorAll("[data-share=copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const url = btn.getAttribute("data-url") || location.href;
    try {
      await navigator.clipboard.writeText(url);
      const prev = btn.textContent;
      btn.textContent = "Copied";
      btn.classList.add("is-success");
      setTimeout(() => {
        btn.textContent = prev;
        btn.classList.remove("is-success");
      }, 1600);
    } catch (_) {
      // Fallback prompt
      window.prompt("Copy link:", url);
    }
  });
});

/* Confession form: prefer mailto (real private delivery). If the browser
   blocks mailto forms, fall back to a constructed mailto: link. No fake
   “stored on server” claims. */
const confessionForm = document.getElementById("blog-confession-form");
if (confessionForm) {
  const submitBtn = document.getElementById("blog-confession-submit");
  const textarea = document.getElementById("blog-confession-input");

  confessionForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!textarea || !textarea.value.trim() || !submitBtn || submitBtn.disabled) return;

    const body = textarea.value.trim();
    const subject = encodeURIComponent("Blog confession (anonymous)");
    const mailBody = encodeURIComponent(body + "\n\n— sent from thebestpornai.com/blog");
    const href = `mailto:contact@thebestpornai.com?subject=${subject}&body=${mailBody}`;

    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = "Opening email…";

    // Navigate to mailto — user completes send in their mail client.
    window.location.href = href;

    setTimeout(() => {
      submitBtn.classList.add("is-success");
      submitBtn.textContent = "Email draft ready";
      textarea.placeholder = "If nothing opened, email contact@thebestpornai.com directly.";
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.classList.remove("is-success");
        submitBtn.textContent = originalLabel;
      }, 2800);
    }, 400);
  });
}
