import {
  getCredentials,
  timingSafeEqualStr,
  createSessionToken,
  sessionCookie,
  noStore,
} from "./_shared.js";

export default function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const { username, password } = getCredentials(process.env);
  const body = req.body && typeof req.body === "object" ? req.body : {};

  if (!password) {
    const token = createSessionToken(username, process.env);
    res.setHeader("Set-Cookie", sessionCookie(token, process.env));
    return res.status(200).json({ ok: true, devOpen: true });
  }

  if (!timingSafeEqualStr(String(body.password || ""), password)) {
    return res.status(401).json({ error: "Wrong password" });
  }

  const token = createSessionToken(username, process.env);
  res.setHeader("Set-Cookie", sessionCookie(token, process.env));
  res.status(200).json({ ok: true });
}
