"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { CART_EVENT, readCart } from "./cart-storage";

function subscribe(callback: () => void) {
  window.addEventListener(CART_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CART_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function countCart() {
  return readCart().length;
}

export default function CartLink({ className = "" }: { className?: string }) {
  const count = useSyncExternalStore(subscribe, countCart, () => 0);

  return (
    <Link
      className={`inline-flex min-h-11 items-center justify-center rounded-full border border-white/40 px-4 text-[14px] font-medium text-white transition-colors hover:border-[#d1aa64] hover:text-[#d1aa64] ${className}`}
      href="/carrinho"
    >
      Carrinho{count > 0 ? ` (${count})` : ""}
    </Link>
  );
}
