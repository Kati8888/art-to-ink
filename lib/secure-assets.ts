import type { DesignSize } from "@/lib/products";

export type ArtworkFormat = "colour" | "blackAndWhite";

/**
 * Private, size-specific Supabase Storage objects. These files must exist in
 * the private bucket before checkout can be enabled. "collection" is a ZIP
 * containing all four sizes in the selected colour format.
 */
const secureDownloadObjects: Record<string, Partial<Record<DesignSize, Record<ArtworkFormat, string>>>> = {
  "sea-dragons": {
    mini: {
      colour: "sea-dragons/assimilation-colour-1200.png",
      blackAndWhite: "sea-dragons/assimilation-black-white-1200.png",
    },
    small: {
      colour: "sea-dragons/assimilation-colour-2000.png",
      blackAndWhite: "sea-dragons/assimilation-black-white-2000.png",
    },
    detailed: {
      colour: "sea-dragons/assimilation-colour-3200.png",
      blackAndWhite: "sea-dragons/assimilation-black-white-3200.png",
    },
    premium: {
      colour: "sea-dragons/assimilation-colour-4000.png",
      blackAndWhite: "sea-dragons/assimilation-black-white-4000.png",
    },
    collection: {
      colour: "sea-dragons/assimilation-colour-complete-collection.zip",
      blackAndWhite: "sea-dragons/assimilation-black-white-complete-collection.zip",
    },
  },
};

export function getSecureDownloadObject(
  productId: string,
  size: DesignSize,
  format: ArtworkFormat,
): string | null {
  return secureDownloadObjects[productId]?.[size]?.[format] ?? null;
}
