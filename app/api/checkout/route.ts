import { NextResponse } from "next/server";
import { DESIGN_SIZE_ORDER, LICENSES, type DesignSize } from "@/lib/products";
import { tattooDesigns } from "@/lib/mock-data";
import { getSecureDownloadObject, type ArtworkFormat } from "@/lib/secure-assets";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
const allowedSizes = new Set<DesignSize>(DESIGN_SIZE_ORDER);
const allowedFormats = new Set<ArtworkFormat>(["colour", "blackAndWhite"]);
const allowedIntents = new Set(["personal-tattoo", "professional-client-tattoo", "personal-reference"]);

function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured) throw new Error("Set NEXT_PUBLIC_SITE_URL to the canonical HTTPS website URL.");
  const parsed = new URL(configured);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS.");
  }
  return parsed.origin;
}

async function privateObjectExists(objectPath: string): Promise<boolean> {
  const bucket = process.env.SUPABASE_DOWNLOAD_BUCKET;
  if (!bucket) throw new Error("Missing SUPABASE_DOWNLOAD_BUCKET server environment variable.");
  const separator = objectPath.lastIndexOf("/");
  const folder = separator >= 0 ? objectPath.slice(0, separator) : "";
  const fileName = separator >= 0 ? objectPath.slice(separator + 1) : objectPath;
  const { data, error } = await getSupabaseAdmin().storage.from(bucket).list(folder, {
    limit: 100,
    search: fileName,
  });
  if (error) throw error;
  return (data ?? []).some((item) => item.name === fileName);
}

export async function POST(request: Request) {
  try {
    const stripe = getStripe();
    const contentType = request.headers.get("content-type") ?? "";
    let body: Record<string, unknown>;
    if (contentType.includes("application/json")) {
      body = await request.json() as Record<string, unknown>;
    } else {
      const form = await request.formData();
      body = Object.fromEntries(form.entries());
    }

    const origin = siteOrigin();
    if (body.type === "license") {
      const licenseId = String(body.licenseId ?? "");
      const license = LICENSES.find((item) => item.id === licenseId);
      if (!license) return NextResponse.json({ error: "Choose a valid licence." }, { status: 400 });
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: Math.round(license.price * 100),
            recurring: { interval: "year" },
            product_data: {
              name: license.title,
              description: `${license.allowance}. ${license.audience}. ${license.description}`,
            },
          },
        }],
        billing_address_collection: "required",
        success_url: `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/`,
        metadata: { purchase_type: "license", license_id: license.id, intended_use_confirmed: "true" },
        subscription_data: { metadata: { license_id: license.id } },
      });
      if (!session.url) throw new Error("Stripe did not return a checkout URL.");
      return contentType.includes("application/json")
        ? NextResponse.json({ url: session.url })
        : NextResponse.redirect(session.url, 303);
    }

    if (body.type !== "design") {
      return NextResponse.json({ error: "Invalid purchase type." }, { status: 400 });
    }
    if (body.intendedUseConfirmed !== true && body.intendedUseConfirmed !== "true") {
      return NextResponse.json({ error: "Please confirm the intended use before checkout." }, { status: 400 });
    }

    const productId = String(body.productId ?? body.productSlug ?? "");
    const design = tattooDesigns.find((item) => item.id === productId || item.slug === productId);
    if (!design) return NextResponse.json({ error: "This design is not currently published for purchase." }, { status: 404 });

    const rawVariantId = String(body.variantId ?? body.size ?? "");
    const size = (rawVariantId.startsWith("var_") ? rawVariantId.slice(4) : rawVariantId) as DesignSize;
    if (!allowedSizes.has(size)) return NextResponse.json({ error: "Choose a valid design variant." }, { status: 400 });

    const format = String(body.artworkFormat ?? "colour") as ArtworkFormat;
    if (!allowedFormats.has(format)) return NextResponse.json({ error: "Choose a valid artwork file format." }, { status: 400 });

    const customerIntent = String(body.customerIntent ?? body.intendedUse ?? "personal-tattoo");
    if (!allowedIntents.has(customerIntent)) return NextResponse.json({ error: "Choose a valid intended use." }, { status: 400 });

    const placementNote = String(body.placementNote ?? "").trim().slice(0, 500);
    const customerName = String(body.customerName ?? "").trim().slice(0, 120);
    const customerPhone = String(body.customerPhone ?? "").trim().slice(0, 40);
    const customerEmail = String(body.customerEmail ?? "").trim().slice(0, 254);
    if (!customerName || !customerPhone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return NextResponse.json({ error: "Enter your name, a valid email address and phone number before checkout." }, { status: 400 });
    }
    const objectPath = getSecureDownloadObject(design.id, size, format);
    if (!objectPath) {
      return NextResponse.json({ error: "Secure delivery is not configured for this design variant." }, { status: 503 });
    }
    if (!(await privateObjectExists(objectPath))) {
      return NextResponse.json({ error: "Secure delivery is temporarily unavailable for this artwork. No payment has been taken." }, { status: 503 });
    }

    const variant = design.sizes[size];
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: Math.round(variant.price * 100),
          product_data: {
            name: `${design.title} — ${variant.label}`,
            description: `${variant.details} File format: ${format === "colour" ? "Colour" : "Black & White"}.`,
            metadata: { productId: design.id, variantId: `var_${size}`, artworkFormat: format },
          },
        },
      }],
      customer_creation: "always",
      customer_email: customerEmail,
      billing_address_collection: "required",
      custom_fields: [
        {
          key: "customer_name",
          label: { type: "custom", custom: "Full name" },
          type: "text",
          optional: false,
          text: { maximum_length: 120 },
        },
        {
          key: "placement_note",
          label: { type: "custom", custom: "Optional placement note" },
          type: "text",
          optional: true,
          text: { maximum_length: 500 },
        },
      ],
      success_url: `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/`,
      metadata: {
        purchase_type: "design",
        productId: design.id,
        variantId: `var_${size}`,
        customerIntent,
        placementNote,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        artworkFormat: format,
        product_slug: design.slug,
        size,
        intended_use: customerIntent,
        intended_use_confirmed: "true",
      },
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout creation failed:", error);
    return NextResponse.json({ error: "Unable to start secure checkout. Please try again shortly." }, { status: 500 });
  }
}
