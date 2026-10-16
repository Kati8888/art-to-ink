import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const configured = process.env.ADMIN_PASSWORD;
    if (!configured) return NextResponse.json({ error: "Admin login is not configured yet." }, { status: 503 });
    const body = await request.json() as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";
    const a = createHmac("sha256", "art-to-ink-admin-check").update(password).digest();
    const b = createHmac("sha256", "art-to-ink-admin-check").update(configured).digest();
    if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    const session = createAdminSession();
    const response = NextResponse.json({ success: true });
    response.cookies.set(session.name, session.value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 8 * 60 * 60 });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Login failed." }, { status: 503 });
  }
}
