import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_DOWNLOAD_BUCKET;
const root = process.argv[2];

if (!url || !key || !bucket || !root) {
  console.error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DOWNLOAD_BUCKET and pass the extracted artwork folder path.");
  process.exit(1);
}

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const sourceToObject = new Map([
  ["brain-heart/brain-heart-colour-source.png", "brain-heart/brain-heart-colour-source.png"],
  ["brain-heart/brain-heart-black-white-derived.png", "brain-heart/brain-heart-black-white-derived.png"],
  ["mrs-beer/mrs-beer-colour-source.png", "mrs-beer/mrs-beer-colour-source.png"],
  ["mrs-beer/mrs-beer-black-white-derived.png", "mrs-beer/mrs-beer-black-white-derived.png"],
  ["sea-horses/sea-horses-colour-source.png", "sea-dragons/sea-dragons-pure-colour.png"],
  ["sea-horses/sea-horses-black-white-derived.png", "sea-dragons/sea-dragons-pure-bw.png"],
  ["lion-heart/lion-heart-colour-source.png", "lion-heart/lion-heart-colour-source.png"],
  ["lion-heart/lion-heart-black-white-derived.png", "lion-heart/lion-heart-black-white-derived.png"],
  ["grandparents/grandparents-colour-source.png", "grandparents/grandparents-colour-source.png"],
  ["grandparents/grandparents-black-white-derived.png", "grandparents/grandparents-black-white-derived.png"],
  ["faces-within/faces-within-colour-source.png", "faces-within/faces-within-colour-source.png"],
  ["faces-within/faces-within-black-white-derived.png", "faces-within/faces-within-black-white-derived.png"],
  ["goodbye-london/goodbye-london-colour-source.png", "goodbye-london/goodbye-london-colour-source.png"],
  ["goodbye-london/goodbye-london-black-white-derived.png", "goodbye-london/goodbye-london-black-white-derived.png"],
  ["war-inside/war-inside-colour-source.png", "war-inside/war-inside-colour-source.png"],
  ["war-inside/war-inside-black-white-derived.png", "war-inside/war-inside-black-white-derived.png"],
]);

async function walk(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full, relative));
    else files.push({ relative, full });
  }
  return files;
}

const allFiles = await walk(root);
const byName = new Map(allFiles.map((file) => [file.relative, file]));
const missing = [...sourceToObject.keys()].filter((name) => !byName.has(name));
if (missing.length) {
  console.error("Upload stopped. Missing required files:\n" + missing.map((name) => "- " + name).join("\n"));
  process.exit(1);
}

for (const [sourceName, objectPath] of sourceToObject) {
  const file = byName.get(sourceName);
  const bytes = await readFile(file.full);
  const { error } = await client.storage.from(bucket).upload(objectPath, bytes, {
    contentType: "image/png", upsert: true, cacheControl: "3600",
  });
  if (error) {
    console.error("Upload failed for " + objectPath + ": " + error.message);
    process.exit(1);
  }
  console.log("Uploaded " + sourceName + " -> " + objectPath);
}
console.log("All " + sourceToObject.size + " source files uploaded. Verify the bucket is private before enabling checkout.");
