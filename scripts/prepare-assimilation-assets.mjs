import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_DOWNLOAD_BUCKET || "art-to-ink-originals";
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as GitHub Actions secrets.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sources = [
  {
    format: "colour",
    sourceUrl: "https://raw.githubusercontent.com/Kati8888/art-to-ink/main/assets/01-seahorses-colour-transparent-original.png",
    sourceFile: "assimilation-colour-source.png",
  },
  {
    format: "black-white",
    sourceUrl: "https://raw.githubusercontent.com/Kati8888/art-to-ink/main/assets/02-seahorses-black-white-transparent-original.png",
    sourceFile: "assimilation-black-white-source.png",
  },
];
const sizes = [
  { key: "mini", pixels: 1200 },
  { key: "small", pixels: 2000 },
  { key: "detailed", pixels: 3200 },
  { key: "premium", pixels: 4000 },
];
const temp = await mkdtemp(path.join(tmpdir(), "assimilation-"));

try {
  const filesByFormat = { colour: [], "black-white": [] };

  for (const source of sources) {
    const response = await fetch(source.sourceUrl);
    if (!response.ok) throw new Error(`Could not fetch original artwork (${response.status}): ${source.sourceUrl}`);
    const original = Buffer.from(await response.arrayBuffer());
    const sourcePath = path.join(temp, source.sourceFile);
    await writeFile(sourcePath, original);
    const metadata = await sharp(original).metadata();
    if (!metadata.width || !metadata.height) throw new Error(`Source image has no dimensions: ${source.sourceFile}`);
    console.log(`Source ${source.format}: ${metadata.width}×${metadata.height}px`);

    for (const size of sizes) {
      const outputName = `assimilation-${source.format}-${size.pixels}.png`;
      const outputPath = path.join(temp, outputName);
      const png = await sharp(original)
        .rotate()
        .resize({ width: size.pixels, height: size.pixels, fit: "inside", withoutEnlargement: false })
        .withMetadata({ density: 300 })
        .png()
        .toBuffer();
      const outMeta = await sharp(png).metadata();
      if (Math.max(outMeta.width ?? 0, outMeta.height ?? 0) !== size.pixels) {
        throw new Error(`Generated ${outputName} did not reach its promised ${size.pixels}px longest edge.`);
      }
      await writeFile(outputPath, png);
      filesByFormat[source.format].push(outputPath);
      const objectName = `sea-dragons/assimilation-${source.format}-${size.pixels}.png`;
      const { error } = await supabase.storage.from(bucket).upload(objectName, png, {
        contentType: "image/png",
        cacheControl: "0",
        upsert: true,
      });
      if (error) throw new Error(`Upload failed for ${objectName}: ${error.message}`);
      console.log(`Uploaded ${objectName} (${outMeta.width}×${outMeta.height}px)`);
    }
  }

  for (const format of ["colour", "black-white"]) {
    const zipPath = path.join(temp, `assimilation-${format}-complete-collection.zip`);
    execFileSync("zip", ["-j", "-q", zipPath, ...filesByFormat[format]]);
    const zipBuffer = await readFile(zipPath);
    const objectName = `sea-dragons/assimilation-${format}-complete-collection.zip`;
    const { error } = await supabase.storage.from(bucket).upload(objectName, zipBuffer, {
      contentType: "application/zip",
      cacheControl: "0",
      upsert: true,
    });
    if (error) throw new Error(`Upload failed for ${objectName}: ${error.message}`);
    console.log(`Uploaded ${objectName} (${zipBuffer.length} bytes)`);
  }

  console.log("All 10 private Assimilation downloads were generated and uploaded.");
} finally {
  await rm(temp, { recursive: true, force: true });
}
