import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const entitlementId = new URL(request.url).searchParams.get("entitlementId") ?? "";
  if (!token || !/^[0-9a-f-]{36}$/i.test(entitlementId)) return NextResponse.json({ error: "Sign in and select a valid download entitlement." }, { status: 401 });
  try {
    const url = process.env.SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const bucket = process.env.SUPABASE_DOWNLOAD_BUCKET;
    if (!url || !anon || !bucket) throw new Error("Secure download is not configured.");
    const authClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await authClient.auth.getUser(token);
    if (authError || !auth.user?.id || !auth.user.email_confirmed_at) return NextResponse.json({ error: "Your verified account is required." }, { status: 403 });
    const admin = getSupabaseAdmin();
    const { data: entitlement, error } = await admin.from("download_entitlements")
      .select("id,expires_at,revoked_at,commerce_assets(storage_object_path,active)")
      .eq("id", entitlementId).eq("customer_id", auth.user.id).maybeSingle();
    if (error) throw error;
    const asset = Array.isArray(entitlement?.commerce_assets) ? entitlement?.commerce_assets[0] : entitlement?.commerce_assets;
    if (!entitlement || entitlement.revoked_at || Date.parse(entitlement.expires_at) <= Date.now() || !asset?.active || !asset.storage_object_path) {
      return NextResponse.json({ error: "This download entitlement is invalid or expired." }, { status: 404 });
    }
    const { data: signed, error: signError } = await admin.storage.from(bucket).createSignedUrl(asset.storage_object_path, 60);
    if (signError || !signed?.signedUrl) throw signError ?? new Error("Unable to sign file.");
    const file = await fetch(signed.signedUrl, { cache: "no-store" });
    if (!file.ok || !file.body) throw new Error("Private file retrieval failed.");
    return new Response(file.body, { headers: {
      "Content-Type": file.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": 'attachment; filename="art-to-ink-licensed-artwork"',
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    console.error("Licence download failed:", error);
    return NextResponse.json({ error: "The secure download is temporarily unavailable." }, { status: 503 });
  }
}
