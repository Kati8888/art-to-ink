"use client";

import Link from "next/link";
import { useState } from "react";
import { CartSummary, useCart } from "@/components/CartProvider";

export default function CartPage() {
  const { items, subtotal, ready, removeItem, updateQuantity } = useCart();
  const [form, setForm] = useState({ name: "", email: "", phone: "", intent: "professional-client-tattoo", confirmed: false });
  const [error, setError] = useState("");
  if (!ready) return <main className="cart-shell"><p className="notice">Loading your cart…</p></main>;
  function checkout() {
    setError("");
    if (!items.length) return;
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.confirmed) {
      setError("Enter your contact details and confirm the intended use before sending your request.");
      return;
    }
    const subject = "ART TO INK order request";
    const body = [
      "Hello Kateřina,",
      "",
      "I would like to request the following items:",
      ...items.map((item) => `• ${item.title} — ${item.variant || "Licence"} — ${item.artworkFormat === "colour" ? "Colour" : item.artworkFormat === "blackAndWhite" ? "Black & White" : ""} — quantity ${item.quantity} — ${(item.price * item.quantity).toFixed(2)} EUR`),
      "",
      `Subtotal shown on website: ${subtotal.toFixed(2)} EUR`,
      `Name: ${form.name.trim()}`,
      `Email: ${form.email.trim()}`,
      `Phone: ${form.phone.trim()}`,
      `Intended use: ${form.intent}`,
      "",
      "Please confirm availability, final price and payment/delivery details before I pay.",
    ].join("\\n");
    window.location.href = `mailto:katerina.pohnetalova@seznam.cz?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return <main className="cart-shell">
    <header className="cart-header"><Link href="/" className="brand"><span className="brand-name">ART <em>TO</em> INK</span><span className="brand-subtitle">YOUR CART</span></Link><Link href="/" className="customer-back">Continue shopping ↗</Link></header>
    <section className="cart-layout" aria-labelledby="cart-heading">
      <div><span className="eyebrow">Private digital artwork</span><h1 id="cart-heading">Your cart</h1>{items.length === 0 ? <div className="empty-cart"><h2>Your cart is empty.</h2><p className="muted">Choose a published artwork or studio licence to begin.</p><Link href="/#gallery" className="button">Browse artwork</Link></div> : <div className="cart-items">{items.map((item) => <article className="cart-item" key={item.key}>{item.image ? <img src={item.image} alt="" /> : <div className="cart-item-placeholder" aria-hidden="true">LICENCE</div>}<div className="cart-item-copy"><h2>{item.title}</h2><p className="muted">{item.variant || "Annual studio licence"}{item.artworkFormat ? ` · ${item.artworkFormat === "colour" ? "Colour" : "Black & White"}` : ""}</p><div className="cart-item-actions">{item.type === "design" ? <label>Quantity <input type="number" min={1} max={20} value={item.quantity} onChange={(event) => updateQuantity(item.key, Number(event.target.value))} /></label> : <span>Quantity 1</span>}<button type="button" className="text-button" onClick={() => removeItem(item.key)}>Remove</button></div></div><strong><CartSummary amount={item.price * item.quantity} /></strong></article>)}</div>}</div>
      {items.length > 0 && <aside className="cart-checkout"><h2>Checkout</h2><div className="cart-total"><span>Subtotal</span><strong><CartSummary amount={subtotal} /></strong></div><label>Full name<input autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Email address<input type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Phone number<input type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>Intended use<select value={form.intent} onChange={(event) => setForm({ ...form, intent: event.target.value })}><option value="professional-client-tattoo">Tattooing a client</option><option value="personal-tattoo">Personal tattoo</option><option value="personal-reference">Personal reference</option></select></label><label className="checkbox-line"><input type="checkbox" checked={form.confirmed} onChange={(event) => setForm({ ...form, confirmed: event.target.checked })} /><span>I confirm the intended use and agree to the licence terms.</span></label>{error && <p className="error-text" role="alert">{error}</p>}<button className="button" type="button" disabled={busy} onClick={checkout}>Send order request by email</button><p className="muted cart-small">This sends an order request by email. No payment is taken on this website.</p></aside>}
    </section>
  </main>;
}
