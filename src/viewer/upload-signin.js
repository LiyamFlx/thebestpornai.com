/* Inline email + password sign-in for uploads. No magic link, no confirmation
   email, no rate limits — enter email + password once and you're in. First
   time an email is used it auto-creates the account (signInWithPassword). */
import { toast } from "../shared/catalog.js";
import { ShAuth } from "../shared/streamhub-api.js";

export function promptUploadSignIn() {
  if (document.getElementById("upload-signin")) return;
  const wrap = document.createElement("div");
  wrap.id = "upload-signin";
  wrap.innerHTML = `
    <div class="usi-backdrop"></div>
    <form class="usi-box">
      <div class="usi-title">Sign in to upload</div>
      <div class="usi-sub">Enter an email and password. New here? We'll create your account automatically.</div>
      <input class="usi-email" type="email" placeholder="you@email.com" required autocomplete="email" />
      <input class="usi-pass" type="password" placeholder="Password (min 6 characters)" required minlength="6" autocomplete="current-password" />
      <button class="usi-send" type="submit">Sign in / Create account</button>
      <div class="usi-msg" aria-live="polite"></div>
      <button class="usi-close" type="button" aria-label="Close">×</button>
    </form>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.querySelector(".usi-backdrop").addEventListener("click", close);
  wrap.querySelector(".usi-close").addEventListener("click", close);
  const email = wrap.querySelector(".usi-email");
  email.focus();
  wrap.querySelector(".usi-box").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = wrap.querySelector(".usi-msg");
    const btn = wrap.querySelector(".usi-send");
    const pass = wrap.querySelector(".usi-pass");
    btn.disabled = true; msg.textContent = "Signing in…";
    try {
      await ShAuth.signInWithPassword(email.value.trim(), pass.value);
      msg.textContent = "Signed in! Drop your file to upload.";
      setTimeout(close, 900);
      toast("Signed in — drag your file to upload");
    } catch (err) {
      msg.textContent = err?.message || "Sign-in failed, try again";
      btn.disabled = false;
    }
  });
}
