import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { LICENSES } from "@/lib/products";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import { getSecureDownloadObject } from "@/lib/secure-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Sign in to check out your saved cart." }, { status: 401 });
  try {
    const url = process.env.SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) throw new Error("Supabase authentication is not configured.");
    const authClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await authClient.auth.getUser(token);
    if (authError || !auth.user?.id || !auth.user.email || !auth.user.email_confirmed_at) {
      return NextResponse.json({ error: "Verify your email and sign in again." }, { status: 403 });
    }
    const checkoutBody = await request.json() as { intendedUseConfirmed?: unknown; intendedUse?: unknown };
    const db = getSupabaseAdmin();
    const { data: cart, error: cartError } = await db.from("carts").select("id").eq("customer_id", auth.user.id).single();
    if (cartError || !cart) return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
    const { data: items, error: itemsError } = await db.from("cart_items")
      .select("id,quantity,product_id,variant_id,asset_id,license_package_id")
      .eq("cart_id", cart.id);
    if (itemsError) throw itemsError;
    if (!items?.length) return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
    if (items.length !== 1 || items[0].quantity !== 1) return NextResponse.json({ error: "For now, please check out one item at a time. Your other saved items will remain in your cart." }, { status: 409 });
    const item = items[0];
    const originValue = process.env.NEXT_PUBLIC_SITE_URL;
    if (!originValue) throw new Error("Missing NEXT_PUBLIC_SITE_URL.");
    const origin = new URL(originValue);
    if (origin.protocol !== "https:" && origin.hostname !== "localhost") throw new Error("The site URL must use HTTPS.");
    const stripe = getStripe();

    if (item.license_package_id) {
      const { data: pkg, error } = await db.from("license_packages")
        .select("id,code,title,price_cents,currency,credit_limit,active")
        .eq("id", item.license_package_id).eq("active", true).single();
      if (error || !pkg) return NextResponse.json({ error: "This licence package is no longer available." }, { status: 409 });
      if (pkg.credit_limit === null) return NextResponse.json({ error: "This licence package is not ready for sale until its usage limit has been configured." }, { status: 409 });
      const licenseId = pkg.code === "starter" ? "artist" : pkg.code === "professional" ? "studio" : pkg.code === "studio" ? "full-catalogue" : "";
      const license = LICENSES.find(entry => entry.id === licenseId);
      if (!license) return NextResponse.json({ error: "Unknown licence package." }, { status: 409 });
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ quantity: 1, price_data: { currency: pkg.currency, unit_amount: pkg.price_cents, product_data: { name: pkg.title, description: pkg.description ?? license.description } } }],
        customer_creation: "always",
        customer_email: auth.user.email,
        billing_address_collection: "required",
        success_url: `${origin.origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin.origin}/cart`,
        metadata: { purchase_type: "license", license_id: license.id, customer_id: auth.user.id, cart_item_id: item.id, intended_use_confirmed: "true" },
      });
      if (!session.url) throw new Error("Stripe did not return a checkout URL.");
      return NextResponse.json({ url: session.url });
    }

    if (!item.product_id || !item.variant_id || !item.asset_id) return NextResponse.json({ error: "The cart item is incomplete." }, { status: 409 });
    const allowedIntents = new Set(["personal-tattoo", "professional-client-tattoo", "personal-reference"]);
    const intendedUse = typeof checkoutBody.intendedUse === "string" ? checkoutBody.intendedUse : "";
    if (checkoutBody.intendedUseConfirmed !== true || !allowedIntents.has(intendedUse)) {
      return NextResponse.json({ error: "Confirm the intended use of this artwork before checkout." }, { status: 400 });
    }
    const [{ data: product, error: productError }, { data: variant, error: variantError }, { data: asset, error: assetError }] = await Promise.all([
      db.from("commerce_products").select("id,slug,title,active").eq("id", item.product_id).eq("active", true).single(),
      db.from("commerce_variants").select("id,variant_key,label,price_cents,currency,active").eq("id", item.variant_id).eq("active", true).single(),
      db.from("commerce_assets").select("id,artwork_format,storage_object_path,active").eq("id", item.asset_id).eq("active", true).single(),
    ]);
    if (productError || !product || variantError || !variant || assetError || !asset) return NextResponse.json({ error: "This artwork is no longer available." }, { status: 409 });
    if (asset.storage_object_path !== getSecureDownloadObject(product.slug, variant.variant_key, asset.artwork_format)) {
      return NextResponse.json({ error: "The private artwork path does not match the published delivery configuration." }, { status: 409 });
    }
    const bucket = process.env.SUPABASE_DOWNLOAD_BUCKET;
    if (!bucket) throw new Error("Missing private download bucket configuration.");
    const slash = asset.storage_object_path.lastIndexOf("/");
    const folder = slash >= 0 ? asset.storage_object_path.slice(0, slash) : "";
    const fileName = slash >= 0 ? asset.storage_object_path.slice(slash + 1) : asset.storage_object_path;
    const { data: stored, error: storageError } = await db.storage.from(bucket).list(folder, { limit: 100, search: fileName });
    if (storageError) throw storageError;
    if (!(stored ?? []).some(file => file.name === fileName)) return NextResponse.json({ error: "The private artwork file is missing from storage." }, { status: 409 });
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ quantity: 1, price_data: { currency: variant.currency, unit_amount: variant.price_cents, product_data: { name: `${product.title} — ${variant.label}`, metadata: { productId: product.slug, variantKey: variant.variant_key, artworkFormat: asset.artwork_format } } } }],
      customer_creation: "always",
      customer_email: auth.user.email,
      billing_address_collection: "required",
      success_url: `${origin.origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin.origin}/cart`,
      metadata: {
        purchase_type: "design", productId: product.slug, product_slug: product.slug,
        variantId: `var_${variant.variant_key}`, size: variant.variant_key,
        artworkFormat: asset.artwork_format, customerIntent: intendedUse,
        intended_use: intendedUse, intended_use_confirmed: "true",
        customer_id: auth.user.id, cart_item_id: item.id,
      },
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Cart checkout failed:", error);
    return NextResponse.json({ error: "Secure checkout could not be started. Please try again." }, { status: 503 });
  }
}
