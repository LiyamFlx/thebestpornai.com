/* Hydrates interactivity on a generated post page (blog/<slug>.html).
   Article content is baked into static HTML by scripts/gen-blog-posts.js. */
import "./blog.css";

/* Hover zoom is CSS-only (see .blog-card / .blog-hero) — no JS listeners. */

const progressEl = document.getElementById("blog-progress-bar");
if (progressEl) {
  let ticking = false;
  const update = () => {
    ticking = false;
    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - window.innerHeight);
    progressEl.style.transform = `scaleX(${Math.min(1, window.scrollY / max)})`;
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
  update();
}

const tocRoot = document.getElementById("blog-toc");
if (tocRoot) {
  const links = [...tocRoot.querySelectorAll("a[href^='#']")];
  const map = new Map();
  for (const a of links) {
    const id = decodeURIComponent(a.getAttribute("href").slice(1));
    const el = document.getElementById(id);
    if (el) map.set(el, a);
  }
  if (map.size && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!vis) return;
        const active = map.get(vis.target);
        if (!active) return;
        links.forEach((l) => l.classList.toggle("is-active", l === active));
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    map.forEach((_, el) => io.observe(el));
  }
}

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

/* Confession form: submits anonymously to /api/confession, falling back
   to mailto if serverless endpoint is offline. */
const confessionForm = document.getElementById("blog-confession-form");
if (confessionForm) {
  const submitBtn = document.getElementById("blog-confession-submit");
  const textarea = document.getElementById("blog-confession-input");

  confessionForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!textarea || !textarea.value.trim() || !submitBtn || submitBtn.disabled) return;

    const body = textarea.value.trim();
    if (body.length < 5) return;

    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const postSlug = pathParts[pathParts.length - 1]?.replace(/\.html$/, "") || "";

    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = "Sending anonymously…";

    try {
      const res = await fetch("/api/confession", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, post_slug: postSlug }),
      });

      if (res.ok) {
        submitBtn.classList.add("is-success");
        submitBtn.textContent = "Confession Received ✓";
        textarea.value = "";
        textarea.placeholder = "Your confession was submitted anonymously.";
        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.classList.remove("is-success");
          submitBtn.textContent = originalLabel;
        }, 3500);
        return;
      }
      throw new Error(`Status ${res.status}`);
    } catch (_) {
      // Fallback to mailto if API fails
      const subject = encodeURIComponent("Blog confession (anonymous)");
      const mailBody = encodeURIComponent(body + "\n\n— sent from thebestpornai.com/blog");
      window.location.href = `mailto:contact@thebestpornai.com?subject=${subject}&body=${mailBody}`;
      submitBtn.classList.add("is-success");
      submitBtn.textContent = "Email draft opened";
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.classList.remove("is-success");
        submitBtn.textContent = originalLabel;
      }, 3000);
    }
  });
}
