import type { ReactNode } from "react";

export default function SectionContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1088px] ${className}`.trim()}>
      {children}
    </div>
  );
}
