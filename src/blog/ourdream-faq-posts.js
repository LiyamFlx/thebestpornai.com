/* OurDream.ai FAQ series — 8 standalone guides, internally linked. */
import { ourdreamUrl } from "../shared/affiliates.js";
const OD = ourdreamUrl("create", "blog-ourdream-faq");
const od = (label = "Try OurDream.ai") =>
  `<a href="${OD}" target="_blank" rel="noopener sponsored nofollow">${label}</a>`;

function yt(id, title) {
  return `
    <div class="blog-yt">
      <iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${title}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
    </div>`;
}

function fig(src, alt, cap) {
  return `
    <figure class="blog-inline-figure">
      <img src="${src}" alt="${alt}" width="1024" height="1365" loading="lazy" decoding="async"/>
      <figcaption class="blog-media-caption">${cap}</figcaption>
    </figure>`;
}

/* A promo figure that is fully clickable (outbound affiliate). */
function linkedFig(href, src, alt, cap) {
  return `
    <figure class="blog-inline-figure">
      <a href="${href}" target="_blank" rel="noopener sponsored nofollow" aria-label="${alt}">
        <img src="${src}" alt="${alt}" width="1024" height="1365" loading="lazy" decoding="async"/>
      </a>
      <figcaption class="blog-media-caption">${cap}</figcaption>
    </figure>`;
}

const SERIES = `
  <nav class="blog-series" aria-label="OurDream.ai FAQ series">
    <p class="blog-series-label">OurDream.ai FAQ series</p>
    <ol>
      <li><a href="/blog/what-is-ai-sex-chat-ourdream.html">What is AI sex chat?</a></li>
      <li><a href="/blog/create-ai-sex-chat-character-ourdream.html">Create your own character</a></li>
      <li><a href="/blog/ourdream-ai-voice-chat.html">Voice chat + text</a></li>
      <li><a href="/blog/ourdream-ai-privacy-conversations.html">Privacy &amp; encryption</a></li>
      <li><a href="/blog/ourdream-nsfw-ai-chat-requirements.html">NSFW access</a></li>
      <li><a href="/blog/ourdream-dreamcoins-explained.html">Dreamcoins</a></li>
      <li><a href="/blog/ourdream-generate-images-videos-same-character.html">Images &amp; videos</a></li>
      <li><a href="/blog/is-ourdream-ai-free.html">Free vs subscription</a></li>
      <li><a href="/blog/building-your-fantasy-from-scratch-ai-adult-ethics.html">Part 2 — Ethics of AI adult media</a></li>
    </ol>
  </nav>`;

const PART2 = `
  <aside class="blog-part2">
    <p class="blog-series-label">Part 2</p>
    <p class="blog-part2-title"><a href="/blog/building-your-fantasy-from-scratch-ai-adult-ethics.html">Building Your Fantasy From Scratch</a></p>
    <p>Consent, likeness, privacy, and what happens when fantasy becomes programmable — a separate editorial, not another product FAQ.</p>
    <a class="blog-cta blog-cta-ghost" href="/blog/building-your-fantasy-from-scratch-ai-adult-ethics.html">Read the ethics guide →</a>
  </aside>`;

const CTA = `
  <p class="blog-takeaway"><strong>Want to try it:</strong> ${od("Open OurDream.ai")} (18+). Prefer finished scenes with no credits? Stream free on <a href="/">thebestpornai</a>.</p>
  ${PART2}`;

