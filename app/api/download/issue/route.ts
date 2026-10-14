import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { sessionId?: unknown };
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    if (!/^cs_(test|live)_/.test(sessionId)) {
      return NextResponse.json({ error: "Invalid checkout session." }, { status: 400 });
    }

    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.status !== "complete" || session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment has not been confirmed." }, { status: 403 });
    }
    if (session.metadata?.purchase_type !== "design") {
      return NextResponse.json({ error: "This order does not include a digital artwork download." }, { status: 400 });
    }

    const verifiedEmail = session.customer_details?.email ?? session.customer_email;
    if (!verifiedEmail) {
      return NextResponse.json({ error: "The verified checkout session has no customer email." }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data: order, error } = await supabase
      .from("orders")
      .select("id,fulfillment_status,customer_email")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();
    if (error) throw error;
    if (!order || order.fulfillment_status !== "fulfilled") {
      return NextResponse.json({ error: "Your secure download is still being prepared. Please try again shortly." }, { status: 409 });
    }
    if (order.customer_email.toLowerCase() !== verifiedEmail.toLowerCase()) {
      return NextResponse.json({ error: "The order could not be verified." }, { status: 403 });
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase.from("download_links").insert({
      order_id: order.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    if (insertError) throw insertError;

    const site = process.env.NEXT_PUBLIC_SITE_URL;
    if (!site) throw new Error("Missing NEXT_PUBLIC_SITE_URL.");
    const origin = new URL(site);
    if (origin.protocol !== "https:" && origin.hostname !== "localhost") {
      throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS.");
    }
    return NextResponse.json({ url: `${origin.origin}/api/download/${token}`, expiresAt });
  } catch (error) {
    console.error("Download link issuance failed:", error);
    return NextResponse.json({ error: "A secure download link could not be issued. Please try again shortly." }, { status: 503 });
  }
}
