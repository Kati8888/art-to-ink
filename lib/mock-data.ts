import type { TattooDesign } from "@/lib/products";

// Public gallery assets are served by the site itself; the catalogue no longer
// depends on Supabase Storage for preview images.
const image = (path: string) => `/assets/${path}`;

const sharedSizes = {
  mini: {
    price: 9,
    label: "Mini — 1,200 px",
    details: "Digital PNG export with a 1,200 px longest edge. Approx. 10.2 cm on the longest edge at 300 DPI; the other edge follows the artwork's original proportions.",
  },
  small: {
    price: 19,
    label: "Small — 2,000 px",
    details: "Digital PNG export with a 2,000 px longest edge. Approx. 16.9 cm on the longest edge at 300 DPI; the other edge follows the artwork's original proportions.",
  },
  detailed: {
    price: 39,
    label: "Detailed — 3,200 px",
    details: "Digital PNG export with a 3,200 px longest edge. Approx. 27.1 cm on the longest edge at 300 DPI; the other edge follows the artwork's original proportions.",
  },
  premium: {
    price: 79,
    label: "Premium — 4,000 px",
    details: "Digital PNG export with a 4,000 px longest edge. Approx. 33.9 cm on the longest edge at 300 DPI; the other edge follows the artwork's original proportions.",
  },
  collection: {
    price: 149,
    label: "Complete Size Collection — 1,200 / 2,000 / 3,200 / 4,000 px",
    details: "Intended package: all four PNG size exports (1,200, 2,000, 3,200 and 4,000 px longest edge), each preserving the artwork's original proportions. Physical dimensions above are estimates at 300 DPI.",
  },
};

export const tattooDesigns: TattooDesign[] = [
  {
    id: "sea-dragons",
    title: "Assimilation — Seahorses",
    slug: "sea-dragons",
    category: "Original Tattoo Artwork",
    description: "The linked seahorse artwork from the public ART TO INK gallery.",
    gridImage: image("01-seahorses-colour-transparent-original.png"),
    checkoutImage: image("01-seahorses-colour-transparent-original.png"),
    media: {
      colour: image("01-seahorses-colour-transparent-original.png"),
      blackAndWhite: image("02-seahorses-black-white-transparent-original.png"),
      onSkin: image("seahorses-color-presentation.jpg"),
    },
    sizes: sharedSizes,
  },
  {
    id: "mrs-beer",
    title: "MRS Beer",
    slug: "mrs-beer",
    category: "Original Tattoo Artwork",
    description: "A flowing copper-red portrait with a bright, expressive finish.",
    gridImage: image("mrs-beer-concept.png"),
    checkoutImage: image("mrs-beer-concept.png"),
    media: {
      colour: image("mrs-beer-concept.png"),
      blackAndWhite: image("mrs-beer.jpg"),
      onSkin: image("shoulder-color-reference.jpg"),
    },
    sizes: sharedSizes,
  },
  {
    id: "goodbye-london",
    title: "Good Bye, London",
    slug: "goodbye-london",
    category: "Original Tattoo Artwork",
    description: "A red-coated figure set against the expressive London-inspired background.",
    gridImage: image("goodbye-london-concept.png"),
    checkoutImage: image("goodbye-london-concept.png"),
    media: {
      colour: image("goodbye-london-concept.png"),
      blackAndWhite: image("goodbye-london.jpg"),
      onSkin: image("back-color-reference.jpg"),
    },
    sizes: sharedSizes,
  },
  {
    id: "war-inside",
    title: "War Inside",
    slug: "war-inside",
    category: "Original Tattoo Artwork",
    description: "A dramatic portrait built around the helmet and inner-conflict motif.",
    gridImage: image("war-inside-concept.png"),
    checkoutImage: image("war-inside-concept.png"),
    media: {
      colour: image("war-inside-concept.png"),
      blackAndWhite: image("war-inside.jpg"),
      onSkin: image("shoulder-black-white-reference.jpg"),
    },
    sizes: sharedSizes,
  },
  {
    id: "brain-heart",
    title: "Brain Heart",
    slug: "brain-heart",
    category: "Original Tattoo Artwork",
    description: "A vivid female portrait with blue eyes and energetic colour.",
    gridImage: image("brain-heart-concept.png"),
    checkoutImage: image("brain-heart-concept.png"),
    media: {
      colour: image("brain-heart-concept.png"),
      blackAndWhite: image("brain-heart.jpg"),
      onSkin: image("detail-01.jpg"),
    },
    sizes: sharedSizes,
  },
  {
    id: "lion-heart",
    title: "Lion Heart",
    slug: "lion-heart",
    category: "Original Tattoo Artwork",
    description: "A layered lion-and-woman portrait in warm, expressive tones.",
    gridImage: image("lion-heart-1.png"),
    checkoutImage: image("lion-heart-1.png"),
    media: {
      colour: image("lion-heart-1.png"),
      blackAndWhite: image("lion-heart-2.png"),
      onSkin: image("shoulder-color-reference.jpg"),
    },
    sizes: sharedSizes,
  },
  {
    // Keep the existing Faces Within product key so current licence/order
    // references are not silently reassigned. The public-facing title matches
    // the live gallery. Verify its backend display name before enabling sales.
    id: "faces-within",
    title: "Aura of Pete",
    slug: "faces-within",
    category: "Original Tattoo Artwork",
    description: "The golden female figure shown as Aura of Pete in the public gallery.",
    gridImage: image("faces-within-concept.png"),
    checkoutImage: image("faces-within-concept.png"),
    media: {
      colour: image("faces-within-concept.png"),
      blackAndWhite: image("faces-within.jpg"),
      onSkin: image("detail-02.jpg"),
    },
    sizes: sharedSizes,
  },
  {
    // This is a new public-gallery design. Its existing backend product/asset
    // record has not been confirmed, so secure checkout will remain unavailable.
    id: "war-mask",
    title: "War Mask",
    slug: "war-mask",
    category: "Original Tattoo Artwork",
    description: "A separate comic-style helmet portrait. Secure ordering will be enabled only after its product record and files are registered.",
    gridImage: image("source-reference-original.jpg"),
    checkoutImage: image("source-reference-original.jpg"),
    media: {
      colour: image("source-reference-original.jpg"),
      blackAndWhite: image("source-reference-black-white.jpg"),
      onSkin: image("detail-03.jpg"),
    },
    sizes: sharedSizes,
  },
];
