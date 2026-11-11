"use client";

import { useState } from "react";
import ProductDetail from "@/components/ProductDetail";
import ArtworkInteractions from "@/components/ArtworkInteractions";
import type { TattooDesign } from "@/lib/products";

export function TattooDesignGallery({ designs }: { designs: TattooDesign[] }) {
  const [activeProduct, setActiveProduct] = useState<TattooDesign | null>(null);

  if (designs.length === 0) {
    return <div className="empty-catalogue" role="status"><strong>New original designs are being prepared.</strong><p>We publish a design only after its original artwork, black-and-white version and on-skin preview have all been checked to match.</p></div>;
  }

  return (
    <>
      <div className="design-grid">
        {designs.map((design) => (
          <article key={design.id} className="design-card">
            <button
              type="button"
              onClick={() => setActiveProduct(design)}
              aria-label={`View ${design.title} artwork and options`}
              className="block w-full text-left"
            >
              <div className="relative block w-full h-[350px] min-h-[350px] overflow-hidden bg-zinc-900">
                <img
                  src={design.gridImage ?? design.media.colour}
                  alt={`${design.title} — tattoo design collection`}
                  className={`absolute inset-0 block w-full h-full ${design.id === "lion-heart" ? "lion-heart-primary object-contain scale-[1.12]" : "object-cover object-center"} ${design.id === "sea-dragons" ? "assimilation-artwork" : ""}`}
                />
              </div>
              <div className="design-card-copy">
                <span className="eyebrow">Tattoo design collection</span>
                <h3>{design.title}</h3>
                <p>{design.description}</p>
                <span className="block border-t border-zinc-800 pt-4">View artwork <span aria-hidden="true">↗</span></span>
              </div>
            </button>
            <ArtworkInteractions designId={design.id} designTitle={design.title} />
          </article>
        ))}
      </div>
      {activeProduct && (
        <ProductDetail
          key={activeProduct.id}
          product={activeProduct}
          onClose={() => setActiveProduct(null)}
        />
      )}
    </>
  );
}
