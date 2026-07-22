/* Reports the git commit this deployment was built from, using Vercel's
   auto-populated VERCEL_GIT_COMMIT_SHA env var (no build config needed).
   Used by the deploy workflow to confirm thebestpornai.com is actually
   serving the commit that was just pushed, instead of trusting that
   promotion silently succeeded. */
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    deployedAt: process.env.VERCEL_DEPLOYMENT_ID ? new Date().toISOString() : null,
  });
}
