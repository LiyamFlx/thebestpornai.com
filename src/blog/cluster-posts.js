/* Metadata only — full bodies live in src/cluster/imported-pages.json
   and are merged at generate time so the blog feed JS stays small. */

const META = [
  { slug: "candy-ai-review-2026", title: "Candy AI Review 2026", category: "Reviews", excerpt: "Photoreal stills, girlfriend memory, and uncensored chat — our 9.9/10 2026 benchmark of Candy AI." },
  { slug: "xotic-ai-review-2026", title: "Xotic AI Review 2026", category: "Reviews", excerpt: "Prompt weight, anatomy, and 4K video — hands-on Xotic AI review, 9.5/10." },
  { slug: "ourdream-ai-review-2026", title: "OurDream AI Review 2026", category: "Reviews", excerpt: "Companion realism, Dreamcoins, stills + video on one face — OurDream scored 9.3/10 in this channel." },
  { slug: "seduced-ai-review-2026", title: "Seduced.ai Review 2026", category: "Reviews", excerpt: "4K photoreal poses and face lock — Seduced.ai at 9.4/10." },
  { slug: "promptchan-review-2026", title: "PromptChan Review 2026", category: "Reviews", excerpt: "Uncensored diffusion and motion video — PromptChan 9.3/10." },
  { slug: "joi-ai-review-2026", title: "Joi AI Review 2026", category: "Reviews", excerpt: "Fast explicit chat that escalates — Joi AI 8.8/10." },
  { slug: "candy-ai-vs-ourdream-ai", title: "Candy AI vs OurDream AI", category: "Guides", excerpt: "Head-to-head: Candy’s 9.9 overall vs OurDream’s companion value." },
  { slug: "candy-ai-vs-xotic-ai", title: "Candy AI vs Xotic AI", category: "Guides", excerpt: "Girlfriend stack vs prompt-accurate 4K — which 2026 tool wins?" },
  { slug: "xotic-ai-vs-seduced-ai", title: "Xotic AI vs Seduced.ai", category: "Guides", excerpt: "Two photoreal engines, different jobs — side-by-side 2026 scores." },
  { slug: "promptchan-vs-seduced-ai", title: "PromptChan vs Seduced.ai", category: "Guides", excerpt: "Unfiltered prompt engine vs pose-locked 4K stills." },
  { slug: "how-ai-porn-generators-work", title: "How AI Porn Generators Work", category: "Guides", excerpt: "Diffusion, video synthesis, and why some clips still collapse." },
  { slug: "how-ai-image-generators-work", title: "How AI Image Generators Work", category: "Guides", excerpt: "Latents, prompts, and what actually changes a still." },
  { slug: "how-ai-video-generators-work", title: "How AI Video Generators Work", category: "Guides", excerpt: "Keyframe animation vs native video diffusion." },
  { slug: "ai-image-vs-ai-video-generation", title: "AI Image vs AI Video Generation", category: "Guides", excerpt: "When to stay on stills and when to pay for motion." },
  { slug: "how-much-do-ai-generators-cost", title: "How Much Do AI Generators Cost", category: "Guides", excerpt: "Credits, subs, and the real price of a usable scene." },
  { slug: "best-free-ai-porn-generators", title: "Best Free AI Porn Generators", category: "Guides", excerpt: "What free actually means — trials, traps, and watch-instead." },
  { slug: "ai-porn-privacy", title: "AI Porn Privacy", category: "Guides", excerpt: "Logs, payments, and what to demand before you type a prompt." },
  { slug: "how-to-write-better-ai-prompts", title: "How to Write Better AI Prompts", category: "Guides", excerpt: "Prompt craft that survives anatomy and motion." },
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
  coverVideoId: 2,
  relatedVideoIds: [2, 4, 7],
  tags: [p.title, "best porn AI", "2026"],
  dropCap: false,
  clusterImport: true,
  body: `<p>${p.excerpt}</p><p>Full review lives on this URL after generate — open <a href="/The-Best-Porn-AI-in-2026">The Best Porn AI in 2026</a> or this page on the static site.</p>`,
}));
