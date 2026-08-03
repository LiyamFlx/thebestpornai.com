import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt.mjs";

function extractJson(text) {
  const raw = String(text || "").trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model returned no JSON object");
  return JSON.parse(body.slice(start, end + 1));
}

const ALLOWED = new Set(["P", "H2", "H3", "UL", "OL", "LI", "BLOCKQUOTE", "EM", "STRONG", "A", "BR", "P"]);

/** Minimal HTML sanitizer for model body fragments. */
export function sanitizeBodyHtml(html) {
  let s = String(html || "");
  // Drop scripts/styles
  s = s.replace(/<\/(?:script|style)[^>]*>/gi, "");
  s = s.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "");
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(/javascript:/gi, "");
  // Strip disallowed tags (keep inner text)
  s = s.replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (full, tag, attrs = "") => {
    const t = tag.toUpperCase();
    if (!ALLOWED.has(t) && t !== "BR") return "";
    if (t === "BR") return "<br/>";
    if (t === "A") {
      const href = (attrs.match(/href\s*=\s*("([^"]*)"|'([^']*)')/i) || [])[2]
        || (attrs.match(/href\s*=\s*("([^"]*)"|'([^']*)')/i) || [])[3] || "";
      const safe = /^(https:\/\/(www\.)?thebestpornai\.com(\/|#)|\/)/i.test(href);
      if (!safe) return "";
      const closing = full.startsWith("</");
      return closing ? "</a>" : `<a href="${href.replace(/"/g, "")}">`;
    }
    const closing = full.startsWith("</");
    return closing ? `</${tag.toLowerCase()}>` : `<${tag.toLowerCase()}>`;
  });
  return s.trim();
}

export function validateGenerated(data) {
  if (!data || typeof data !== "object") throw new Error("Invalid payload");
  for (const k of ["title", "excerpt", "microcopy", "body"]) {
    if (!data[k] || typeof data[k] !== "string") throw new Error(`Missing field: ${k}`);
  }
  if (!Array.isArray(data.faqs) || data.faqs.length < 2) throw new Error("Need at least 2 FAQs");
  data.faqs = data.faqs.slice(0, 4).map((f) => ({
    q: String(f.q || "").trim(),
    a: String(f.a || "").trim(),
  })).filter((f) => f.q && f.a);
  if (data.faqs.length < 2) throw new Error("FAQs incomplete");
  data.tags = Array.isArray(data.tags) ? data.tags.map(String).slice(0, 8) : [];
  data.readMins = Math.min(12, Math.max(3, Number(data.readMins) || 5));
  data.body = sanitizeBodyHtml(data.body);
  data.excerpt = data.excerpt.trim().slice(0, 200);
  data.microcopy = data.microcopy.trim().slice(0, 160);
  data.title = data.title.trim().slice(0, 120);
  return data;
}

export async function generateArticle({ title, category, notes, video, env }) {
  if (env.WRITER_MOCK_LLM === "1") {
    const safeTitle = String(title).replace(/</g, "");
    const safeVid = String(video.title || "").replace(/</g, "");
    return validateGenerated({
      title: safeTitle.slice(0, 120),
      excerpt: ("Watch-focused guide: " + safeTitle).slice(0, 155),
      microcopy: "Story to stream — curated on thebestpornai.",
      tags: [category, "AI", "watch"],
      readMins: 5,
      body: "<p>This is a mock article for <strong>" + safeTitle + "</strong>. It demonstrates the Content Manager pipeline.</p>\n" +
        "<h2>Why this video</h2>\n" +
        "<p>The companion clip <em>" + safeVid + "</em> streams on thebestpornai. Open it when the words stop being enough.</p>\n" +
        "<h2>How to watch</h2>\n" +
        "<p>Fullscreen, sound on when privacy allows, and save keepers to Library. Quality beats infinite scroll.</p>\n" +
        "<blockquote>Mock mode is for pipeline tests — set WRITER_LLM_API_KEY for real copy.</blockquote>\n" +
        "<h2>From story to stream</h2>\n" +
        "<p>Use the Watch CTA on this page to open video #" + video.id + " on https://www.thebestpornai.com/.</p>",
      faqs: [
        { q: "Is this a real published article?", a: "Mock mode produces valid structure for testing publish. Use a live LLM key for production writing." },
        { q: "Where do I watch the video?", a: "Open https://www.thebestpornai.com/#video/" + video.id + " or use the on-page Watch button after publish." },
      ],
    });
  }
  const apiKey = env.WRITER_LLM_API_KEY || env.OPENAI_API_KEY || env.XAI_API_KEY;
  const base = (env.WRITER_LLM_BASE_URL || env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = env.WRITER_LLM_MODEL || env.OPENAI_MODEL || "gpt-4o-mini";
  if (!apiKey) {
    throw new Error("Missing WRITER_LLM_API_KEY (or OPENAI_API_KEY / XAI_API_KEY) in environment");
  }

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt({ title, category, notes, video }) },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`LLM error ${res.status}: ${errText.slice(0, 400)}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  const parsed = extractJson(content);
  return validateGenerated(parsed);
}
