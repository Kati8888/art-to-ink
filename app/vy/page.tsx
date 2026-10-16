"use client";

import { useEffect, useState, type FormEvent } from "react";

type Photo = { id: string; caption: string | null; imageUrl: string };

export default function VyPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [name, setName] = useState("");
  const [permission, setPermission] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/customer-photos").then(async (r) => r.ok ? r.json() : { photos: [] })
      .then((data) => setPhotos(data.photos ?? [])).catch(() => setPhotos([]));
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    if (!file || !permission) return;
    setBusy(true); setStatus("");
    const body = new FormData();
    body.append("photo", file); body.append("name", name); body.append("caption", caption);
    body.append("permission", "yes");
    try {
      const response = await fetch("/api/customer-photos", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The photo could not be uploaded.");
      setStatus("Thank you! Your photo has been submitted for review. It will be published only after approval.");
      setFile(null); setCaption(""); setName(""); setPermission(false);
      formElement.reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally { setBusy(false); }
  }

  return <main className="customer-page">
    <header className="customer-header">
      <a href="/" className="customer-brand">ART <em>TO</em> INK<span>KATEŘINA POHNETALOVÁ</span></a>
      <a className="customer-back" href="/">Back to the website ↗</a>
    </header>
    <section className="customer-hero">
      <p className="customer-kicker">REAL PEOPLE · REAL TATTOOS</p>
      <h1>You. Your skin. Your story.</h1>
      <p>Got a tattoo based on an ART TO INK design? Show us how it looks on you. Every photo is reviewed before it appears in the gallery.</p>
      <a className="customer-gold-button" href="#upload">Upload Your Photo ↓</a>
    </section>
    <section className="customer-gallery">
      <div className="customer-section-heading"><div><p className="customer-kicker">COMMUNITY GALLERY</p><h2>Your Photos</h2></div><span>{photos.length} {photos.length === 1 ? "photo" : "photos"}</span></div>
      {photos.length ? <div className="customer-photo-grid">{photos.map((photo) => <figure key={photo.id}><img src={photo.imageUrl} alt={photo.caption || "ART TO INK tattoo on a customer"} /><figcaption>{photo.caption || "A story from the community"} </figcaption></figure>)}</div> : <div className="customer-empty"><span>✳</span><h3>Be among the first.</h3><p>This gallery will feature real customer photos after they have been submitted and approved. No stock images or made-up examples.</p></div>}
    </section>
    <section className="customer-upload" id="upload">
      <div><p className="customer-kicker">YOUR TURN</p><h2>Got your tattoo done?</h2><p>Upload a photo of your tattoo. Share a close-up of the design or a photo showing how it looks on your body.</p></div>
      <form onSubmit={submit}>
        <label className="customer-file-label">Your tattoo photo
          <input type="file" accept="image/jpeg,image/png,image/webp" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <small>{file ? file.name : "JPG, PNG or WebP · max. 10 MB"}</small>
        </label>
        <label>Name or nickname (optional)<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="How should we credit you?" /></label>
        <label>Short caption (optional)<input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={180} placeholder="e.g. Lion Heart · forearm" /></label>
        <label className="customer-consent"><input type="checkbox" checked={permission} onChange={(e) => setPermission(e.target.checked)} required /><span>I agree that ART TO INK may publish this photo on the website after review. I confirm that I have the right to share this photo.</span></label>
        <button className="customer-gold-button" type="submit" disabled={busy || !file || !permission}>{busy ? "Uploading…" : "Submit Photo for Review →"}</button>
        <p className="customer-form-note">Your photo will not appear publicly immediately after submission. It must be manually approved first.</p>
        {status && <p className="customer-status" role="status">{status}</p>}
      </form>
    </section>
    <footer className="customer-footer">© ART TO INK · Kateřina Pohnetalová <a href="/">Back to the main website ↑</a></footer>
    <style jsx>{`
      .customer-page{min-height:100vh;background:#080807;color:#f4ecdf;font:15px/1.6 Arial,sans-serif}
      .customer-header{height:88px;border-bottom:1px solid #493a27;display:flex;align-items:center;justify-content:space-between;padding:0 max(24px,calc((100vw - 1200px)/2))}
      .customer-brand{font:30px Georgia,serif;letter-spacing:.03em}.customer-brand em{color:#e3262e}.customer-brand span{display:block;font:10px Arial,sans-serif;letter-spacing:2px;color:#b9ad9c;margin-top:7px}
      .customer-back{border:1px solid #d5a957;padding:10px 16px;font-size:12px}
      .customer-hero{padding:82px 24px 76px;text-align:center;background:radial-gradient(ellipse at top,#241a0e,#080807 65%);border-bottom:1px solid #493a27}
      .customer-kicker{font-size:11px;letter-spacing:3px;color:#d5a957;text-transform:uppercase;margin:0 0 14px}
      h1,h2,h3{font-family:Georgia,serif;font-weight:400}.customer-hero h1{font-size:clamp(38px,5vw,66px);line-height:1.08;margin:0 auto 22px}.customer-hero>p:not(.customer-kicker){max-width:650px;color:#c9beae;margin:0 auto 28px}
      .customer-gold-button{display:inline-flex;align-items:center;justify-content:center;background:#d5a957;color:#080807;border:0;padding:15px 22px;font-weight:bold;font-size:11px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;text-decoration:none}
      .customer-gold-button:disabled{opacity:.55;cursor:not-allowed}
      .customer-gallery,.customer-upload{max-width:1200px;margin:auto;padding:64px 24px}
      .customer-section-heading{display:flex;align-items:end;justify-content:space-between;border-bottom:1px solid #493a27;margin-bottom:24px}.customer-section-heading h2,.customer-upload h2{font-size:38px;margin:0 0 20px}.customer-section-heading>span{color:#b9ad9c;padding-bottom:22px}
      .customer-empty{border:1px solid #493a27;background:#11100e;text-align:center;padding:48px 24px}.customer-empty>span{color:#d5a957;font-size:32px}.customer-empty h3{font-size:28px;margin:12px 0}.customer-empty p{max-width:540px;margin:auto;color:#b9ad9c}
      .customer-photo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.customer-photo-grid figure{margin:0;border:1px solid #493a27;background:#11100e;padding:10px}.customer-photo-grid img{display:block;width:100%;max-height:430px;object-fit:contain;background:#050505}.customer-photo-grid figcaption{padding:12px 4px 4px;color:#d5a957}
      .customer-upload{display:grid;grid-template-columns:1fr 1fr;gap:60px;border-top:1px solid #493a27}.customer-upload>div>p:not(.customer-kicker){color:#b9ad9c;max-width:440px}.customer-upload form{display:grid;gap:18px}.customer-upload label{display:grid;gap:8px;font-size:12px;letter-spacing:.4px}.customer-upload input:not([type=checkbox]){width:100%;background:#11100e;border:1px solid #493a27;color:#f4ecdf;padding:13px}.customer-file-label{border:1px dashed #d5a957;padding:18px}.customer-file-label input{border:0!important;padding:0!important}.customer-file-label small{color:#b9ad9c}.customer-consent{display:grid!important;grid-template-columns:20px 1fr;align-items:start;font-size:12px!important;letter-spacing:0!important}.customer-consent input{margin-top:4px;accent-color:#d5a957}.customer-form-note,.customer-status{font-size:12px;color:#b9ad9c;margin:0}.customer-status{color:#d5a957}
      .customer-footer{border-top:1px solid #493a27;padding:24px max(24px,calc((100vw - 1200px)/2));display:flex;justify-content:space-between;color:#b9ad9c;font-size:12px}
      @media(max-width:700px){.customer-header{height:auto;min-height:76px;padding:16px;gap:14px}.customer-brand{font-size:24px}.customer-hero{padding:58px 20px}.customer-gallery,.customer-upload{padding:42px 18px}.customer-upload{grid-template-columns:1fr;gap:28px}.customer-photo-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.customer-section-heading h2,.customer-upload h2{font-size:30px}.customer-footer{padding:20px;gap:16px;flex-wrap:wrap}}
      @media(max-width:420px){.customer-photo-grid{grid-template-columns:1fr}}
    `}</style>
  </main>;
}
