import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import dns from "dns";

// Monkeypatch dns.lookup to use DNS-over-HTTPS via Cloudflare
const originalLookup = dns.lookup;
dns.lookup = function(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  
  if (hostname.includes('r2.cloudflarestorage.com')) {
    // Resolve via Cloudflare DNS-over-HTTPS JSON API using raw IP to avoid DNS bootstrap loop
    fetch(`https://1.1.1.1/dns-query?name=${hostname}&type=A`, {
      headers: { accept: "application/dns-json" }
    })
      .then(res => res.json())
      .then(data => {
        const answers = data.Answer || [];
        const aRecord = answers.find(a => a.type === 1); // Type 1 is A record
        if (aRecord && aRecord.data) {
          callback(null, aRecord.data, 4);
        } else {
          // Fallback to original lookup
          originalLookup(hostname, options, callback);
        }
      })
      .catch(err => {
        console.warn("DoH lookup failed, falling back:", err);
        originalLookup(hostname, options, callback);
      });
    return;
  }
  
  originalLookup(hostname, options, callback);
};

dotenv.config();

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET = process.env.R2_BUCKET || "streamhub-media";

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) {
  console.error("Missing R2 credentials in environment variables.");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

async function initManifest() {
  try {
    await s3.send(new HeadObjectCommand({
      Bucket: R2_BUCKET,
      Key: "manifest.json"
    }));
    console.log("manifest.json already exists in R2.");
  } catch (err) {
    console.log("manifest.json not found, initializing with empty array []...");
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: "manifest.json",
      Body: "[]",
      ContentType: "application/json"
    }));
    console.log("Successfully initialized manifest.json on R2!");
  }
}

initManifest().catch(console.error);
