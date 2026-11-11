"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Summary = { email?: string; orders?: Array<Record<string, unknown>>; licences?: Array<Record<string, unknown>> };

export default function AccountPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [designSlug, setDesignSlug] = useState("");
  const [licenseId, setLicenseId] = useState("");
  const [variantKey, setVariantKey] = useState("detailed");
  const [format, setFormat] = useState("colour");
  const [activationBusy, setActivationBusy] = useState(false);
  const [activationMessage, setActivationMessage] = useState("");
  const [entitlementId, setEntitlementId] = useState("");

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

  async function activateDesign(event: React.FormEvent) {
    event.preventDefault(); setActivationBusy(true); setActivationMessage(""); setEntitlementId("");
    try {
      const session = (await getSupabaseBrowser().auth.getSession()).data.session;
      if (!session?.access_token) throw new Error("Please sign in again.");
      const response = await fetch("/api/licenses/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ licenseId, designSlug: designSlug.trim().toLowerCase(), variantKey, format, idempotencyKey: crypto.randomUUID() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not activate this design.");
      setEntitlementId(String(result.entitlement_id ?? result.entitlementId ?? ""));
      setActivationMessage("One licence credit has been activated for this design.");
      await loadAccount();
    } catch (error) {
      setActivationMessage(error instanceof Error ? error.message : "Activation failed.");
    } finally { setActivationBusy(false); }
  }

  async function renewOrderDownload(order: Record<string, unknown>) {
    try {
      const session = (await getSupabaseBrowser().auth.getSession()).data.session;
      if (!session?.access_token) throw new Error("Please sign in again.");
      const response = await fetch("/api/download/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ sessionId: order.stripe_checkout_session_id }),
      });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error ?? "Could not issue a new download link.");
      window.location.assign(result.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not issue a new download link.");
    }
  }

  async function downloadLicensedDesign() {
    try {
      const session = (await getSupabaseBrowser().auth.getSession()).data.session;
      if (!session?.access_token || !entitlementId) throw new Error("Please sign in and activate a design first.");
      const response = await fetch(`/api/licenses/download?entitlementId=${encodeURIComponent(entitlementId)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error ?? "Download failed."); }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = objectUrl; link.download = "art-to-ink-licensed-artwork"; link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setActivationMessage(error instanceof Error ? error.message : "Download failed.");
    }
  }

  async function signOut() {
    await getSupabaseBrowser().auth.signOut();
    setSummary(null); setMessage("You have signed out.");
  }

  return <main style={{ minHeight: "100vh", background: "#090908", color: "#f7f3eb", padding: "48px 20px" }}>
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <Link href="/" style={{ color: "#d5a957", letterSpacing: 3, fontSize: 12 }}>ART TO INK</Link>
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
          {order.purchase_type === "design" && order.fulfillment_status === "fulfilled" && <button onClick={() => void renewOrderDownload(order)} style={{ marginTop: 10, padding: 10, border: "1px solid #d5a957" }}>Get a fresh secure download link</button>}
        </article>)}</div> : <p style={{ color: "#aaa39a" }}>No purchases are linked yet.</p>}
        <h2 style={{ fontSize: 24, marginTop: 32 }}>Studio licences</h2>
        {(summary.licences ?? []).length ? <div style={{ display: "grid", gap: 12, marginTop: 12 }}>{summary.licences!.map((licence, i) => <article key={String(licence.id ?? i)} style={{ border: "1px solid #39342b", padding: 16 }}>
          <strong>{String((licence.license_packages as {title?:string}|null)?.title ?? "Studio licence")}</strong>
          <p style={{ color: "#aaa39a", fontSize: 13 }}>Valid until {String(licence.expires_at ?? "")} · {String(licence.status ?? "")}</p>
          <p>{String(licence.used_credits ?? 0)} / {String(licence.purchased_credits ?? "Limit not configured")} credits used</p>
        </article>)}</div> : <p style={{ color: "#aaa39a" }}>No licences linked yet.</p>}
        {(summary.licences ?? []).length > 0 && <section style={{ marginTop: 32, border: "1px solid #51432d", padding: 18 }}>
          <h2 style={{ fontSize: 24 }}>Activate a design with your licence</h2>
          <p style={{ color: "#aaa39a", fontSize: 13, margin: "8px 0 16px" }}>Activating a design consumes one credit. A credit covers one design for one tattoo client. Previewing artwork does not consume a credit.</p>
          <form onSubmit={activateDesign} style={{ display: "grid", gap: 12, maxWidth: 520 }}>
            <label>Licence<select required value={licenseId} onChange={e => setLicenseId(e.target.value)} style={{ display: "block", width: "100%", padding: 12, marginTop: 6, background: "#171512", color: "#fff", border: "1px solid #39342b" }}>
              <option value="">Choose an active licence</option>
              {(summary.licences ?? []).filter(l => l.status === "active" && l.purchased_credits !== null && Date.parse(String(l.expires_at)) > Date.now()).map(l => <option key={String(l.id)} value={String(l.id)}>{String((l.license_packages as {title?:string}|null)?.title ?? "Studio licence")} · {String(l.used_credits ?? 0)}/{String(l.purchased_credits ?? "not configured")}</option>)}
            </select></label>
            <label>Design<select required value={designSlug} onChange={e => setDesignSlug(e.target.value)} style={{ display: "block", width: "100%", padding: 12, marginTop: 6, background: "#171512", color: "#fff", border: "1px solid #39342b" }}><option value="">Choose a design</option>{[["brain-heart","Brain Heart"],["mrs-beer","MRS Beer"],["sea-dragons","Assimilation"],["lion-heart","Lion Heart"],["babicka-dedo","Grandparents"],["faces-within","Faces Within"],["goodbye-london","Goodbye London"],["war-inside","War Inside"]].map(([slug,title]) => <option key={slug} value={slug}>{title}</option>)}</select></label>
            <label>File size<select value={variantKey} onChange={e => setVariantKey(e.target.value)} style={{ display: "block", width: "100%", padding: 12, marginTop: 6, background: "#171512", color: "#fff", border: "1px solid #39342b" }}>{["mini","small","detailed","premium","collection"].map(v => <option key={v} value={v}>{v}</option>)}</select></label>
            <label>File format<select value={format} onChange={e => setFormat(e.target.value)} style={{ display: "block", width: "100%", padding: 12, marginTop: 6, background: "#171512", color: "#fff", border: "1px solid #39342b" }}><option value="colour">Colour</option><option value="blackAndWhite">Black &amp; white</option></select></label>
            <button disabled={activationBusy || !licenseId} style={{ padding: 13, background: "#d5a957", color: "#090908", fontWeight: 700 }}>{activationBusy ? "Activating…" : "Activate one credit"}</button>
          </form>
          {activationMessage && <p role="status" style={{ marginTop: 12, color: "#d5a957" }}>{activationMessage}</p>}
          {entitlementId && <button onClick={() => void downloadLicensedDesign()} style={{ marginTop: 12, padding: 12, border: "1px solid #d5a957" }}>Download activated design</button>}
        </section>}
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
      <p style={{ marginTop: 36 }}><Link href="/" style={{ color: "#d5a957" }}>Back to ART TO INK</Link></p>
    </div>
  </main>;
}
