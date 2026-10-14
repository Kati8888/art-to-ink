"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export function DownloadButton() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") ?? "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function getDownload() {
    setBusy(true);
    setError("");
    try {
      if (!/^cs_(test|live)_/.test(sessionId)) {
        throw new Error("This checkout link is invalid. Please use the link from your payment confirmation.");
      }

      let response: Response | undefined;
      let data: { url?: string; error?: string } = {};
      for (let attempt = 0; attempt < 8; attempt += 1) {
        response = await fetch("/api/download/issue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ sessionId }),
        });
        data = await response.json() as { url?: string; error?: string };
        if (response.ok && data.url) break;
        if (response.status !== 409 || attempt === 7) {
          throw new Error(data.error ?? "The secure download is not ready yet.");
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (!response?.ok || !data.url) {
        throw new Error(data.error ?? "The secure download is not ready yet.");
      }
      window.location.assign(data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The secure download is not ready yet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="purchase-form" style={{ maxWidth: 480, marginTop: 18 }}>
      <button className="button" type="button" onClick={getDownload} disabled={busy || !sessionId}>
        {busy ? "Preparing your secure download…" : "Download your artwork"}
      </button>
      <p className="muted" style={{ marginTop: 10 }}>Your private download link is valid for seven days.</p>
      {error && <p className="error-text" role="alert">{error}</p>}
    </div>
  );
}