const RAW = [
  {
    id: 40,
    slug: "what-is-ai-sex-chat-ourdream",
    title: "What is AI Sex Chat and How Does It Work on OurDream.ai?",
    category: "Guides",
    cover: "/blog-assets/ourdream-pink-studio.jpg",
    excerpt:
      "AI sex chat on OurDream.ai is a customizable partner you can text, generate images and videos of, and call — one character across every mode.",
    microcopy: "Text, images, video, and voice on one character — not a one-trick chatbot.",
    date: "2026-08-14",
    dateModified: "2026-08-14",
    readMins: 5,
    coverVideoId: 5168,
    relatedVideoIds: [5168, 5248, 5257, 2],
    tags: ["ai sex chat", "ourdream ai", "ai companion", "nsfw ai chat", "dreamcoins"],
    body: `
      <p>AI sex chat has evolved far beyond simple text bots. On ${od("OurDream.ai")}, it means creating a fully customizable digital partner you can talk to, generate images and videos of, and even speak with through voice calls — all in one place.</p>
      ${fig("/blog-assets/ourdream-pink-studio.jpg", "Custom AI companion character in a studio setting", "One character stays consistent across chat, stills, and video.")}
      <p>OurDream.ai is built around character creation and multi-modal interaction. You design a character with their own personality, appearance, and backstory. Once created, you can chat through text, generate images and videos that match their look and the scene you describe, and connect via voice calls or audio messages.</p>
      ${yt("IfhczYCZEDg", "OurDream.ai AI sex chat walkthrough")}
      <p>The experience is powered by <strong>dreamcoins</strong>, the platform’s internal currency. Coins generate visual content, make voice calls, and unlock other features. NSFW content becomes available once you have an <a href="/blog/ourdream-nsfw-ai-chat-requirements.html">active subscription</a>.</p>
      ${fig("/blog-assets/sex-chat.jpg", "AI sex chat conversation on a phone", "Chat is one layer — the same partner can generate matching scenes.")}
      <p>Unlike rigid chatbots that stick to a fixed script, OurDream.ai lets the character respond according to the personality and history you defined. That creates a more consistent, immersive experience, whether the conversation stays light or moves into explicit territory.</p>
      <p>The combination of text, image generation, video, and voice in a single platform is what sets it apart. You don’t jump between tools — everything stays connected to the same character. For a head-to-head, see <a href="/blog/ourdream-ai-vs-candy-ai-comparison.html">OurDream vs Candy</a> and our <a href="/blog/best-ai-companion-uncensored-image-platforms-2026.html">companion ranking</a>.</p>
      ${CTA}
      ${SERIES}
    `,
    faqs: [
      { q: "What is AI sex chat on OurDream.ai?", a: "A multi-modal partner: text chat, image and video generation, and voice/audio, all tied to one custom character." },
      { q: "Do I need dreamcoins?", a: "Dreamcoins pay for images, video, voice, packs, and (on the free tier) text. Unused coins stay in the balance until spent." },
      { q: "Is NSFW included by default?", a: "NSFW unlocks with an 18+ account and an active subscription. Without a plan, visuals stay blurred." },
    ],
  },
  {
    id: 41,
    slug: "create-ai-sex-chat-character-ourdream",
    title: "Can I Create My Own Character for AI Sex Chat on OurDream.ai?",
    category: "Guides",
    cover: "/blog-assets/character-for-ai-sex.webp",
    excerpt:
      "OurDream.ai lets you build a character from scratch — personality, backstory, look — or start faster with subscriber community packs.",
    microcopy: "Scratch-built characters, or community packs if you want to start tonight.",
    date: "2026-08-14",
    dateModified: "2026-08-14",
    readMins: 4,
    coverVideoId: 5257,
    relatedVideoIds: [5257, 5168, 5248, 4],
    tags: ["ai character creator", "ourdream ai", "ai sex chat", "custom ai girlfriend"],
    body: `
      <p>One of the strongest features of ${od("OurDream.ai")} is that character creation sits at the center of the experience. You are not limited to a library of pre-made characters.</p>
      ${fig("/blog-assets/character-for-ai-sex.webp", "Building a custom AI sex chat character", "Personality, backstory, and look become the same person in chat and generations.")}
      <p>You can build a character completely from scratch: personality traits, a backstory, and appearance. That character becomes the foundation for everything that follows — text chat, image generation, video, and voice.</p>
      ${fig("/blog-assets/ourdream-lace-bedroom.jpg", "Custom AI character in a bedroom scene", "Once the character exists, every scene stays on the same face and body language.")}
      ${fig("/blog-assets/character-for-ai-sex1.webp", "Another custom AI sex chat character design", "Community packs exist if you want a faster start without building from zero.")}
      <p>For a faster start, <strong>community packs</strong> with existing characters are available to subscribers. Most users still take the full creator: you shape attitude, speaking style, and how they look in generated images and videos.</p>
      <p>Whether you create your own or use a pack, the same features apply once the character is set up. Prefer named faces with no prompting? Stream <a href="/creator/ps-mia-nympo">Mia Nympo</a> and other packs free on thebestpornai.</p>
      ${CTA}
      ${SERIES}
    `,
    faqs: [
      { q: "Do I have to use pre-made characters?", a: "No. Full scratch creation is the default. Community packs are an optional shortcut for subscribers." },
      { q: "Does a custom character work in video?", a: "Yes. Chat, images, video, and voice all use the same character definition." },
    ],
  },
  {
    id: 42,
    slug: "ourdream-ai-voice-chat",
    title: "Does OurDream.ai Support AI Voice Chat as Well as Text?",
    category: "Guides",
    cover: "/blog-assets/ourdream-kitchen-stretch.jpg",
    excerpt:
      "OurDream.ai supports text chat plus voice calls and audio messages. Voice spends dreamcoins and keeps the same character personality.",
    microcopy: "Type the long scene. Call when you want presence.",
    date: "2026-08-14",
    dateModified: "2026-08-14",
    readMins: 4,
    coverVideoId: 5248,
    relatedVideoIds: [5248, 5168, 2, 7],
    tags: ["ai voice chat", "ourdream ai", "ai sex chat", "dreamcoins"],
    body: `
      <p>Yes. ${od("OurDream.ai")} supports both text chat and voice interaction.</p>
      ${fig("/blog-assets/ourdream-kitchen-stretch.jpg", "AI companion character in a casual kitchen scene", "Voice sits on the same personality you already chat with.")}
      <p>In addition to regular text conversations, the platform offers voice calls and audio messages. Your character is not limited to written replies — you can hear them respond in real time or receive audio messages.</p>
      ${yt("IfhczYCZEDg", "OurDream.ai walkthrough — chat, voice, and premium plans")}
      <p>Voice features use the same <a href="/blog/ourdream-dreamcoins-explained.html">dreamcoin</a> system as image and video generation. A call or an audio message consumes coins from your balance.</p>
      <p>Having both modes creates flexibility. Some users prefer typing for longer, detailed scenes; others want the presence of a voice call. Because personality and backstory stay consistent across formats, the experience feels continuous whether you are typing or speaking. That multi-modal loop (text + voice + visuals) is a core strength of the platform.</p>
      ${CTA}
      ${SERIES}
    `,
    faqs: [
      { q: "Is voice included with chat?", a: "Voice calls and audio messages are available on the same character. They consume dreamcoins." },
      { q: "Can I switch between text and voice?", a: "Yes. The character’s history and personality carry across formats." },
    ],
  },
  {
    id: 43,
    slug: "ourdream-ai-privacy-conversations",
    title: "Are My Conversations and Characters Private on OurDream.ai?",
    category: "Guides",
    cover: "/blog-assets/ourdream-privacy-halo.jpg",
    excerpt:
      "OurDream.ai encrypts conversations, offers optional 2FA, and lets you edit or delete chat history. Characters stay private unless you share them.",
    microcopy: "Encryption, optional 2FA, and history you can delete.",
    date: "2026-08-14",
    dateModified: "2026-08-14",
    readMins: 4,
    coverVideoId: 3,
    relatedVideoIds: [3, 7, 5168, 12],
    tags: ["ourdream privacy", "ai sex chat privacy", "encrypted ai chat"],
    body: `
      <p>Privacy is treated as a priority on ${od("OurDream.ai")}.</p>
      ${fig("/blog-assets/ourdream-privacy-halo.jpg", "Private AI companion conversation, editorial portrait", "Your characters are not published unless you choose to share them.")}
      <p>Every conversation is encrypted end-to-end, so the content of your chats is protected so that only you and the system processing the interaction can access it in readable form. Optional two-factor authentication adds an extra layer of account security.</p>
      <p>OurDream.ai states that it does not share or sell user information. You also have full control over chat history — you can edit or delete conversations at any time.</p>
      <p>Your characters and the interactions you have with them remain private. Nothing is published or made visible to other users unless you choose to share it. Encryption, account options, and history control are meant to give people confidence in personal or explicit sessions. Always confirm the live privacy policy on the site before you subscribe — wording can change.</p>
      ${CTA}
      ${SERIES}
    `,
    faqs: [
      { q: "Are chats encrypted?", a: "OurDream.ai states conversations are end-to-end encrypted." },
      { q: "Can other users see my characters?", a: "Not unless you share them. History can be edited or deleted by you." },
    ],
  },
  {
    id: 44,
    slug: "ourdream-nsfw-ai-chat-requirements",
    title: "What Do You Need to Access NSFW AI Chat on OurDream.ai?",
    category: "Guides",
    cover: "/blog-assets/ourdream-couch-scene.jpg",
    excerpt:
      "NSFW on OurDream.ai needs you to be 18+ and on an active subscription. Without a plan, images and video stay blurred.",
    microcopy: "18+ and a paid plan. That’s the gate.",
    date: "2026-08-14",
    dateModified: "2026-08-14",
    readMins: 4,
    coverVideoId: 2,
    relatedVideoIds: [2, 4, 5168, 1],
    tags: ["nsfw ai chat", "ourdream subscription", "uncensored ai"],
    body: `
      <p>Access to NSFW features on ${od("OurDream.ai")} requires two things: you must be <strong>18 or older</strong>, and you must have an <strong>active subscription</strong>.</p>
      ${fig("/blog-assets/ourdream-couch-scene.jpg", "Uncensored AI adult scene generated in-platform", "Without a plan, generated visuals stay blurred.")}
      <p>Without a subscription, image and video content is blurred, and certain features remain locked. Once you subscribe, full NSFW capabilities become available, including uncensored image and video generation along with unrestricted chat.</p>
      <ul>
        <li>Monthly: <strong>$19.99 / month</strong></li>
        <li>Annual: <strong>$119.88 / year</strong> (about $9.99 / month) with a larger initial dreamcoin allocation</li>
      </ul>
      <p>Age verification and an active paid plan are the only requirements for unlocking the complete NSFW experience. Full pricing and payment methods: <a href="/blog/is-ourdream-ai-free.html">Is OurDream.ai free?</a></p>
      ${CTA}
      ${SERIES}
    `,
    faqs: [
      { q: "Can I use NSFW OurDream for free?", a: "No. NSFW requires 18+ and an active paid plan. Free browsing leaves visuals blurred." },
      { q: "What does a subscription unlock?", a: "Uncensored image and video generation plus unrestricted chat, plus ongoing dreamcoin grants." },
    ],
  },
  {
    id: 45,
    slug: "ourdream-dreamcoins-explained",
    title: "How Do Dreamcoins Work on OurDream.ai? Do They Expire?",
    category: "Guides",
    cover: "/blog-assets/ourdream-gym-pink.jpg",
    excerpt:
      "Dreamcoins power OurDream.ai chat, images, video, and voice. They do not expire — but the 1,000 monthly plan coins do not roll over. Top-ups stay.",
    microcopy: "No hard expiry date. Monthly grant coins still reset on renewal. Bought packs do not.",
    date: "2026-08-14",
    dateModified: "2026-08-14",
    readMins: 7,
    coverVideoId: 4,
    relatedVideoIds: [4, 7, 12, 1],
    tags: ["dreamcoins", "ourdream ai", "ai credits", "ourdream pricing"],
    body: `
      <p>On ${od("OurDream.ai")}, almost everything that is not a paid member’s standard text message is priced in <strong>Dreamcoins</strong>. Free trial or annual plan, the same wallet pays for GPU work. Get the expiry rules wrong and you will either hoard coins that reset, or panic-buy packs you did not need.</p>
      <p>Official wording lives in the <a href="https://help.ourdream.ai" target="_blank" rel="noopener nofollow">OurDream Help Center</a>. Confirm rates there before a big spend — they can move. Plans and checkout: <a href="/blog/is-ourdream-ai-free.html">free vs paid</a>.</p>

      <h2>What Dreamcoins actually are</h2>
      <p>They are internal credits, not cash you withdraw. Light work (plain text) barely touches the servers. Images, video, and voice eat GPU time. OurDream meters that with coins so you are not hitting a card on every render.</p>
      <ul>
        <li><strong>Text</strong> — cheap or free if you subscribe</li>
        <li><strong>Stills, video, voice</strong> — the real drain</li>
      </ul>

      <h2>What each feature costs</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Action</th><th>Free user</th><th>Paid subscriber</th></tr>
          </thead>
          <tbody>
            <tr><td>Standard text</td><td>1 coin / message</td><td>Unlimited (0)</td></tr>
            <tr><td>Genius / Lively Genius chat</td><td>1 / reply</td><td>1 / reply</td></tr>
            <tr><td>Image generation</td><td>~10 / image (or 10 per 2; 5 for in-chat auto-gen)</td><td>Same</td></tr>
            <tr><td>Enhance / edit</td><td>10–20 (Spark vs Eclipse)</td><td>Same</td></tr>
            <tr><td>Video</td><td>100 / 5 seconds (up to 1,200 for 60s; +200 Ultra)</td><td>Same</td></tr>
            <tr><td>Voice call</td><td>50 / minute</td><td>Same</td></tr>
            <tr><td>Narration</td><td>0 standard; 5 / paragraph premium</td><td>Same</td></tr>
            <tr><td>New character (first 2 avatars)</td><td>10</td><td>10</td></tr>
            <tr><td>Community pack unlock</td><td>250 / 750 / 1,000</td><td>Same</td></tr>
          </tbody>
        </table>
      </div>
      <p>Paid chat is the only “unlimited” line that matters. Everything visual still burns the grant. A 60-second clip can wipe a month of coins; a hundred stills will too if you treat auto-gen as free.</p>

      <h2>How you get coins</h2>
      <ol>
        <li><strong>Monthly plan — $19.99 / month.</strong> 1,000 Dreamcoins on each billing date.</li>
        <li><strong>Annual plan — $119.88 / year (~$9.99 / month).</strong> 2,000 coins up front, then 1,000 every following month.</li>
        <li><strong>Top-up packs.</strong> Extra tokens in the store if the grant is gone. Example bundles: 1,000 for $11.99, 5,000 for $49.99. Usually requires an active subscription.</li>
        <li><strong>Referrals.</strong> Invite links can add a free buffer when the live program is on.</li>
      </ol>

      <h2>Do they expire? Rollover vs “never expire”</h2>
      <p>People mix up a hard expiry date with a monthly reset. The Help Center’s line is: <strong>Dreamcoins do not expire</strong>. The catch is <em>which</em> coins, and how you got them.</p>
      <h3>Rule 1 — monthly plan coins do not roll over</h3>
      <p>The <strong>1,000 subscription coins do not carry into the next cycle</strong>. On renewal the grant resets to the new 1,000. Use 400, and the leftover 600 are gone. You start the next month at 1,000 — not 1,600.</p>
      <h3>Rule 2 — purchased top-ups stay</h3>
      <p>Cash packs sit in the account until you spend them. No clock. If you need a stash that survives renewal, buy a pack; do not hoard the monthly grant.</p>
      <h3>Rule 3 — cancel does not wipe the wallet</h3>
      <p>Remaining coins are not deleted. The account just becomes free again: text costs 1 coin per message, unblurred / NSFW media can lock. Spend or accept the sandbox. More on that gate: <a href="/blog/ourdream-nsfw-ai-chat-requirements.html">NSFW access</a>.</p>

      <h2>How to stop wasting the grant</h2>
      <ul>
        <li><strong>Burn the monthly 1,000 before renewal</strong> — stills or a short clip, not leftover guilt.</li>
        <li><strong>Chat on a paid plan</strong> — text is already paid for. Save coins for images, audio, and video.</li>
        <li><strong>Annual if you are staying</strong> — half the monthly cash rate plus the 2,000-coin start.</li>
        <li><strong>Referrals</strong> — a buffer that is not a top-up.</li>
        <li><strong>Don’t generate to watch.</strong> Finished scenes with no coin meter live on <a href="/">thebestpornai</a>.</li>
      </ul>
      ${CTA}
      ${SERIES}
    `,
    faqs: [
      {
        q: "Do Dreamcoins expire?",
        a: "There is no hard expiry date. Monthly subscription coins do not roll over — unused grant coins are replaced by the next 1,000 on renewal. Purchased top-up packs stay until spent.",
      },
      {
        q: "Do monthly plan coins roll over?",
        a: "No. If you use 400 of 1,000, you start the next billing cycle at 1,000, not 1,600.",
      },
      {
        q: "How much is an image or a video?",
        a: "About 10 coins per image (sometimes 10 per two, or 5 for in-chat auto-gen). Video is about 100 coins per 5 seconds. Voice calls are about 50 coins per minute.",
      },
      {
        q: "What happens to coins if I cancel?",
        a: "The balance is not deleted. The account reverts to free rules: 1 coin per text message, and unblurred/NSFW generation can lock.",
      },
    ],
  },
  {
    id: 46,
    slug: "ourdream-generate-images-videos-same-character",
    title: "Can I Generate Images and Videos of My AI Character on OurDream.ai?",
    category: "Guides",
    cover: "/blog-assets/ourdream-studio-athlete.jpg",
    excerpt:
      "Yes — OurDream.ai generates stills and short videos of the same character you chat with. How consistency works, coin costs, no-upload rules, and when to stream instead.",
    microcopy: "Same face in chat, portraits, and short clips — without exporting to a second app.",
    date: "2026-08-14",
    dateModified: "2026-08-14",
    readMins: 7,
    coverVideoId: 12,
    relatedVideoIds: [12, 5168, 5257, 4],
    tags: [
      "generate images of ai character",
      "ourdream ai video",
      "consistent ai character",
      "ai character portraits",
      "dreamcoins",
      "nsfw video",
    ],
    body: `
      <p>Text chat is enough until it isn’t. Once you have built a persona on ${od("OurDream.ai")}, the next question is almost always the same: <strong>can you generate images and videos of that exact character</strong>, or do you have to hop to another tool and hope the face matches?</p>
      <p>The short answer is <strong>yes</strong>. Stills and short clips are built into the same product as chat and voice. You do not export a character card to Midjourney, a separate video app, or a face-swap site. You stay on OurDream, spend <a href="/blog/ourdream-dreamcoins-explained.html">dreamcoins</a>, and the generation is supposed to follow the persona you already defined.</p>

      <h2>Why visual consistency is the real product</h2>
      <p>Most “AI girlfriend” stacks fail the second picture. Prompt one café scene, then a bedroom scene, and you get two different people who share a hair color at best. That <em>visual drift</em> kills immersion faster than a weak reply.</p>
      <p>OurDream’s pitch is consistent character rendering:</p>
      <ul>
        <li><strong>Unified facial features</strong> — core structure, hair, and distinguishing marks are meant to persist across prompts instead of being rolled from scratch each time.</li>
        <li><strong>Recognizable identity in new settings</strong> — a modern gym, a kitchen, a staged portrait — the same person, not a random model who “kind of looks like her.”</li>
      </ul>
      <p>It will not be pixel-perfect every frame. No consumer model is. Treat it as “recognizable companion,” not a locked VFX hero. If a render drifts, tighten the base profile (eyes, hair, baseline style) before you burn more coins on video.</p>

      <h2>What you can actually generate</h2>
      <h3>1. Consistent character portraits</h3>
      <p>Turn a chat beat into a still: expression, outfit, lighting, location. That is how a text thread becomes a visual gallery tied to one storyline instead of a folder of strangers.</p>
      ${fig("/blog-assets/ai-boobs-generate.webp", "In-platform AI adult portrait generated on OurDream.ai", "Portraits spend dreamcoins. NSFW stills unlock with an 18+ subscription.")}
      <h3>2. Short video animation</h3>
      <p>Beyond stills, you can animate a portrait into a brief clip — micro-expression, a little body motion, something closer to presence than a JPEG. These are short clips, not ten-minute movies. Use them as punctuation on a scene, not as a replacement for a watch library.</p>
      ${yt("WN2Iy4RWKSw", "OurDream.ai image and video generation of a custom character")}
      <h3>3. Community content packs</h3>
      <p>Subscribers can browse community-curated packs: shared stills and clips around popular characters. Useful for a faster start or for seeing what the engine actually looks like before you spend coins on your own persona. Same rule as <a href="/blog/create-ai-sex-chat-character-ourdream.html">character creation</a> — packs and custom characters share the generation tools once they are set up.</p>

      <h2>Rules that matter before you hit generate</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Rule</th><th>What it means in practice</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>No external photo uploads</strong></td>
              <td>You cannot drop in a real selfie or a celebrity still to clone a living person. Characters are built from prompts and presets. That is a deepfake / consent guardrail, not a missing filter.</td>
            </tr>
            <tr>
              <td><strong>Coins and subscription</strong></td>
              <td>Chat may be easy to start. Stills, video, and packs consume <a href="/blog/ourdream-dreamcoins-explained.html">dreamcoins</a> and typically need an <a href="/blog/ourdream-nsfw-ai-chat-requirements.html">active plan</a> for uncensored output. Unused coins stay until spent.</td>
            </tr>
            <tr>
              <td><strong>18+ NSFW gate</strong></td>
              <td>Without a subscription, generated media stays blurred. Age plus a paid plan unlocks the uncensored path. Details: <a href="/blog/is-ourdream-ai-free.html">is OurDream free?</a></td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>How to get better stills and clips</h2>
      <ol>
        <li><strong>Lock visual anchors first.</strong> In the character profile, be specific: eye shape, hair, body type, photoreal vs anime. Vague bases drift.</li>
        <li><strong>Prompt the scene, not a new person.</strong> Lighting, room, wardrobe, mood. Do not rewrite the face in every request.</li>
        <li><strong>Spend video on highlights.</strong> Stills are cheaper. Save clips for the moment the scene actually needs motion.</li>
        <li><strong>Know when to stop generating.</strong> If you only want to <em>watch</em> finished AI video with no coin meter, that is a different product — stream free on <a href="/">thebestpornai</a>.</li>
      </ol>
      <p>OurDream is for people who want one character across text, ${od("voice")}, stills, and short video. thebestpornai is for people who want the scene already cut. Use the first when you are building; use the second when you are done prompting.</p>
      ${CTA}
      ${SERIES}
    `,
    faqs: [
      {
        q: "Can I generate both images and videos of my OurDream character?",
        a: "Yes. Portraits and short video clips are generated inside OurDream.ai on the same character you use for chat and voice. You do not export to another app.",
      },
      {
        q: "Will my character look the same in every image?",
        a: "The platform is built to keep core facial features and identity consistent across scenes. Some drift still happens. A precise character profile reduces it.",
      },
      {
        q: "Can I upload a real photo to make the character look like someone I know?",
        a: "No. External photo uploads are blocked to prevent non-consensual likenesses and deepfakes. Build the look with prompts and presets.",
      },
      {
        q: "Do image and video generations cost extra?",
        a: "They consume dreamcoins — about 10 per two stills, 100 per 5 seconds of video, 50 per minute of voice. Unused coins stay. Uncensored output generally needs an 18+ subscription.",
      },
    ],
  },
  {
    id: 47,
    slug: "is-ourdream-ai-free",
    title: "Is OurDream.ai Free, or Do I Need a Subscription?",
    category: "Guides",
    cover: "/blog-assets/07-lilith-dream-portrait.jpg",
    excerpt:
      "OurDream.ai review: free vs paid, $19.99 vs $119.88/year, exact Dreamcoin rates (images, video, voice), and why unused coins stay. PayPal is not accepted.",
    microcopy: "Browse for free. Unblurred media, NSFW, unlimited chat, and voice sit behind a plan.",
    date: "2026-08-14",
    dateModified: "2026-08-14",
    readMins: 8,
    coverVideoId: 7,
    relatedVideoIds: [7, 2, 5168, 12],
    tags: [
      "ourdream pricing",
      "is ourdream ai free",
      "ourdream subscription",
      "dreamcoins",
      "ourdream annual plan",
    ],
    body: `
      <p>When people ask whether ${od("OurDream.ai")} is free, they usually want one of two things: a cheap way to talk to a character, or uncensored images and video of that character. The short answer: you can browse public feeds and burn a small signup token bonus for free. Core use — uncensored roleplay, unblurred stills and video, voice calls, and community packs — needs an active paid plan.</p>
      <p>If you only want to <em>watch</em> finished AI scenes, you do not need this product at all. Stream on <a href="/">thebestpornai</a> instead.</p>

      <h2>Free tier vs paid membership</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Feature</th><th>Free / unsubscribed</th><th>Paid membership</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Chat</strong></td><td>1 Dreamcoin per message</td><td>Unlimited standard chat (0 coins)</td></tr>
            <tr><td><strong>Images &amp; video</strong></td><td>Blurred or locked previews</td><td>Unblurred HD generation</td></tr>
            <tr><td><strong>NSFW / adult</strong></td><td>Locked / filtered</td><td>Uncensored (18+)</td></tr>
            <tr><td><strong>Voice &amp; narration</strong></td><td>Locked</td><td>Live calls and narration</td></tr>
            <tr><td><strong>Monthly coins</strong></td><td>Signup / referral bonus only</td><td>1,000 / month (annual: 2,000 at start)</td></tr>
            <tr><td><strong>Community packs</strong></td><td>Locked / read-only</td><td>Full unlock</td></tr>
            <tr><td><strong>Character continuity</strong></td><td>Basic test viewing</td><td>Same persona across text, voice, stills, video</td></tr>
          </tbody>
        </table>
      </div>

      <h2>What the free tier actually lets you do</h2>
      <p>You can create an account, look at discovery feeds, and peek at community characters. Then the rails go up:</p>
      <ul>
        <li><strong>1 coin per message</strong> after the bonus is gone — chat is not free once you are testing in earnest.</li>
        <li><strong>Blurred media</strong> — stills, photos, and short clips stay hidden until you pay. See <a href="/blog/ourdream-generate-images-videos-same-character.html">images and video</a>.</li>
        <li><strong>NSFW locked</strong> — uncensored roleplay stays off. <a href="/blog/ourdream-nsfw-ai-chat-requirements.html">NSFW requirements</a>.</li>
        <li><strong>Packs locked</strong> — subscriber decks and advanced modules stay closed.</li>
      </ul>
      <p>That is a sandbox to judge the UI. Regular conversation, visual generation, or unrestricted roleplay means an upgrade.</p>

      <h2>Plans, price, and checkout</h2>
      ${linkedFig(OD, "/blog-assets/sex-chat-cta-banner.webp", "OurDream.ai subscription call to action — click to open OurDream.ai", "Annual is half the monthly rate if you already know you will stay.")}
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th></th><th>Monthly</th><th>Annual</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Price</strong></td><td>$19.99 / month</td><td>$119.88 / year (~$9.99 / month)</td></tr>
            <tr><td><strong>Uncensored access</strong></td><td>Yes</td><td>Yes</td></tr>
            <tr><td><strong>Standard chat</strong></td><td>Unlimited</td><td>Unlimited</td></tr>
            <tr><td><strong>Dreamcoins</strong></td><td>1,000 each renewal</td><td>2,000 at start (1,000 + 1,000 bonus), then 1,000 / month</td></tr>
            <tr><td><strong>Vs paying monthly</strong></td><td>—</td><td>~50% less over a year</td></tr>
          </tbody>
        </table>
      </div>
      <p>Accepted at the time of writing: Visa, Mastercard, Amex, Discover; major crypto; G2A Pay. <strong>PayPal is not accepted.</strong> Confirm on the live checkout — gateways change.</p>

      <h2>Exact Dreamcoin rates</h2>
      <p>Dreamcoins are GPU / model tokens. There is <strong>no hard expiry date</strong>, but the 1,000 monthly <em>grant</em> coins <strong>do not roll over</strong> — leftover grant is replaced on renewal. Bought top-ups stay. Full rules: <a href="/blog/ourdream-dreamcoins-explained.html">how Dreamcoins work</a>.</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Action</th><th>Cost</th></tr>
          </thead>
          <tbody>
            <tr><td>Standard text (subscriber)</td><td>0</td></tr>
            <tr><td>Standard text (free)</td><td>1 / message</td></tr>
            <tr><td>Genius / Lively Genius chat</td><td>1 / reply</td></tr>
            <tr><td>Image generation</td><td>10 / 2 images (5 for in-chat auto-gen)</td></tr>
            <tr><td>Enhance / edit (Spark vs Eclipse)</td><td>10–20</td></tr>
            <tr><td>Video</td><td>100 / 5 seconds (up to 1,200 for 60s); +200 Ultra</td></tr>
            <tr><td>Voice call</td><td>50 / minute</td></tr>
            <tr><td>Narration</td><td>0 standard; 5 / paragraph premium</td></tr>
            <tr><td>New character (incl. first 2 avatars)</td><td>10</td></tr>
            <tr><td>Community pack unlock</td><td>250 / 750 / 1,000</td></tr>
          </tbody>
        </table>
      </div>
      <ul>
        <li>Monthly grant: <strong>1,000 coins</strong> on each renewal. Annual also drops <strong>2,000 immediately</strong>.</li>
        <li>Top-ups (need an active plan): e.g. <strong>1,000 for $11.99</strong> or <strong>5,000 for $49.99</strong>.</li>
        <li>Referrals can add bonus coins if the live program is on.</li>
        <li>Cancel: leftover coins stay, but the profile is free again — chat costs 1 coin, unblurred/NSFW tools lock.</li>
      </ul>
      <p>One thousand coins is a lot of stills and almost no video. A single 60-second clip can eat the whole monthly grant. That is why the subscription is the unlock, and packs are for people who generate past the allotment.</p>

      <h2>Same character across chat, stills, and video</h2>
      <p>Once look, backstory, and personality are set, that persona is meant to hold across text, ${od("voice")}, stills, and clips. You do not export a LoRA to another site. Generators sit in the same chat and spend the same balance. More on that: <a href="/blog/ourdream-generate-images-videos-same-character.html">generate images and videos of your character</a>.</p>

      <h2>Verdict</h2>
      <p>Browse archetypes for free. Live in the product on a plan. For regular roleplay, voice, and unblurred media, the <strong>annual plan at $119.88</strong> is the only price that is not a tax on indecision — half the monthly rate plus the 2,000-coin start.</p>
      <p>If you do not want to generate, do not buy coins to watch. Use <a href="/">thebestpornai</a>, and read <a href="/blog/free-ai-porn-what-is-free-vs-trap.html">free vs trap</a> before you card any “free AI porn” page.</p>
      ${CTA}
      ${SERIES}
    `,
    faqs: [
      {
        q: "Can I use OurDream.ai for free indefinitely?",
        a: "You can browse characters for free. Unsubscribed chat costs 1 coin per message. When signup tokens run out, messaging stops until you subscribe or add coins.",
      },
      {
        q: "Do Dreamcoins expire if I don't use them?",
        a: "No hard expiry date. Monthly subscription grant coins do not roll over (unused grant is replaced on renewal). Purchased top-up packs stay until spent.",
      },
      {
        q: "What happens if I cancel my subscription?",
        a: "The account reverts to free status. Remaining coins stay, but chat costs 1 coin per message again and uncensored/unblurred tools lock.",
      },
      {
        q: "Does OurDream.ai offer full NSFW?",
        a: "Yes, for active 18+ paid members. Uncensored roleplay and unblurred generation are gated behind a subscription.",
      },
      {
        q: "Can I pay with PayPal?",
        a: "Not at the time of writing. Checkout lists cards, crypto, and G2A.",
      },
    ],
  },
];

export const OURDREAM_FAQ_POSTS = RAW.map((p) => ({
  ...p,
  coverLayout: "portrait",
  dropCap: false,
  wide: false,
}));
