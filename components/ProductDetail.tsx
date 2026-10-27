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
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
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

  async function checkout() {
    setError("");
    if (!intendedUseConfirmed) {
      setError("Please confirm the intended use before checkout.");
      return;
    }
    if (!customerName.trim() || !customerPhone.trim() || !customerEmail.trim()) {
      setError("Please enter your name, phone number and email so we can contact you if delivery fails.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "design",
          productId: product.id,
          variantId: "var_" + size,
          artworkFormat,
          customerIntent: intendedUse,
          intendedUseConfirmed: true,
          intendedUse,
          placementNote: placementNote.trim().slice(0, 500),
          customerName: customerName.trim().slice(0, 120),
          customerPhone: customerPhone.trim().slice(0, 40),
          customerEmail: customerEmail.trim().slice(0, 254),
        }),
      });
      const data: { url?: string; error?: string } = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Checkout could not be started.");
      }
      window.location.assign(data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout could not be started.");
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
        className="relative my-4 w-full max-w-6xl border border-zinc-800 bg-black p-4 text-white shadow-2xl sm:p-6"
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
                onClick={() => setActiveView(view.key)}
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
            <button type="button" aria-pressed={artworkFormat === "colour"} onClick={() => setArtworkFormat("colour")} className="border border-zinc-700 px-4 py-2 text-xs uppercase tracking-widest">Colour file</button>
            <button type="button" aria-pressed={artworkFormat === "blackAndWhite"} onClick={() => setArtworkFormat("blackAndWhite")} className="border border-zinc-700 px-4 py-2 text-xs uppercase tracking-widest">Black &amp; white file</button>
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
              <h3 className="mb-3 text-xs uppercase tracking-widest text-zinc-400">Order contact details</h3>
              <p className="mb-3 text-xs text-zinc-500">We use these details for your order and to contact you if the payment or download delivery has a problem.</p>
              <label className="mb-3 block text-sm text-zinc-300">Full name<input required autoComplete="name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={120} className="mt-2 w-full border border-zinc-800 bg-zinc-900 p-3 text-white" /></label>
              <label className="mb-3 block text-sm text-zinc-300">Email address<input required type="email" autoComplete="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} maxLength={254} className="mt-2 w-full border border-zinc-800 bg-zinc-900 p-3 text-white" /></label>
              <label className="block text-sm text-zinc-300">Phone number<input required type="tel" autoComplete="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} maxLength={40} className="mt-2 w-full border border-zinc-800 bg-zinc-900 p-3 text-white" /></label>
            </div>
            <label className="mb-4 block text-sm text-zinc-300">
              Intended use
              <select
                value={intendedUse}
                onChange={(event) => setIntendedUse(event.target.value)}
                className="mt-2 w-full border border-zinc-800 bg-zinc-900 p-3 text-white"
              >
                <option value="personal-tattoo">Personal tattoo</option>
                <option value="professional-client-tattoo">Tattooing a client</option>
                <option value="personal-reference">Personal reference only</option>
              </select>
            </label>
            <label className="mb-4 block text-sm text-zinc-300">
              Optional placement note
              <textarea
                value={placementNote}
                onChange={(event) => setPlacementNote(event.target.value)}
                maxLength={500}
                rows={2}
                placeholder="e.g. outer forearm (optional)"
                className="mt-2 w-full border border-zinc-800 bg-zinc-900 p-3 text-white placeholder:text-zinc-600"
              />
            </label>
            <label className="mb-4 flex items-start gap-3 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={intendedUseConfirmed}
                onChange={(event) => setIntendedUseConfirmed(event.target.checked)}
                className="mt-1 accent-white"
              />
              <span>I confirm the intended use above and agree to the applicable design licence terms.</span>
            </label>
            {error && <p role="alert" className="mb-3 text-sm text-red-300">{error}</p>}
            {checkingDelivery ? <p role="status" className="mb-3 border border-zinc-700 p-3 text-sm text-zinc-400">Checking secure file availability…</p> : !deliveryReady ? <p role="status" className="mb-3 border border-zinc-700 p-3 text-sm text-zinc-400">This exact size and file format is not yet available for secure delivery. Checkout is disabled; no payment will be taken.</p> : null}
            <button
              type="button"
              disabled={busy || checkingDelivery || !deliveryReady}
              onClick={checkout}
              className="w-full bg-white py-4 text-sm font-medium uppercase tracking-widest text-black hover:bg-zinc-200 disabled:opacity-60"
            >
              {busy ? "Opening secure checkout…" : checkingDelivery ? "Checking secure files…" : !deliveryReady ? "Unavailable · secure file not uploaded" : `Continue to checkout — ${formatEuro(product.sizes[size].price)}`}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
