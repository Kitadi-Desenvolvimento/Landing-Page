"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

// Mostra no máximo `limit` linhas do corpo da tabela; as restantes ficam num scroll interior.
export function ScrollTable({ children, limit = 7 }: { children: ReactNode; limit?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number>();

  useLayoutEffect(() => {
    const rows = containerRef.current?.querySelectorAll<HTMLElement>("tbody > tr");
    if (!rows || rows.length <= limit) {
      setMaxHeight(undefined);
      return;
    }
    const last = rows[limit - 1];
    setMaxHeight(last.offsetTop + last.offsetHeight + 2);
  });

  return (
    <div
      className="overflow-auto"
      ref={containerRef}
      style={maxHeight ? { maxHeight } : undefined}
    >
      {children}
    </div>
  );
}
