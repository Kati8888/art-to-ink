import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sendTransactionalEmail } from "@/lib/brevo";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} server environment variable.`);
  return value;
}

function siteOrigin(): string {
  const url = new URL(requiredEnv("NEXT_PUBLIC_SITE_URL"));
  if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS.");
  return url.origin;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] ?? character));
}

function lineMetadata(line: Stripe.LineItem): Record<string, string> {
  const product = line.price?.product;
  if (!product || typeof product === "string" || product.deleted) return {};
  return product.metadata ?? {};
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, requiredEnv("STRIPE_WEBHOOK_SECRET"));
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") return NextResponse.json({ received: true, ignored: true });

  const sessionEvent = event.data.object as Stripe.Checkout.Session;
  if (sessionEvent.payment_status !== "paid" && sessionEvent.payment_status !== "no_payment_required") return NextResponse.json({ received: true, awaitingPayment: true });
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionEvent.id, { expand: ["line_items.data.price.product"] });
    const email = session.customer_details?.email ?? session.customer_email;
    if (!email) throw new Error("Completed Checkout Session has no customer email.");
    const supabase = getSupabaseAdmin();
    const { data: existingEvent, error: eventLookupError } = await supabase.from("stripe_events").select("id,processed_at").eq("id", event.id).maybeSingle();
    if (eventLookupError) throw eventLookupError;
    if (existingEvent?.processed_at) return NextResponse.json({ received: true, duplicate: true });
    const { error: eventInsertError } = await supabase.from("stripe_events").upsert({ id: event.id, event_type: event.type, payload: event, processed_at: null }, { onConflict: "id" });
    if (eventInsertError) throw eventInsertError;

    const lines = session.line_items?.data ?? [];
    if (!lines.length) throw new Error("Completed Checkout Session has no line items.");
    const metadata = session.metadata ?? {};
    const firstDesign = lines.map(lineMetadata).find((item) => item.item_type === "design");
    const firstLicense = lines.map(lineMetadata).find((item) => item.item_type === "license");
    const purchaseType = firstDesign ? "design" : "license";
    const safeVariant = firstDesign?.variant_key && ["mini", "small", "detailed", "premium"].includes(firstDesign.variant_key) ? firstDesign.variant_key : "detailed";
    const orderPayload = {
      stripe_checkout_session_id: session.id,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
      customer_email: email,
      customer_name: metadata.customer_name ?? session.customer_details?.name ?? null,
      customer_phone: metadata.customer_phone ?? null,
      purchase_type: purchaseType,
      product_slug: firstDesign?.product_slug ?? null,
      variant: firstDesign ? safeVariant : null,
      license_id: firstLicense?.license_code ?? null,
      amount_total: session.amount_total,
      currency: session.currency,
      intended_use: metadata.customer_intent ?? null,
      intended_use_confirmed: metadata.intended_use_confirmed === "true",
      placement_note: metadata.placement_note ?? null,
      fulfillment_status: "processing",
      updated_at: new Date().toISOString(),
    };
    const { data: order, error: orderError } = await supabase.from("orders").upsert(orderPayload, { onConflict: "stripe_checkout_session_id" }).select("id,fulfillment_status").single();
    if (orderError) throw orderError;

    const orderItems = lines.map((line) => {
      const item = lineMetadata(line);
      return {
        order_id: order.id,
        product_id: item.product_id || null,
        variant_id: item.variant_id || null,
        asset_id: item.asset_id || null,
        license_package_id: item.license_id || null,
        quantity: line.quantity ?? 1,
        unit_amount: line.price?.unit_amount ?? 0,
        currency: line.price?.currency ?? session.currency ?? "eur",
        title_snapshot: line.description ?? "ART TO INK purchase",
        variant_snapshot: item.variant_key ?? null,
        artwork_format_snapshot: item.artwork_format ?? null,
        storage_object_path_snapshot: item.storage_object_path ?? null,
      };
    });
    const { error: itemError } = await supabase.from("order_items").upsert(orderItems, { onConflict: "id" });
    if (itemError) throw itemError;

    let downloadUrl: string | null = null;
    const hasMissingArtwork = lines.some((line) => lineMetadata(line).item_type === "design" && !lineMetadata(line).storage_object_path);
    if (firstDesign && !hasMissingArtwork) {
      const firstPath = firstDesign.storage_object_path;
      const bucket = requiredEnv("SUPABASE_DOWNLOAD_BUCKET");
      const slash = firstPath.lastIndexOf("/");
      const folder = slash >= 0 ? firstPath.slice(0, slash) : "";
      const fileName = slash >= 0 ? firstPath.slice(slash + 1) : firstPath;
      const { data: storedFiles, error: storageError } = await supabase.storage.from(bucket).list(folder, { limit: 100, search: fileName });
      if (storageError) throw storageError;
      if (!(storedFiles ?? []).some((file) => file.name === fileName)) throw new Error("Purchased artwork is not present in private storage.");
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const { error: deliveryError } = await supabase.from("orders").update({ download_token_hash: tokenHash, download_object_path: firstPath, download_expires_at: expiresAt }).eq("id", order.id);
      if (deliveryError) throw deliveryError;
      downloadUrl = `${siteOrigin()}/api/download/${token}`;
    }

    const from = process.env.BREVO_FROM_EMAIL ?? process.env.RESEND_FROM_EMAIL;
    if (!from) throw new Error("Missing BREVO_FROM_EMAIL or RESEND_FROM_EMAIL server environment variable.");
    const title = firstDesign?.product_slug ?? firstLicense?.license_code ?? "ART TO INK order";
    const downloadMessage = downloadUrl ? `Your private download link expires in seven days: ${downloadUrl}` : "Your secure artwork files are still being verified; no download is available yet.";
    await sendTransactionalEmail({
      sender: { email: from, name: "ART TO INK" },
      to: [email],
      subject: `ART TO INK order confirmed · ${title}`,
      htmlContent: `<p>Thank you for your ART TO INK purchase.</p><p><strong>Order:</strong> ${escapeHtml(session.id)}</p><p><strong>Items:</strong> ${lines.length}</p><p>${escapeHtml(downloadMessage)}</p><p>Your purchase grants only the rights stated in the applicable licence. Please do not resell or redistribute source files.</p>`,
      textContent: `Thank you for your ART TO INK purchase. Order ${session.id}. Items: ${lines.length}. ${downloadMessage}`,
      messageId: `art-to-ink-customer-${session.id}`,
    });

    const finalStatus = downloadUrl || firstLicense ? "fulfilled" : "processing";
    const { error: updateError } = await supabase.from("orders").update({ fulfillment_status: finalStatus, fulfilled_at: finalStatus === "fulfilled" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", order.id);
    if (updateError) throw updateError;
    const { error: eventUpdateError } = await supabase.from("stripe_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id);
    if (eventUpdateError) throw eventUpdateError;
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe fulfillment failed; Stripe should retry this webhook:", error);
    return NextResponse.json({ error: "Payment was received, but fulfillment needs a retry." }, { status: 500 });
  }
}
