import { NextResponse } from "next/server";
import { DESIGN_SIZE_ORDER, type DesignSize } from "@/lib/products";
import { tattooDesigns } from "@/lib/mock-data";
import { getSecureDownloadObject, type ArtworkFormat } from "@/lib/secure-assets";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

const allowedFormats = new Set<ArtworkFormat>(["colour", "blackAndWhite"]);
const allowedIntents = new Set(["personal-tattoo", "professional-client-tattoo", "personal-reference"]);
const licenseCodeById: Record<string, string> = {
  artist: "starter",
  studio: "professional",
  "full-catalogue": "studio",
};

type DesignItem = {
  type: "design";
  productId?: string;
  productSlug?: string;
  variantId?: string;
  size?: string;
  artworkFormat?: string;
  quantity?: number;
};

type LicenseItem = {
  type: "license";
  licenseId?: string;
  quantity?: number;
};

type CheckoutItem = DesignItem | LicenseItem;

function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured) throw new Error("Set NEXT_PUBLIC_SITE_URL to the canonical HTTPS website URL.");
  const parsed = new URL(configured);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS.");
  return parsed.origin;
}

function stringValue(value: unknown, maxLength: number): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeItems(body: Record<string, unknown>): CheckoutItem[] {
  if (Array.isArray(body.items)) return body.items as CheckoutItem[];
  if (body.type === "license") return [{ type: "license", licenseId: stringValue(body.licenseId, 80), quantity: 1 }];
  return [{
    type: "design",
    productId: stringValue(body.productId, 120),
    productSlug: stringValue(body.productSlug, 120),
    variantId: stringValue(body.variantId, 80),
    size: stringValue(body.size, 40),
    artworkFormat: stringValue(body.artworkFormat, 40),
    quantity: 1,
  }];
}

async function privateObjectExists(objectPath: string): Promise<boolean> {
  const bucket = process.env.SUPABASE_DOWNLOAD_BUCKET;
  if (!bucket) throw new Error("Missing SUPABASE_DOWNLOAD_BUCKET server environment variable.");
  const separator = objectPath.lastIndexOf("/");
  const folder = separator >= 0 ? objectPath.slice(0, separator) : "";
  const fileName = separator >= 0 ? objectPath.slice(separator + 1) : objectPath;
  const { data, error } = await getSupabaseAdmin().storage.from(bucket).list(folder, { limit: 100, search: fileName });
  if (error) throw error;
  return (data ?? []).some((item) => item.name === fileName);
}

