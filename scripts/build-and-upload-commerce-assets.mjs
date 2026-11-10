import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_DOWNLOAD_BUCKET;
const root = process.argv[2];
if (!url || !key || !bucket || !root) {
  console.error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DOWNLOAD_BUCKET and pass the extracted artwork-pack folder.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const designs = [
  { slug: "brain-heart", folder: "brain-heart", colour: "brain-heart-colour-source.png", blackAndWhite: "brain-heart-black-white-derived.png" },
  { slug: "mrs-beer", folder: "mrs-beer", colour: "mrs-beer-colour-source.png", blackAndWhite: "mrs-beer-black-white-derived.png" },
  { slug: "sea-dragons", folder: "sea-horses", colour: "sea-horses-colour-source.png", blackAndWhite: "sea-horses-black-white-derived.png" },
  { slug: "lion-heart", folder: "lion-heart", colour: "lion-heart-colour-source.png", blackAndWhite: "lion-heart-black-white-derived.png" },
  { slug: "babicka-dedo", folder: "grandparents", colour: "grandparents-colour-source.png", blackAndWhite: "grandparents-black-white-derived.png" },
  { slug: "faces-within", folder: "faces-within", colour: "faces-within-colour-source.png", blackAndWhite: "faces-within-black-white-derived.png" },
  { slug: "goodbye-london", folder: "goodbye-london", colour: "goodbye-london-colour-source.png", blackAndWhite: "goodbye-london-black-white-derived.png" },
  { slug: "war-inside", folder: "war-inside", colour: "war-inside-colour-source.png", blackAndWhite: "war-inside-black-white-derived.png" },
];
const sizes = [
  { key: "mini", pixels: 1200 },
  { key: "small", pixels: 2000 },
  { key: "detailed", pixels: 3200 },
  { key: "premium", pixels: 4000 },
];
const allFiles = new Set();
async function walk(dir, prefix = "") {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) await walk(path.join(dir, entry.name), relative);
    else allFiles.add(relative);
  }
}
await walk(root);
const required = designs.flatMap(d => [`${d.folder}/${d.colour}`, `${d.folder}/${d.blackAndWhite}`]);
const missing = required.filter(file => !allFiles.has(file));
if (missing.length) {
  console.error("Upload stopped; required artwork files are missing:\n" + missing.map(x => "- " + x).join("\n"));
  process.exit(1);
}
const { data: bucketInfo, error: bucketError } = await db.storage.getBucket(bucket);
if (bucketError) throw bucketError;
if (bucketInfo.public) throw new Error("Refusing to upload paid originals to a public Storage bucket.");
const { data: products, error: productError } = await db.from("commerce_products").select("id,slug").in("slug", designs.map(d => d.slug));
if (productError) throw productError;
const productBySlug = new Map((products ?? []).map(p => [p.slug, p]));
if (designs.some(d => !productBySlug.has(d.slug))) throw new Error("Run the reviewed commerce migration first; one or more catalogue products are missing.");
const { data: variants, error: variantError } = await db.from("commerce_variants").select("id,product_id,variant_key").in("variant_key", sizes.map(s => s.key));
if (variantError) throw variantError;
let uploaded = 0;
for (const design of designs) {
  const product = productBySlug.get(design.slug);
  for (const format of ["colour", "blackAndWhite"]) {
    const sourceName = format === "colour" ? design.colour : design.blackAndWhite;
    const source = await readFile(path.join(root, design.folder, sourceName));
    for (const size of sizes) {
      const objectPath = `${design.slug}/${design.slug}-${format}-${size.pixels}.png`;
      const output = await sharp(source).resize({ width: size.pixels, height: size.pixels, fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
      const { error } = await db.storage.from(bucket).upload(objectPath, output, { contentType: "image/png", upsert: true, cacheControl: "3600" });
      if (error) throw new Error(`Upload failed for ${objectPath}: ${error.message}`);
      const variant = (variants ?? []).find(v => v.product_id === product.id && v.variant_key === size.key);
      if (!variant) throw new Error(`Missing catalogue variant ${design.slug}/${size.key}; run the reviewed migration first.`);
      const { error: assetError } = await db.from("commerce_assets").upsert({
        product_id: product.id, variant_id: variant.id, artwork_format: format,
        storage_object_path: objectPath, active: true,
      }, { onConflict: "product_id,variant_id,artwork_format" });
      if (assetError) throw new Error(`Asset registration failed for ${objectPath}: ${assetError.message}`);
      uploaded++;
      console.log(`Uploaded and registered ${objectPath}`);
    }
  }
}
console.log(`Finished: ${uploaded} private, size-specific assets uploaded and registered.`);
console.log("The Complete Size Collection ZIP is not generated by this script and must remain unavailable until separately prepared.");
