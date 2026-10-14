"use client";

import { useState } from "react";

export function DownloadButton({ sessionId }: { sessionId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function getDownload() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/download/issue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) });
      const data: { url?: string; error?: string } = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error ?? "The download is not ready yet.");
      window.location.assign(data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The download is not ready yet.");
    } finally { setBusy(false); }
  }
  return <div><button className="button" type="button" onClick={getDownload} disabled={busy}>{busy ? "Preparing secure download…" : "Download your artwork"}</button>{error && <p className="error-text" role="alert">{error}</p>}</div>;
}
