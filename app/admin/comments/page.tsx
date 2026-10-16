"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type Comment = { id: string; design_id: string; visitor_name: string; body: string; created_at: string };

export default function CommentModerationPage() {
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const loadComments = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/comments", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) { if (response.status === 401) setLoggedIn(false); throw new Error(data.error || "Could not load comments."); }
      setComments(data.comments || []); setLoggedIn(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load comments."); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void loadComments(); }, [loadComments]);

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Login failed.");
      setPassword(""); setLoggedIn(true); await loadComments();
    } catch (e) { setError(e instanceof Error ? e.message : "Login failed."); }
    finally { setBusy(false); }
  }
  async function remove(comment: Comment) {
    if (!window.confirm(`Permanently delete this comment by ${comment.visitor_name}?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/comments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: comment.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete comment.");
      setComments(current => current.filter(item => item.id !== comment.id)); setNotice("Comment deleted.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not delete comment."); }
    finally { setBusy(false); }
  }
  const designs = useMemo(() => Array.from(new Set(comments.map(comment => comment.design_id))).sort(), [comments]);
  const visible = useMemo(() => comments.filter(comment => !filter || comment.design_id.toLowerCase().includes(filter.toLowerCase())), [comments, filter]);
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }); setLoggedIn(false); setComments([]); setNotice("");
  }

  return <main style={{ minHeight: "100vh", background: "#080807", color: "#f4ecdf", padding: "32px 18px", fontFamily: "Arial, sans-serif" }}>
    <div style={{ maxWidth: 1050, margin: "0 auto" }}>
      <div style={{ color: "#d5a957", letterSpacing: 3, fontSize: 11 }}>ART TO INK · PRIVATE ADMIN</div>
      <h1 style={{ fontFamily: "Georgia,serif", fontWeight: 400, fontSize: 38, margin: "12px 0" }}>Comment Moderation</h1>
      <p style={{ color: "#b9ad9c" }}>Review and remove comments across your tattoo design collection.</p>
      {error && <p role="alert" style={{ border: "1px solid #e3262e", padding: 12, color: "#ffb6b6" }}>{error}</p>}
      {notice && <p role="status" style={{ border: "1px solid #5d4930", padding: 12, color: "#d5a957" }}>{notice}</p>}
      {!loggedIn ? <form onSubmit={login} style={{ maxWidth: 430, marginTop: 28, border: "1px solid #5d4930", padding: 22 }}>
        <label htmlFor="admin-password" style={{ display: "block", marginBottom: 10 }}>Administrator password</label>
        <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: "100%", padding: 13, background: "#10100e", border: "1px solid #5d4930", color: "#f4ecdf" }} />
        <button disabled={busy} style={{ marginTop: 14, padding: "12px 18px", background: "#d5a957", color: "#080807", fontWeight: 700, border: 0, cursor: "pointer" }}>{busy ? "Signing in…" : "Sign in"}</button>
      </form> : <>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", margin: "24px 0", borderBottom: "1px solid #5d4930", paddingBottom: 18 }}>
          <strong>{comments.length} comments</strong>
          <select aria-label="Filter by artwork" value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: 10, background: "#10100e", border: "1px solid #5d4930", color: "#f4ecdf" }}>
            <option value="">All artwork</option>{designs.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
          <button onClick={() => void loadComments()} disabled={busy} style={{ padding: 10, border: "1px solid #5d4930" }}>Refresh</button>
          <button onClick={() => void logout()} style={{ padding: 10, border: "1px solid #5d4930", marginLeft: "auto" }}>Sign out</button>
        </div>
        {visible.length === 0 ? <p style={{ color: "#b9ad9c" }}>{busy ? "Loading comments…" : "No comments found."}</p> : <div style={{ display: "grid", gap: 12 }}>
          {visible.map(comment => <article key={comment.id} style={{ border: "1px solid #5d4930", padding: 18, background: "#10100e" }}>
            <div style={{ display: "flex", gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
              <div><strong>{comment.visitor_name}</strong><div style={{ color: "#d5a957", fontSize: 12, marginTop: 5 }}>{comment.design_id}</div></div>
              <time style={{ color: "#b9ad9c", fontSize: 12 }}>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(comment.created_at))}</time>
            </div>
            <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{comment.body}</p>
            <button onClick={() => void remove(comment)} disabled={busy} style={{ border: "1px solid #e3262e", color: "#ffb6b6", padding: "8px 12px", cursor: "pointer" }}>Delete comment</button>
          </article>)}
        </div>}
      </>}
      <p style={{ color: "#766c60", fontSize: 12, marginTop: 32 }}>Private administrator area · Sessions expire after 8 hours.</p>
    </div>
  </main>;
}
