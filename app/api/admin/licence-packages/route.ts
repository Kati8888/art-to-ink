import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { data, error } = await getSupabaseAdmin().from("license_packages")
    .select("id,code,title,price_cents,currency,credit_limit,catalogue_scope,validity_months,active")
    .order("price_cents", { ascending: true });
  if (error) return NextResponse.json({ error: "Could not load licence packages." }, { status: 503 });
  return NextResponse.json({ packages: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = await request.json() as { packageId?: unknown; creditLimit?: unknown };
    const packageId = typeof body.packageId === "string" ? body.packageId : "";
    const creditLimit = Number(body.creditLimit);
    if (!/^[0-9a-f-]{36}$/i.test(packageId) || !Number.isInteger(creditLimit) || creditLimit < 1 || creditLimit > 10000) {
      return NextResponse.json({ error: "Set a credit limit between 1 and 10,000." }, { status: 400 });
    }
    const { data, error } = await getSupabaseAdmin().from("license_packages")
      .update({ credit_limit: creditLimit, updated_at: new Date().toISOString() })
      .eq("id", packageId).select("id,code,title,credit_limit").single();
    if (error) throw error;
    return NextResponse.json({ package: data });
  } catch (error) {
    console.error("Licence package update failed:", error);
    return NextResponse.json({ error: "The licence usage limit could not be saved." }, { status: 503 });
  }
}
