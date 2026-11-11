"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { tattooDesigns } from "@/lib/mock-data";
import { DESIGN_SIZE_ORDER, formatEuro, type DesignSize } from "@/lib/products";

type GuestItem = { productSlug: string; variantKey: DesignSize; format: "colour" | "blackAndWhite"; quantity: number };
const CART_KEY = "art-to-ink-guest-cart";

export default function CartPage() {
  const [items, setItems] = useState<GuestItem[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try { setItems(JSON.parse(window.localStorage.getItem(CART_KEY) ?? "[]") as GuestItem[]); }
    catch { setItems([]); setMessage("Your browser cart could not be read. Please return to the gallery and add the design again."); }
  }, []);

  function save(next: GuestItem[]) {
    setItems(next);
    window.localStorage.setItem(CART_KEY, JSON.stringify(next));
  }

  function remove(index: number) { save(items.filter((_, i) => i !== index)); }
  function changeQuantity(index: number, quantity: number) {
    save(items.map((item, i) => i === index ? { ...item, quantity: Math.max(1, Math.min(20, quantity)) } : item));
  }

  const total = useMemo(() => items.reduce((sum, item) => {
    const design = tattooDesigns.find((entry) => entry.slug === item.productSlug);
    return sum + (design ? design.sizes[item.variantKey].price * item.quantity : 0);
  }, 0), [items]);

  async function checkout() {
    setMessage("Secure guest checkout is not activated yet. We are completing and testing the Stripe order and delivery connection before accepting payments.");
  }

  return <main style={{ minHeight: "100vh", background: "#090908", color: "#f7f3eb", padding: "48px 20px" }}>
    <div style={{ maxWidth: 850, margin: "0 auto" }}>
      <Link href="/" style={{ color: "#d5a957", letterSpacing: 3, fontSize: 12 }}>ART TO INK</Link>
      <h1 style={{ fontFamily: "Georgia,serif", fontWeight: 400, fontSize: 44, margin: "22px 0 8px" }}>Your cart</h1>
      <p style={{ color: "#aaa39a" }}>Review your selected artwork. No account is required.</p>
      {message && <p role="status" style={{ marginTop: 18, border: "1px solid #8b6838", padding: 12, color: "#f2d49c" }}>{message}</p>}
      {items.length === 0 ? <section style={{ marginTop: 30, border: "1px solid #51432d", padding: 20 }}>
        <p>Your cart is empty.</p><Link href="/gallery" style={{ display: "inline-block", marginTop: 14, color: "#d5a957" }}>Continue browsing artwork →</Link>
      </section> : <>
        <div style={{ display: "grid", gap: 12, marginTop: 28 }}>
          {items.map((item, index) => {
            const design = tattooDesigns.find((entry) => entry.slug === item.productSlug);
            if (!design || !DESIGN_SIZE_ORDER.includes(item.variantKey)) return null;
            const price = design.sizes[item.variantKey].price;
            return <article key={item.productSlug + item.variantKey + item.format} style={{ border: "1px solid #51432d", padding: 18, display: "flex", gap: 16, justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <img src={item.format === "colour" ? design.media.colour : design.media.blackAndWhite} alt="" style={{ width: 76, height: 76, objectFit: "cover" }} />
                <div><strong>{design.title}</strong><p style={{ color: "#aaa39a", fontSize: 13, marginTop: 6 }}>{design.sizes[item.variantKey].label} · {item.format === "colour" ? "Colour" : "Black & White"}</p></div>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong>{formatEuro(price * item.quantity)}</strong>
                <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", marginTop: 8 }}>
                  <label style={{ fontSize: 12, color: "#aaa39a" }}>Qty <input aria-label={"Quantity for " + design.title} type="number" min={1} max={20} value={item.quantity} onChange={(e) => changeQuantity(index, Number(e.target.value))} style={{ width: 54, padding: 4, color: "#fff", background: "#171512", border: "1px solid #51432d" }} /></label>
                  <button onClick={() => remove(index)} style={{ color: "#d5a957", textDecoration: "underline", fontSize: 13 }}>Remove</button>
                </div>
              </div>
            </article>;
          })}
        </div>
        <section style={{ marginTop: 30, border: "1px solid #51432d", padding: 20 }}>
          <h2 style={{ fontFamily: "Georgia,serif", fontSize: 26, fontWeight: 400 }}>Checkout details</h2>
          <p style={{ color: "#aaa39a", fontSize: 13, margin: "8px 0 18px" }}>The checkout form is being prepared. No payment is accepted until the private artwork files and automatic delivery are verified.</p>
          <div style={{ display: "grid", gap: 12 }}>
            <label>Full name<input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required style={{ display: "block", width: "100%", padding: 12, marginTop: 6, background: "#171512", color: "#fff", border: "1px solid #51432d" }} /></label>
            <label>Email address<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} required style={{ display: "block", width: "100%", padding: 12, marginTop: 6, background: "#171512", color: "#fff", border: "1px solid #51432d" }} /></label>
            <label>Phone number<input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} required style={{ display: "block", width: "100%", padding: 12, marginTop: 6, background: "#171512", color: "#fff", border: "1px solid #51432d" }} /></label>
          </div>
        </section>
        <div style={{ borderTop: "1px solid #51432d", marginTop: 24, paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>Total: {formatEuro(total)}</strong>
          <button disabled={true} onClick={() => void checkout()} style={{ padding: "14px 22px", background: "#d5a957", color: "#090908", fontWeight: 700 }}>Secure checkout is being prepared</button>
        </div>
      </>}
      <p style={{ marginTop: 32 }}><Link href="/gallery" style={{ color: "#d5a957" }}>← Continue browsing artwork</Link></p>
    </div>
  </main>;
}
