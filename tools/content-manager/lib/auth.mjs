import crypto from "crypto";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function secret(env) {
  return env.WRITER_SESSION_SECRET || env.WRITER_PASSWORD || "dev-insecure-writer-secret";
}

export function getCredentials(env) {
  return {
    username: env.WRITER_USERNAME || "writer",
    password: env.WRITER_PASSWORD || "",
  };
}

export function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function createSessionToken(username, env) {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ u: username, exp }), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret(env)).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token, env) {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", secret(env)).update(payload).digest("base64url");
  try {
    if (!timingSafeEqualStr(sig, expected)) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function sessionCookie(token, env, { clear = false } = {}) {
  const secure = env.WRITER_COOKIE_SECURE === "1" || env.VERCEL === "1" || env.NODE_ENV === "production";
  if (clear) {
    return `writer_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
  }
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `writer_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export function parseCookies(cookieHeader) {
  const out = {};
  for (const part of String(cookieHeader || "").split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}

export function isAuthenticated(reqLike, env) {
  const { password } = getCredentials(env);
  if (!password) return true; // local open dev
  const cookies = parseCookies(reqLike.headers?.cookie || reqLike.headers?.Cookie);
  return Boolean(verifySessionToken(cookies.writer_session, env));
}
