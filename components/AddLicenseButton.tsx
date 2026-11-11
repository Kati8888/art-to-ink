"use client";

import { useState } from "react";
import { licenseCartItem, useCart } from "@/components/CartProvider";

export function AddLicenseButton({ id, title, price, description }: { id: string; title: string; price: number; description: string }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  return <><button className="button" type="button" onClick={() => { addItem(licenseCartItem(id, title, price, description)); setAdded(true); window.setTimeout(() => setAdded(false), 1800); }}>{added ? "Added to cart" : "Add licence to cart"}</button>{added && <span className="cart-feedback" role="status">Licence added. <a href="/cart">View cart</a></span>}</>;
}
