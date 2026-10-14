import { NextResponse } from "next/server";
import { DESIGN_SIZE_ORDER, LICENSES, type DesignSize } from "@/lib/products";
import { tattooDesigns } from "@/lib/mock-data";
import { getSecureDownloadObject } from "@/lib/secure-assets";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
const allowedSizes = new Set<DesignSize>(DESIGN_SIZE_ORDER);

function siteOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured) throw new Error("Set NEXT_PUBLIC_SITE_URL to the canonical HTTPS website URL.");
  const parsed = new URL(configured);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS.");
  return parsed.origin;
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

    const origin = siteOrigin(request);
    const type = body.type;
    if (type === "license") {
      const licenseId = String(body.licenseId ?? "");
      const license = LICENSES.find((item) => item.id === licenseId);
      if (!license) return NextResponse.json({ error: "Choose a valid licence." }, { status: 400 });
      const priceId = process.env[license.stripePriceEnv];
      if (!priceId || !priceId.startsWith("price_")) {
        return NextResponse.json({ error: "This licence is not available for checkout yet. The verified Stripe recurring price is not configured." }, { status: 503 });
      }
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        customer_creation: undefined,
        billing_address_collection: "auto",
        customer_email: typeof body.email === "string" ? body.email : undefined,
        success_url: `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?checkout=cancelled#licences`,
        metadata: { purchase_type: "license", license_id: license.id, intended_use_confirmed: "true" },
        subscription_data: { metadata: { license_id: license.id } },
      });
      if (!session.url) throw new Error("Stripe did not return a checkout URL.");
      return contentType.includes("application/json") ? NextResponse.json({ url: session.url }) : NextResponse.redirect(session.url, 303);
    }

    if (type !== "design") return NextResponse.json({ error: "Invalid purchase type." }, { status: 400 });
    if (body.intendedUseConfirmed !== true && body.intendedUseConfirmed !== "true") {
      return NextResponse.json({ error: "Please confirm the intended use before checkout." }, { status: 400 });
    }
    const slug = String(body.productSlug ?? "");
    const design = tattooDesigns.find((item) => item.slug === slug);
    if (!design) return NextResponse.json({ error: "This design is not currently published for purchase." }, { status: 404 });
    const size = String(body.size ?? "") as DesignSize;
    if (!allowedSizes.has(size)) return NextResponse.json({ error: "Choose a valid design size." }, { status: 400 });
    const downloadObject = getSecureDownloadObject(design.slug, size);
    if (!downloadObject) return NextResponse.json({ error: "Secure delivery is not configured for this design and size, so checkout is disabled." }, { status: 503 });
    const intendedUse = String(body.intendedUse ?? "professional-client-tattoo");
    if (!["professional-client-tattoo", "personal-reference"].includes(intendedUse)) return NextResponse.json({ error: "Choose a valid intended use." }, { status: 400 });
    const placementNote = String(body.placementNote ?? "").trim().slice(0, 500);
    const variant = design.sizes[size];
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: Math.round(variant.price * 100), product_data: { name: `${design.title} — ${variant.label}`, description: variant.details, metadata: { product_slug: design.slug, size } } } }],
      billing_address_collection: "auto",
      customer_creation: "always",
      custom_fields: [
        { key: "customer_name", label: { type: "custom", custom: "Full name" }, type: "text", optional: false, text: { maximum_length: 120 } },
        { key: "placement_note", label: { type: "custom", custom: "Optional placement note" }, type: "text", optional: true, text: { maximum_length: 500 } },
      ],
      success_url: `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled#gallery`,
      metadata: { purchase_type: "design", product_slug: design.slug, size, intended_use: intendedUse, intended_use_confirmed: "true", placement_note: placementNote, download_object: downloadObject },
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout creation failed:", error);
    const message = error instanceof Error ? error.message : "Unable to start secure checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
