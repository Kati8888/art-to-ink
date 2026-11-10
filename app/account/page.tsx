"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Summary = { email?: string; orders?: Array<Record<string, unknown>>; licences?: Array<Record<string, unknown>> };

export default function AccountPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadAccount() {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setSummary(null); return; }
    const claim = await fetch("/api/account/claim", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const claimData = await claim.json();
    if (!claim.ok && claim.status !== 403) throw new Error(claimData.error ?? "Could not link purchases.");
    const response = await fetch("/api/account/summary", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not load account.");
    setSummary(result);
    setMessage(claim.status === 403 ? "Verify your email using the link we sent you. Then sign in again to link previous purchases." : "Your purchases are linked to this account.");
  }

  useEffect(() => {
    loadAccount().catch(() => undefined);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const supabase = getSupabaseBrowser();
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/account` } });
        if (error) throw error;
        setMessage("Check your email and confirm your account. Then return here and sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        await loadAccount();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally { setBusy(false); }
  }

  async function signOut() {
    await getSupabaseBrowser().auth.signOut();
    setSummary(null); setMessage("You have signed out.");
  }

  return <main style={{ minHeight: "100vh", background: "#090908", color: "#f7f3eb", padding: "48px 20px" }}>
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <a href="/" style={{ color: "#d5a957", letterSpacing: 3, fontSize: 12 }}>ART TO INK</a>
      <h1 style={{ fontFamily: "Georgia,serif", fontWeight: 400, fontSize: 42, margin: "24px 0 8px" }}>Your account</h1>
      <p style={{ color: "#aaa39a" }}>Sign in to see your orders, downloads and annual studio licences.</p>
      {summary ? <section style={{ marginTop: 32 }}>
        <p>Signed in as <strong>{summary.email}</strong></p>
        <button onClick={signOut} style={{ border: "1px solid #75613b", padding: "10px 16px", margin: "16px 0" }}>Sign out</button>
        <h2 style={{ fontSize: 24, marginTop: 28 }}>Orders</h2>
        {(summary.orders ?? []).length ? <div style={{ display: "grid", gap: 12, marginTop: 12 }}>{summary.orders!.map((order, i) => <article key={String(order.id ?? i)} style={{ border: "1px solid #39342b", padding: 16 }}>
          <strong>{String(order.product_slug ?? order.purchase_type ?? "Order")}</strong>
          <p style={{ color: "#aaa39a", fontSize: 13 }}>{String(order.created_at ?? "")} · {String(order.fulfillment_status ?? "")}</p>
          <p>{typeof order.amount_total === "number" ? `€${(order.amount_total / 100).toFixed(2)}` : ""} {String(order.currency ?? "").toUpperCase()}</p>
        </article>)}</div> : <p style={{ color: "#aaa39a" }}>No purchases are linked yet.</p>}
        <h2 style={{ fontSize: 24, marginTop: 32 }}>Studio licences</h2>
        {(summary.licences ?? []).length ? <div style={{ display: "grid", gap: 12, marginTop: 12 }}>{summary.licences!.map((licence, i) => <article key={String(licence.id ?? i)} style={{ border: "1px solid #39342b", padding: 16 }}>
          <strong>{String((licence.license_packages as {title?:string}|null)?.title ?? "Studio licence")}</strong>
          <p style={{ color: "#aaa39a", fontSize: 13 }}>Valid until {String(licence.expires_at ?? "")} · {String(licence.status ?? "")}</p>
          <p>{String(licence.used_credits ?? 0)} / {String(licence.purchased_credits ?? "Unlimited")} credits used</p>
        </article>)}</div> : <p style={{ color: "#aaa39a" }}>No licences linked yet.</p>}
      </section> : <form onSubmit={submit} style={{ marginTop: 32, maxWidth: 440, display: "grid", gap: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => setMode("signin")} aria-pressed={mode === "signin"} style={{ border: "1px solid #75613b", padding: 10 }}>Sign in</button>
          <button type="button" onClick={() => setMode("signup")} aria-pressed={mode === "signup"} style={{ border: "1px solid #75613b", padding: 10 }}>Create account</button>
        </div>
        <label>Email address<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={{ display: "block", width: "100%", padding: 12, background: "#171512", border: "1px solid #39342b", marginTop: 6 }}/></label>
        <label>Password<input type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} style={{ display: "block", width: "100%", padding: 12, background: "#171512", border: "1px solid #39342b", marginTop: 6 }}/></label>
        <button disabled={busy} type="submit" style={{ padding: 14, background: "#d5a957", color: "#090908", fontWeight: 700 }}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</button>
      </form>}
      {message && <p role="status" style={{ marginTop: 20, color: "#d5a957" }}>{message}</p>}
      <p style={{ marginTop: 36 }}><a href="/" style={{ color: "#d5a957" }}>Back to ART TO INK</a></p>
    </div>
  </main>;
}
