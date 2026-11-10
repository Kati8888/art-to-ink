import type { DesignSize } from "@/lib/products";

export type ArtworkFormat = "colour" | "blackAndWhite";

/**
 * Private size-specific objects created by scripts/build-and-upload-commerce-assets.mjs.
 * Complete Size Collection remains unavailable until a ZIP has been prepared and uploaded.
 */
const slugs = ["brain-heart", "mrs-beer", "sea-dragons", "lion-heart", "babicka-dedo", "faces-within", "goodbye-london", "war-inside"];
const sizes: Partial<Record<DesignSize, number>> = { mini: 1200, small: 2000, detailed: 3200, premium: 4000 };

const secureDownloadObjects: Record<string, Partial<Record<DesignSize, Record<ArtworkFormat, string>>>> = {};
for (const slug of slugs) {
  const variants: Partial<Record<DesignSize, Record<ArtworkFormat, string>>> = {};
  for (const [size, pixels] of Object.entries(sizes) as Array<[DesignSize, number]>) {
    variants[size] = {
      colour: `${slug}/${slug}-colour-${pixels}.png`,
      blackAndWhite: `${slug}/${slug}-blackAndWhite-${pixels}.png`,
    };
  }
  secureDownloadObjects[slug] = variants;
}

export function getSecureDownloadObject(productId: string, size: DesignSize, format: ArtworkFormat): string | null {
  return secureDownloadObjects[productId]?.[size]?.[format] ?? null;
}
