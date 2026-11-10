"use client";

import { useCallback, useEffect, useState } from "react";

type Dashboard = {
  orders?: Array<Record<string, unknown>>;
  licences?: Array<Record<string, unknown>>;
  customers?: Array<Record<string, unknown>>;
  stats?: { orders: number; revenueCents: number };
};

export default function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/commerce", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) { if (response.status === 401) setLoggedIn(false); throw new Error(result.error ?? "Could not load dashboard."); }
      setData(result); setLoggedIn(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load dashboard."); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Login failed.");
      setPassword(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Login failed."); }
    finally { setBusy(false); }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setLoggedIn(false); setData(null);
  }

  return <main style={{ minHeight: "100vh", background: "#090908", color: "#f7f3eb", padding: "36px 20px" }}>
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <a href="/" style={{ color: "#d5a957", letterSpacing: 3, fontSize: 12 }}>ART TO INK</a>
      <h1 style={{ fontFamily: "Georgia,serif", fontWeight: 400, fontSize: 42, margin: "20px 0 8px" }}>Commerce dashboard</h1>
      <p style={{ color: "#aaa39a" }}>Private overview of paid orders, customers and annual studio licences.</p>
      {error && <p role="alert" style={{ border: "1px solid #a33", color: "#ffbaba", padding: 12 }}>{error}</p>}
      {!loggedIn ? <form onSubmit={login} style={{ maxWidth: 420, marginTop: 30, display: "grid", gap: 12 }}>
        <label>Administrator password<input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} style={{ display: "block", width: "100%", padding: 12, marginTop: 6, background: "#171512", color: "#fff", border: "1px solid #5d4930" }}/></label>
        <button disabled={busy} style={{ padding: 14, background: "#d5a957", color: "#090908" }}>{busy ? "Signing in…" : "Sign in"}</button>
      </form> : <>
        <div style={{ display: "flex", gap: 12, margin: "24px 0", flexWrap: "wrap" }}>
          <div style={{ border: "1px solid #51432d", padding: 18, minWidth: 180 }}><small>Orders</small><h2 style={{ fontSize: 30 }}>{data?.stats?.orders ?? 0}</h2></div>
          <div style={{ border: "1px solid #51432d", padding: 18, minWidth: 180 }}><small>Recorded revenue*</small><h2 style={{ fontSize: 30 }}>€{((data?.stats?.revenueCents ?? 0) / 100).toFixed(2)}</h2></div>
          <div style={{ border: "1px solid #51432d", padding: 18, minWidth: 180 }}><small>Customer accounts</small><h2 style={{ fontSize: 30 }}>{data?.customers?.length ?? 0}</h2></div>
          <div style={{ border: "1px solid #51432d", padding: 18, minWidth: 180 }}><small>Licences</small><h2 style={{ fontSize: 30 }}>{data?.licences?.length ?? 0}</h2></div>
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <button onClick={() => void load()} disabled={busy} style={{ border: "1px solid #5d4930", padding: 10 }}>Refresh</button>
          <button onClick={() => void logout()} style={{ border: "1px solid #5d4930", padding: 10 }}>Sign out</button>
          <a href="/admin/comments" style={{ border: "1px solid #5d4930", padding: 10 }}>Moderate comments</a>
        </div>
        <h2 style={{ fontSize: 26, marginBottom: 12 }}>Orders</h2>
        <div style={{ overflowX: "auto", border: "1px solid #39342b" }}>
          <table style={{ width: "100%", minWidth: 850, borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["Date","Customer","Item","Type","Amount","Status"].map(x => <th key={x} style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #5d4930" }}>{x}</th>)}</tr></thead>
            <tbody>{(data?.orders ?? []).map((o,i) => <tr key={String(o.id ?? i)}>{[String(o.created_at ?? ""),String(o.customer_name ?? o.customer_email ?? ""),String(o.product_slug ?? o.license_id ?? "—"),String(o.purchase_type ?? ""),typeof o.amount_total === "number" ? `€${(o.amount_total/100).toFixed(2)}` : "—",String(o.fulfillment_status ?? "")].map((v,j)=><td key={j} style={{ padding: 12, borderBottom: "1px solid #27231d" }}>{v}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <h2 style={{ fontSize: 26, margin: "32px 0 12px" }}>Studio licences</h2>
        <div style={{ display: "grid", gap: 10 }}>{(data?.licences ?? []).map((l,i)=><article key={String(l.id ?? i)} style={{ border: "1px solid #39342b", padding: 16 }}>
          <strong>{String((l.license_packages as {title?:string}|null)?.title ?? "Licence")}</strong>
          <p style={{ color: "#aaa39a", fontSize: 13 }}>{String(l.customer_email ?? "")} · {String(l.status ?? "")} · Expires {String(l.expires_at ?? "")}</p>
          <p>{String(l.used_credits ?? 0)} / {String(l.purchased_credits ?? "Unlimited")} credits used</p>
        </article>)}</div>
        <p style={{ color: "#766c60", fontSize: 12, marginTop: 24 }}>*Recorded paid order totals, not net revenue after Stripe fees, refunds or tax adjustments.</p>
      </>}
    </div>
  </main>;
}
