import { sessionCookie, noStore } from "./_shared.js";

export default function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  res.setHeader("Set-Cookie", sessionCookie("", process.env, { clear: true }));
  res.status(200).json({ ok: true });
}
