import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const COOKIE = "art_to_ink_admin";
function secret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("ADMIN_SESSION_SECRET must be set to a random secret of at least 32 characters.");
  return value;
}
export function createAdminSession() {
  const payload = Buffer.from(JSON.stringify({ role: "admin", exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return { name: COOKIE, value: payload + "." + signature };
}
export function isAdminRequest(request: NextRequest) {
  try {
    const value = request.cookies.get(COOKIE)?.value;
    if (!value) return false;
    const [payload, signature] = value.split(".");
    if (!payload || !signature) return false;
    const expected = createHmac("sha256", secret()).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {role?: string; exp?: number};
    return decoded.role === "admin" && typeof decoded.exp === "number" && decoded.exp > Date.now();
  } catch { return false; }
}
export const ADMIN_COOKIE = COOKIE;
