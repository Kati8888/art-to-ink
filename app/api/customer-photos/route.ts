import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const bucket = process.env.SUPABASE_CUSTOMER_PHOTOS_BUCKET || "customer-photos";
function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Nahrávání zatím není připojeno. Správce webu musí nastavit úložiště fotek.");
  return createClient(url, key, { auth: { persistSession: false } });
}
export async function GET() {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.from("customer_tattoo_photos").select("id,caption,storage_path").eq("status","approved").order("created_at",{ascending:false}).limit(60);
    if (error) throw error;
    const photos = await Promise.all((data ?? []).map(async (row) => {
      const { data: signed, error: signError } = await supabase.storage.from(bucket).createSignedUrl(row.storage_path, 60 * 30);
      if (signError || !signed) return null;
      return { id: row.id, caption: row.caption, imageUrl: signed.signedUrl };
    }));
    return NextResponse.json({ photos: photos.filter(Boolean) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ photos: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
export async function POST(request: Request) {
  let storagePath = "";
  try {
    const form = await request.formData();
    const file = form.get("photo");
    const permission = form.get("permission");
    const name = String(form.get("name") ?? "").trim().slice(0,80);
    const caption = String(form.get("caption") ?? "").trim().slice(0,180);
    if (permission !== "yes") return NextResponse.json({ error: "Pro odeslání je potřeba potvrdit souhlas se zveřejněním." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Vyber prosím fotku." }, { status: 400 });
    if (!["image/jpeg","image/png","image/webp"].includes(file.type)) return NextResponse.json({ error: "Povoleny jsou pouze JPG, PNG a WebP." }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Fotka může mít maximálně 10 MB." }, { status: 400 });
    const supabase = supabaseAdmin();
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    storagePath = `pending/${new Date().toISOString().slice(0,10)}/${randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const { error: insertError } = await supabase.from("customer_tattoo_photos").insert({ storage_path: storagePath, display_name: name || null, caption: caption || null, status: "pending", consented_at: new Date().toISOString() });
    if (insertError) {
      await supabase.storage.from(bucket).remove([storagePath]);
      throw insertError;
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const safeMessage = message.includes("not connected") || message.includes("Nahrávání zatím") ? message : "Fotku se teď nepodařilo uložit. Zkontroluj prosím nastavení úložiště a zkus to znovu.";
    return NextResponse.json({ error: safeMessage }, { status: 503 });
  }
}
