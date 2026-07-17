/* Set the CORS policy on the Cloudflare R2 bucket so the browser can fetch
 * manifest.json (and media HEAD requests) from the site origin.
 *
 * Run once (or after changing allowed origins):
 *   node scripts/set-r2-cors.js
 *
 * Requires R2_* env vars (loaded from .env). Idempotent — safe to re-run.
 */
import "dotenv/config";
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";

const { R2_ENDPOINT, R2_BUCKET = "streamhub-media", R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;

if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error("Missing R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY in env.");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  forcePathStyle: true,
});

const CORSRules = [
  {
    AllowedOrigins: [
      "https://www.thebestpornai.com",
      "https://thebestpornai.com",
      "http://localhost:5173",
    ],
    AllowedMethods: ["GET", "HEAD"],
    AllowedHeaders: ["*"],
    MaxAgeSeconds: 3600,
  },
];

try {
  await s3.send(new PutBucketCorsCommand({ Bucket: R2_BUCKET, CORSConfiguration: { CORSRules } }));
  console.log(`✔ CORS policy applied to bucket "${R2_BUCKET}"`);
  const got = await s3.send(new GetBucketCorsCommand({ Bucket: R2_BUCKET }));
  console.log("Current rules:", JSON.stringify(got.CORSRules, null, 2));
} catch (e) {
  console.error("Failed to set CORS:", e?.message || e);
  process.exit(1);
}
