import type { TattooDesign } from "@/lib/products";

/**
 * Each public preview path points to one isolated artwork image, never a
 * multi-panel infographic or a graphic with baked-in labels. Secure checkout
 * stays disabled until the matching private download assets are configured.
 */
export const tattooDesigns: TattooDesign[] = [
  {
    id: "sea-dragons",
    title: "Sea Dragons",
    slug: "sea-dragons",
    category: "Original Tattoo Artwork",
    description:
      "A golden-black composition of two sea dragons forming mirrored spirals. Switch between the clean colour artwork, monochrome linework, and a single natural-skin placement photo.",
    media: {
      colour: "/images/products/sea-dragons-pure-colour.png",
      blackAndWhite: "/images/products/sea-dragons-pure-bw.png",
      onSkin: "/images/products/sea-dragons-pure-skin.jpg",
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
