import type { TattooDesign } from "@/lib/products";

/**
 * Sea Dragons preview paths are preconfigured for the artwork files that will
 * be uploaded to public/images/products. Secure checkout remains unavailable
 * until matching private download assets are configured in lib/secure-assets.ts.
 */
export const tattooDesigns: TattooDesign[] = [
  {
    id: "sea-dragons",
    title: "Sea Dragons",
    slug: "sea-dragons",
    category: "Original Tattoo Artwork",
    description:
      "A golden-black composition of two sea dragons forming mirrored spirals. Explore the colour artwork, monochrome linework, and natural-skin placement preview.",
    media: {
      colour: "/images/products/sea-dragons-colour.png",
      blackAndWhite: "/images/products/sea-dragons-bw.png",
      onSkin: "/images/products/sea-dragons-on-skin.jpg",
    },
    sizes: {
      mini: {
        price: 9,
        label: "Mini Digital Design",
        details: "Compact digital design file for personal reference.",
      },
      small: {
        price: 19,
        label: "Small Digital Design",
        details: "Small-format digital design file.",
      },
      detailed: {
        price: 39,
        label: "Detailed Design",
        details: "High-detail design file for careful placement planning.",
      },
      premium: {
        price: 79,
        label: "Premium Design Bundle",
        details: "Premium design package for professional review.",
      },
      collection: {
        price: 149,
        label: "Complete Sea Dragons Collection",
        details: "Complete Sea Dragons digital design collection.",
      },
    },
  },
];
