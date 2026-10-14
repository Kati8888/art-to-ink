"use client";

import { useState } from "react";
import ProductDetail from "@/components/ProductDetail";
import type { TattooDesign } from "@/lib/products";
import { DESIGN_SIZE_ORDER, formatEuro } from "@/lib/products";

type MediaState = "colour" | "bw" | "skin";
const mediaLabels: Record<MediaState, string> = { colour: "Original / Colour", bw: "Black & White", skin: "On Skin" };
const mediaKey: Record<MediaState, keyof TattooDesign["media"]> = { colour: "colourPreview", bw: "bwPreview", skin: "onSkinPreview" };

export function TattooDesignGallery({ designs }: { designs: TattooDesign[] }) {
  if (designs.length === 0) {
    return <div className="empty-catalogue" role="status"><strong>New original designs are being prepared.</strong><p>We publish a design only after its original artwork, black-and-white version and on-skin preview have all been checked to match.</p></div>;
  }
  return <><div className="design-grid">{designs.map((design) => <DesignCard key={design.id} design={design} onOpen={() => setActiveProduct(design)} />)}</div>{activeProduct && <ProductDetail key={activeProduct.id} product={activeProduct} onClose={() => setActiveProduct(null)} />}</>;
}

function DesignCard({ design, onOpen }: { design: TattooDesign; onOpen: () => void }) {
  const [state, setState] = useState<MediaState>("colour");
  const [activeProduct, setActiveProduct] = useState<TattooDesign | null>(null);
  const [size, setSize] = useState<(typeof DESIGN_SIZE_ORDER)[number]>("detailed");
  const [intendedUseConfirmed, setIntendedUseConfirmed] = useState(false);
  const [intendedUse, setIntendedUse] = useState("professional-client-tattoo");
  const [placementNote, setPlacementNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const currentMedia = useMemo(() => design.media[mediaKey[state]], [design, state]);

  async function checkout() {
    setError("");
    if (!intendedUseConfirmed) { setError("Please confirm the intended use before checkout."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "design", productSlug: design.slug, size, intendedUseConfirmed, intendedUse, placementNote }),
      });
      const data: { url?: string; error?: string } = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error ?? "Checkout could not be started.");
      window.location.assign(data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout could not be started.");
      setBusy(false);
    }
  }

  return <article className="design-card">
    <div style={{ padding: 14 }}>
      {/* Main art is contained, not cropped, so important details are not hidden. */}
      <button type="button" onClick={onOpen} aria-label={`View ${design.title} details`} className="block w-full text-left"><div className="w-full aspect-square bg-zinc-900 border border-zinc-800 rounded-sm overflow-hidden flex items-center justify-center"><img className="w-full h-full object-contain" src={currentMedia} alt={`${design.title} — ${mediaLabels[state]}`} /></div></button>
      <div className="gallery-tabs" role="group" aria-label={`${design.title} image view`}>
        {(Object.keys(mediaLabels) as MediaState[]).map((item) => <button key={item} type="button" className="gallery-tab" aria-pressed={state === item} onClick={() => setState(item)}>{mediaLabels[item]}</button>)}
      </div>
    </div>
    <div className="design-card-copy">
      <button type="button" onClick={onOpen} className="text-left"><span className="eyebrow">Original tattoo artwork</span><h3>{design.title}</h3><p>{design.description}</p></button>
      <div className="purchase-form">
        <label>Artwork size and file <select value={size} onChange={(event) => setSize(event.target.value as typeof size)}>{DESIGN_SIZE_ORDER.map((key) => <option key={key} value={key}>{design.sizes[key].label} — {formatEuro(design.sizes[key].price)}</option>)}</select></label>
        <p className="muted" style={{ margin: 0 }}>{design.sizes[size].details}</p>
        <label>Intended use <select value={intendedUse} onChange={(event) => setIntendedUse(event.target.value)}><option value="professional-client-tattoo">Tattooing a client</option><option value="personal-reference">Personal reference</option></select></label>
        <label>Optional placement note <textarea rows={2} maxLength={500} value={placementNote} onChange={(event) => setPlacementNote(event.target.value)} placeholder="e.g. outer forearm (optional)" /></label>
        <label className="checkbox-line"><input type="checkbox" checked={intendedUseConfirmed} onChange={(event) => setIntendedUseConfirmed(event.target.checked)} /><span>I confirm the intended use above and agree to the design licence terms.</span></label>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button type="button" className="button" disabled={busy} onClick={checkout}>{busy ? "Opening secure checkout…" : `Buy design · ${formatEuro(design.sizes[size].price)}`}</button>
      </div>
    </div>
  </article>;
}
