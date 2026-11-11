import sharp from "sharp";
import { readdir, readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { deflateRawSync } from "node:zlib";

const root = process.argv[2];
const bucket = process.env.CLOUDFLARE_R2_BUCKET ?? "ART_TO_INK_FILES";
if (!root) {
  console.error("Usage: node scripts/build-and-upload-commerce-assets.mjs <extracted-artwork-pack-folder>");
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(bucket)) throw new Error("Invalid R2 bucket name.");

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
  console.error("Upload stopped; required source files are missing:\n" + missing.map(x => "- " + x).join("\n"));
  process.exit(1);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const compressed = deflateRawSync(file.data);
    const crc = crc32(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

function upload(localPath, key, contentType) {
  execFileSync("npx", [
    "wrangler", "r2", "object", "put", `${bucket}/${key}`,
    `--file=${localPath}`, `--content-type=${contentType}`,
  ], { stdio: "inherit" });
}

const temp = await mkdtemp(path.join(os.tmpdir(), "art-to-ink-r2-"));
let uploaded = 0;
try {
  for (const design of designs) {
    for (const format of ["colour", "blackAndWhite"]) {
      const sourceName = format === "colour" ? design.colour : design.blackAndWhite;
      const source = await readFile(path.join(root, design.folder, sourceName));
      const collectionFiles = [];
      for (const size of sizes) {
        const key = `${design.slug}/${design.slug}-${format}-${size.pixels}.png`;
        const output = await sharp(source)
          .resize({ width: size.pixels, height: size.pixels, fit: "inside", withoutEnlargement: true })
          .png({ compressionLevel: 9 }).toBuffer();
        const localPath = path.join(temp, `${design.slug}-${format}-${size.pixels}.png`);
        await writeFile(localPath, output);
        upload(localPath, key, "image/png");
        collectionFiles.push({ name: `${size.key}.png`, data: output });
        uploaded++;
        console.log(`Uploaded ${key}`);
      }
      const zip = makeZip(collectionFiles);
      const zipPath = path.join(temp, `${design.slug}-${format}-complete-collection.zip`);
      await writeFile(zipPath, zip);
      const zipKey = `${design.slug}/${design.slug}-${format}-complete-collection.zip`;
      upload(zipPath, zipKey, "application/zip");
      uploaded++;
      console.log(`Uploaded ${zipKey}`);
    }
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}
console.log(`Finished: ${uploaded} private objects uploaded to R2 bucket ${bucket}.`);
