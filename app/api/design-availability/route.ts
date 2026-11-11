import { NextResponse } from "next/server";
import { DESIGN_SIZE_ORDER, type DesignSize } from "@/lib/products";
import { getSecureDownloadObject, type ArtworkFormat } from "@/lib/secure-assets";
import { getCommerceBindings } from "@/lib/cloudflare-commerce";

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
  if (!objectPath) {
    return NextResponse.json({ available: false }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const { files } = await getCommerceBindings();
    const stored = await files.head(objectPath);
    return NextResponse.json({ available: Boolean(stored && stored.size > 0) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ available: false }, { headers: { "Cache-Control": "no-store" } });
  }
}
