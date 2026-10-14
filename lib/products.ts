/** Canonical catalogue contract. Keep these keys stable when publishing new designs. */
export interface TattooDesign {
  id: string;
  title: string;
  slug: string;
  description: string;
  media: {
    colourPreview: string;
    bwPreview: string;
    onSkinPreview: string;
    highResTransparentWatermarked: string;
    finalSecureDownloadUrl: string;
  };
  sizes: {
    mini: { price: number; label: string; details: string };
    small: { price: number; label: string; details: string };
    detailed: { price: number; label: string; details: string };
    premium: { price: number; label: string; details: string };
  };
}

export type DesignSize = keyof TattooDesign["sizes"];

export const DESIGN_SIZE_ORDER: DesignSize[] = ["mini", "small", "detailed", "premium"];

export const LICENSES = [
  {
    id: "artist",
    title: "Independent Artist License",
    price: 249,
    interval: "year" as const,
    allowance: "5 designs per year",
    audience: "One tattoo artist",
    description: "Choose five designs from the published catalogue for client tattoos by one licensed artist.",
    stripePriceEnv: "STRIPE_PRICE_ARTIST_YEARLY",
  },
  {
    id: "studio",
    title: "Tattoo Studio License",
    price: 499,
    interval: "year" as const,
    allowance: "20 designs per year",
    audience: "Up to 5 artists at one location",
    description: "A shared studio licence for one physical location. Source files may not be resold or redistributed.",
    stripePriceEnv: "STRIPE_PRICE_STUDIO_YEARLY",
  },
  {
    id: "full-catalogue",
    title: "Full Catalogue Studio License",
    price: 1500,
    interval: "year" as const,
    allowance: "All published designs",
    audience: "All artists at one location",
    description: "Non-exclusive commercial studio use of all published designs. Copyright remains with the artist.",
    stripePriceEnv: "STRIPE_PRICE_FULL_CATALOGUE_YEARLY",
  },
] as const;

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);
}
