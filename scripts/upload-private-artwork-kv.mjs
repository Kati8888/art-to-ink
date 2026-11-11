import sharp from "sharp";
import { readdir, readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const root = process.argv[2];
const namespaceId = process.env.ART_TO_INK_KV_NAMESPACE_ID ?? "de03271ad6ff4435959f9e7d2581984a";
if (!root) {
  console.error("Usage: node scripts/upload-private-artwork-kv.mjs <ART_TO_INK_web_catalogue_ready-folder>");
  process.exit(1);
}
if (!/^[a-f0-9]{32}$/.test(namespaceId)) throw new Error("Invalid Cloudflare KV namespace ID.");

const products = [
  { folder: "assimilation-seahorses", slug: "sea-dragons", title: "Assimilation — Seahorses", confidence: "high" },
  { folder: "mrs-beer", slug: "mrs-beer", title: "MRS Beer", confidence: "high" },
  { folder: "good-bye-london", slug: "goodbye-london", title: "Good Bye, London", confidence: "high" },
  { folder: "brain-heart", slug: "brain-heart", title: "Brain Heart", confidence: "medium" },
  { folder: "lion-heart", slug: "lion-heart", title: "Lion Heart", confidence: "medium" },
  { folder: "aura-of-pete", slug: "faces-within", title: "Aura of Pete", confidence: "medium" },
  { folder: "war-inside", slug: "war-inside", title: "War Inside", confidence: "medium" },
  { folder: "war-mask", slug: "war-mask", title: "War Mask", confidence: "medium" },
];
const formats = [
  { folder: "colour", key: "colour" },
  { folder: "black-and-white", key: "blackAndWhite" },
];
const sizes = [
  { variant: "mini", pixels: 1200 },
  { variant: "small", pixels: 2000 },
  { variant: "detailed", pixels: 3200 },
  { variant: "premium", pixels: 4000 },
];

for (const product of products) {
  for (const format of formats) {
    const sourcePath = path.join(root, product.folder, format.folder, "original.png");
    try { await readFile(sourcePath); }
    catch { throw new Error(`Missing verified source: ${sourcePath}`); }
  }
}

const temp = await mkdtemp(path.join(os.tmpdir(), "art-to-ink-kv-"));
let uploaded = 0;
try {
  for (const product of products) {
    for (const format of formats) {
      const sourcePath = path.join(root, product.folder, format.folder, "original.png");
      const source = await readFile(sourcePath);
      for (const size of sizes) {
        const output = await sharp(source)
          .resize({ width: size.pixels, height: size.pixels, fit: "inside", withoutEnlargement: true })
          .png({ compressionLevel: 9 }).toBuffer();
        if (output.length > 24 * 1024 * 1024) {
          throw new Error(`File exceeds the Cloudflare KV per-value limit: ${product.slug}/${size.variant}/${format.key}`);
        }
        const localPath = path.join(temp, `${product.slug}-${size.variant}-${format.key}.png`);
        await writeFile(localPath, output);
        const key = `${product.slug}/${product.slug}-${format.key}-${size.pixels}.png`;
        const metadata = JSON.stringify({ contentType: "image/png", size: output.length });
        execFileSync("npx", [
          "wrangler", "kv", "key", "put", key,
          `--path=${localPath}`,
          `--namespace-id=${namespaceId}`,
          `--metadata=${metadata}`,
        ], { stdio: "inherit" });
        uploaded++;
        console.log(`Uploaded private candidate: ${key} (${Math.round(output.length / 1024)} KB)`);
      }
    }
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}
console.log(`Uploaded ${uploaded} private candidate files. Product variants remain disabled until the artwork matches are approved.`);
