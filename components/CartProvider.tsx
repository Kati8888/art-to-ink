"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { TattooDesign } from "@/lib/products";
import { formatEuro } from "@/lib/products";

export type CartItem = {
  key: string;
  type: "design" | "license";
  productId?: string;
  productSlug?: string;
  licenseId?: string;
  title: string;
  variant?: string;
  artworkFormat?: "colour" | "blackAndWhite";
  price: number;
  image?: string;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  ready: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const storageKey = "art-to-ink-cart-v1";

export function designCartItem(design: TattooDesign, variant: string, artworkFormat: "colour" | "blackAndWhite"): CartItem {
  return {
    key: `design:${design.slug}:${variant}:${artworkFormat}`,
    type: "design",
    productId: design.id,
    productSlug: design.slug,
    title: design.title,
    variant,
    artworkFormat,
    price: design.sizes[variant as keyof typeof design.sizes].price,
    image: design.gridImage ?? design.media.colour,
    quantity: 1,
  };
}

export function licenseCartItem(id: string, title: string, price: number, description?: string): CartItem {
  return { key: `license:${id}`, type: "license", licenseId: id, title, variant: description, price, quantity: 1 };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setItems(JSON.parse(saved) as CartItem[]);
    } catch {
      setItems([]);
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    if (ready) window.localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, ready]);
  const value = useMemo<CartContextValue>(() => ({
    items,
    count: items.reduce((total, item) => total + item.quantity, 0),
    subtotal: items.reduce((total, item) => total + item.price * item.quantity, 0),
    ready,
    addItem: (item) => setItems((current) => {
      const existing = current.find((candidate) => candidate.key === item.key);
      if (existing) return current.map((candidate) => candidate.key === item.key ? { ...candidate, quantity: Math.min(20, candidate.quantity + item.quantity) } : candidate);
      return [...current, { ...item, quantity: Math.min(20, Math.max(1, item.quantity)) }];
    }),
    removeItem: (key) => setItems((current) => current.filter((item) => item.key !== key)),
    updateQuantity: (key, quantity) => setItems((current) => current.map((item) => item.key === key ? { ...item, quantity: Math.min(20, Math.max(1, Math.round(quantity))) } : item)),
    clear: () => setItems([]),
  }), [items, ready]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}

export function CartSummary({ amount }: { amount: number }) {
  return <span>{formatEuro(amount)}</span>;
}
