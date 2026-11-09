import fs from "node:fs";

const HOST = "www.thebestpornai.com";
const KEY = process.env.INDEXNOW_KEY || "c8f192b0e9a44c77a3d95e62f0178491";

if (!KEY || !/^[a-zA-Z0-9-]{8,128}$/.test(KEY)) {
  console.error("INDEXNOW_KEY missing or invalid");
  process.exit(1);
}

// Ensure key verification file exists in public/
fs.writeFileSync(`public/${KEY}.txt`, KEY);

if (process.argv.includes("--ping")) {
  if (!fs.existsSync("public/sitemap.xml")) {
    console.warn("public/sitemap.xml not found; skipping ping.");
    process.exit(0);
  }
  const xml = fs.readFileSync("public/sitemap.xml", "utf8");
  const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].trim())
    .slice(0, 10000);

  if (urlList.length === 0) {
    console.log("No URLs found in sitemap to ping.");
    process.exit(0);
  }

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: HOST,
        key: KEY,
        keyLocation: `https://${HOST}/${KEY}.txt`,
        urlList,
      }),
    });
    console.log(`IndexNow ${res.status} — ${urlList.length} URLs submitted`);
  } catch (err) {
    console.error(`IndexNow ping failed:`, err.message);
  }
}

