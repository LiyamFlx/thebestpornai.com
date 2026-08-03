import { getCredentials, noStore } from "./_shared.js";

export default function handler(req, res) {
  noStore(res);
  const { password } = getCredentials(process.env);
  res.status(200).json({
    ok: true,
    passwordRequired: Boolean(password),
    githubPublish: Boolean(process.env.GITHUB_TOKEN),
  });
}
