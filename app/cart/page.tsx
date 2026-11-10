"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type CartItem = {
  id: string;
  quantity: number;
  commerce_products?: { slug: string; title: string } | null;
  commerce_variants?: { variant_key: string; label: string; price_cents: number; currency: string } | null;
  license_packages?: { code: string; title: string; price_cents: number; currency: string; credit_limit: number | null } | null;
};

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [intendedUse, setIntendedUse] = useState("personal-tattoo");
  const [intendedUseConfirmed, setIntendedUseConfirmed] = useState(false);

  const load = useCallback(async () => {
    const session = (await getSupabaseBrowser().auth.getSession()).data.session;
    if (!session?.access_token) { setSignedIn(false); setItems([]); return; }
    setSignedIn(true);
    const response = await fetch("/api/cart", { headers: { Authorization: "Bearer " + session.access_token }, cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not load cart.");
    setItems(data.items ?? []);
  }, []);

  useEffect(() => { load().catch(e => setMessage(e instanceof Error ? e.message : "Could not load cart.")); }, [load]);

  async function remove(itemId: string) {
    setBusy(true); setMessage("");
    try {
      const session = (await getSupabaseBrowser().auth.getSession()).data.session;
      if (!session?.access_token) throw new Error("Please sign in again.");
      const response = await fetch("/api/cart", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ itemId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not remove item.");
      await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not remove item."); }
    finally { setBusy(false); }
  }

  async function checkout() {
    setBusy(true); setMessage("");
    try {
      const session = (await getSupabaseBrowser().auth.getSession()).data.session;
      if (!session?.access_token) throw new Error("Please sign in again.");
      const response = await fetch("/api/cart/checkout", { method: "POST", headers: { Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ intendedUse, intendedUseConfirmed }) });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error ?? "Checkout could not be started.");
      window.location.assign(data.url);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Checkout could not be started."); setBusy(false); }
  }

  const total = items.reduce((sum,item) => sum + Number(item.commerce_variants?.price_cents ?? item.license_packages?.price_cents ?? 0), 0);

  return <main style={{ minHeight: "100vh", background: "#090908", color: "#f7f3eb", padding: "48px 20px" }}>
    <div style={{ maxWidth: 850, margin: "0 auto" }}>
      <a href="/" style={{ color: "#d5a957", letterSpacing: 3, fontSize: 12 }}>ART TO INK</a>
      <h1 style={{ fontFamily: "Georgia,serif", fontWeight: 400, fontSize: 44, margin: "22px 0 8px" }}>Your saved cart</h1>
      <p style={{ color: "#aaa39a" }}>Your cart is saved to your customer account.</p>
      {message && <p role="alert" style={{ marginTop: 18, border: "1px solid #8b3838", padding: 12, color: "#ffbcbc" }}>{message}</p>}
      {!signedIn ? <section style={{ marginTop: 30, border: "1px solid #51432d", padding: 20 }}>
        <p>Sign in to see and manage your saved cart.</p><a href="/account" style={{ display: "inline-block", marginTop: 14, padding: 12, background: "#d5a957", color: "#090908" }}>Sign in / Create account</a>
      </section> : items.length === 0 ? <p style={{ marginTop: 30, color: "#aaa39a" }}>Your cart is empty. Browse the collection to add artwork or a studio licence.</p> : <>
        <div style={{ display: "grid", gap: 12, marginTop: 28 }}>
          {items.map(item => {
            const title = item.commerce_products?.title ?? item.license_packages?.title ?? "ART TO INK item";
            const detail = item.commerce_variants?.label ?? (item.license_packages ? "Annual studio licence" : "");
            const price = Number(item.commerce_variants?.price_cents ?? item.license_packages?.price_cents ?? 0) / 100;
            return <article key={item.id} style={{ border: "1px solid #51432d", padding: 18, display: "flex", gap: 16, justifyContent: "space-between", alignItems: "center" }}>
              <div><strong>{title}</strong><p style={{ color: "#aaa39a", fontSize: 13, marginTop: 6 }}>{detail}</p></div>
              <div style={{ textAlign: "right" }}><strong>€{price.toFixed(2)}</strong><button disabled={busy} onClick={() => void remove(item.id)} style={{ display: "block", marginTop: 8, color: "#d5a957", textDecoration: "underline", fontSize: 13 }}>Remove</button></div>
            </article>;
          })}
        </div>
        {items.length === 1 && items[0].commerce_products && <section style={{ marginTop: 20, border: "1px solid #51432d", padding: 16 }}>
          <label style={{ display: "block", fontSize: 13 }}>Intended use
            <select value={intendedUse} onChange={e => setIntendedUse(e.target.value)} style={{ display: "block", width: "100%", padding: 10, marginTop: 8, background: "#171512", color: "#fff", border: "1px solid #39342b" }}>
              <option value="personal-tattoo">Personal tattoo</option>
              <option value="professional-client-tattoo">Tattooing a client</option>
              <option value="personal-reference">Personal reference only</option>
            </select>
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 12, fontSize: 13, color: "#aaa39a" }}>
            <input type="checkbox" checked={intendedUseConfirmed} onChange={e => setIntendedUseConfirmed(e.target.checked)} />
            I confirm the intended use and agree to the applicable artwork licence terms.
          </label>
        </section>}
        <div style={{ borderTop: "1px solid #51432d", marginTop: 24, paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>Total saved: €{(total / 100).toFixed(2)}</strong>
          <button disabled={busy || (items.length === 1 && Boolean(items[0]?.commerce_products) && !intendedUseConfirmed)} onClick={() => void checkout()} style={{ padding: "14px 22px", background: "#d5a957", color: "#090908", fontWeight: 700 }}>{busy ? "Opening checkout…" : "Secure checkout"}</button>
        </div>
        {items.length > 1 && <p style={{ color: "#aaa39a", fontSize: 12, marginTop: 12 }}>The current secure checkout processes one item at a time. Other saved items remain in your cart.</p>}
      </>}
      <p style={{ marginTop: 32 }}><a href="/" style={{ color: "#d5a957" }}>Continue browsing artwork</a></p>
    </div>
  </main>;
}
