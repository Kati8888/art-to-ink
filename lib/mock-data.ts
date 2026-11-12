import type { TattooDesign } from "@/lib/products";

// Preview files are public artwork assets. No Supabase Storage is used here.
const asset = (path: string) => `/assets/${path}`;
const source = (filename: string) =>
  `https://raw.githubusercontent.com/Kati8888/art-to-ink/commerce-completion/images/${encodeURIComponent(filename)}`;

const sharedSizes = {
  mini: { price: 9, label: "Mini — 1,200 px", details: "Digital PNG export with a 1,200 px longest edge. Approx. 10.2 cm at 300 DPI; the other edge follows the artwork's original proportions." },
  small: { price: 19, label: "Small — 2,000 px", details: "Digital PNG export with a 2,000 px longest edge. Approx. 16.9 cm at 300 DPI; the other edge follows the artwork's original proportions." },
  detailed: { price: 39, label: "Detailed — 3,200 px", details: "Digital PNG export with a 3,200 px longest edge. Approx. 27.1 cm at 300 DPI; the other edge follows the artwork's original proportions." },
  premium: { price: 79, label: "Premium — 4,000 px", details: "Digital PNG export with a 4,000 px longest edge. Approx. 33.9 cm at 300 DPI; the other edge follows the artwork's original proportions." },
  collection: { price: 149, label: "Complete Size Collection — 1,200 / 2,000 / 3,200 / 4,000 px", details: "Intended package: all four PNG size exports (1,200, 2,000, 3,200 and 4,000 px longest edge), each preserving the artwork's original proportions." },
};

export const tattooDesigns: TattooDesign[] = [
  {
    id: "sea-dragons", title: "Assimilation — Seahorses", slug: "assimilation-seahorses",
    category: "Original Tattoo Artwork",
    description: "The linked seahorse artwork from the public ART TO INK gallery.",
    gridImage: asset("01-seahorses-colour-transparent-original.png"),
    checkoutImage: asset("01-seahorses-colour-transparent-original.png"),
    media: {
      colour: asset("01-seahorses-colour-transparent-original.png"),
      blackAndWhite: asset("02-seahorses-black-white-transparent-original.png"),
      onSkin: asset("seahorses-color-presentation.jpg"),
    }, sizes: sharedSizes,
  },
  {
    id: "mrs-beer", title: "MRS Beer", slug: "mrs-beer",
    category: "Original Tattoo Artwork",
    description: "A flowing copper-red portrait with a bright, expressive finish.",
    gridImage: source("Bublinová zrzka v akvarelu.png"),
    checkoutImage: source("Bublinová zrzka v akvarelu.png"),
    media: {
      colour: source("Bublinová zrzka v akvarelu.png"),
      blackAndWhite: source("Vodní portrét a tetovací variace.png"),
      onSkin: source("Bublinová zrzka v akvarelu.png"),
    }, sizes: sharedSizes,
  },
  {
    id: "goodbye-london", title: "Good Bye, London", slug: "good-bye-london",
    category: "Original Tattoo Artwork",
    description: "A red-coated figure set against the expressive London-inspired background.",
    gridImage: source("Snímek obrazovky 2026-10-15 092238.png"),
    checkoutImage: source("Snímek obrazovky 2026-10-15 092238.png"),
    media: {
      colour: source("Snímek obrazovky 2026-10-15 092238.png"),
      blackAndWhite: source("Čtyřpanelová přehlídka akvarelových tetování (1).png"),
      onSkin: source("Snímek obrazovky 2026-10-15 092238.png"),
    }, sizes: sharedSizes,
  },
  {
    id: "war-inside", title: "War Inside", slug: "war-inside",
    category: "Original Tattoo Artwork",
    description: "A dramatic portrait built around the helmet and inner-conflict motif.",
    gridImage: source("Tanková koruna_ portrét v inkoustu.png"),
    checkoutImage: source("Tanková koruna_ portrét v inkoustu.png"),
    media: {
      colour: source("Tanková koruna_ portrét v inkoustu.png"),
      blackAndWhite: source("Tattooový kolážový panel s tankem a inkoustem.png"),
      onSkin: source("Tanková koruna_ portrét v inkoustu.png"),
    }, sizes: sharedSizes,
  },
  {
    id: "brain-heart", title: "Brain Heart", slug: "brain-heart",
    category: "Original Tattoo Artwork",
    description: "A vivid female portrait with blue eyes and energetic colour.",
    gridImage: source("Výrazný portrét v proudu barev.png"),
    checkoutImage: source("Výrazný portrét v proudu barev.png"),
    media: {
      colour: source("Výrazný portrét v proudu barev.png"),
      blackAndWhite: source("Abstraktní portréty v tetování.png"),
      onSkin: source("Výrazný portrét v proudu barev.png"),
    }, sizes: sharedSizes,
  },
  {
    id: "lion-heart", title: "Lion Heart", slug: "lion-heart",
    category: "Original Tattoo Artwork",
    description: "A layered lion-and-woman portrait in warm, expressive tones.",
    gridImage: asset("lion-heart-1.png"),
    checkoutImage: asset("lion-heart-1.png"),
    media: {
      colour: asset("lion-heart-1.png"),
      blackAndWhite: asset("lion-heart-2.png"),
      onSkin: asset("lion-heart-1.png"),
    }, sizes: sharedSizes,
  },
  {
    // Retain the existing product key to avoid silently changing order references.
    id: "faces-within", title: "Aura of Pete", slug: "aura-of-pete",
    category: "Original Tattoo Artwork",
    description: "The golden female figure shown as Aura of Pete in the public gallery.",
    gridImage: source("Zrcadlový tanec ve zlatém šeru.png"),
    checkoutImage: source("Zrcadlový tanec ve zlatém šeru.png"),
    media: {
      colour: source("Zrcadlový tanec ve zlatém šeru.png"),
      blackAndWhite: source("Srdce ženy a lva_ tattoo portfolio (1).png"),
      onSkin: source("Zrcadlový tanec ve zlatém šeru.png"),
    }, sizes: sharedSizes,
  },
  {
    // War Mask is visible in the public gallery, but its secure commerce product
    // record has not yet been confirmed. Availability checks therefore keep checkout closed.
    id: "war-mask", title: "War Mask", slug: "war-mask",
    category: "Original Tattoo Artwork",
    description: "A separate comic-style helmet portrait. Secure ordering remains unavailable until its product and licensed files are registered.",
    gridImage: source("Válečný portrét s tanky a rohy.png"),
    checkoutImage: source("Válečný portrét s tanky a rohy.png"),
    media: {
      colour: source("Válečný portrét s tanky a rohy.png"),
      blackAndWhite: source("Komiksový portrét v inkoustových tetováních (1).png"),
      onSkin: source("Válečný portrét s tanky a rohy.png"),
    }, sizes: sharedSizes,
  },
];
