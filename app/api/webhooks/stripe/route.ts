import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sendTransactionalEmail } from "@/lib/brevo";
import { getCommerceBindings } from "@/lib/cloudflare-commerce";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  customer_email: string;
  customer_name: string | null;
  status: string;
  items_json: string;
};

type CartItem = {
  productSlug: string;
  variantKey: string;
  format: "colour" | "blackAndWhite";
  quantity: number;
};

type VariantRow = {
  product_slug: string;
  product_title: string;
  variant_key: string;
  artwork_format: "colour" | "blackAndWhite";
  price_minor: number;
  currency: string;
  r2_object_key: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} server environment variable.`);
  return value;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      requiredEnv("STRIPE_WEBHOOK_SECRET"),
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  try {
    const { db, files } = await getCommerceBindings();
    await db.prepare("INSERT OR IGNORE INTO stripe_events (event_id, event_type) VALUES (?, ?)")
      .bind(event.id, event.type).run();

    const eventRow = await db.prepare("SELECT processed_at FROM stripe_events WHERE event_id = ?")
      .bind(event.id).first<{ processed_at: string | null }>();
    if (eventRow?.processed_at) return NextResponse.json({ received: true, duplicate: true });

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
      if (paymentIntentId && charge.refunded) {
        await db.prepare("UPDATE orders SET status = 'refunded' WHERE stripe_payment_intent_id = ?")
          .bind(paymentIntentId).run();
        await db.prepare("UPDATE download_links SET revoked_at = CURRENT_TIMESTAMP WHERE order_id IN (SELECT id FROM orders WHERE stripe_payment_intent_id = ?)")
          .bind(paymentIntentId).run();
      }
      await db.prepare("UPDATE stripe_events SET processed_at = CURRENT_TIMESTAMP WHERE event_id = ?").bind(event.id).run();
      return NextResponse.json({ received: true });
    }

    if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
      await db.prepare("UPDATE stripe_events SET processed_at = CURRENT_TIMESTAMP WHERE event_id = ?").bind(event.id).run();
      return NextResponse.json({ received: true, ignored: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
      return NextResponse.json({ received: true, awaitingPayment: true });
    }

    const order = await db.prepare(`
      SELECT id, customer_email, customer_name, status, items_json
      FROM orders WHERE stripe_checkout_session_id = ? LIMIT 1
    `).bind(session.id).first<OrderRow>();
    if (!order) throw new Error("No pending D1 order exists for this Stripe Checkout Session.");
    if (order.status === "fulfilled") {
      await db.prepare("UPDATE stripe_events SET processed_at = CURRENT_TIMESTAMP WHERE event_id = ?").bind(event.id).run();
      return NextResponse.json({ received: true, duplicate: true });
    }
    if (order.status === "refunded") {
      await db.prepare("UPDATE stripe_events SET processed_at = CURRENT_TIMESTAMP WHERE event_id = ?").bind(event.id).run();
      return NextResponse.json({ received: true, refunded: true });
    }

    const email = session.customer_details?.email ?? session.customer_email ?? order.customer_email;
    if (!email) throw new Error("The paid Stripe session has no customer email.");
    const items = JSON.parse(order.items_json) as CartItem[];
    if (!Array.isArray(items) || items.length < 1) throw new Error("The saved order has no line items.");

    const clauses = items.map(() => "(v.product_slug = ? AND v.variant_key = ? AND v.artwork_format = ?)").join(" OR ");
    const values = items.flatMap(item => [item.productSlug, item.variantKey, item.format]);
    const catalogue = await db.prepare(`
      SELECT v.product_slug, p.title AS product_title, v.variant_key, v.artwork_format,
             v.price_minor, v.currency, v.r2_object_key
      FROM product_variants v JOIN products p ON p.slug = v.product_slug
      WHERE v.active = 1 AND p.active = 1 AND (${clauses})
    `).bind(...values).all<VariantRow>();
    const variants = catalogue.results ?? [];
    if (variants.length !== items.length) throw new Error("One or more purchased variants are no longer published.");

    const downloadRows: Array<{ token: string; key: string; fileName: string; title: string }> = [];
    for (const item of items) {
      const variant = variants.find(row => row.product_slug === item.productSlug &&
        row.variant_key === item.variantKey && row.artwork_format === item.format);
      if (!variant) throw new Error("A purchased variant could not be resolved.");
      const stored = await files.head(variant.r2_object_key);
      if (!stored || stored.size <= 0) throw new Error(`Paid artwork is missing from private KV storage: ${variant.r2_object_key}`);
      for (let quantity = 0; quantity < item.quantity; quantity += 1) {
        const token = randomBytes(32).toString("base64url");
        downloadRows.push({
          token,
          key: variant.r2_object_key,
          fileName: variant.r2_object_key.split("/").pop() || "art-to-ink-artwork",
          title: variant.product_title,
        });
      }
    }

    await db.prepare(`
      UPDATE orders SET status = 'paid',
        stripe_payment_intent_id = ?, stripe_customer_id = ?,
        amount_total = ?, currency = ?
      WHERE id = ?
    `).bind(
      typeof session.payment_intent === "string" ? session.payment_intent : null,
      typeof session.customer === "string" ? session.customer : null,
      session.amount_total ?? 0,
      session.currency ?? "eur",
      order.id,
    ).run();

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const insertLinks = downloadRows.map(row => db.prepare(`
      INSERT INTO download_links (token_hash, order_id, r2_object_key, file_name, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(createHash("sha256").update(row.token).digest("hex"), order.id, row.key, row.fileName, expiresAt));
    if (insertLinks.length) await db.batch(insertLinks);

    const siteUrl = new URL(requiredEnv("NEXT_PUBLIC_SITE_URL")).origin;
    const linksHtml = downloadRows.map(row =>
      `<li style="margin:12px 0"><strong>${escapeHtml(row.title)}</strong><br/><a href="${siteUrl}/api/download/${row.token}">Download your artwork</a></li>`
    ).join("");
    const senderEmail = requiredEnv("BREVO_FROM_EMAIL");
    await sendTransactionalEmail({
      sender: { email: senderEmail, name: "ART TO INK" },
      to: [{ email, name: order.customer_name ?? session.customer_details?.name ?? undefined }],
      subject: "Your ART TO INK artwork is ready",
      htmlContent: `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f5f0e7;color:#17130d;padding:28px"><main style="max-width:600px;margin:auto;background:#fffdf8;padding:32px"><p style="letter-spacing:3px;color:#9a762f">ART TO INK</p><h1>Your artwork is ready.</h1><p>Thank you. Your payment has been confirmed. Your private download links are available for seven days.</p><ul>${linksHtml}</ul><p>For help with your order, reply to this email.</p></main></body></html>`,
      textContent: `Thank you for your ART TO INK order. Your private download links are available for seven days:\n${downloadRows.map(row => row.title + ": " + siteUrl + "/api/download/" + row.token).join("\n")}`,
      messageId: `art-to-ink-order-${order.id}`,
    });

    await db.prepare("UPDATE orders SET status = 'fulfilled', fulfilled_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(order.id).run();
    await db.prepare("UPDATE stripe_events SET processed_at = CURRENT_TIMESTAMP WHERE event_id = ?")
      .bind(event.id).run();

    return NextResponse.json({ received: true, fulfilled: true });
  } catch (error) {
    console.error("Stripe order fulfillment failed:", error);
    return NextResponse.json({ error: "Order fulfillment failed and requires a Stripe retry." }, { status: 500 });
  }
}
