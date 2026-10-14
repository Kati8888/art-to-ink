"use client";

import { useEffect, useState } from "react";
import type { TattooDesign, DesignSize } from "@/lib/products";
import { DESIGN_SIZE_ORDER, formatEuro } from "@/lib/products";

export default function ProductDetail({ product, onClose }: { product: TattooDesign; onClose: () => void }) {
  const [size, setSize] = useState<DesignSize>("detailed");
  const [intendedUseConfirmed, setIntendedUseConfirmed] = useState(false);
  const [intendedUse, setIntendedUse] = useState("professional-client-tattoo");
  const [placementNote, setPlacementNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function checkout() {
    setError("");
    if (!intendedUseConfirmed) { setError("Please confirm the intended use before checkout."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "design", productSlug: product.slug, size, intendedUseConfirmed: true, intendedUse, placementNote: placementNote.trim().slice(0, 500) }),
      });
      const data: { url?: string; error?: string } = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error ?? "Checkout could not be started.");
      window.location.assign(data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout could not be started.");
      setBusy(false);
    }
  }

  const views = [
    { key: "colourPreview" as const, label: "Colour" },
    { key: "bwPreview" as const, label: "Black & White" },
    { key: "onSkinPreview" as const, label: "On Skin" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/90 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="product-modal-title" className="relative my-4 w-full max-w-6xl border border-zinc-800 bg-black p-4 text-white shadow-2xl sm:p-6">
        <button type="button" onClick={onClose} aria-label="Close design details" className="absolute right-3 top-3 z-10 border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900">Close</button>
        <div className="mb-6 pr-16">
          <p className="text-xs uppercase tracking-widest text-zinc-500">{product.category}</p>
          <h2 id="product-modal-title" className="mt-2 text-3xl font-light tracking-wide">{product.title}</h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-zinc-400">{product.description}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {views.map((view) => <figure key={view.key} className="min-w-0">
            <figcaption className="mb-2 text-xs uppercase tracking-widest text-zinc-400">{view.label}</figcaption>
            <div className="w-full aspect-square bg-zinc-900 border border-zinc-800 rounded-sm overflow-hidden flex items-center justify-center">
              <img src={product.media[view.key]} alt={`${product.title} — ${view.label}`} className="w-full h-full object-contain" />
            </div>
          </figure>)}
        </div>
        <div className="mt-8 grid grid-cols-1 gap-8 border-t border-zinc-800 pt-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-4 text-xs uppercase tracking-widest text-zinc-400">Artwork size & files</h3>
            <fieldset className="space-y-3"><legend className="sr-only">Choose artwork size</legend>
              {DESIGN_SIZE_ORDER.map((key) => <label key={key} className={`flex cursor-pointer items-start justify-between gap-4 border p-4 ${size === key ? "border-white bg-zinc-950" : "border-zinc-800 bg-zinc-900/50"}`}>
                <span className="flex items-start gap-3"><input type="radio" name={`size-${product.id}`} checked={size === key} onChange={() => setSize(key)} className="mt-1 accent-white" /><span><span className="block text-sm font-medium">{product.sizes[key].label}</span><span className="mt-1 block text-xs text-zinc-500">{product.sizes[key].details}</span></span></span>
                <span className="shrink-0 text-sm font-semibold">{formatEuro(product.sizes[key].price)}</span>
              </label>)}
            </fieldset>
          </div>
          <div>
            <label className="mb-4 block text-sm text-zinc-300">Intended use
              <select value={intendedUse} onChange={(event) => setIntendedUse(event.target.value)} className="mt-2 w-full border border-zinc-800 bg-zinc-900 p-3 text-white"><option value="professional-client-tattoo">Tattooing a client</option><option value="personal-reference">Personal reference</option></select>
            </label>
            <label className="mb-4 block text-sm text-zinc-300">Optional placement note
              <textarea value={placementNote} onChange={(event) => setPlacementNote(event.target.value)} maxLength={500} rows={2} placeholder="e.g. outer forearm (optional)" className="mt-2 w-full border border-zinc-800 bg-zinc-900 p-3 text-white placeholder:text-zinc-600" />
            </label>
            <label className="mb-4 flex items-start gap-3 text-sm text-zinc-300"><input type="checkbox" checked={intendedUseConfirmed} onChange={(event) => setIntendedUseConfirmed(event.target.checked)} className="mt-1 accent-white" /><span>I confirm the intended use above and agree to the applicable design licence terms.</span></label>
            {error && <p role="alert" className="mb-3 text-sm text-red-300">{error}</p>}
            <button type="button" disabled={busy} onClick={checkout} className="w-full bg-white py-4 text-sm font-medium uppercase tracking-widest text-black hover:bg-zinc-200 disabled:opacity-60">{busy ? "Opening secure checkout…" : `Continue to checkout — ${formatEuro(product.sizes[size].price)}`}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
