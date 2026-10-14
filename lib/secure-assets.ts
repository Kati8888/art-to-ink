import type { DesignSize } from "@/lib/products";

/** Private Supabase Storage object paths, never public URLs. Add an entry only after checking the source artwork and final export. */
const secureDownloadObjects: Record<string, Partial<Record<DesignSize, string>>> = {};

export function getSecureDownloadObject(slug: string, size: DesignSize): string | null {
  return secureDownloadObjects[slug]?.[size] ?? null;
}
