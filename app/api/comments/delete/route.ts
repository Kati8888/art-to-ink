import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { id?: unknown; token?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    const token = typeof body.token === "string" ? body.token : "";
    if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[A-Za-z0-9_-]{32,100}$/.test(token)) {
      return NextResponse.json({ error: "Invalid deletion request." }, { status: 400 });
    }
    const hash = createHash("sha256").update(token).digest("hex");
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("artwork_comments").select("id,delete_token_hash").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data?.delete_token_hash) return NextResponse.json({ error: "This comment cannot be removed from this browser." }, { status: 404 });
    const expected = Buffer.from(data.delete_token_hash, "utf8");
    const actual = Buffer.from(hash, "utf8");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return NextResponse.json({ error: "Removal token is invalid." }, { status: 403 });
    }
    const { error: deleteError } = await supabase.from("artwork_comments").delete().eq("id", id).eq("delete_token_hash", hash);
    if (deleteError) throw deleteError;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Comment removal failed:", error);
    return NextResponse.json({ error: "Unable to remove this comment right now." }, { status: 500 });
  }
}
