import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Sign in to claim your purchases." }, { status: 401 });
  try {
    const url = process.env.SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) throw new Error("Supabase public authentication is not configured.");
    const authClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data.user?.email || !data.user.email_confirmed_at) {
      return NextResponse.json({ error: "Please verify your email address before claiming purchases." }, { status: 403 });
    }
    const email = data.user.email.toLowerCase();
    const admin = getSupabaseAdmin();
    const [orders, licenses] = await Promise.all([
      admin.from("orders").update({ customer_id: data.user.id, updated_at: new Date().toISOString() })
        .is("customer_id", null).ilike("customer_email", email).select("id"),
      admin.from("customer_licenses").update({ customer_id: data.user.id, updated_at: new Date().toISOString() })
        .is("customer_id", null).ilike("customer_email", email).select("id"),
    ]);
    if (orders.error) throw orders.error;
    if (licenses.error) throw licenses.error;
    return NextResponse.json({ claimedOrders: orders.data?.length ?? 0, claimedLicences: licenses.data?.length ?? 0 });
  } catch (error) {
    console.error("Purchase claim failed:", error);
    return NextResponse.json({ error: "Your purchases could not be linked right now." }, { status: 503 });
  }
}
