import sharp from "sharp";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { deflateRawSync } from "node:zlib";

const root = process.argv[2];
const namespaceId = process.env.ART_TO_INK_KV_NAMESPACE_ID ?? "de03271ad6ff4435959f9e7d2581984a";
if (!root) throw new Error("Usage: node scripts/upload-private-artwork-kv.mjs <extracted artwork folder>");
if (!/^[a-f0-9]{32}$/.test(namespaceId)) throw new Error("Invalid Cloudflare KV namespace ID.");

const products = [
  "assimilation-seahorses", "mrs-beer", "war-mask", "lion-heart",
  "good-bye-london", "brain-heart", "war-inside", "aura-of-pete",
];
const formats = [
  { folder: "colour", key: "colour" },
  { folder: "black-and-white", key: "blackAndWhite" },
];
const sizes = [
  { key: "mini", pixels: 1200 },
  { key: "small", pixels: 2000 },
  { key: "detailed", pixels: 3200 },
  { key: "premium", pixels: 4000 },
];

const originals = new Map();
for (const slug of products) for (const format of formats) {
  const file = path.join(root, slug, format.folder, "original.png");
  const data = await readFile(file);
  const meta = await sharp(data).metadata();
  if (!meta.width || !meta.height) throw new Error("Invalid image: " + file);
  originals.set(slug + ":" + format.key, data);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(files) {
  const local=[], central=[]; let offset=0;
  for (const file of files) {
    const name=Buffer.from(file.name); const packed=deflateRawSync(file.data); const crc=crc32(file.data);
    const h=Buffer.alloc(30); h.writeUInt32LE(0x04034b50,0); h.writeUInt16LE(20,4); h.writeUInt16LE(0x0800,6); h.writeUInt16LE(8,8); h.writeUInt32LE(crc,14); h.writeUInt32LE(packed.length,18); h.writeUInt32LE(file.data.length,22); h.writeUInt16LE(name.length,26);
    local.push(h,name,packed);
    const c=Buffer.alloc(46); c.writeUInt32LE(0x02014b50,0); c.writeUInt16LE(20,4); c.writeUInt16LE(20,6); c.writeUInt16LE(0x0800,8); c.writeUInt16LE(8,10); c.writeUInt32LE(crc,16); c.writeUInt32LE(packed.length,20); c.writeUInt32LE(file.data.length,24); c.writeUInt16LE(name.length,28); c.writeUInt32LE(offset,42);
    central.push(c,name); offset+=h.length+name.length+packed.length;
  }
  const centralSize=central.reduce((n,b)=>n+b.length,0); const end=Buffer.alloc(22); end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(files.length,8); end.writeUInt16LE(files.length,10); end.writeUInt32LE(centralSize,12); end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,...central,end]);
}

const temp=await mkdtemp(path.join(os.tmpdir(),"art-to-ink-private-"));
let uploaded=0;
function put(local,key,metadata) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  execFileSync(command,["wrangler","kv","key","put",key,`--path=${local}`,`--namespace-id=${namespaceId}`,`--metadata=${JSON.stringify(metadata)}`],{
    stdio:"inherit",
    shell: process.platform === "win32",
  });
}
try {
 for (const slug of products) for (const format of formats) {
  const source=originals.get(slug+":"+format.key); const variants=[];
  for (const size of sizes) {
   const output=await sharp(source).resize({width:size.pixels,height:size.pixels,fit:"inside",withoutEnlargement:false}).png({compressionLevel:8}).toBuffer();
   if(output.length>24*1024*1024) throw new Error("KV value too large: "+slug+" "+format.key+" "+size.key);
   const key=`${slug}/${slug}-${format.key}-${size.pixels}.png`;
   const local=path.join(temp,`${slug}-${format.key}-${size.pixels}.png`); await writeFile(local,output);
   put(local,key,{contentType:"image/png",size:output.length,product:slug,format:format.key,size:size.key});
   variants.push({name:size.key+".png",data:output}); uploaded++;
   console.log("Uploaded "+key);
  }
  const archive=zip(variants); if(archive.length>24*1024*1024) throw new Error("Collection ZIP exceeds KV limit: "+slug+" "+format.key);
  const zipKey=`${slug}/${slug}-${format.key}-complete-collection.zip`;
  const zipLocal=path.join(temp,`${slug}-${format.key}-complete-collection.zip`); await writeFile(zipLocal,archive);
  put(zipLocal,zipKey,{contentType:"application/zip",size:archive.length,product:slug,format:format.key,size:"collection"});
  uploaded++; console.log("Uploaded "+zipKey);
 }
} finally { await rm(temp,{recursive:true,force:true}); }
console.log(`Uploaded ${uploaded} private artwork files. Review all product matches before activating D1 variants.`);
