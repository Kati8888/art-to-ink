import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getCommerceBindings } from "@/lib/cloudflare-commerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DownloadRecord = {
  order_id: string;
  r2_object_key: string;
  file_name: string;
  expires_at: string;
  revoked_at: string | null;
  order_status: string;
};

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) {
    return NextResponse.json({ error: "This download link is invalid or expired." }, { status: 404 });
  }

  try {
    const { db, files } = await getCommerceBindings();
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const link = await db.prepare(`
      SELECT dl.order_id, dl.r2_object_key, dl.file_name, dl.expires_at, dl.revoked_at,
             o.status AS order_status
      FROM download_links dl
      JOIN orders o ON o.id = dl.order_id
      WHERE dl.token_hash = ?
      LIMIT 1
    `).bind(tokenHash).first<DownloadRecord>();

    if (!link || link.revoked_at || link.order_status !== "fulfilled" ||
        !Number.isFinite(Date.parse(link.expires_at)) || Date.parse(link.expires_at) <= Date.now()) {
      return NextResponse.json({ error: "This download link is invalid or expired." }, { status: 404 });
    }

    const object = await files.get(link.r2_object_key);
    if (!object?.body) {
      console.error("Paid download object is missing from private R2 storage:", link.r2_object_key);
      return NextResponse.json({ error: "The purchased file is temporarily unavailable. Please contact ART TO INK." }, { status: 503 });
    }

    const safeName = link.file_name.replace(/[\\r\\n"]/g, "").slice(0, 160) || "art-to-ink-artwork";
    const isZip = safeName.toLowerCase().endsWith(".zip");
    const contentType = object.httpMetadata?.contentType ?? (isZip ? "application/zip" : "image/png");
    const headers = new Headers({
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    });
    if (typeof object.size === "number") headers.set("Content-Length", String(object.size));
    return new Response(object.body, { status: 200, headers });
  } catch (error) {
    console.error("Secure R2 download failed:", error);
    return NextResponse.json({ error: "The secure download is temporarily unavailable." }, { status: 503 });
  }
}
