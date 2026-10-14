import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return NextResponse.json({ error: "This download link is invalid or expired." }, { status: 404 });
  try {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const supabase = getSupabaseAdmin();
    const { data: order, error } = await supabase.from("orders").select("id,download_object_path,download_expires_at,fulfillment_status").eq("download_token_hash", tokenHash).maybeSingle();
    if (error) throw error;
    if (!order || order.fulfillment_status !== "fulfilled" || !order.download_object_path || !order.download_expires_at || Date.parse(order.download_expires_at) <= Date.now()) {
      return NextResponse.json({ error: "This download link is invalid or expired." }, { status: 404 });
    }
    const bucket = process.env.SUPABASE_DOWNLOAD_BUCKET;
    if (!bucket) throw new Error("Missing SUPABASE_DOWNLOAD_BUCKET server environment variable.");
    const { data: signed, error: signError } = await supabase.storage.from(bucket).createSignedUrl(order.download_object_path, 60);
    if (signError || !signed?.signedUrl) throw signError ?? new Error("Unable to create secure storage access.");
    const fileResponse = await fetch(signed.signedUrl, { cache: "no-store" });
    if (!fileResponse.ok || !fileResponse.body) throw new Error("Secure file retrieval failed.");
    const headers = new Headers({
      "Content-Type": fileResponse.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": 'attachment; filename="art-to-ink-design.png"',
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    });
    const size = fileResponse.headers.get("content-length");
    if (size) headers.set("Content-Length", size);
    return new Response(fileResponse.body, { status: 200, headers });
  } catch (error) {
    console.error("Secure download failed:", error);
    return NextResponse.json({ error: "The secure download is temporarily unavailable." }, { status: 503 });
  }
}
