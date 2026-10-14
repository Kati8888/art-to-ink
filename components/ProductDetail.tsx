"use client";

import { useState } from "react";
import type { TattooDesign } from "@/data/products";

type View = "colour" | "bw" | "skin";
type CheckoutSize = "mini" | "small" | "detailed" | "premium";

const viewLabels: Record<View, string> = {
  colour: "Colour",
  bw: "Black & White",
  skin: "On Skin",
};

const sizeMap: Record<string, CheckoutSize | null> = {
  var_mini: "mini",
  var_small: "small",
  var_detailed: "detailed",
  var_premium: "premium",
  var_collection: null,
};

function euro(amount: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ProductDetail({ product }: { product: TattooDesign }) {
  const [activeTab, setActiveTab] = useState<View>("colour");
  const [selectedVariantId, setSelectedVariantId] = useState(
    product.variants.find((variant) => variant.id === "var_detailed")?.id ??
      product.variants[0]?.id ??
      "",
  );
  const [intendedUseConfirmed, setIntendedUseConfirmed] = useState(false);
  const [intendedUse, setIntendedUse] = useState(
    "professional-client-tattoo",
  );
  const [placementNote, setPlacementNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedVariant = product.variants.find(
    (variant) => variant.id === selectedVariantId,
  );
  const currentImage =
    activeTab === "bw"
      ? product.media.blackAndWhite
      : activeTab === "skin"
        ? product.media.onSkin
        : product.media.colour;
  const checkoutSize = selectedVariant
    ? sizeMap[selectedVariant.id]
    : undefined;

  async function checkout() {
    setError("");
    if (!selectedVariant || !checkoutSize) {
      setError(
        "This bundle is not available for secure checkout yet. Please choose another file option.",
      );
      return;
    }
    if (!intendedUseConfirmed) {
      setError("Please confirm the intended use before checkout.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "design",
          productSlug: product.slug,
          size: checkoutSize,
          intendedUseConfirmed: true,
          intendedUse,
          placementNote: placementNote.trim().slice(0, 500),
        }),
      });
      const data: { url?: string; error?: string } = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Secure checkout could not be started.");
      }
      window.location.assign(data.url);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Secure checkout could not be started.",
      );
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl bg-black px-4 py-12 font-sans text-white sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-4" aria-label="Artwork preview">
          <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
            <img
              src={currentImage}
              alt={`${product.title} — ${viewLabels[activeTab]}`}
              className="max-h-full max-w-full object-contain transition-opacity duration-300"
            />
          </div>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Artwork view">
            {(Object.keys(viewLabels) as View[]).map((view) => (
              <button
                key={view}
                type="button"
                aria-pressed={activeTab === view}
                onClick={() => setActiveTab(view)}
                className={`border py-3 text-xs uppercase tracking-widest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  activeTab === view
                    ? "border-white bg-white text-black"
                    : "border-zinc-800 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {viewLabels[view]}
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col justify-between gap-8">
          <div>
            <span className="text-xs uppercase tracking-widest text-zinc-500">
              {product.category}
            </span>
            <h1 className="mb-4 mt-2 text-4xl font-light tracking-wide">
              {product.title}
            </h1>
            <p className="mb-8 leading-relaxed text-zinc-400">
              {product.description}
            </p>
            <h2 className="mb-4 text-xs uppercase tracking-widest text-zinc-400">
              Select artwork size &amp; files
            </h2>

            <fieldset className="space-y-3">
              <legend className="sr-only">Artwork file option</legend>
              {product.variants.map((variant) => {
                const selected = selectedVariantId === variant.id;
                const supported = sizeMap[variant.id] !== null && sizeMap[variant.id] !== undefined;
                return (
                  <label
                    key={variant.id}
                    className={`flex cursor-pointer items-start justify-between gap-4 border p-4 transition-colors ${
                      selected
                        ? "border-white bg-zinc-950"
                        : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                    }`}
                  >
                    <span className="flex min-w-0 items-start gap-3">
                      <input
                        type="radio"
                        name={`variant-${product.id}`}
                        value={variant.id}
                        checked={selected}
                        onChange={() => setSelectedVariantId(variant.id)}
                        className="mt-1 accent-white"
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-sm font-medium">{variant.name}</span>
                        <span className="mt-1 text-xs leading-relaxed text-zinc-500">
                          {variant.description}
                        </span>
                        {!supported && (
                          <span className="mt-1 text-xs text-amber-300">
                            Secure bundle delivery is not configured yet
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold">
                      {euro(variant.price)}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          </div>

          <div className="border-t border-zinc-800 pt-6">
            <div className="mb-4 space-y-1 text-xs text-zinc-500">
              <p>✓ Secure Stripe Checkout</p>
              <p>✓ Private digital delivery after verified payment</p>
            </div>

            <label className="mb-4 flex items-start gap-3 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={intendedUseConfirmed}
                onChange={(event) => setIntendedUseConfirmed(event.target.checked)}
                className="mt-1 accent-white"
              />
              <span>
                I confirm my intended use and agree to the applicable design licence terms.
              </span>
            </label>
            <label className="mb-4 block text-sm text-zinc-300">
              Intended use
              <select
                value={intendedUse}
                onChange={(event) => setIntendedUse(event.target.value)}
                className="mt-2 w-full border border-zinc-800 bg-zinc-900 p-3 text-white"
              >
                <option value="professional-client-tattoo">Tattooing a client</option>
                <option value="personal-reference">Personal reference</option>
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
                className="mt-2 w-full resize-y border border-zinc-800 bg-zinc-900 p-3 text-white placeholder:text-zinc-600"
              />
            </label>

            {error && (
              <p role="alert" className="mb-3 text-sm text-red-300">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={busy || !selectedVariant}
              onClick={checkout}
              className="w-full bg-white py-4 text-sm font-medium uppercase tracking-widest text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy
                ? "Opening secure checkout…"
                : `Continue to checkout — ${euro(selectedVariant?.price ?? 0)}`}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
