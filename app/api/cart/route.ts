import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getVerifiedUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: NextResponse.json({ error: "Sign in to use your saved cart." }, { status: 401 }) };
  const url = process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase authentication is not configured.");
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user?.id || !data.user.email_confirmed_at) return { error: NextResponse.json({ error: "Verify your email and sign in again." }, { status: 403 }) };
  return { user: data.user };
}

async function getOrCreateCart(customerId: string) {
  const db = getSupabaseAdmin();
  const { data: current, error } = await db.from("carts").select("id").eq("customer_id", customerId).maybeSingle();
  if (error) throw error;
  if (current) return current.id;
  const { data, error: createError } = await db.from("carts").insert({ customer_id: customerId, currency: "eur" }).select("id").single();
  if (createError) throw createError;
  return data.id;
}

export async function GET(request: Request) {
  try {
    const auth = await getVerifiedUser(request);
    if (auth.error) return auth.error;
    const db = getSupabaseAdmin();
    const { data: cart } = await db.from("carts").select("id").eq("customer_id", auth.user.id).maybeSingle();
    if (!cart) return NextResponse.json({ items: [] }, { headers: { "Cache-Control": "no-store" } });
    const { data, error } = await db.from("cart_items")
      .select("id,quantity,created_at,commerce_products(slug,title),commerce_variants(variant_key,label,price_cents,currency),license_packages(code,title,price_cents,currency,credit_limit)")
      .eq("cart_id", cart.id).order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ items: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Cart read failed:", error);
    return NextResponse.json({ error: "Your saved cart is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getVerifiedUser(request);
    if (auth.error) return auth.error;
    const body = await request.json() as { type?: unknown; productSlug?: unknown; variantKey?: unknown; format?: unknown; licenseCode?: unknown };
    const cartId = await getOrCreateCart(auth.user.id);
    const db = getSupabaseAdmin();
    if (body.type === "license") {
      const code = typeof body.licenseCode === "string" ? body.licenseCode : "";
      const { data: pkg, error } = await db.from("license_packages").select("id,credit_limit,active").eq("code", code).eq("active", true).single();
      if (error || !pkg) return NextResponse.json({ error: "This licence package is not available." }, { status: 404 });
      if (pkg.credit_limit === null) return NextResponse.json({ error: "This licence package is not ready for sale because its usage limit has not been configured." }, { status: 409 });
      const { data: priorItem, error: priorError } = await db.from("cart_items").select("id").eq("cart_id", cartId).eq("license_package_id", pkg.id).maybeSingle();
      if (priorError) throw priorError;
      if (priorItem) {
        const { error: updateError } = await db.from("cart_items").update({ quantity: 1, updated_at: new Date().toISOString() }).eq("id", priorItem.id);
        if (updateError) throw updateError;
      } else {
        const { error: addError } = await db.from("cart_items").insert({ cart_id: cartId, license_package_id: pkg.id, quantity: 1 });
        if (addError) throw addError;
      }
    } else if (body.type === "design") {
      const slug = typeof body.productSlug === "string" ? body.productSlug : "";
      const variantKey = typeof body.variantKey === "string" ? body.variantKey : "";
      if (body.format !== "colour" && body.format !== "blackAndWhite") return NextResponse.json({ error: "Choose a valid artwork format." }, { status: 400 });
      const format = body.format;
      const { data: product, error: productError } = await db.from("commerce_products").select("id").eq("slug", slug).eq("active", true).single();
      if (productError || !product) return NextResponse.json({ error: "This design is not available." }, { status: 404 });
      const { data: variant, error: variantError } = await db.from("commerce_variants").select("id").eq("product_id", product.id).eq("variant_key", variantKey).eq("active", true).single();
      if (variantError || !variant) return NextResponse.json({ error: "This size is not available." }, { status: 404 });
      const { data: asset, error: assetError } = await db.from("commerce_assets").select("id,storage_object_path").eq("product_id", product.id).eq("variant_id", variant.id).eq("artwork_format", format).eq("active", true).single();
      if (assetError || !asset) return NextResponse.json({ error: "This exact file is not yet available for secure delivery." }, { status: 409 });
      const bucket = process.env.SUPABASE_DOWNLOAD_BUCKET;
      if (!bucket) throw new Error("Missing private download bucket configuration.");
      const slash = asset.storage_object_path.lastIndexOf("/");
      const folder = slash >= 0 ? asset.storage_object_path.slice(0, slash) : "";
      const fileName = slash >= 0 ? asset.storage_object_path.slice(slash + 1) : asset.storage_object_path;
      const { data: stored, error: storageError } = await db.storage.from(bucket).list(folder, { limit: 100, search: fileName });
      if (storageError) throw storageError;
      if (!(stored ?? []).some(file => file.name === fileName)) return NextResponse.json({ error: "The private artwork file is not present in storage." }, { status: 409 });
      const { data: priorItem, error: priorError } = await db.from("cart_items").select("id").eq("cart_id", cartId).eq("product_id", product.id).eq("variant_id", variant.id).eq("asset_id", asset.id).maybeSingle();
      if (priorError) throw priorError;
      if (priorItem) {
        const { error: updateError } = await db.from("cart_items").update({ quantity: 1, updated_at: new Date().toISOString() }).eq("id", priorItem.id);
        if (updateError) throw updateError;
      } else {
        const { error: addError } = await db.from("cart_items").insert({ cart_id: cartId, product_id: product.id, variant_id: variant.id, asset_id: asset.id, quantity: 1 });
        if (addError) throw addError;
      }
    } else {
      return NextResponse.json({ error: "Invalid cart item." }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cart update failed:", error);
    return NextResponse.json({ error: "The item could not be added to your saved cart." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getVerifiedUser(request);
    if (auth.error) return auth.error;
    const body = await request.json() as { itemId?: unknown };
    const itemId = typeof body.itemId === "string" ? body.itemId : "";
    if (!/^[0-9a-f-]{36}$/i.test(itemId)) return NextResponse.json({ error: "Invalid cart item." }, { status: 400 });
    const db = getSupabaseAdmin();
    const { data: cart } = await db.from("carts").select("id").eq("customer_id", auth.user.id).maybeSingle();
    if (!cart) return NextResponse.json({ success: true });
    const { error } = await db.from("cart_items").delete().eq("id", itemId).eq("cart_id", cart.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cart item removal failed:", error);
    return NextResponse.json({ error: "The cart item could not be removed." }, { status: 503 });
  }
}
