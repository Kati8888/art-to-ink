import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import { getSecureDownloadObject, type ArtworkFormat } from "@/lib/secure-assets";
import { DESIGN_SIZE_ORDER, type DesignSize } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} server environment variable.`);
  return value;
}

function safeSiteOrigin(): string {
  const raw = requiredEnv("NEXT_PUBLIC_SITE_URL");
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS.");
  return url.origin;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = getStripe().webhooks.constructEvent(rawBody, signature, requiredEnv("STRIPE_WEBHOOK_SECRET"));
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return NextResponse.json({ received: true, ignored: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return NextResponse.json({ received: true, awaitingPayment: true });
  }
  if (!session.customer_details?.email && !session.customer_email) {
    console.error("Completed Checkout Session has no customer email:", session.id);
    return NextResponse.json({ error: "Customer email missing from completed session." }, { status: 500 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const email = session.customer_details?.email ?? session.customer_email!;
    const purchaseType = session.metadata?.purchase_type;
    if (purchaseType !== "design" && purchaseType !== "license") throw new Error("Checkout Session is missing a valid purchase_type metadata value.");
    const baseOrder = {
      stripe_checkout_session_id: session.id,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
      customer_email: email,
      customer_name: session.customer_details?.name ?? session.custom_fields?.find((field) => field.key === "customer_name")?.text?.value ?? null,
      purchase_type: purchaseType,
      product_slug: session.metadata?.productId ?? session.metadata?.product_slug ?? null,
      variant: (session.metadata?.variantId?.replace(/^var_/, "") ?? session.metadata?.size ?? null),
      artwork_format: session.metadata?.artworkFormat ?? null,
      license_id: session.metadata?.license_id ?? null,
      amount_total: session.amount_total,
      currency: session.currency,
      intended_use: session.metadata?.customerIntent ?? session.metadata?.intended_use ?? null,
      intended_use_confirmed: session.metadata?.intended_use_confirmed === "true",
      placement_note: session.custom_fields?.find((field) => field.key === "placement_note")?.text?.value || session.metadata?.placementNote || session.metadata?.placement_note || null,
      fulfillment_status: "processing",
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: lookupError } = await supabase.from("orders").select("id,fulfillment_status,download_token_hash,download_expires_at").eq("stripe_checkout_session_id", session.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing?.fulfillment_status === "fulfilled" || existing?.fulfillment_status === "license_active") return NextResponse.json({ received: true, duplicate: true });

    let token: string | null = null;
    let downloadExpiresAt: string | null = null;
    let downloadUrl: string | null = null;
    if (purchaseType === "design") {
      const productId = session.metadata?.productId ?? session.metadata?.product_slug;
      const rawVariantId = session.metadata?.variantId ?? session.metadata?.size;
      const size = (rawVariantId?.replace(/^var_/, "") ?? "") as DesignSize;
      const format = (session.metadata?.artworkFormat ?? "colour") as ArtworkFormat;
      if (!productId || !DESIGN_SIZE_ORDER.includes(size) || !["colour", "blackAndWhite"].includes(format)) {
        throw new Error("Verified Checkout Session is missing valid product, variant, or format metadata.");
      }
      const objectPath = getSecureDownloadObject(productId, size, format);
      if (!objectPath || objectPath.startsWith("/") || objectPath.split("/").includes("..")) {
        throw new Error("Secure download object is not configured for this product variant.");
      }
      const bucket = requiredEnv("SUPABASE_DOWNLOAD_BUCKET");
      const slash = objectPath.lastIndexOf("/");
      const folder = slash >= 0 ? objectPath.slice(0, slash) : "";
      const fileName = slash >= 0 ? objectPath.slice(slash + 1) : objectPath;
      const { data: storedFiles, error: storageError } = await supabase.storage.from(bucket).list(folder, { limit: 100, search: fileName });
      if (storageError) throw storageError;
      if (!(storedFiles ?? []).some((file) => file.name === fileName)) throw new Error("Purchased artwork is not present in private storage.");
      token = randomBytes(32).toString("base64url");
      downloadExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const { error: orderError } = await supabase.from("orders").upsert({ ...baseOrder, download_token_hash: tokenHash, download_object_path: objectPath, download_expires_at: downloadExpiresAt }, { onConflict: "stripe_checkout_session_id" });
      if (orderError) throw orderError;
      downloadUrl = `${safeSiteOrigin()}/api/download/${token}`;
    } else {
      const { error: orderError } = await supabase.from("orders").upsert({ ...baseOrder, fulfillment_status: "license_active" }, { onConflict: "stripe_checkout_session_id" });
      if (orderError) throw orderError;
    }

    const resend = new Resend(requiredEnv("RESEND_API_KEY"));
    const from = requiredEnv("RESEND_FROM_EMAIL");
    const subject = purchaseType === "design" ? "Your ART TO INK artwork is ready" : "Your ART TO INK studio licence is active";
    const html = purchaseType === "design"
      ? `<div style="font-family:Arial,sans-serif;color:#17130d;max-width:600px;margin:auto"><h1>Thank you for supporting original artwork!</h1><p>Your payment has been confirmed. Your tattoo files are ready.</p><p>Your secure artwork download link is valid for seven days.</p><p><a href="${downloadUrl}" style="display:inline-block;padding:14px 20px;background:#d5a957;color:#080807;text-decoration:none">Download your artwork</a></p><p>Please save your file securely and share it only as permitted by your licence.</p><p>Thank you personally for supporting my original artwork.</p><p>With gratitude,<br/>Kateřina Pohnetalová<br/>ART TO INK</p></div>`
      : `<div style="font-family:Arial,sans-serif;color:#17130d;max-width:600px;margin:auto"><h1>Thank you for choosing ART TO INK.</h1><p>Your payment has been confirmed and your studio licence is active.</p><p>Licence: <strong>${session.metadata?.license_id ?? "Studio licence"}</strong></p><p>Keep this email as your purchase confirmation. The licence is non-exclusive and does not transfer copyright.</p><p>Kateřina Pohnetalová · ART TO INK</p></div>`;
    const { error: emailError } = await resend.emails.send({ from, to: email, subject, html, idempotencyKey: `art-to-ink-customer-${session.id}` });
    if (emailError) throw new Error(`Transactional customer email failed: ${emailError.message}`);

    // Send the shop owner a separate order notification without exposing the secure download token.
    try {
      const ownerEmail = "katerina.pohnetalova@seznam.cz";
      const amount = typeof session.amount_total === "number" ? (session.amount_total / 100).toFixed(2) : "not available";
      const currency = (session.currency ?? "eur").toUpperCase();
      const item = purchaseType === "license"
        ? `Studio licence: ${session.metadata?.license_id ?? "ART TO INK licence"}`
        : `${session.metadata?.product_slug ?? session.metadata?.productId ?? "Tattoo artwork"} · ${session.metadata?.variantId?.replace(/^var_/, "") ?? session.metadata?.size ?? "design"} · ${session.metadata?.artworkFormat === "blackAndWhite" ? "black & white" : "colour"}`;
      const ownerHtml = `<div style="font-family:Arial,sans-serif;color:#17130d;max-width:600px;margin:auto"><h1>New paid order · ART TO INK</h1><p>A Stripe payment has been confirmed.</p><p><strong>Item:</strong> ${item}</p><p><strong>Amount:</strong> ${amount} ${currency}</p><p><strong>Customer:</strong> ${email}</p><p><strong>Intended use:</strong> ${session.metadata?.customerIntent ?? session.metadata?.intended_use ?? "not specified"}</p><p><strong>Checkout session:</strong> ${session.id}</p></div>`;
      const { error: ownerEmailError } = await resend.emails.send({
        from,
        to: ownerEmail,
        subject: `Nová zaplacená objednávka ART TO INK · ${amount} ${currency}`,
        html: ownerHtml,
        text: `Nová zaplacená objednávka ART TO INK. Položka: ${item}. Částka: ${amount} ${currency}. Zákazník: ${email}. Session: ${session.id}.`,
        idempotencyKey: `art-to-ink-owner-order-${session.id}`,
      });
      if (ownerEmailError) console.error("ART TO INK owner notification failed:", ownerEmailError.message);
    } catch (ownerNotificationError) {
      console.error("ART TO INK owner notification failed:", ownerNotificationError);
    }

    const { error: updateError } = await supabase.from("orders").update({ fulfillment_status: purchaseType === "design" ? "fulfilled" : "license_active", fulfilled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("stripe_checkout_session_id", session.id);
    if (updateError) throw updateError;
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe fulfillment failed; Stripe should retry this webhook:", error);
    return NextResponse.json({ error: "Payment was received, but fulfillment needs a retry. No public download URL was exposed." }, { status: 500 });
  }
}
