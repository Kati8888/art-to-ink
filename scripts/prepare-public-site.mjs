import { mkdirSync, readdirSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
const root = process.cwd();
const publicDir = join(root, "public");
const publicAssets = join(publicDir, "assets");
const sourceAssets = join(root, "assets");
mkdirSync(publicAssets, { recursive: true });
for (const entry of readdirSync(sourceAssets, { withFileTypes: true })) {
  if (!entry.isFile() || !/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(extname(entry.name))) continue;
  copyFileSync(join(sourceAssets, entry.name), join(publicAssets, entry.name));
}
copyFileSync(join(root, "Muj_stanek_25MB (2).mp4"), join(publicDir, "Muj_stanek_25MB (2).mp4"));
writeFileSync(join(publicDir, "legacy.html"), readFileSync(join(root, "index.html"), "utf8"), "utf8");
console.log("Prepared original ART TO INK storefront, referenced images, and video.");
