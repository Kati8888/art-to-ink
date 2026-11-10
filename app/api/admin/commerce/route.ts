import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const db = getSupabaseAdmin();
    const [orders, licences, customers] = await Promise.all([
      db.from("orders").select("id,customer_email,customer_name,customer_phone,purchase_type,product_slug,variant,license_id,amount_total,currency,fulfillment_status,created_at").order("created_at", { ascending: false }).limit(500),
      db.from("customer_licenses").select("id,customer_email,starts_at,expires_at,purchased_credits,used_credits,status,license_packages(code,title),orders(customer_email,amount_total,currency)").order("created_at", { ascending: false }).limit(500),
      db.from("profiles").select("id,display_name,phone,created_at").order("created_at", { ascending: false }).limit(500),
    ]);
    if (orders.error) throw orders.error;
    if (licences.error) throw licences.error;
    if (customers.error) throw customers.error;
    const paidOrders = orders.data ?? [];
    const revenueCents = paidOrders.filter(o => ["fulfilled","license_active"].includes(o.fulfillment_status)).reduce((sum,o) => sum + Number(o.amount_total ?? 0), 0);
    return NextResponse.json({ orders: paidOrders, licences: licences.data ?? [], customers: customers.data ?? [], stats: { orders: paidOrders.length, revenueCents } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin commerce dashboard failed:", error);
    return NextResponse.json({ error: "Could not load commerce dashboard." }, { status: 503 });
  }
}
