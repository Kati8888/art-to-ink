import Link from "next/link";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { DownloadButton } from "@/components/DownloadButton";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ session_id?: string }>;

export default async function ThankYouPage({ searchParams }: { searchParams: SearchParams }) {
  const { session_id: sessionId } = await searchParams;
  if (!sessionId || !sessionId.startsWith("cs_")) {
    return <main className="section"><div className="section-inner"><span className="eyebrow">ART TO INK</span><h1>Thank you.</h1><p className="muted">We could not verify a checkout session in this link. Please use the link from your payment confirmation.</p><Link className="button" href="/">Return to the gallery</Link></div></main>;
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
      return <main className="section"><div className="section-inner"><span className="eyebrow">ART TO INK</span><h1>Payment not confirmed yet.</h1><p className="muted">Your payment status has not been confirmed. If you have just paid, refresh this page in a moment.</p><Link className="button secondary" href="/">Return to the gallery</Link></div></main>;
    }
    const { data: order, error } = await getSupabaseAdmin().from("orders").select("purchase_type,fulfillment_status,product_slug,variant,license_id").eq("stripe_checkout_session_id", sessionId).maybeSingle();
    if (error) throw error;
    return <main className="section"><div className="section-inner" style={{ maxWidth: 760 }}><span className="eyebrow">ART TO INK · ORDER CONFIRMED</span><h1 style={{ font: "clamp(48px,8vw,86px)/.95 Georgia,serif", margin: "22px 0" }}>Thank you for supporting original artwork!<br/><em style={{ color: "var(--gold)" }}>Your tattoo files are ready.</em></h1>
      {!order || order.fulfillment_status === "processing" ? <div className="notice"><strong>We are preparing your order.</strong><p>Your payment is confirmed. Secure delivery is finishing in the background. Use the button below and we will retry securely while the order is being prepared. A backup link will also be sent by email.</p><DownloadButton /><a className="button secondary" href={`/thank-you?session_id=${encodeURIComponent(sessionId)}`}>Refresh order status</a></div> : order.purchase_type === "design" && order.fulfillment_status === "fulfilled" ? <><p className="muted">Your order is confirmed. Your private download link is valid for seven days.</p><DownloadButton /></> : <div className="notice"><strong>Your studio licence is confirmed.</strong><p>Licence: {order.license_id ?? "Studio licence"}. Your receipt and licence details will be sent to the email used at checkout.</p></div>}
      <p className="muted" style={{ marginTop: 32 }}>Questions about your order? Contact ART TO INK support.</p><Link href="/" className="button secondary">Back to ART TO INK</Link></div></main>;
  } catch (error) {
    console.error("Thank-you page could not verify order:", error);
    return <main className="section"><div className="section-inner"><span className="eyebrow">ART TO INK</span><h1>We are checking your order.</h1><p className="muted">The payment service is temporarily unavailable. Your order has not been marked as delivered. Please refresh this page shortly or use the secure link in your confirmation email.</p><Link href="/" className="button secondary">Return to the gallery</Link></div></main>;
  }
}