async function resolveDesign(item: DesignItem) {
  const requested = stringValue(item.productId || item.productSlug, 120);
  const design = tattooDesigns.find((entry) => entry.id === requested || entry.slug === requested);
  if (!design) throw new Error("This design is not currently published for purchase.");
  const rawSize = stringValue(item.variantId || item.size, 40).replace(/^var_/, "") as DesignSize;
  if (!DESIGN_SIZE_ORDER.includes(rawSize)) throw new Error("Choose a valid design variant.");
  const format = stringValue(item.artworkFormat || "colour", 40) as ArtworkFormat;
  if (!allowedFormats.has(format)) throw new Error("Choose a valid artwork file format.");
  const quantity = Number(item.quantity ?? 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error("Each cart quantity must be a whole number from 1 to 20.");

  const { data: product, error: productError } = await getSupabaseAdmin()
    .from("commerce_products")
    .select("id,slug,title,active")
    .eq("slug", design.slug)
    .eq("active", true)
    .maybeSingle();
  if (productError) throw productError;
  if (!product) throw new Error("This design is not available in the live catalogue.");

  const { data: variant, error: variantError } = await getSupabaseAdmin()
    .from("commerce_variants")
    .select("id,variant_key,label,price_cents,active")
    .eq("product_id", product.id)
    .eq("variant_key", rawSize)
    .eq("active", true)
    .maybeSingle();
  if (variantError) throw variantError;
  if (!variant) throw new Error("This design variant is not available.");

  const { data: asset, error: assetError } = await getSupabaseAdmin()
    .from("commerce_assets")
    .select("id,storage_object_path,active,artwork_format")
    .eq("product_id", product.id)
    .eq("variant_id", variant.id)
    .eq("artwork_format", format)
    .eq("active", true)
    .maybeSingle();
  if (assetError) throw assetError;
  if (!asset) throw new Error("Secure delivery is not yet available for this artwork.");
  const objectPath = asset.storage_object_path || getSecureDownloadObject(design.id, rawSize, format);
  if (!objectPath || !(await privateObjectExists(objectPath))) throw new Error("Secure delivery is not yet available for this artwork.");

  return {
    quantity,
    price_data: {
      currency: "eur",
      unit_amount: variant.price_cents,
      product_data: {
        name: `${product.title} — ${variant.label}`,
        description: `${design.description} File format: ${format === "colour" ? "Colour" : "Black & White"}.`,
        metadata: {
          item_type: "design",
          product_id: product.id,
          product_slug: design.slug,
          variant_id: variant.id,
          variant_key: rawSize,
          asset_id: asset.id,
          artwork_format: format,
          storage_object_path: objectPath,
        },
      },
    },
  };
}

async function resolveLicense(item: LicenseItem) {
  const licenseId = stringValue(item.licenseId, 80);
  const code = licenseCodeById[licenseId];
  if (!code) throw new Error("Choose a valid licence.");
  const quantity = Number(item.quantity ?? 1);
  if (quantity !== 1) throw new Error("A licence can only be purchased once per checkout.");
  const { data: license, error } = await getSupabaseAdmin()
    .from("license_packages")
    .select("id,code,title,description,price_cents,currency,credit_limit,catalogue_scope,validity_months,active")
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  if (!license) throw new Error("This licence is not currently available.");
  return {
    quantity: 1,
    price_data: {
      currency: license.currency,
      unit_amount: license.price_cents,
      product_data: {
        name: license.title,
        description: license.description ?? "ART TO INK commercial licence.",
        metadata: {
          item_type: "license",
          license_id: license.id,
          license_code: license.code,
          credit_limit: license.credit_limit === null ? "unlimited" : String(license.credit_limit),
          catalogue_scope: license.catalogue_scope,
          validity_months: String(license.validity_months),
        },
      },
    },
  };
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await request.json() as Record<string, unknown>
      : Object.fromEntries((await request.formData()).entries());
    const items = normalizeItems(body);
    if (items.length < 1 || items.length > 20) return NextResponse.json({ error: "Add between one and twenty items to checkout." }, { status: 400 });
    if (items.some((item) => item.type !== "design" && item.type !== "license")) return NextResponse.json({ error: "Invalid cart item." }, { status: 400 });

    const intendedUseConfirmed = body.intendedUseConfirmed === true || body.intendedUseConfirmed === "true";
    if (!intendedUseConfirmed) return NextResponse.json({ error: "Please confirm the intended use before checkout." }, { status: 400 });
    const customerName = stringValue(body.customerName, 120);
    const customerPhone = stringValue(body.customerPhone, 40);
    const customerEmail = stringValue(body.customerEmail, 254);
    const customerIntent = stringValue(body.customerIntent || body.intendedUse || "personal-tattoo", 60);
    if (!customerName || !customerPhone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return NextResponse.json({ error: "Enter your name, a valid email address and phone number before checkout." }, { status: 400 });
    if (!allowedIntents.has(customerIntent)) return NextResponse.json({ error: "Choose a valid intended use." }, { status: 400 });

    const lineItems = [];
    for (const item of items) lineItems.push(item.type === "design" ? await resolveDesign(item) : await resolveLicense(item));
    const hasDesign = items.some((item) => item.type === "design");
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_creation: "always",
      customer_email: customerEmail,
      billing_address_collection: "required",
      custom_fields: [
        { key: "customer_name", label: { type: "custom", custom: "Full name" }, type: "text", optional: false, text: { maximum_length: 120 } },
        { key: "placement_note", label: { type: "custom", custom: "Optional placement note" }, type: "text", optional: true, text: { maximum_length: 500 } },
      ],
      success_url: `${siteOrigin()}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteOrigin()}/`,
      metadata: {
        purchase_type: hasDesign ? "design" : "license",
        customer_intent: customerIntent,
        intended_use_confirmed: "true",
        customer_name: customerName,
        customer_phone: customerPhone,
        placement_note: stringValue(body.placementNote, 500),
      },
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return contentType.includes("application/json") ? NextResponse.json({ url: session.url }) : NextResponse.redirect(session.url, 303);
  } catch (error) {
    console.error("Checkout creation failed:", error);
    const message = error instanceof Error && /not available|valid|quantity|licence|delivery|catalogue/.test(error.message) ? error.message : "Unable to start secure checkout. Please try again shortly.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
