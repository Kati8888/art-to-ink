import { NextResponse } from "next/server";
import { getCommerceBindings } from "@/lib/cloudflare-commerce";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutItem = {
  productSlug: string;
  variantKey: string;
  format: "colour" | "blackAndWhite";
  quantity: number;
};

type PublishedVariant = {
  id: string;
  product_slug: string;
  product_title: string;
  variant_key: string;
  artwork_format: "colour" | "blackAndWhite";
  price_minor: number;
  currency: string;
  r2_object_key: string;
};

function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      items?: CheckoutItem[];
      name?: string;
      email?: string;
      phone?: string;
    };

    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : "";
    if (!name || !validEmail(email) || !phone) {
      return NextResponse.json({ error: "Enter your name, a valid email address and phone number." }, { status: 400 });
    }
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) {
      return NextResponse.json({ error: "Your cart is empty or contains too many items." }, { status: 400 });
    }

    const items: CheckoutItem[] = [];
    for (const raw of body.items) {
      if (!raw || typeof raw.productSlug !== "string" ||
          !["mini", "small", "detailed", "premium", "collection"].includes(raw.variantKey) ||
          !["colour", "blackAndWhite"].includes(raw.format) ||
          !Number.isInteger(raw.quantity) || raw.quantity < 1 || raw.quantity > 20) {
        return NextResponse.json({ error: "One of the cart items is invalid. Please review your cart." }, { status: 400 });
      }
      items.push(raw);
    }

    const { db, files } = await getCommerceBindings();
    const unique = [...new Map(items.map(item => [
      [item.productSlug, item.variantKey, item.format].join("|"), item,
    ])).values()];
    if (unique.length !== items.length) {
      return NextResponse.json({ error: "Please combine duplicate cart items before checkout." }, { status: 400 });
    }

    const clauses = unique.map(() => "(v.product_slug = ? AND v.variant_key = ? AND v.artwork_format = ?)").join(" OR ");
    const values = unique.flatMap(item => [item.productSlug, item.variantKey, item.format]);
    const query = `SELECT v.id, v.product_slug, p.title AS product_title, v.variant_key, v.artwork_format, v.price_minor, v.currency, v.r2_object_key
      FROM product_variants v JOIN products p ON p.slug = v.product_slug
      WHERE p.active = 1 AND v.active = 1 AND (${clauses})`;
    const result = await db.prepare(query).bind(...values).all<PublishedVariant>();
    const published = result.results ?? [];
    if (published.length !== unique.length) {
      return NextResponse.json({ error: "Some selected artwork options are not published for secure purchase yet." }, { status: 409 });
    }

    const lineItems: Array<{
      quantity: number;
      price_data: {
        currency: string;
        unit_amount: number;
        product_data: { name: string; metadata: Record<string, string> };
      };
    }> = [];

    for (const item of items) {
      const variant = published.find(row =>
        row.product_slug === item.productSlug &&
        row.variant_key === item.variantKey &&
        row.artwork_format === item.format
      );
      if (!variant || !Number.isSafeInteger(variant.price_minor) || variant.price_minor < 50 ||
          !/^[a-z]{3}$/.test(variant.currency) || !variant.r2_object_key) {
        return NextResponse.json({ error: "A selected artwork option has invalid publication data." }, { status: 409 });
      }
      const file = await files.head(variant.r2_object_key);
      if (!file || file.size <= 0) {
        return NextResponse.json({ error: "A purchased artwork file is not yet available for secure delivery." }, { status: 409 });
      }
      lineItems.push({
        quantity: item.quantity,
        price_data: {
          currency: variant.currency,
          unit_amount: variant.price_minor,
          product_data: {
            name: `${variant.product_title} — ${variant.variant_key} — ${variant.artwork_format === "colour" ? "Colour" : "Black & White"}`,
            metadata: { product_slug: variant.product_slug, variant_key: variant.variant_key, artwork_format: variant.artwork_format },
          },
        },
      });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL is not configured.");
    const origin = new URL(siteUrl);
    if (origin.protocol !== "https:" && origin.hostname !== "localhost") throw new Error("The storefront URL must use HTTPS.");

    const stripe = getStripe();
    const orderId = crypto.randomUUID();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_creation: "always",
      customer_email: email,
      phone_number_collection: { enabled: true },
      success_url: `${origin.origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin.origin}/cart`,
      metadata: {
        order_id: orderId,
        customer_name: name,
        customer_phone: phone,
        item_count: String(items.length),
      },
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");

    const amount = lineItems.reduce((sum, line) => sum + line.price_data.unit_amount * line.quantity, 0);
    const currency = published[0]?.currency ?? "eur";
    if (published.some(row => row.currency !== currency)) {
      await stripe.checkout.sessions.expire(session.id);
      return NextResponse.json({ error: "All items in one order must use the same currency." }, { status: 409 });
    }

    await db.prepare(`INSERT INTO orders
      (id, stripe_checkout_session_id, customer_email, customer_name, customer_phone, amount_total, currency, items_json, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`)
      .bind(orderId, session.id, email, name, phone, amount, currency, JSON.stringify(items))
      .run();

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Guest checkout could not be started:", error);
    return NextResponse.json({
      error: "Secure checkout is not ready yet. The store must finish its Cloudflare database, private files and Stripe configuration first.",
    }, { status: 503 });
  }
}
