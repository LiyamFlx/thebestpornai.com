/* Metadata only — full bodies live in src/cluster/imported-pages.json
   and are merged at generate time so the blog feed JS stays small. */

const META = [
  { slug: "candy-ai-review-2026", title: "Candy AI Review 2026", category: "Reviews", excerpt: "Photoreal stills, girlfriend memory, and uncensored chat — our 9.9/10 2026 benchmark of Candy AI.", cover: "/blog-assets/best-ai-porn-sites-2026-crew.jpg", relatedVideoIds: [15, 24, 25, 4] },
  { slug: "xotic-ai-review-2026", title: "Xotic AI Review 2026", category: "Reviews", excerpt: "Prompt weight, anatomy, and 4K video — hands-on Xotic AI review, 9.5/10.", cover: "/blog-assets/ourdream-studio-athlete.jpg", relatedVideoIds: [34, 40, 42, 7] },
  { slug: "ourdream-ai-review-2026", title: "OurDream AI Review 2026", category: "Reviews", excerpt: "Companion realism, Dreamcoins, stills + video on one face — OurDream scored 9.3/10 in this channel.", cover: "/blog-assets/ourdream-ai-review-2026-hero-wide.jpg", relatedVideoIds: [5168, 5248, 5257, 12] },
  { slug: "seduced-ai-review-2026", title: "Seduced.ai Review 2026", category: "Reviews", excerpt: "4K photoreal poses and face lock — Seduced.ai at 9.4/10.", cover: "/blog-assets/ourdream-couch-scene.jpg", relatedVideoIds: [5100, 388, 395, 1] },
  { slug: "promptchan-review-2026", title: "PromptChan Review 2026", category: "Reviews", excerpt: "Uncensored diffusion and motion video — PromptChan 9.3/10.", cover: "/blog-assets/ourdream-studio-athlete.jpg", relatedVideoIds: [21, 22, 23, 4] },
  { slug: "joi-ai-review-2026", title: "Joi AI Review 2026", category: "Reviews", excerpt: "Fast explicit chat that escalates — Joi AI 8.8/10.", cover: "/blog-assets/ourdream-kitchen-stretch.jpg", relatedVideoIds: [260, 261, 262, 7] },
  { slug: "candy-ai-vs-ourdream-ai", title: "Candy AI vs OurDream AI", category: "Guides", excerpt: "Head-to-head: Candy’s 9.9 overall vs OurDream’s companion value.", cover: "/blog-assets/ourdream-pink-studio.jpg", relatedVideoIds: [5253, 5249, 5169, 12] },
  { slug: "candy-ai-vs-xotic-ai", title: "Candy AI vs Xotic AI", category: "Guides", excerpt: "Girlfriend stack vs prompt-accurate 4K — which 2026 tool wins?", cover: "/blog-assets/ourdream-gym-pink.jpg", relatedVideoIds: [396, 397, 398, 1] },
  { slug: "xotic-ai-vs-seduced-ai", title: "Xotic AI vs Seduced.ai", category: "Guides", excerpt: "Two photoreal engines, different jobs — side-by-side 2026 scores.", cover: "/blog-assets/ourdream-kitchen-stretch.jpg", relatedVideoIds: [399, 400, 401, 4] },
  { slug: "promptchan-vs-seduced-ai", title: "PromptChan vs Seduced.ai", category: "Guides", excerpt: "Unfiltered prompt engine vs pose-locked 4K stills.", cover: "/blog-assets/07-lilith-dream-portrait.jpg", relatedVideoIds: [402, 403, 404, 7] },
  { slug: "how-ai-porn-generators-work", title: "How AI Porn Generators Work", category: "Guides", excerpt: "Diffusion, video synthesis, and why some clips still collapse.", cover: "/blog-assets/best-ai-adult-content-platforms-2026-hero.jpg", relatedVideoIds: [44, 47, 52, 12] },
  { slug: "how-ai-image-generators-work", title: "How AI Image Generators Work", category: "Guides", excerpt: "Latents, prompts, and what actually changes a still.", cover: "/blog-assets/best-ai-character-generators-workout-raw.jpg", relatedVideoIds: [55, 62, 63, 1] },
  { slug: "how-ai-video-generators-work", title: "How AI Video Generators Work", category: "Guides", excerpt: "Keyframe animation vs native video diffusion.", cover: "/blog-assets/gptgirlfriend-review-2026-hero-wide.jpg", relatedVideoIds: [72, 78, 90, 4] },
  { slug: "ai-image-vs-ai-video-generation", title: "AI Image vs AI Video Generation", category: "Guides", excerpt: "When to stay on stills and when to pay for motion.", cover: "/blog-assets/ai-sex-chats-guide-2026-hero-wide.jpg", relatedVideoIds: [116, 132, 140, 7] },
  { slug: "how-much-do-ai-generators-cost", title: "How Much Do AI Generators Cost", category: "Guides", excerpt: "Credits, subs, and the real price of a usable scene.", cover: "/blog-assets/best-ai-porn-sites-2026-ranking-hero-wide.jpg", relatedVideoIds: [159, 174, 28, 12] },
  { slug: "best-free-ai-porn-generators", title: "Best Free AI Porn Generators", category: "Guides", excerpt: "What free actually means — trials, traps, and watch-instead.", cover: "/blog-assets/best-free-ai-porn-wet-night-penthouse.jpg", relatedVideoIds: [263, 264, 265, 1] },
  { slug: "ai-porn-privacy", title: "AI Porn Privacy", category: "Guides", excerpt: "Logs, payments, and what to demand before you type a prompt.", cover: "/blog-assets/ourdream-privacy-halo.jpg", relatedVideoIds: [266, 267, 268, 4] },
  { slug: "how-to-write-better-ai-prompts", title: "How to Write Better AI Prompts", category: "Guides", excerpt: "Prompt craft that survives anatomy and motion.", cover: "/blog-assets/ourdream-pink-studio.jpg", relatedVideoIds: [269, 270, 39, 7] },
];

let id = 200;
export const CLUSTER_POSTS = META.map((p) => ({
  id: id++,
  slug: p.slug,
  title: p.title,
  category: p.category,
  excerpt: p.excerpt,
  microcopy: "Independent 2026 benchmark — create aisle.",
  date: "2026-08-17",
  dateModified: "2026-08-17",
  readMins: 6,
  cover: p.cover,
  coverVideoId: null,
  relatedVideoIds: p.relatedVideoIds,
  tags: [p.title, "best porn AI", "2026"],
  dropCap: false,
  clusterImport: true,
  ctaHref: "/The-Best-Porn-AI-in-2026",
  ctaLabel: "Open 2026 leaderboard →",
  body: `<p>${p.excerpt}</p><p>Full review lives on this URL after generate — open <a href="/The-Best-Porn-AI-in-2026">The Best Porn AI in 2026</a> or this page on the static site.</p>`,
}));
