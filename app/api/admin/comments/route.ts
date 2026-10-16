import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("artwork_comments").select("id,design_id,visitor_name,body,created_at").order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    return NextResponse.json({ comments: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin comments fetch failed", error);
    return NextResponse.json({ error: "Could not load comments. Check server configuration." }, { status: 503 });
  }
}
export async function DELETE(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = await request.json() as { id?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid comment ID." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("artwork_comments").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin comment delete failed", error);
    return NextResponse.json({ error: "Could not delete this comment." }, { status: 503 });
  }
}
