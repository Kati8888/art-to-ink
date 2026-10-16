"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabase: SupabaseClient = createClient(
  "https://tiruitlpdnasgyzgwmka.supabase.co",
  "sb_publishable_eH-7JOUxNCbUibaaKulJTg_vKUZMMtT",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

type CommentRow = { id: string; visitor_name: string; body: string; created_at: string };
const deleteTokenKey = (id: string) => `art-to-ink-comment-delete:${id}`;
async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
type Props = { designId: string; designTitle: string };

function getVisitorId() {
  const key = "art-to-ink-visitor-id";
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = window.crypto.randomUUID();
    window.localStorage.setItem(key, id);
  }
  return id;
}

export default function ArtworkInteractions({ designId, designTitle }: Props) {
  const [visitorId, setVisitorId] = useState("");
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async (id: string) => {
    setLoading(true);
    setError("");
    const [likesResult, ownLikeResult, commentsResult] = await Promise.all([
      supabase.from("artwork_likes").select("id", { count: "exact", head: true }).eq("design_id", designId),
      supabase.from("artwork_likes").select("id").eq("design_id", designId).eq("visitor_id", id).maybeSingle(),
      supabase.from("artwork_comments").select("id,visitor_name,body,created_at").eq("design_id", designId).order("created_at", { ascending: false }).limit(50),
    ]);
    if (likesResult.error || ownLikeResult.error || commentsResult.error) {
      setError("Interakce se nepodařilo načíst. Zkuste stránku obnovit.");
    } else {
      setLikeCount(likesResult.count ?? 0);
      setLiked(Boolean(ownLikeResult.data));
      setComments((commentsResult.data ?? []) as CommentRow[]);
    }
    setLoading(false);
  }, [designId]);

  useEffect(() => {
    const id = getVisitorId();
    setVisitorId(id);
    void refresh(id);
  }, [refresh]);

  async function toggleLike() {
    if (!visitorId) return;
    setNotice("");
    const previousLiked = liked;
    setLiked(!previousLiked);
    setLikeCount((count) => Math.max(0, count + (previousLiked ? -1 : 1)));
    const result = previousLiked
      ? await supabase.from("artwork_likes").delete().eq("design_id", designId).eq("visitor_id", visitorId)
      : await supabase.from("artwork_likes").insert({ design_id: designId, visitor_id: visitorId });
    if (result.error) {
      setLiked(previousLiked);
      setLikeCount((count) => Math.max(0, count + (previousLiked ? 1 : -1)));
      setNotice("Lajk se nepodařilo uložit. Zkus to prosím znovu.");
    } else {
      setNotice(previousLiked ? "Lajk odebrán." : "Děkujeme za lajk!");
    }
  }

  async function removeComment(comment: CommentRow) {
    const token = window.localStorage.getItem(deleteTokenKey(comment.id));
    if (!token) {
      setNotice("Tento komentář lze odebrat pouze z prohlížeče, ze kterého byl odeslán.");
      return;
    }
    if (!window.confirm("Opravdu chceš tento komentář odebrat?")) return;
    const response = await fetch("/api/comments/delete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: comment.id, token }),
    });
    const data = await response.json() as { error?: string; success?: boolean };
    if (!response.ok || !data.success) {
      setNotice(data.error ?? "Komentář se nepodařilo odebrat.");
      return;
    }
    window.localStorage.removeItem(deleteTokenKey(comment.id));
    setComments((current) => current.filter((item) => item.id !== comment.id));
    setNotice("Komentář byl odebrán.");
  }

  async function postComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim() || "Návštěvník";
    const cleanBody = body.trim();
    if (!cleanBody) return;
    if (cleanBody.length > 1000 || cleanName.length > 60) {
      setNotice("Jméno může mít nejvýše 60 a komentář 1 000 znaků.");
      return;
    }
    setSending(true);
    setNotice("");
    setError("");
    const deleteToken = window.crypto.randomUUID() + window.crypto.randomUUID();
    const deleteTokenHash = await sha256(deleteToken);
    const { data, error: insertError } = await supabase
      .from("artwork_comments")
      .insert({ design_id: designId, visitor_name: cleanName, body: cleanBody, visitor_id: visitorId, delete_token_hash: deleteTokenHash })
      .select("id,visitor_name,body,created_at")
      .single();
    if (insertError) {
      setNotice("Komentář se nepodařilo uložit. Zkus to prosím znovu.");
    } else if (data) {
      window.localStorage.setItem(deleteTokenKey(data.id), deleteToken);
      setComments((current) => [data as CommentRow, ...current]);
      setBody("");
      setNotice("Komentář byl zveřejněn. Z tohoto prohlížeče ho můžeš kdykoli odebrat.");
    }
    setSending(false);
  }

  return (
    <section className="artwork-social" aria-label={`Likes and comments for ${designTitle}`}>
      <div className="artwork-social-top">
        <div>
          <span className="social-eyebrow">COMMUNITY</span>
          <h4>Co říkáš na tento návrh?</h4>
        </div>
        <button className={`social-like ${liked ? "is-liked" : ""}`} type="button" onClick={toggleLike} disabled={!visitorId || loading} aria-pressed={liked}>
          <span aria-hidden="true">{liked ? "♥" : "♡"}</span> {liked ? "Líbí se ti" : "To se mi líbí"} <b>{likeCount}</b>
        </button>
      </div>
      <form className="social-comment-form" onSubmit={postComment}>
        <label>
          Tvoje jméno (nepovinné)
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="Např. Jana" />
        </label>
        <label>
          Komentář
          <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={1000} rows={3} required placeholder="Napiš, co si o návrhu myslíš…" />
        </label>
        <button className="social-submit" type="submit" disabled={sending || !body.trim()}>{sending ? "Ukládám…" : "Přidat komentář →"}</button>
      </form>
      {notice && <p className="social-notice" role="status">{notice}</p>}
      {error && <p className="social-error" role="alert">{error}</p>}
      <div className="social-comments">
        <div className="social-comments-heading">Komentáře <span>{comments.length}</span></div>
        {loading ? <p className="social-empty">Načítám reakce…</p> : comments.length === 0 ? <p className="social-empty">Zatím tu nejsou komentáře. Buď první!</p> : comments.map((comment) => (
          <article className="social-comment" key={comment.id}>
            <div className="social-comment-meta"><strong>{comment.visitor_name}</strong><time dateTime={comment.created_at}>{new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium" }).format(new Date(comment.created_at))}</time></div>
            <p>{comment.body}</p>
            {typeof window !== "undefined" && window.localStorage.getItem(deleteTokenKey(comment.id)) && <button className="social-remove-comment" type="button" onClick={() => void removeComment(comment)}>Odebrat komentář ×</button>}
          </article>
        ))}
      </div>
    </section>
  );
}
