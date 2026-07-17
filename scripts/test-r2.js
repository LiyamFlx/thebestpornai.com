import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

async function main() {
  console.log("Listing R2 bucket contents...");
  try {
    const data = await client.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET,
        MaxKeys: 10,
      })
    );
    console.log("Success! Found files:");
    if (data.Contents) {
      data.Contents.forEach((c) => console.log(` - ${c.Key} (${c.Size} bytes)`));
    } else {
      console.log("Bucket is empty");
    }
  } catch (err) {
    console.error("R2 Error:", err);
  }
}

main();
