/* OurDream.ai FAQ series — 8 standalone guides, internally linked. */
const OD = "https://ourdream.ai/?ref=thebestpornai";
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
    </ol>
  </nav>`;

const CTA = `
  <p class="blog-takeaway"><strong>Want to try it:</strong> ${od("Open OurDream.ai")} (18+). Prefer finished scenes with no credits? Stream free on <a href="/">thebestpornai</a>.</p>`;

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
      { q: "Do I need dreamcoins?", a: "Dreamcoins pay for images, video, voice calls, and audio. They do not expire." },
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
    relatedVideoIds: [5257, 5168, 5248],
    tags: ["ai character creator", "ourdream ai", "ai sex chat", "custom ai girlfriend"],
    body: `
      <p>One of the strongest features of ${od("OurDream.ai")} is that character creation sits at the center of the experience. You are not limited to a library of pre-made characters.</p>
      ${fig("/blog-assets/character-for-ai-sex.webp", "Building a custom AI sex chat character", "Personality, backstory, and look become the same person in chat and generations.")}
      <p>You can build a character completely from scratch: personality traits, a backstory, and appearance. That character becomes the foundation for everything that follows — text chat, image generation, video, and voice.</p>
      ${fig("/blog-assets/ourdream-lace-bedroom.jpg", "Custom AI character in a bedroom scene", "Once the character exists, every scene stays on the same face and body language.")}
      ${fig("/blog-assets/character-for-ai-sex1.webp", "Another custom AI sex chat character design", "Community packs exist if you want a faster start without building from zero.")}
      <p>For a faster start, <strong>community packs</strong> with existing characters are available to subscribers. Most users still take the full creator: you shape attitude, speaking style, and how they look in generated images and videos.</p>
      <p>Whether you create your own or use a pack, the same features apply once the character is set up. Prefer named faces with no prompting? Stream <a href="/#creator/ps-mia-nympo">Mia Nympo</a> and other packs free on thebestpornai.</p>
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
    relatedVideoIds: [5248, 5168, 2],
    tags: ["ai voice chat", "ourdream ai", "ai sex chat", "dreamcoins"],
    body: `
      <p>Yes. ${od("OurDream.ai")} supports both text chat and voice interaction.</p>
      ${fig("/blog-assets/ourdream-kitchen-stretch.jpg", "AI companion character in a casual kitchen scene", "Voice sits on the same personality you already chat with.")}
      <p>In addition to regular text conversations, the platform offers voice calls and audio messages. Your character is not limited to written replies — you can hear them respond in real time or receive audio messages.</p>
      ${yt("qs_kXEgSUx0", "OurDream.ai voice and character demo")}
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
    relatedVideoIds: [3, 7, 5168],
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
    relatedVideoIds: [2, 4, 5168],
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
      "Dreamcoins pay for images, video, and voice on OurDream.ai. They never expire. Monthly plans grant 1,000 coins; annual starts with 2,000.",
    microcopy: "Coins do not expire. Spend them when you want the render.",
    date: "2026-08-14",
    dateModified: "2026-08-14",
    readMins: 4,
    coverVideoId: 4,
    relatedVideoIds: [4, 7, 12],
    tags: ["dreamcoins", "ourdream ai", "ai credits", "ourdream pricing"],
    body: `
      <p>Dreamcoins are the in-platform currency used on ${od("OurDream.ai")}. They power image generation, video generation, voice calls, audio messages, and other premium features.</p>
      ${fig("/blog-assets/ourdream-gym-pink.jpg", "High-energy AI character used as a generation example", "Each still, clip, or call draws from the same coin balance.")}
      <p>Importantly, dreamcoins <strong>do not expire</strong>. Once they are in your account, they remain available until you use them.</p>
      <ul>
        <li><strong>Monthly</strong> subscribers receive 1,000 dreamcoins on sign-up and another 1,000 coins every month.</li>
        <li><strong>Annual</strong> subscribers receive 2,000 dreamcoins upfront, followed by 1,000 coins each subsequent month.</li>
      </ul>
      <p>If you need more coins while you have an active subscription, additional packs can be purchased. Because the coins never expire, you can accumulate them or use them at your own pace. The subscription unlocks NSFW and the ongoing grant; coins are how you spend on the specific content you want.</p>
      ${CTA}
      ${SERIES}
    `,
    faqs: [
      { q: "Do dreamcoins expire?", a: "No. They remain until used." },
      { q: "How many coins do I get?", a: "Monthly plans start at 1,000 plus 1,000/month. Annual starts at 2,000, then 1,000/month." },
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
    relatedVideoIds: [12, 5168, 5257],
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
              <td>Chat may be easy to start. High-res stills, video, and premium packs consume <a href="/blog/ourdream-dreamcoins-explained.html">dreamcoins</a> and typically need an <a href="/blog/ourdream-nsfw-ai-chat-requirements.html">active plan</a> for uncensored output. Coins do not expire.</td>
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
        a: "They consume dreamcoins, which do not expire. Uncensored output generally requires an 18+ subscription. Extra coin packs can be bought while a plan is active.",
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
      "OurDream.ai is not fully free. A subscription unlocks NSFW, community packs, and unblurred media. Monthly $19.99 or annual $119.88. No PayPal.",
    microcopy: "Paid plan for the real product. Annual cuts the monthly rate in half.",
    date: "2026-08-14",
    dateModified: "2026-08-14",
    readMins: 4,
    coverVideoId: 7,
    relatedVideoIds: [7, 2, 5168],
    tags: ["ourdream pricing", "ourdream free", "ai sex chat cost", "dreamcoins"],
    body: `
      <p>${od("OurDream.ai")} requires a subscription to access its full feature set.</p>
      ${fig("/blog-assets/07-lilith-dream-portrait.jpg", "OurDream-style AI character portrait", "The annual plan is the cheaper way to stay if you already know you want the full toolkit.")}
      <p>Without a subscription, image and video content remains blurred, community packs are unavailable, and NSFW capabilities are locked. An active plan is needed to unlock these features.</p>
      <ul>
        <li><strong>Monthly plan:</strong> $19.99 per month</li>
        <li><strong>Annual plan:</strong> $119.88 per year (equivalent to $9.99 per month), which also includes a larger upfront dreamcoin allocation of 2,000 coins</li>
      </ul>
      <p>Accepted payment methods include credit or debit card, cryptocurrency, and G2A. <strong>PayPal is not currently accepted.</strong></p>
      ${fig("/blog-assets/sex-chat-cta-banner.webp", "OurDream.ai call to action", "The subscription funds NSFW access, regular coin grants, and the full generation toolkit.")}
      <p>The model funds ongoing NSFW access, regular dreamcoin grants, and the full range of generation and interaction tools. The platform is not free, but the annual option significantly lowers the effective monthly cost for users who plan to stay. If you want finished AI video with no credits, watch on <a href="/">thebestpornai</a> — see <a href="/blog/free-ai-porn-what-is-free-vs-trap.html">free vs trap</a>.</p>
      ${CTA}
      ${SERIES}
    `,
    faqs: [
      { q: "Is OurDream.ai free?", a: "Not for NSFW or unblurred generation. Those need a paid plan." },
      { q: "What does annual cost?", a: "$119.88 per year (~$9.99/month) with 2,000 dreamcoins up front." },
      { q: "Can I pay with PayPal?", a: "No. Card, crypto, and G2A are listed. Confirm on checkout." },
    ],
  },
];

export const OURDREAM_FAQ_POSTS = RAW.map((p) => ({
  ...p,
  coverLayout: "portrait",
  dropCap: false,
  wide: false,
}));
