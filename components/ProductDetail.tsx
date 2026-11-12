"use client";

import { useEffect, useState } from "react";
import type { TattooDesign, DesignSize } from "@/lib/products";
import { DESIGN_SIZE_ORDER, formatEuro } from "@/lib/products";

type MediaView = keyof TattooDesign["media"];

const mediaViews: { key: MediaView; label: string }[] = [
  { key: "colour", label: "Colour" },
  { key: "blackAndWhite", label: "Black & White" },
  { key: "onSkin", label: "On Skin" },
];

export default function ProductDetail({ product, onClose }: { product: TattooDesign; onClose: () => void }) {
  const [activeView, setActiveView] = useState<MediaView>("colour");
  const [artworkFormat, setArtworkFormat] = useState<"colour" | "blackAndWhite">("colour");
  const [size, setSize] = useState<DesignSize>("detailed");
  const [intendedUseConfirmed, setIntendedUseConfirmed] = useState(false);
  const [intendedUse, setIntendedUse] = useState("personal-tattoo");
  const [placementNote, setPlacementNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [deliveryReady, setDeliveryReady] = useState(false);
  const [checkingDelivery, setCheckingDelivery] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setCheckingDelivery(true);
    setDeliveryReady(false);
    const query = new URLSearchParams({ productId: product.id, size, artworkFormat });
    fetch(`/api/design-availability?${query.toString()}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { available: false })
      .then((data: { available?: boolean }) => { if (!cancelled) setDeliveryReady(data.available === true); })
      .catch(() => { if (!cancelled) setDeliveryReady(false); })
      .finally(() => { if (!cancelled) setCheckingDelivery(false); });
    return () => { cancelled = true; };
  }, [product.id, size, artworkFormat]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function addToCart() {
    setError("");
    setBusy(true);
    try {
      const key = "art-to-ink-guest-cart";
      const current = JSON.parse(window.localStorage.getItem(key) ?? "[]") as Array<{ productSlug: string; variantKey: DesignSize; format: "colour" | "blackAndWhite"; quantity: number }>;
      const existing = current.find((item) => item.productSlug === product.slug && item.variantKey === size && item.format === artworkFormat);
      if (existing) existing.quantity = Math.min(20, existing.quantity + 1);
      else current.push({ productSlug: product.slug, variantKey: size, format: artworkFormat, quantity: 1 });
      window.localStorage.setItem(key, JSON.stringify(current));
      window.location.assign("/cart");
    } catch {
      setError("The item could not be added to your cart. Please enable browser storage and try again.");
      setBusy(false);
    }
  }
  function getCurrentImage(): string {
    if (activeView === "colour" && product.checkoutImage) return product.checkoutImage;
    return product.media[activeView];
  }

  const activeLabel = mediaViews.find((view) => view.key === activeView)?.label ?? "Colour";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/90 p-3 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
        className="relative my-3 max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl overflow-y-auto overscroll-contain border border-zinc-800 bg-black p-4 text-white shadow-2xl sm:my-6 sm:max-h-[calc(100dvh-3rem)] sm:p-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close design details"
          className="absolute right-3 top-3 z-10 border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900"
        >
          Close
        </button>

        <div className="mb-6 pr-16">
          <p className="text-xs uppercase tracking-widest text-zinc-500">{product.category}</p>
          <h2 id="product-modal-title" className="mt-2 text-3xl font-light tracking-wide">{product.title}</h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-zinc-400">{product.description}</p>
        </div>

        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Artwork image view">
            {mediaViews.map((view) => (
              <button
                key={view.key}
                type="button"
                aria-pressed={activeView === view.key}
                onClick={() => { setActiveView(view.key); if (view.key === "colour" || view.key === "blackAndWhite") setArtworkFormat(view.key); }}
                className={`border px-4 py-2 text-xs uppercase tracking-widest transition-colors ${
                  activeView === view.key
                    ? "border-white bg-white text-black"
                    : "border-zinc-700 text-zinc-300 hover:border-zinc-400"
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>
          <p className="mb-2 text-xs uppercase tracking-widest text-zinc-400">{activeLabel}</p>
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Download file format">
            <button type="button" aria-pressed={artworkFormat === "colour"} onClick={() => { setArtworkFormat("colour"); setActiveView("colour"); }} className="border border-zinc-700 px-4 py-2 text-xs uppercase tracking-widest">Colour file</button>
            <button type="button" aria-pressed={artworkFormat === "blackAndWhite"} onClick={() => { setArtworkFormat("blackAndWhite"); setActiveView("blackAndWhite"); }} className="border border-zinc-700 px-4 py-2 text-xs uppercase tracking-widest">Black &amp; white file</button>
          </div>
          <div className="w-full aspect-square overflow-hidden border border-zinc-800 bg-white flex items-center justify-center">
            <img
              key={getCurrentImage()}
              src={getCurrentImage()}
              alt={`${product.title} — ${activeLabel}`}
              className="w-full h-full object-contain" style={{ filter: "brightness(1.28) contrast(1.06)" }}
            />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 border-t border-zinc-800 pt-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-4 text-xs uppercase tracking-widest text-zinc-400">Artwork size & files</h3>
            <fieldset className="space-y-3">
              <legend className="sr-only">Choose artwork size</legend>
              {DESIGN_SIZE_ORDER.map((key) => (
                <label
                  key={key}
                  className={`flex cursor-pointer items-start justify-between gap-4 border p-4 ${
                    size === key ? "border-white bg-zinc-950" : "border-zinc-800 bg-zinc-900/50"
                  }`}
                >
                  <span className="flex items-start gap-3">
                    <input
                      type="radio"
                      name={`size-${product.id}`}
                      checked={size === key}
                      onChange={() => setSize(key)}
                      className="mt-1 accent-white"
                    />
                    <span>
                      <span className="block text-sm font-medium">{product.sizes[key].label}</span>
                      <span className="mt-1 block text-xs text-zinc-500">{product.sizes[key].details}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold">{formatEuro(product.sizes[key].price)}</span>
                </label>
              ))}
            </fieldset>
          </div>

          <div>
            <div className="mb-5 border border-zinc-800 bg-zinc-950 p-4">
              <h3 className="mb-3 text-xs uppercase tracking-widest text-zinc-400">Order details</h3>
              <label className="mb-4 block text-sm text-zinc-300">Intended use
                <select value={intendedUse} onChange={(event) => setIntendedUse(event.target.value)} className="mt-2 w-full border border-zinc-800 bg-zinc-900 p-3 text-white">
                  <option value="personal-tattoo">Personal tattoo</option><option value="professional-client-tattoo">Tattooing a client</option><option value="personal-reference">Personal reference only</option>
                </select>
              </label>
              <label className="mb-4 block text-sm text-zinc-300">Optional placement note
                <textarea value={placementNote} onChange={(event) => setPlacementNote(event.target.value)} maxLength={500} rows={2} placeholder="e.g. outer forearm (optional)" className="mt-2 w-full border border-zinc-800 bg-zinc-900 p-3 text-white placeholder:text-zinc-600" />
              </label>
              <label className="flex items-start gap-3 text-sm text-zinc-300"><input type="checkbox" checked={intendedUseConfirmed} onChange={(event) => setIntendedUseConfirmed(event.target.checked)} className="mt-1 accent-white" /><span>I confirm the intended use above and agree to the applicable design licence terms.</span></label>
            </div>
            {error && <p role="alert" className="mb-3 text-sm text-red-300">{error}</p>}
            {checkingDelivery ? <p role="status" className="mb-3 border border-zinc-700 p-3 text-sm text-zinc-400">Checking secure file availability…</p> : !deliveryReady ? <p role="status" className="mb-3 border border-zinc-700 p-3 text-sm text-zinc-400">This exact size and file format is not yet ready for secure delivery. You can save it in your cart, but payment will stay unavailable until the file is uploaded.</p> : null}
            <button type="button" disabled={busy || !intendedUseConfirmed} onClick={addToCart} className="w-full bg-white py-4 text-sm font-medium uppercase tracking-widest text-black hover:bg-zinc-200 disabled:opacity-60">
              {busy ? "Adding to cart…" : "Add to cart — " + formatEuro(product.sizes[size].price)}
            </button>
            <p className="mt-3 text-xs text-zinc-500">No account or personal details needed yet. You will enter your contact details when your full order is ready.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
