// src/data/products.ts

export interface TattooDesign {
  id: string;
  title: string;
  slug: string;
  category: string;
  description: string;
  media: {
    colour: string;
    blackAndWhite: string;
    onSkin: string;
  };
  variants: {
    id: string;
    name: string;
    price: number;
    description: string;
  }[];
}

/**
 * Draft catalogue contract only.
 * Do not add a design to the live catalogue until all three previews and the
 * matching high-resolution source have been visually verified. The paths
 * below are supplied examples and are not treated as verified production art.
 */
export const tattooProducts: TattooDesign[] = [];
