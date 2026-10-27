import { NextResponse } from "next/server";
import { DESIGN_SIZE_ORDER, type DesignSize } from "@/lib/products";
import { getSecureDownloadObject, type ArtworkFormat } from "@/lib/secure-assets";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedSizes = new Set<DesignSize>(DESIGN_SIZE_ORDER);
const allowedFormats = new Set<ArtworkFormat>(["colour", "blackAndWhite"]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const productId = params.get("productId") ?? "";
  const size = (params.get("size") ?? "") as DesignSize;
  const format = (params.get("artworkFormat") ?? "") as ArtworkFormat;

  if (!allowedSizes.has(size) || !allowedFormats.has(format)) {
    return NextResponse.json({ available: false }, { headers: { "Cache-Control": "no-store" } });
  }

  const objectPath = getSecureDownloadObject(productId, size, format);
  const bucket = process.env.SUPABASE_DOWNLOAD_BUCKET;
  if (!objectPath || !bucket || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ available: false }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const separator = objectPath.lastIndexOf("/");
    const folder = separator >= 0 ? objectPath.slice(0, separator) : "";
    const fileName = separator >= 0 ? objectPath.slice(separator + 1) : objectPath;
    const { data, error } = await getSupabaseAdmin().storage.from(bucket).list(folder, {
      limit: 100,
      search: fileName,
    });
    if (error) throw error;
    const available = (data ?? []).some((item) => item.name === fileName);
    return NextResponse.json({ available }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ available: false }, { headers: { "Cache-Control": "no-store" } });
  }
}
