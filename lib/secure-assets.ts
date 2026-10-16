import type { DesignSize } from "@/lib/products";

export type ArtworkFormat = "colour" | "blackAndWhite";

/**
 * Private Supabase Storage object keys. These names are deliberately not public
 * URLs. Checkout verifies the object exists before creating a paid session.
 */
const secureDownloadObjects: Record<string, Partial<Record<DesignSize, Record<ArtworkFormat, string>>>> = {
  "sea-dragons": {
    mini: {
      colour: "sea-dragons/sea-dragons-pure-colour.png",
      blackAndWhite: "sea-dragons/sea-dragons-pure-bw.png",
    },
    small: {
      colour: "sea-dragons/sea-dragons-pure-colour.png",
      blackAndWhite: "sea-dragons/sea-dragons-pure-bw.png",
    },
    detailed: {
      colour: "sea-dragons/sea-dragons-pure-colour.png",
      blackAndWhite: "sea-dragons/sea-dragons-pure-bw.png",
    },
    premium: {
      colour: "sea-dragons/sea-dragons-pure-colour.png",
      blackAndWhite: "sea-dragons/sea-dragons-pure-bw.png",
    },
    collection: {
      colour: "sea-dragons/sea-dragons-pure-colour.png",
      blackAndWhite: "sea-dragons/sea-dragons-pure-bw.png",
    },
  },
};

export function isSecureDownloadConfigured(productId: string): boolean {
  const variants = secureDownloadObjects[productId];
  return Boolean(variants && variants.mini?.colour && variants.mini?.blackAndWhite);
}

export function getSecureDownloadObject(
  productId: string,
  size: DesignSize,
  format: ArtworkFormat,
): string | null {
  return secureDownloadObjects[productId]?.[size]?.[format] ?? null;
}
