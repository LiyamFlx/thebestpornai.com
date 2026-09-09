/* How-to guide — distinct from candy-ai-review-2026 (scorecard) and comparison posts.
   SEO: "how to use Candy AI", "Candy AI guide 2026", "Candy AI tutorial"
   AEO: HowTo + FAQ schema, direct answers above the fold in steps. */

import { candyAiUrl, AFFILIATE_REL } from "../shared/affiliates.js";

const CANDY = candyAiUrl("home", "blog-candy-guide-2026");
const CANDY_CREATE = candyAiUrl("create", "blog-candy-guide-2026");
const REL = AFFILIATE_REL;

function ext(href, label) {
  return `<a href="${href}" target="_blank" rel="${REL}">${label}</a>`;
}

const img = (file, alt, caption) => `
<figure class="blog-figure">
  <img src="/blog-assets/candy/${file}" alt="${alt}" width="600" height="500" loading="lazy" decoding="async"/>
  ${caption ? `<figcaption>${caption}</figcaption>` : ""}
</figure>`;

export const CANDY_AI_GUIDE_2026_POST = {
  id: 221,
  slug: "how-to-use-candy-ai-2026",
  title: "How to Use Candy AI in 2026: Step-by-Step Guide (Chat, Images, Tokens)",
  category: "Guides",
  excerpt:
    "The complete Candy AI tutorial for 2026 — sign up, pick or build a companion, chat with memory, generate images and beta video, manage tokens, and write better prompts. Includes visuals and FAQs.",
  microcopy: "Not a scorecard — a practical walkthrough from signup to NSFW roleplay prompts.",
  date: "2026-09-09",
  dateModified: "2026-09-09",
  readMins: 12,
  cover: "/blog-assets/candy/asset2.webp",
  coverVideoId: 21,
  relatedVideoIds: [22, 24, 25, 6464, 1],
  ctaHref: CANDY,
  ctaLabel: "Open Candy AI →",
  tags: [
    "how to use Candy AI",
    "Candy AI guide 2026",
    "Candy AI tutorial",
    "Candy AI prompts",
    "AI girlfriend chat",
    "Candy AI tokens",
    "Candy AI character builder",
  ],
  review: {
    name: "Candy AI",
    rating: 9.7,
    url: CANDY,
  },
  howToTotalTime: "PT25M",
  howToSteps: [
    {
      name: "Create your Candy AI account",
      text: "Go to the official Candy AI site, register with your email, confirm you are 18+, and land in the companion library.",
      url: CANDY,
    },
    {
      name: "Explore free or trial chat first",
      text: "Test basic text messages with a pre-made character before paying. Note message limits and which media features stay locked.",
    },
    {
      name: "Choose a pre-made companion or open the character builder",
      text: "Pick from the library for speed, or build a custom AI with appearance, personality, voice, hobbies, and relationship framing.",
      url: CANDY_CREATE,
    },
    {
      name: "Chat so memory can adapt",
      text: "Send several messages in one thread. Mention preferences, nicknames, and boundaries so later replies feel continuous.",
    },
    {
      name: "Unlock multimodal media on a paid plan",
      text: "Use subscription tokens for voice notes, image generation, and beta video. Spend tokens on clear prompts to avoid waste.",
    },
    {
      name: "Prompt for richer storytelling and images",
      text: "Write scene, emotion, and sensory detail in chat. For images, specify outfit, pose, setting, and lighting; avoid contradictions.",
    },
  ],
  faqs: [
    {
      q: "What is Candy AI?",
      a: "Candy AI is an adult-oriented virtual companion platform for NSFW chat, custom AI characters, and multimodal media (images, voice, and beta video) built around ongoing character memory rather than one-off prompts.",
    },
    {
      q: "Is Candy AI free?",
      a: "You can usually explore limited text chat on a free or trial tier, but unlimited messaging, custom character creation depth, and media generation (images/video) sit on paid subscription plans with a monthly token allowance for media.",
    },
    {
      q: "How do Candy AI tokens work?",
      a: "Tokens are a limited balance used for media generation (images, voice, video). They typically refresh with your billing cycle. Text chat on premium is often unlimited; media is the scarce resource — write precise prompts so you do not burn tokens on bad generations.",
    },
    {
      q: "How do I generate images in Candy AI chat?",
      a: "On a plan that includes image generation, ask your companion for a visual (selfie, scene, outfit change). Community tip: some users add an extra space in phrases like “show me” while roleplaying to steer image requests. Prefer the image controls (outfit, pose, scene) when available for cleaner results.",
    },
    {
      q: "Candy AI vs OurDream — which should I use?",
      a: "Candy AI leans hard into girlfriend-style chat, photoreal stills, and companion memory. OurDream is stronger when you want the same character across chat, stills, video, and voice in one stack. See our Candy AI review and OurDream vs Candy comparison for a head-to-head.",
    },
    {
      q: "Is Candy AI only for adults?",
      a: "Yes. Candy AI is intended for users 18+ (or the age of majority where you live). Do not attempt to create or roleplay anything involving minors — platforms ban it and it is illegal.",
    },
  ],
  body: `
      <p><strong>Candy AI</strong> is an adult-oriented virtual companion platform: you chat with AI characters, build custom companions, and unlock multimodal media (voice, images, beta video) on paid plans. This page is the <em>how-to</em> — a step-by-step Candy AI guide for 2026 — not another scorecard. For ratings, see our <a href="/blog/candy-ai-review-2026.html">Candy AI Review 2026</a>; for a head-to-head with OurDream, read <a href="/blog/ourdream-ai-vs-candy-ai-comparison.html">OurDream vs Candy AI</a>.</p>

      <div class="blog-callout">
        <strong>Quick answer (AEO)</strong>
        Sign up on ${ext(CANDY, "Candy AI")} → try free/trial chat → pick a library girl or ${ext(CANDY_CREATE, "build a character")} → chat so memory adapts → subscribe when you want images/voice/video → spend tokens on clear prompts. Adults 18+ only.
      </div>

      <p class="cta-row" style="margin:1.25em 0 1.75em;display:flex;flex-wrap:wrap;gap:10px">
        <a class="btn blog-cta-primary" href="${CANDY}" target="_blank" rel="${REL}">Try Candy AI</a>
        <a class="btn blog-cta-ghost" href="${CANDY_CREATE}" target="_blank" rel="${REL}">Create a character</a>
        <a class="btn blog-cta-ghost" href="/blog/candy-ai-review-2026.html">Read the 2026 review</a>
      </p>

      ${img("asset2.webp", "Candy AI companion chat and character visuals", "Candy AI is built as a multimodal companion stack — chat first, then media.")}

      <h2>What Candy AI is (and is not)</h2>
      <p>Candy AI sits in the <strong>AI girlfriend / NSFW companion</strong> category: fictional adult characters, relationship-style chat, and optional media generation. It is not a general assistant, and it is not a free tube site. On thebestpornai we separate jobs clearly:</p>
      <ul>
        <li><strong>Watch finished AI scenes</strong> → <a href="/">thebestpornai catalog</a> / <a href="/shorts">Shorts</a></li>
        <li><strong>Chat + generate with a character</strong> → ${ext(CANDY, "Candy AI")} (this guide)</li>
        <li><strong>Same-character chat + video stack</strong> → often compared with <a href="/blog/ourdream-ai-review-2026.html">OurDream</a></li>
      </ul>
      <p>Official product framing emphasizes companions that chat, remember context, and move into voice/images/video. Third-party explainers describe the same loop: library or builder → conversation memory → media unlocked on premium tiers.</p>

      <h2>Step-by-step: how to use Candy AI</h2>
      <ol class="blog-steps">
        <li id="step-signup">
          <strong>Sign up on the official site</strong>
          Visit ${ext(CANDY, "Candy AI")} and register with your email. Confirm you are 18+ (or the age of majority where you live). Use a password manager; do not reuse credentials from banking apps. After signup you land in the companion experience — library, chat, and account/settings.
        </li>
        <li id="step-explore">
          <strong>Explore free or trial chat before you pay</strong>
          Use free/trial limits to test <em>text</em> chemistry with one or two pre-made characters. Note what is locked (images, voice, video, unlimited messages). A short trial answers “do I like the vibe?” cheaper than burning a month of tokens on day one.
          ${img("asset5.webp", "Exploring Candy AI character options", "Start with a pre-made companion to learn the chat rhythm before building from scratch.")}
        </li>
        <li id="step-choose">
          <strong>Choose a companion — library or character builder</strong>
          <em>Library:</em> fastest path. Hundreds of distinct personalities/moods; pick one whose bio matches the fantasy (goth, soft girlfriend, dominant, shy, etc.).<br/>
          <em>Builder:</em> open ${ext(CANDY_CREATE, "Create character")} to set appearance, personality, voice, occupation, hobbies, relationship framing, and style. More setup time; better long-term fit.
          ${img("asset8.webp", "Candy AI character builder and companion styles", "Custom characters reward specificity — traits, hobbies, and voice beat vague “hot girl” presets.")}
        </li>
        <li id="step-chat">
          <strong>Chat so memory can adapt</strong>
          Candy AI’s value is continuity: each message can shape the next reply. Treat the first 10–20 messages as training:
          <ul>
            <li>State a name/nickname you want her to use</li>
            <li>State tone (teasing, romantic, filthy, slow-burn)</li>
            <li>State hard limits once, clearly</li>
            <li>Stay in one thread instead of resetting every five minutes</li>
          </ul>
          Coming on too hard in message one often gets a rejection-style reply — many reviewers note Candy leans “earn the heat” like a slow-burn girlfriend sim. If you want instant explicit, say so after a short rapport beat, or pick a character marketed as more direct.
        </li>
        <li id="step-media">
          <strong>Unlock multimodal media (voice, images, beta video)</strong>
          Paid plans typically unlock richer media. Expect:
          <ul>
            <li><strong>Voice notes / calls</strong> — presence layer on top of text</li>
            <li><strong>Images</strong> — character-linked selfies/scenes (often token-priced)</li>
            <li><strong>Video</strong> — often labeled beta; quality varies</li>
          </ul>
          ${img("asset3.gif", "Example Candy AI style promotional visual", "Media features are where tokens matter — clear prompts save money.")}
        </li>
        <li id="step-tokens">
          <strong>Understand tokens and subscriptions</strong>
          Premium is usually a <strong>subscription</strong> (monthly / longer discounts) plus a <strong>token balance</strong> for media that refreshes with the billing cycle. Text may be unlimited on premium while images/video drain tokens. Check the live subscriptions page for current prices — third-party tutorials quote numbers that go stale fast. Cancel in settings if the charge is discretionary (billing descriptors often show the parent company name such as EverAI).
        </li>
      </ol>

      <h2>How core features work</h2>
      <h3>Chat and memory</h3>
      <p>Text is the spine. Memory is what makes it feel like a relationship instead of a lottery. Official and secondary explainers agree: companions adapt to style, interests, and ongoing context. Practical tip — <strong>restate important facts occasionally</strong> (“Remember I’m Alex, we met at the gallery”) so long threads stay coherent.</p>

      <h3>Images during roleplay</h3>
      <p>On plans with image generation, ask in-character for a visual, or use the image UI controls (outfit, action, pose, accessories, scene, count). Community tip referenced in short-form tutorials: when typing a request like “show me…”, <strong>an extra space in the phrase</strong> is sometimes used to steer generation during roleplay. Prefer structured controls when you have them — fewer wasted tokens than vague “send nudes” spam.</p>
      <p>Image prompt checklist:</p>
      <ul>
        <li>Who (same character — do not rename mid-prompt)</li>
        <li>Outfit + body framing</li>
        <li>Pose / action</li>
        <li>Location + lighting</li>
        <li>Mood (soft, filthy, cinematic)</li>
        <li>What to avoid (extra limbs, text overlays, different face)</li>
      </ul>

      <h3>Voice and beta video</h3>
      <p>Voice adds intimacy; video is the experimental layer. Treat beta video as a bonus, not the reason you subscribe, until quality stabilizes for your use case.</p>

      <h2>Prompting Candy AI for better storytelling</h2>
      <p>Weak: “You’re hot. Let’s fuck.”<br/>
      Stronger: set <strong>scene + stakes + sensory detail + pace</strong>.</p>
      <div class="blog-callout">
        <strong>Copy-paste prompt pattern</strong>
        “We are in [place] at [time]. You are [role/traits]. I am [role]. Tone: [teasing / romantic / filthy]. Keep replies 4–8 sentences. Include one physical action and one question back to me. Soft limit: [x]. Hard limit: [y]. Start with you noticing [detail].”
      </div>
      <p>For longer arcs:</p>
      <ol>
        <li><strong>Establish</strong> — location, relationship status, what just happened</li>
        <li><strong>Escalate</strong> — one notch per reply; do not jump to climax in message two unless that is the kink</li>
        <li><strong>Callback</strong> — reference something she said earlier (trains memory + immersion)</li>
        <li><strong>Direct the camera</strong> — “Describe only what I can see/feel from my POV”</li>
        <li><strong>Brake or boost</strong> — “Slow down” / “Be more explicit” works better than rage-quitting the thread</li>
      </ol>
      <p>More general craft: <a href="/blog/how-to-write-better-ai-prompts.html">How to write better AI prompts</a>.</p>

      ${img("asset9.webp", "Candy AI NSFW companion aesthetic example", "Photoreal companion aesthetics are a Candy strength — match prompts to the look you picked in the builder.")}

      <h2>Pricing mindset (without stale dollar quotes)</h2>
      <div class="blog-table-wrap">
        <table>
          <thead><tr><th>Need</th><th>Likely fit</th></tr></thead>
          <tbody>
            <tr><td>Curious about chat vibe only</td><td>Free/trial text with a library character</td></tr>
            <tr><td>Daily girlfriend-style chat</td><td>Premium unlimited text</td></tr>
            <tr><td>Lots of selfies / outfit changes</td><td>Premium + watch token burn; write tighter image prompts</td></tr>
            <tr><td>Same character across chat + longer video</td><td>Compare Candy with <a href="/blog/ourdream-ai-vs-candy-ai-comparison.html">OurDream</a> before locking in</td></tr>
          </tbody>
        </table>
      </div>
      <p>Always verify current plan prices and token allotments on Candy’s live subscriptions page before you buy — affiliate blogs (including older tutorials) drift.</p>

      <h2>Privacy, safety, and rules of the road</h2>
      <ul>
        <li><strong>18+ only</strong> — no exceptions.</li>
        <li><strong>Fictional adults</strong> — do not request real-person deepfakes or non-consensual intimate imagery.</li>
        <li><strong>Read retention policy</strong> — chats and generations can be stored; delete/account rights exist but legal retention may apply.</li>
        <li><strong>Billing privacy</strong> — check how the charge appears on your statement.</li>
        <li><strong>Moderation</strong> — illegal content, hate, and exploitation are banned; accounts can be removed.</li>
      </ul>
      <p>Broader ethics context: <a href="/blog/building-your-fantasy-from-scratch-ai-adult-ethics.html">Building fantasy from scratch</a> and <a href="/blog/ai-porn-privacy.html">AI porn privacy</a>.</p>

      <h2>Candy AI vs watching on thebestpornai</h2>
      <p>If you want to <em>talk</em> and generate with one character, use ${ext(CANDY, "Candy AI")}. If you want to <em>watch</em> curated AI scenes without prompting, stay on <a href="/">thebestpornai</a> — <a href="/categories/ai-generated.html">AI Generated</a>, <a href="/shorts">Shorts</a>, and pornstar packs. Many people do both: chat on Candy, then cool down with a finished clip here.</p>

      <h2>Related guides on this site</h2>
      <ul>
        <li><a href="/blog/candy-ai-review-2026.html">Candy AI Review 2026</a> — scores and photorealism notes</li>
        <li><a href="/blog/ourdream-ai-vs-candy-ai-comparison.html">OurDream vs Candy AI</a> — buyer’s comparison</li>
        <li><a href="/blog/ai-sex-chats-ultimate-guide-2026.html">AI sex chats ultimate guide</a> — category map</li>
        <li><a href="/blog/best-ai-companion-uncensored-image-platforms-2026.html">Best AI companion platforms 2026</a></li>
        <li><a href="/blog/how-to-write-better-ai-prompts.html">Better AI prompts</a></li>
      </ul>

      <p class="cta-row" style="margin:2em 0 1em;display:flex;flex-wrap:wrap;gap:10px">
        <a class="btn blog-cta-primary" href="${CANDY}" target="_blank" rel="${REL}">Start on Candy AI</a>
        <a class="btn blog-cta-ghost" href="${CANDY_CREATE}" target="_blank" rel="${REL}">Build your AI companion</a>
        <a class="btn blog-cta-ghost" href="/shorts">Watch AI Shorts instead</a>
      </p>
    `,
};
