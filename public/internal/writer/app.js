const $ = (id) => document.getElementById(id);

const state = {
  article: null,
  video: null,
};

function setBadge(text) {
  $("statusBadge").textContent = text;
}

function setStatus(el, msg, kind = "") {
  el.textContent = msg || "";
  el.className = "status" + (kind ? " " + kind : "");
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || "Request failed");
  return data;
}

function showApp(authed) {
  $("loginView").classList.toggle("hidden", authed);
  $("appView").classList.toggle("hidden", !authed);
}

function mediaUrl(src) {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  const rel = String(src).replace(/^(\.\.\/)?media\//, "");
  return "https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev/media/" +
    rel.split("/").map(encodeURIComponent).join("/");
}

function renderVideoBox(v) {
  const box = $("videoBox");
  if (!v) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  const thumb = v.thumb ? mediaUrl(v.thumb) : "";
  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="video-resolved">
      ${thumb ? `<img src="${thumb}" alt=""/>` : `<div style="width:96px;height:54px;background:#222;border-radius:8px"></div>`}
      <div>
        <div class="t">${escapeHtml(v.title)}</div>
        <div class="meta">#${v.id}${v.duration ? " · " + escapeHtml(v.duration) : ""} · <a href="${v.watchUrl}" target="_blank" rel="noopener">Open</a></div>
      </div>
    </div>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function draftFromForm() {
  let faqs = [];
  try {
    faqs = JSON.parse($("editFaqs").value || "[]");
  } catch {
    throw new Error("FAQs must be valid JSON array");
  }
  return {
    title: $("editTitle").value.trim(),
    excerpt: $("editExcerpt").value.trim(),
    microcopy: $("editMicro").value.trim(),
    body: $("editBody").value,
    faqs,
    tags: state.article?.tags || [],
    readMins: state.article?.readMins || 5,
  };
}

function fillEditor(article) {
  $("editTitle").value = article.title || "";
  $("editExcerpt").value = article.excerpt || "";
  $("editMicro").value = article.microcopy || "";
  $("editBody").value = article.body || "";
  $("editFaqs").value = JSON.stringify(article.faqs || [], null, 2);
  $("editPanel").classList.remove("hidden");
  renderPreview();
}

function renderPreview() {
  let draft;
  try {
    draft = draftFromForm();
  } catch (e) {
    $("preview").innerHTML = `<p class="status err">${escapeHtml(e.message)}</p>`;
    return;
  }
  const cat = $("category").value;
  const faqs = (draft.faqs || [])
    .map((f) => `<details><summary>${escapeHtml(f.q)}</summary><p>${escapeHtml(f.a)}</p></details>`)
    .join("");
  const vid = state.video;
  $("preview").innerHTML = `
    <span class="pill">${escapeHtml(cat)}</span>
    <h1>${escapeHtml(draft.title)}</h1>
    <p class="deck">${escapeHtml(draft.microcopy)}</p>
    <p class="deck" style="font-size:13px">${escapeHtml(draft.excerpt)}</p>
    ${vid ? `<p style="font-size:13px;color:var(--accent)">Watch → #${vid.id} ${escapeHtml(vid.title)}</p>` : ""}
    <div class="body">${draft.body}</div>
    <div class="faq-preview"><h3>FAQ</h3>${faqs}</div>
  `;
}

async function resolveVideo() {
  setStatus($("formStatus"), "Resolving video…");
  try {
    const v = await api("/api/internal-writer/resolve-video", {
      method: "POST",
      body: JSON.stringify({ url: $("videoUrl").value }),
    });
    state.video = v;
    renderVideoBox(v);
    setStatus($("formStatus"), `Resolved: ${v.title}`, "ok");
  } catch (e) {
    state.video = null;
    renderVideoBox(null);
    setStatus($("formStatus"), e.message, "err");
  }
}

async function generate() {
  setBadge("Generating…");
  setStatus($("formStatus"), "Generating article (30–90s)…");
  $("generateBtn").disabled = true;
  try {
    if (!state.video) await resolveVideo();
    if (!state.video) throw new Error("Resolve a valid video first");
    const data = await api("/api/internal-writer/generate", {
      method: "POST",
      body: JSON.stringify({
        title: $("title").value,
        videoUrl: $("videoUrl").value,
        category: $("category").value,
        notes: $("notes").value,
      }),
    });
    state.article = data.article;
    if (data.article.video) {
      state.video = { ...state.video, ...data.article.video };
      renderVideoBox(state.video);
    }
    fillEditor(data.article);
    setBadge("Ready");
    setStatus($("formStatus"), "Ready — review and publish", "ok");
  } catch (e) {
    setBadge("Error");
    setStatus($("formStatus"), e.message, "err");
  } finally {
    $("generateBtn").disabled = false;
  }
}

async function publish() {
  setBadge("Publishing…");
  setStatus($("formStatus"), "Publishing…");
  $("publishBtn").disabled = true;
  try {
    const draft = draftFromForm();
    if (!state.video) throw new Error("Missing video");
    const data = await api("/api/internal-writer/publish", {
      method: "POST",
      body: JSON.stringify({
        ...draft,
        category: $("category").value,
        videoUrl: $("videoUrl").value,
        coverVideoId: state.video.id,
      }),
    });
    setBadge("Published");
    const box = $("publishResult");
    box.classList.remove("hidden");
    box.className = "success-box";
    const steps = (data.nextSteps || []).join("\n");
    const gh = data.github && !data.github.skipped
      ? `\nGitHub: ${data.github.commit || data.github.error || "ok"}`
      : data.github?.skipped
        ? "\n(GitHub remote commit skipped — push manually or set GITHUB_TOKEN)"
        : "";
    box.innerHTML = `
      <strong>Published</strong>
      <div style="margin-top:6px"><a href="${data.absolute || data.path}" target="_blank" rel="noopener">${escapeHtml(data.absolute || data.path)}</a></div>
      <code>${escapeHtml(steps)}${escapeHtml(gh)}</code>
    `;
    setStatus($("formStatus"), "Published to repo pipeline", "ok");
  } catch (e) {
    setBadge("Error");
    setStatus($("formStatus"), e.message, "err");
  } finally {
    $("publishBtn").disabled = false;
  }
}

async function init() {
  try {
    const s = await api("/api/internal-writer/session");
    if (!s.passwordRequired || s.authenticated) showApp(true);
    else showApp(false);
  } catch {
    showApp(false);
  }

  $("loginBtn").onclick = async () => {
    setStatus($("loginStatus"), "Checking…");
    try {
      await api("/api/internal-writer/login", {
        method: "POST",
        body: JSON.stringify({ password: $("password").value }),
      });
      showApp(true);
    } catch (e) {
      setStatus($("loginStatus"), e.message, "err");
    }
  };
  $("password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("loginBtn").click();
  });
  $("logoutBtn").onclick = async () => {
    await api("/api/internal-writer/logout", { method: "POST", body: "{}" });
    showApp(false);
  };
  $("resolveBtn").onclick = () => resolveVideo();
  $("generateBtn").onclick = () => generate();
  $("publishBtn").onclick = () => publish();
  $("refreshPreviewBtn").onclick = () => renderPreview();
  ["editTitle", "editExcerpt", "editMicro", "editBody", "editFaqs"].forEach((id) => {
    $(id).addEventListener("input", () => {
      /* live preview on demand via button; body HTML can be heavy */
    });
  });
  $("videoUrl").addEventListener("change", () => resolveVideo());
}

init();
