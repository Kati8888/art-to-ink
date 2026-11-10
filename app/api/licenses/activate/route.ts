import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Sign in to use a studio licence." }, { status: 401 });
  try {
    const url = process.env.SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) throw new Error("Supabase authentication is not configured.");
    const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await userClient.auth.getUser(token);
    if (authError || !auth.user?.id || !auth.user.email_confirmed_at) return NextResponse.json({ error: "Verify your email and sign in again." }, { status: 403 });
    const body = await request.json() as { licenseId?: unknown; designSlug?: unknown; variantKey?: unknown; format?: unknown; idempotencyKey?: unknown };
    const licenseId = typeof body.licenseId === "string" ? body.licenseId : "";
    const designSlug = typeof body.designSlug === "string" ? body.designSlug : "";
    const variantKey = typeof body.variantKey === "string" ? body.variantKey : "detailed";
    const format = body.format === "blackAndWhite" ? "blackAndWhite" : "colour";
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
    if (!/^[a-z0-9-]{2,80}$/.test(designSlug) || !["mini","small","detailed","premium","collection"].includes(variantKey) || idempotencyKey.length < 16 || idempotencyKey.length > 120) {
      return NextResponse.json({ error: "Invalid design, size or activation request." }, { status: 400 });
    }
    const admin = getSupabaseAdmin();
    const { data: product, error: productError } = await admin.from("commerce_products").select("id,slug").eq("slug", designSlug).eq("active", true).single();
    if (productError || !product) return NextResponse.json({ error: "This design is not available in the licence catalogue." }, { status: 404 });
    const { data: variant, error: variantError } = await admin.from("commerce_variants").select("id").eq("product_id", product.id).eq("variant_key", variantKey).eq("active", true).maybeSingle();
    if (variantError) throw variantError;
    const { data: asset, error: assetError } = await admin.from("commerce_assets").select("id").eq("product_id", product.id).eq("artwork_format", format).eq("active", true).eq("variant_id", variant?.id ?? null).maybeSingle();
    if (assetError) throw assetError;
    if (!asset) return NextResponse.json({ error: "The requested secure artwork file is not available." }, { status: 404 });
    const { data, error } = await userClient.rpc("activate_license", {
      p_license_id: licenseId,
      p_asset_id: asset.id,
      p_design_id: designSlug,
      p_idempotency_key: idempotencyKey,
      p_entitlement_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ activated: true, ...result });
  } catch (error) {
    console.error("Licence activation failed:", error);
    return NextResponse.json({ error: "The licence could not be activated. Check that it is active and has credits remaining." }, { status: 409 });
  }
}
