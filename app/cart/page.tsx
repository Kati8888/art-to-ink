"use client";

import Link from "next/link";
import { useState } from "react";
import { CartSummary, useCart } from "@/components/CartProvider";

export default function CartPage() {
  const { items, subtotal, ready, removeItem, updateQuantity } = useCart();
  const [form, setForm] = useState({ name: "", email: "", phone: "", intent: "professional-client-tattoo", confirmed: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!ready) return <main className="cart-shell"><p className="notice">Loading your cart…</p></main>;
  async function checkout() {
    setError("");
    if (!items.length) return;
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.confirmed) { setError("Enter your contact details and confirm the intended use before checkout."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        items: items.map((item) => ({ type: item.type, productId: item.productId, productSlug: item.productSlug, licenseId: item.licenseId, variantId: item.variant, artworkFormat: item.artworkFormat, quantity: item.quantity })),
        customerName: form.name.trim(), customerEmail: form.email.trim(), customerPhone: form.phone.trim(), customerIntent: form.intent, intendedUseConfirmed: true,
      }) });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? "Checkout could not be started.");
      window.location.assign(data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout could not be started.");
      setBusy(false);
    }
  }
  return <main className="cart-shell">
    <header className="cart-header"><Link href="/" className="brand"><span className="brand-name">ART <em>TO</em> INK</span><span className="brand-subtitle">YOUR CART</span></Link><Link href="/" className="customer-back">Continue shopping ↗</Link></header>
    <section className="cart-layout" aria-labelledby="cart-heading">
      <div><span className="eyebrow">Private digital artwork</span><h1 id="cart-heading">Your cart</h1>{items.length === 0 ? <div className="empty-cart"><h2>Your cart is empty.</h2><p className="muted">Choose a published artwork or studio licence to begin.</p><Link href="/#gallery" className="button">Browse artwork</Link></div> : <div className="cart-items">{items.map((item) => <article className="cart-item" key={item.key}>{item.image ? <img src={item.image} alt="" /> : <div className="cart-item-placeholder" aria-hidden="true">LICENCE</div>}<div className="cart-item-copy"><h2>{item.title}</h2><p className="muted">{item.variant || "Annual studio licence"}{item.artworkFormat ? ` · ${item.artworkFormat === "colour" ? "Colour" : "Black & White"}` : ""}</p><div className="cart-item-actions">{item.type === "design" ? <label>Quantity <input type="number" min={1} max={20} value={item.quantity} onChange={(event) => updateQuantity(item.key, Number(event.target.value))} /></label> : <span>Quantity 1</span>}<button type="button" className="text-button" onClick={() => removeItem(item.key)}>Remove</button></div></div><strong><CartSummary amount={item.price * item.quantity} /></strong></article>)}</div>}</div>
      {items.length > 0 && <aside className="cart-checkout"><h2>Checkout</h2><div className="cart-total"><span>Subtotal</span><strong><CartSummary amount={subtotal} /></strong></div><label>Full name<input autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Email address<input type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Phone number<input type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>Intended use<select value={form.intent} onChange={(event) => setForm({ ...form, intent: event.target.value })}><option value="professional-client-tattoo">Tattooing a client</option><option value="personal-tattoo">Personal tattoo</option><option value="personal-reference">Personal reference</option></select></label><label className="checkbox-line"><input type="checkbox" checked={form.confirmed} onChange={(event) => setForm({ ...form, confirmed: event.target.checked })} /><span>I confirm the intended use and agree to the licence terms.</span></label>{error && <p className="error-text" role="alert">{error}</p>}<button className="button" type="button" disabled={busy} onClick={checkout}>{busy ? "Opening secure checkout…" : "Continue to secure checkout"}</button><p className="muted cart-small">Prices and availability are rechecked on the server before Stripe opens.</p></aside>}
    </section>
  </main>;
}
