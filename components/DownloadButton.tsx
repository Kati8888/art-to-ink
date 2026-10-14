"use client";

import { useState } from "react";

export function DownloadButton({ sessionId }: { sessionId: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function getDownload() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/download/issue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, email: email.trim() }) });
      const data: { url?: string; error?: string } = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error ?? "The download is not ready yet.");
      window.location.assign(data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The download is not ready yet.");
    } finally { setBusy(false); }
  }
  return <div className="purchase-form" style={{ maxWidth: 480, marginTop: 18 }}>
    <label>Email used at checkout<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
    <button className="button" type="button" onClick={getDownload} disabled={busy || !email.includes("@")}>{busy ? "Preparing secure download…" : "Download your artwork"}</button>
    {error && <p className="error-text" role="alert">{error}</p>}
  </div>;
}
