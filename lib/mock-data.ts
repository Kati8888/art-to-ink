import type { TattooDesign } from "@/lib/products";

const image = (path: string) => `https://raw.githubusercontent.com/Kati8888/art-to-ink/main/${path}`;

const sharedSizes = {
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
    label: "Complete Digital Design Collection",
    details: "Complete digital design collection.",
  },
};

export const tattooDesigns: TattooDesign[] = [
  {
    id: "brain-heart",
    title: "Brain Heart",
    slug: "brain-heart",
    category: "Original Tattoo Artwork",
    description: "Original Brain Heart tattoo artwork with its own colour portrait and presentation collage.",
    media: {
      colour: image("images/Kubistick%C3%BD%20portr%C3%A9t%20s%20rud%C3%BDm%20mozkov%C3%BDm%20ornamentem.png"),
      blackAndWhite: image("images/Barevn%C3%A1%20tv%C3%A1%C5%99%20v%20inkoustov%C3%BDch%20tetov%C3%A1n%C3%ADch.png"),
      onSkin: image("images/Barevn%C3%A1%20tv%C3%A1%C5%99%20v%20inkoustov%C3%BDch%20tetov%C3%A1n%C3%ADch.png"),
    },
    sizes: sharedSizes,
  },
  {
    id: "mrs-beer",
    title: "MRS Beer",
    slug: "mrs-beer",
    category: "Original Tattoo Artwork",
    description: "Original MRS Beer artwork by Kateřina Pohnetalová.",
    media: {
      colour: image("images/Bublinov%C3%A1%20zrzka%20v%20akvarelu.png"),
      blackAndWhite: image("images/Vodn%C3%AD%20portr%C3%A9t%20a%20tetovac%C3%AD%20variace.png"),
      onSkin: image("images/Vodn%C3%AD%20portr%C3%A9t%20a%20tetovac%C3%AD%20variace.png"),
    },
    sizes: sharedSizes,
  },
  {
    id: "sea-dragons",
    title: "Assimilation",
    slug: "sea-dragons",
    category: "Original Tattoo Artwork",
    description: "Original Assimilation tattoo artwork with dragon spirals.",
    media: {
      colour: image("assets/01-seahorses-colour-transparent-original.png"),
      blackAndWhite: image("assets/02-seahorses-black-white-transparent-original.png"),
      onSkin: image("images/Tetovac%C3%AD%20portfolio%20s%20dra%C4%8D%C3%ADmi%20spir%C3%A1lami%20%282%29.png"),
    },
    sizes: sharedSizes,
  },
  {
    id: "lion-heart",
    title: "Lion Heart",
    slug: "lion-heart",
    category: "Original Tattoo Artwork",
    description: "Original Lion Heart tattoo artwork, with its own colour design and matching presentation image.",
    gridImage: image("images/Lion-heart-1.png?v=143ef12"),
    checkoutImage: image("images/Lion-heart-1.png?v=143ef12"),
    media: {
      colour: image("images/Lion-heart-1.png?v=143ef12"),
      blackAndWhite: image("images/Lion-heart-1.png?v=143ef12"),
      onSkin: image("images/Lion-heart-2.png?v=3db48b0"),
    },
    sizes: sharedSizes,
  },
  {
    id: "babicka-dedo",
    title: "Grandparents — Babicka & Dedo",
    slug: "babicka-dedo",
    category: "Original Tattoo Artwork",
    description: "A personal portrait concept celebrating family bonds, prepared as original tattoo artwork.",
    gridImage: image("public/assets/babicka-dedo-concept.png"),
    checkoutImage: image("public/assets/babicka-dedo-concept.png"),
    media: {
      colour: image("public/assets/babicka-dedo-concept.png"),
      blackAndWhite: image("images/Abstraktní%20portréty%20v%20tetování.png"),
      onSkin: image("public/assets/babicka-dedo-concept.png"),
    },
    sizes: sharedSizes,
  },
  {
    id: "faces-within",
    title: "Faces Within",
    slug: "faces-within",
    category: "Original Tattoo Artwork",
    description: "Layered portrait artwork exploring identity, expression, and the stories held within a face.",
    gridImage: image("public/assets/faces-within-concept.png"),
    checkoutImage: image("public/assets/faces-within-concept.png"),
    media: {
      colour: image("public/assets/faces-within-concept.png"),
      blackAndWhite: image("images/Abstraktní%20portréty%20v%20tetování.png"),
      onSkin: image("public/assets/faces-within.jpg"),
    },
    sizes: sharedSizes,
  },
  {
    id: "goodbye-london",
    title: "Goodbye London",
    slug: "goodbye-london",
    category: "Original Tattoo Artwork",
    description: "An expressive original portrait design inspired by memory, change, and a new chapter.",
    gridImage: image("public/assets/goodbye-london-concept.png"),
    checkoutImage: image("public/assets/goodbye-london-concept.png"),
    media: {
      colour: image("public/assets/goodbye-london-concept.png"),
      blackAndWhite: image("public/assets/goodbye-london.jpg"),
      onSkin: image("public/assets/goodbye-london.jpg"),
    },
    sizes: sharedSizes,
  },
  {
    id: "war-inside",
    title: "War Inside",
    slug: "war-inside",
    category: "Original Tattoo Artwork",
    description: "A bold, dramatic original tattoo-art portrait built around inner conflict and resilience.",
    gridImage: image("public/assets/war-inside-concept.png"),
    checkoutImage: image("public/assets/war-inside-concept.png"),
    media: {
      colour: image("public/assets/war-inside-concept.png"),
      blackAndWhite: image("public/assets/war-inside.jpg"),
      onSkin: image("public/assets/war-inside.jpg"),
    },
    sizes: sharedSizes,
  },
];
