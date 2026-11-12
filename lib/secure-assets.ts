import type { DesignSize } from "@/lib/products";

export type ArtworkFormat = "colour" | "blackAndWhite";

/**
 * Private object paths must match scripts/upload-private-artwork-kv.mjs and the
 * existing catalogue IDs. Keep the public product ID separate from the storage
 * folder name: several legacy product IDs intentionally differ.
 */
const storageSlugByProductId: Record<string, string> = {
  "sea-dragons": "assimilation-seahorses",
  "mrs-beer": "mrs-beer",
  "goodbye-london": "good-bye-london",
  "war-inside": "war-inside",
  "brain-heart": "brain-heart",
  "lion-heart": "lion-heart",
  "faces-within": "aura-of-pete",
  "war-mask": "war-mask",
};

const sizes: Partial<Record<DesignSize, number>> = {
  mini: 1200,
  small: 2000,
  detailed: 3200,
  premium: 4000,
};

export function getSecureDownloadObject(
  productId: string,
  size: DesignSize,
  format: ArtworkFormat,
): string | null {
  const storageSlug = storageSlugByProductId[productId];
  if (!storageSlug) return null;

  if (size === "collection") {
    return `${storageSlug}/${storageSlug}-${format}-complete-collection.zip`;
  }

  const pixels = sizes[size];
  if (!pixels) return null;
  return `${storageSlug}/${storageSlug}-${format}-${pixels}.png`;
}
