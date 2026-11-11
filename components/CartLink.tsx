"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";

export function CartLink() {
  const { count, ready } = useCart();
  return <Link className="cart-link" href="/cart" aria-label={`Cart${ready && count ? `, ${count} item${count === 1 ? "" : "s"}` : ""}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h2l1.5 10h10L20 8H7"/><circle cx="9" cy="19" r="1"/><circle cx="17" cy="19" r="1"/></svg><span>Cart</span>{ready && count > 0 && <b>{count}</b>}</Link>;
}
