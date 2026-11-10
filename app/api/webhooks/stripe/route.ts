import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sendTransactionalEmail } from "@/lib/brevo";
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

async function sendEmailOnce(
  db: ReturnType<typeof getSupabaseAdmin>,
  deliveryKey: string,
  orderId: string,
  emailType: string,
  recipientEmail: string,
  send: () => Promise<{ messageId?: string }>,
) {
  const { data: prior, error: lookupError } = await db.from("email_deliveries")
    .select("id,sent_at").eq("delivery_key", deliveryKey).maybeSingle();
  if (lookupError) throw lookupError;
  if (prior?.sent_at) return;
  if (!prior) {
    const { error } = await db.from("email_deliveries").insert({
      delivery_key: deliveryKey, order_id: orderId, email_type: emailType, recipient_email: recipientEmail,
    });
    if (error && error.code !== "23505") throw error;
  }
  try {
    const result = await send();
    const { error } = await db.from("email_deliveries").update({
      sent_at: new Date().toISOString(), provider_message_id: result.messageId ?? null, error_message: null,
    }).eq("delivery_key", deliveryKey);
    if (error) throw error;
  } catch (error) {
    await db.from("email_deliveries").update({
      error_message: error instanceof Error ? error.message.slice(0, 1000) : "Email delivery failed",
    }).eq("delivery_key", deliveryKey);
    throw error;
  }
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

  if (event.type === "charge.refunded") {
    try {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
      if (!paymentIntentId) return NextResponse.json({ received: true, ignored: true });
      const db = getSupabaseAdmin();
      const { data: refundedOrder, error } = await db.from("orders")
        .update({ refunded_at: new Date().toISOString(), refund_amount: charge.amount_refunded, fulfillment_status: "refunded", updated_at: new Date().toISOString() })
        .eq("stripe_payment_intent_id", paymentIntentId).select("id").maybeSingle();
      if (error) throw error;
      if (refundedOrder?.id) {
        await Promise.all([
          db.from("customer_licenses").update({ status: "refunded", updated_at: new Date().toISOString() }).eq("order_id", refundedOrder.id),
          db.from("download_entitlements").update({ revoked_at: new Date().toISOString() }).eq("order_id", refundedOrder.id),
        ]);
      }
      return NextResponse.json({ received: true, refundProcessed: Boolean(refundedOrder?.id) });
    } catch (error) {
      console.error("Stripe refund processing failed:", error);
      return NextResponse.json({ error: "Refund status could not be synchronized." }, { status: 500 });
    }
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
      stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
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
    if (existing?.fulfillment_status === "fulfilled") return NextResponse.json({ received: true, duplicate: true });
    if (existing?.fulfillment_status === "license_active") {
      const { data: existingLicences, error: licenceLookupError } = await supabase.from("customer_licenses").select("id").eq("order_id", existing.id).limit(1);
      if (licenceLookupError) throw licenceLookupError;
      if (existingLicences?.length) return NextResponse.json({ received: true, duplicate: true });
    }

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
      const { data: designOrder, error: designOrderError } = await supabase.from("orders").select("id").eq("stripe_checkout_session_id", session.id).single();
      if (designOrderError || !designOrder) throw designOrderError ?? new Error("Design order record is missing.");
      const { data: productRow, error: productRowError } = await supabase.from("commerce_products").select("id").eq("slug", purchasedDesign?.slug ?? productId).single();
      if (productRowError || !productRow) throw productRowError ?? new Error("Design catalogue record is missing.");
      const { data: variantRow, error: variantRowError } = await supabase.from("commerce_variants").select("id").eq("product_id", productRow.id).eq("variant_key", size).single();
      if (variantRowError || !variantRow) throw variantRowError ?? new Error("Design size catalogue record is missing.");
      const { error: itemError } = await supabase.from("order_items").upsert({
        order_id: designOrder.id, product_id: productRow.id, variant_id: variantRow.id,
        asset_id: null, license_package_id: null, quantity: 1,
        unit_amount: session.amount_total ?? 0, currency: session.currency ?? "eur",
        title_snapshot: purchasedDesign?.title ?? productId, variant_snapshot: size,
        artwork_format_snapshot: format, storage_object_path_snapshot: objectPath,
      }, { onConflict: "order_id,product_id,variant_id,license_package_id,artwork_format_snapshot" });
      if (itemError) throw itemError;
      downloadUrl = `${safeSiteOrigin()}/api/download/${token}`;
    } else {
      const { error: orderError } = await supabase.from("orders").upsert({ ...baseOrder, fulfillment_status: "processing" }, { onConflict: "stripe_checkout_session_id" });
      if (orderError) throw orderError;
      const licenseId = session.metadata?.license_id ?? "";
      const selectedLicense = LICENSES.find((item) => item.id === licenseId);
      if (!selectedLicense) throw new Error("Paid licence purchase has an unknown licence package.");
      const packageCode = licenseId === "artist" ? "starter" : licenseId === "studio" ? "professional" : "studio";
      const { data: packageRow, error: packageError } = await supabase.from("license_packages")
        .select("id,credit_limit,validity_months").eq("code", packageCode).eq("active", true).single();
      if (packageError || !packageRow) throw packageError ?? new Error("Licence package is not configured in Supabase.");
      const startsAt = new Date();
      const expiresAt = new Date(startsAt);
      expiresAt.setUTCMonth(expiresAt.getUTCMonth() + Number(packageRow.validity_months ?? 12));
      const { data: licenceOrder, error: licenceOrderError } = await supabase.from("orders")
        .select("id").eq("stripe_checkout_session_id", session.id).single();
      if (licenceOrderError || !licenceOrder) throw licenceOrderError ?? new Error("Licence order record is missing.");
      const { error: createLicenceError } = await supabase.from("customer_licenses").upsert({
        customer_id: null,
        customer_email: email.toLowerCase(),
        order_id: licenceOrder.id,
        license_package_id: packageRow.id,
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        purchased_credits: packageRow.credit_limit,
        used_credits: 0,
        status: "active",
      }, { onConflict: "order_id,license_package_id", ignoreDuplicates: true });
      if (createLicenceError) throw createLicenceError;
      const { error: licenceItemError } = await supabase.from("order_items").upsert({
        order_id: licenceOrder.id, product_id: null, variant_id: null, asset_id: null,
        license_package_id: packageRow.id, quantity: 1,
        unit_amount: session.amount_total ?? 0, currency: session.currency ?? "eur",
        title_snapshot: selectedLicense.title, variant_snapshot: null,
        artwork_format_snapshot: null, storage_object_path_snapshot: null,
      }, { onConflict: "order_id,product_id,variant_id,license_package_id,artwork_format_snapshot" });
      if (licenceItemError) throw licenceItemError;
    }

    const { data: emailOrder, error: emailOrderError } = await supabase.from("orders").select("id").eq("stripe_checkout_session_id", session.id).single();
    if (emailOrderError || !emailOrder) throw emailOrderError ?? new Error("Order record missing for email delivery.");
    const from = process.env.BREVO_FROM_EMAIL ?? process.env.RESEND_FROM_EMAIL;
    if (!from) throw new Error("Missing BREVO_FROM_EMAIL server environment variable.");
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
      ? `<!doctype html><html><body style="margin:0;background:#f5f0e7;color:#17130d;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f0e7;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fffdf8;border:1px solid #e4d6bd"><tr><td style="padding:32px"><p style="font-size:12px;letter-spacing:3px;color:#9a762f">ART TO INK · ORIGINAL ARTWORK</p><h1 style="font-family:Georgia,serif;font-weight:400;font-size:32px">Your artwork is ready.</h1><p>Thank you for supporting original artwork by Kateřina Pohnetalová. Your payment has been confirmed.</p><h2 style="font-family:Georgia,serif;font-weight:400">${purchasedDesign?.title ?? "Your selected design"}</h2>${purchasedDesign ? `<p><img src="${purchasedDesign.media[format]}" alt="${purchasedDesign.title} tattoo artwork preview" width="520" style="display:block;width:100%;max-width:520px;height:auto;border:0"/></p>` : ""}<p><strong>Package:</strong> ${variantInfo?.label ?? variantKey}<br/><strong>File:</strong> ${format === "colour" ? "Colour" : "Black & white"}</p><p>${variantInfo?.details ?? "Digital artwork file."}</p><p>Your private download link expires in seven days. If it expires before you download the file, reply to this email and we can help.</p><p><a href="${downloadUrl}" style="display:inline-block;padding:15px 22px;background:#d5a957;color:#080807;text-decoration:none;font-weight:bold">DOWNLOAD YOUR ARTWORK</a></p><p style="font-size:13px;color:#655b4d">Your purchase grants only the rights stated in the applicable licence. Please do not resell, redistribute, or publicly share the source file.</p><p>With gratitude,<br/>Kateřina Pohnetalová<br/>ART TO INK</p><p style="font-size:12px"><a href="${safeSiteOrigin()}" style="color:#806126">Visit ART TO INK</a></p></td></tr></table></td></tr></table></body></html>`
      : `<!doctype html><html><body style="margin:0;background:#f5f0e7;color:#17130d;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f0e7;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fffdf8;border:1px solid #e4d6bd"><tr><td style="padding:32px"><p style="font-size:12px;letter-spacing:3px;color:#9a762f">ART TO INK · STUDIO LICENSING</p><h1 style="font-family:Georgia,serif;font-weight:400;font-size:32px">Thank you for choosing ART TO INK.</h1><p>Your payment has been confirmed. Keep this email as your purchase record.</p><h2 style="font-family:Georgia,serif;font-weight:400">${license?.title ?? "Studio licence"}</h2><p><strong>Annual price:</strong> €${license?.price ?? "—"}<br/><strong>Scope:</strong> ${license?.allowance ?? "As specified in your licence"}<br/><strong>Team/location:</strong> ${license?.audience ?? "As specified in your licence"}</p><p>This licence is non-exclusive and does not transfer copyright. Use is limited to the stated designs, artist count, and studio location. Source files may not be resold or redistributed.</p><p>For your records, payment reference: ${session.id}</p><p>If you need to register the artists using the licence or clarify its scope, reply to this email before using the artwork commercially.</p><p>Kateřina Pohnetalová<br/>ART TO INK</p><p style="font-size:12px"><a href="${safeSiteOrigin()}" style="color:#806126">Visit ART TO INK</a></p></td></tr></table></td></tr></table></body></html>`;
    await sendEmailOnce(supabase, `customer:${session.id}`, emailOrder.id, "customer_receipt", email, async () => sendTransactionalEmail({
      sender: { email: from, name: "ART TO INK" },
      to: [email],
      subject,
      htmlContent: html,
      textContent: purchaseType === "design"
        ? `Your ART TO INK artwork is ready. Design: ${purchasedDesign?.title ?? productId}. Package: ${variantInfo?.label ?? variantKey}. Format: ${format === "colour" ? "Colour" : "Black & white"}. Your private download link expires in seven days: ${downloadUrl}. Thank you, Kateřina Pohnetalová, ART TO INK.`
        : `Your ART TO INK studio licence payment is confirmed. Licence: ${license?.title ?? licenseId}. Annual price: €${license?.price ?? "—"}. Scope: ${license?.allowance ?? "see licence terms"}. This licence is non-exclusive and does not transfer copyright. Payment reference: ${session.id}. Reply to this email for registration or questions.`,
      messageId: `art-to-ink-customer-${session.id}`,
    }));

    // Send the shop owner a separate order notification without exposing the secure download token.
    try {
      const ownerEmail = "katerina.pohnetalova@seznam.cz";
      const amount = typeof session.amount_total === "number" ? (session.amount_total / 100).toFixed(2) : "not available";
      const currency = (session.currency ?? "eur").toUpperCase();
      const item = purchaseType === "license"
        ? `Studio licence: ${session.metadata?.license_id ?? "ART TO INK licence"}`
        : `${session.metadata?.product_slug ?? session.metadata?.productId ?? "Tattoo artwork"} · ${session.metadata?.variantId?.replace(/^var_/, "") ?? session.metadata?.size ?? "design"} · ${session.metadata?.artworkFormat === "blackAndWhite" ? "black & white" : "colour"}`;
      const ownerHtml = `<div style="font-family:Arial,sans-serif;color:#17130d;max-width:600px;margin:auto"><h1>New paid order · ART TO INK</h1><p>A Stripe payment has been confirmed.</p><p><strong>Item:</strong> ${item}</p><p><strong>Amount:</strong> ${amount} ${currency}</p><p><strong>Customer:</strong> ${session.metadata?.customer_name ?? session.customer_details?.name ?? "Not provided"} (${email})</p><p><strong>Phone:</strong> ${session.metadata?.customer_phone ?? "Not provided"}</p><p><strong>Intended use:</strong> ${session.metadata?.customerIntent ?? session.metadata?.intended_use ?? "not specified"}</p><p><strong>Checkout session:</strong> ${session.id}</p></div>`;
      await sendEmailOnce(supabase, `owner:${session.id}`, emailOrder.id, "owner_order_notification", ownerEmail, async () => sendTransactionalEmail({
        sender: { email: from, name: "ART TO INK" },
        to: [ownerEmail],
        subject: `Nová zaplacená objednávka ART TO INK · ${amount} ${currency}`,
        htmlContent: ownerHtml,
        textContent: `Nová zaplacená objednávka ART TO INK. Položka: ${item}. Částka: ${amount} ${currency}. Zákazník: ${session.metadata?.customer_name ?? session.customer_details?.name ?? "Not provided"}. E-mail: ${email}. Telefon: ${session.metadata?.customer_phone ?? "Not provided"}. Session: ${session.id}.`,
        messageId: `art-to-ink-owner-order-${session.id}`,
      }));
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
