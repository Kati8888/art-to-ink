"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export function AddLicenseToCart({ licenseId }: { licenseId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const code = licenseId === "artist" ? "starter" : licenseId === "studio" ? "professional" : "studio";

  async function add() {
    setBusy(true); setMessage("");
    try {
      const session = (await getSupabaseBrowser().auth.getSession()).data.session;
      if (!session?.access_token) { window.location.assign("/account"); return; }
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ type: "license", licenseCode: code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "This licence could not be added.");
      window.location.assign("/cart");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "This licence could not be added.");
      setBusy(false);
    }
  }

  return <div style={{ marginTop: 10 }}>
    <button type="button" onClick={() => void add()} disabled={busy} className="button secondary">{busy ? "Adding…" : "Save licence to cart"}</button>
    {message && <p role="alert" style={{ color: "#e8b4a9", fontSize: 12, marginTop: 8 }}>{message}</p>}
  </div>;
}
