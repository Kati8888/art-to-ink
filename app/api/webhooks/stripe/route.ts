import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import { getSecureDownloadObject, type ArtworkFormat } from "@/lib/secure-assets";
import { DESIGN_SIZE_ORDER, LICENSES, type DesignSize } from "@/lib/products";
import { tattooDesigns } from "@/lib/mock-data";

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
      customer_name: session.metadata?.customer_name ?? session.customer_details?.name ?? session.custom_fields?.find((field) => field.key === "customer_name")?.text?.value ?? null,
      customer_phone: session.metadata?.customer_phone ?? null,
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
    const productId = session.metadata?.productId ?? session.metadata?.product_slug ?? "";
    const purchasedDesign = purchaseType === "design" ? tattooDesigns.find((item) => item.id === productId || item.slug === productId) : undefined;
    const format = session.metadata?.artworkFormat === "blackAndWhite" ? "blackAndWhite" : "colour";
    const variantKey = (session.metadata?.variantId?.replace(/^var_/, "") ?? session.metadata?.size ?? "detailed") as DesignSize;
    const variantInfo = purchasedDesign?.sizes[variantKey];
    const licenseId = session.metadata?.license_id ?? "";
    const license = LICENSES.find((item) => item.id === licenseId);
    const subject = purchaseType === "design"
      ? `Your ${purchasedDesign?.title ?? "ART TO INK"} artwork is ready`
      : "Your ART TO INK studio licence — payment confirmed";
    const html = purchaseType === "design"
      ? `<!doctype html><html><body style="margin:0;background:#f5f0e7;color:#17130d;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f0e7;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fffdf8;border:1px solid #e4d6bd"><tr><td style="padding:32px"><p style="font-size:12px;letter-spacing:3px;color:#9a762f">ART TO INK · ORIGINAL ARTWORK</p><h1 style="font-family:Georgia,serif;font-weight:400;font-size:32px">Your artwork is ready.</h1><p>Thank you for supporting original artwork by Kateřina Pohnetalová. Your payment has been confirmed.</p><h2 style="font-family:Georgia,serif;font-weight:400">${purchasedDesign?.title ?? "Your selected design"}</h2>${purchasedDesign ? `<p><img src="${purchasedDesign.media[format]}" alt="${purchasedDesign.title} tattoo artwork preview" width="520" style="display:block;width:100%;max-width:520px;height:auto;border:0"/></p>` : ""}<p><strong>Package:</strong> ${variantInfo?.label ?? variantKey}<br/><strong>File:</strong> ${format === "colour" ? "Colour" : "Black & white"}</p><p>Your private download link expires in seven days. If it expires before you download the file, reply to this email and we can help.</p><p><a href="${downloadUrl}" style="display:inline-block;padding:15px 22px;background:#d5a957;color:#080807;text-decoration:none;font-weight:bold">DOWNLOAD YOUR ARTWORK</a></p><p style="font-size:13px;color:#655b4d">Your purchase grants only the rights stated in the applicable licence. Please do not resell, redistribute, or publicly share the source file.</p><p>With gratitude,<br/>Kateřina Pohnetalová<br/>ART TO INK</p><p style="font-size:12px"><a href="${safeSiteOrigin()}" style="color:#806126">Visit ART TO INK</a></p></td></tr></table></td></tr></table></body></html>`
      : `<!doctype html><html><body style="margin:0;background:#f5f0e7;color:#17130d;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f0e7;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fffdf8;border:1px solid #e4d6bd"><tr><td style="padding:32px"><p style="font-size:12px;letter-spacing:3px;color:#9a762f">ART TO INK · STUDIO LICENSING</p><h1 style="font-family:Georgia,serif;font-weight:400;font-size:32px">Thank you for choosing ART TO INK.</h1><p>Your payment has been confirmed. Keep this email as your purchase record.</p><h2 style="font-family:Georgia,serif;font-weight:400">${license?.title ?? "Studio licence"}</h2><p><strong>Annual price:</strong> €${license?.price ?? "—"}<br/><strong>Scope:</strong> ${license?.allowance ?? "As specified in your licence"}<br/><strong>Team/location:</strong> ${license?.audience ?? "As specified in your licence"}</p><p>This licence is non-exclusive and does not transfer copyright. Use is limited to the stated designs, artist count, and studio location. Source files may not be resold or redistributed.</p><p>For your records, payment reference: ${session.id}</p><p>If you need to register the artists using the licence or clarify its scope, reply to this email before using the artwork commercially.</p><p>Kateřina Pohnetalová<br/>ART TO INK</p><p style="font-size:12px"><a href="${safeSiteOrigin()}" style="color:#806126">Visit ART TO INK</a></p></td></tr></table></td></tr></table></body></html>`;
    const { error: emailError } = await resend.emails.send({
      from, to: email, subject, html,
      text: purchaseType === "design"
        ? `Your ART TO INK artwork is ready. Design: ${purchasedDesign?.title ?? productId}. Package: ${variantInfo?.label ?? variantKey}. Format: ${format === "colour" ? "Colour" : "Black & white"}. Your private download link expires in seven days: ${downloadUrl}. Thank you, Kateřina Pohnetalová, ART TO INK.`
        : `Your ART TO INK studio licence payment is confirmed. Licence: ${license?.title ?? licenseId}. Annual price: €${license?.price ?? "—"}. Scope: ${license?.allowance ?? "see licence terms"}. This licence is non-exclusive and does not transfer copyright. Payment reference: ${session.id}. Reply to this email for registration or questions.`
    }, { idempotencyKey: `art-to-ink-customer-${session.id}` });
    if (emailError) throw new Error(`Transactional customer email failed: ${emailError.message}`);

    // Send the shop owner a separate order notification without exposing the secure download token.
    try {
      const ownerEmail = "katerina.pohnetalova@seznam.cz";
      const amount = typeof session.amount_total === "number" ? (session.amount_total / 100).toFixed(2) : "not available";
      const currency = (session.currency ?? "eur").toUpperCase();
      const item = purchaseType === "license"
        ? `Studio licence: ${session.metadata?.license_id ?? "ART TO INK licence"}`
        : `${session.metadata?.product_slug ?? session.metadata?.productId ?? "Tattoo artwork"} · ${session.metadata?.variantId?.replace(/^var_/, "") ?? session.metadata?.size ?? "design"} · ${session.metadata?.artworkFormat === "blackAndWhite" ? "black & white" : "colour"}`;
      const ownerHtml = `<div style="font-family:Arial,sans-serif;color:#17130d;max-width:600px;margin:auto"><h1>New paid order · ART TO INK</h1><p>A Stripe payment has been confirmed.</p><p><strong>Item:</strong> ${item}</p><p><strong>Amount:</strong> ${amount} ${currency}</p><p><strong>Customer:</strong> ${session.metadata?.customer_name ?? session.customer_details?.name ?? "Not provided"} (${email})</p><p><strong>Phone:</strong> ${session.metadata?.customer_phone ?? "Not provided"}</p><p><strong>Intended use:</strong> ${session.metadata?.customerIntent ?? session.metadata?.intended_use ?? "not specified"}</p><p><strong>Checkout session:</strong> ${session.id}</p></div>`;
      const { error: ownerEmailError } = await resend.emails.send({
        from,
        to: ownerEmail,
        subject: `Nová zaplacená objednávka ART TO INK · ${amount} ${currency}`,
        html: ownerHtml,
        text: `Nová zaplacená objednávka ART TO INK. Položka: ${item}. Částka: ${amount} ${currency}. Zákazník: ${session.metadata?.customer_name ?? session.customer_details?.name ?? "Not provided"}. E-mail: ${email}. Telefon: ${session.metadata?.customer_phone ?? "Not provided"}. Session: ${session.id}.`,
      }, { idempotencyKey: `art-to-ink-owner-order-${session.id}` });
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
