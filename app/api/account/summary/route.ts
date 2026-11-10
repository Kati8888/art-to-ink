import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Sign in to view your account." }, { status: 401 });
  try {
    const url = process.env.SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) throw new Error("Supabase public authentication is not configured.");
    const authClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data.user?.id) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
    const admin = getSupabaseAdmin();
    const [orders, licenses] = await Promise.all([
      admin.from("orders").select("id,stripe_checkout_session_id,customer_name,purchase_type,product_slug,variant,artwork_format,amount_total,currency,fulfillment_status,created_at,download_expires_at")
        .eq("customer_id", data.user.id).order("created_at", { ascending: false }).limit(100),
      admin.from("customer_licenses").select("id,customer_email,license_package_id,starts_at,expires_at,purchased_credits,used_credits,status,license_packages(code,title)")
        .eq("customer_id", data.user.id).order("created_at", { ascending: false }).limit(100),
    ]);
    if (orders.error) throw orders.error;
    if (licenses.error) throw licenses.error;
    return NextResponse.json({ email: data.user.email, orders: orders.data ?? [], licences: licenses.data ?? [] });
  } catch (error) {
    console.error("Account summary failed:", error);
    return NextResponse.json({ error: "Your account information is temporarily unavailable." }, { status: 503 });
  }
}
