import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendTransactionalEmail } from "@/lib/brevo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(value: string) {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, character => entities[character] ?? character);
}

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

async function sendReminder(db: ReturnType<typeof getSupabaseAdmin>, licence: {
  id: string; customer_id: string | null; customer_email: string; expires_at: string;
  license_packages: { title: string } | { title: string }[] | null;
}, days: 7 | 30) {
  const deliveryKey = `license-expiry-${days}:${licence.id}`;
  const { data: prior, error: lookupError } = await db.from("email_deliveries")
    .select("id,sent_at").eq("delivery_key", deliveryKey).maybeSingle();
  if (lookupError) throw lookupError;
  if (prior?.sent_at) return false;
  if (!prior) {
    const { error } = await db.from("email_deliveries").insert({
      delivery_key: deliveryKey, customer_id: licence.customer_id,
      email_type: `licence_expiry_${days}_day_reminder`, recipient_email: licence.customer_email,
    });
    if (error && error.code !== "23505") throw error;
    const { data: afterInsert, error: recheckError } = await db.from("email_deliveries")
      .select("sent_at").eq("delivery_key", deliveryKey).maybeSingle();
    if (recheckError) throw recheckError;
    if (afterInsert?.sent_at) return false;
  }
  const pkg = Array.isArray(licence.license_packages) ? licence.license_packages[0] : licence.license_packages;
  const title = pkg?.title ?? "ART TO INK studio licence";
  const expires = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(licence.expires_at));
  const from = process.env.BREVO_FROM_EMAIL ?? process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("Missing BREVO_FROM_EMAIL.");
  try {
    const result = await sendTransactionalEmail({
      sender: { email: from, name: "ART TO INK" },
      to: [licence.customer_email],
      subject: `Your ART TO INK licence expires in ${days} days`,
      htmlContent: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#17130d"><p style="letter-spacing:3px;color:#9a762f">ART TO INK · STUDIO LICENSING</p><h1 style="font-family:Georgia,serif;font-weight:400">A quick licence reminder</h1><p>Your <strong>${escapeHtml(title)}</strong> is due to expire in ${days} days, on <strong>${expires}</strong>.</p><p>Please sign in to your customer account to review your licence and usage history. If you need help, reply to this email.</p><p>Kateřina Pohnetalová<br/>ART TO INK</p></div>`,
      textContent: `Your ${title} expires in ${days} days, on ${expires}. Sign in to your ART TO INK customer account to review your licence. If you need help, reply to this email.`,
      messageId: `art-to-ink-license-expiry-${days}-${licence.id}`,
    });
    const { error } = await db.from("email_deliveries").update({
      sent_at: new Date().toISOString(), provider_message_id: result.messageId ?? null, error_message: null,
    }).eq("delivery_key", deliveryKey);
    if (error) throw error;
    return true;
  } catch (error) {
    await db.from("email_deliveries").update({
      error_message: error instanceof Error ? error.message.slice(0, 1000) : "Reminder delivery failed",
    }).eq("delivery_key", deliveryKey);
    throw error;
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const db = getSupabaseAdmin();
    let sent = 0;
    for (const days of [30, 7] as const) {
      const target = new Date();
      target.setUTCHours(0, 0, 0, 0);
      target.setUTCDate(target.getUTCDate() + days);
      const nextDay = new Date(target.getTime() + 24 * 60 * 60 * 1000);
      const { data, error } = await db.from("customer_licenses")
        .select("id,customer_id,customer_email,expires_at,license_packages(title)")
        .eq("status", "active")
        .gte("expires_at", target.toISOString())
        .lt("expires_at", nextDay.toISOString());
      if (error) throw error;
      for (const licence of data ?? []) {
        if (await sendReminder(db, licence, days)) sent++;
      }
    }
    return NextResponse.json({ success: true, remindersSent: sent });
  } catch (error) {
    console.error("Licence expiry reminders failed:", error);
    return NextResponse.json({ error: "Licence expiry reminders could not be completed." }, { status: 500 });
  }
}
