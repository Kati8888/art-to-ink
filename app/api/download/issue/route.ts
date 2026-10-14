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
    if (!sessionId.startsWith("cs_")) return NextResponse.json({ error: "Invalid checkout session." }, { status: 400 });
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.status !== "complete" || (session.mode === "payment" && session.payment_status !== "paid")) {
      return NextResponse.json({ error: "Payment is not confirmed." }, { status: 403 });
    }
    if (session.metadata?.purchase_type !== "design") return NextResponse.json({ error: "This order does not include a digital design download." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { data: order, error } = await supabase.from("orders").select("id,fulfillment_status,customer_email").eq("stripe_checkout_session_id", sessionId).maybeSingle();
    if (error) throw error;
    const verifiedEmail = session.customer_details?.email ?? session.customer_email;
    if (!order || order.fulfillment_status !== "fulfilled" || !verifiedEmail || order.customer_email.toLowerCase() !== verifiedEmail.toLowerCase()) {
      return NextResponse.json({ error: "Your secure download is still being prepared. Please refresh this page shortly." }, { status: 409 });
    }
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase.from("download_links").insert({ order_id: order.id, token_hash: tokenHash, expires_at: expiresAt });
    if (insertError) throw insertError;
    const site = process.env.NEXT_PUBLIC_SITE_URL;
    if (!site) throw new Error("Missing NEXT_PUBLIC_SITE_URL.");
    return NextResponse.json({ url: `${new URL(site).origin}/api/download/${token}`, expiresAt });
  } catch (error) {
    console.error("Download link issuance failed:", error);
    return NextResponse.json({ error: "A secure download link could not be issued. Please try again shortly." }, { status: 503 });
  }
}
