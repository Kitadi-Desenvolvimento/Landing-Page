"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CART_EVENT, readCart } from "./cart-storage";

function CartIcon() {
  return (
    <svg aria-hidden="true" className="size-5 flex-none" fill="currentColor" viewBox="0 0 24 24">
      <path d="M7 18a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 18m10 0a2 2 0 1 0 .001 4.001A2 2 0 0 0 17 18M7.16 14h9.45c.75 0 1.41-.41 1.75-1.03L21.94 6.5A1 1 0 0 0 21 5H6.21l-.94-2H1v2h2l3.6 7.59-1.35 2.44C4.52 15.37 5.48 17 7 17h12v-2H7.42a.25.25 0 0 1-.22-.37z" />
    </svg>
  );
}

export default function CartLink({ className = "" }: { className?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(readCart().length);
    update();
    window.addEventListener(CART_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(CART_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return (
    <Link
      aria-label={count > 0 ? `Carrinho, ${count} ${count === 1 ? "produto" : "produtos"}` : "Carrinho"}
      className={`relative inline-flex size-11 items-center justify-center overflow-visible rounded-full border border-white/40 text-white transition-colors hover:border-[#d1aa64] hover:text-[#d1aa64] ${className}`}
      href="/carrinho"
    >
      <CartIcon />
      {count > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#cda45c] px-1 text-[10px] font-bold leading-none text-[#2b160f] ring-2 ring-[#390b15]">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
