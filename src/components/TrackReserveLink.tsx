"use client";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export default function TrackReserveLink({
  href = "/contact",
  className,
  style,
  children,
}: {
  href?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      style={style}
      onClick={() => {
        if (typeof window !== "undefined" && (window as any).fbq) {
          (window as any).fbq("trackCustom", "ClicReserver");
        }
      }}
    >
      {children}
    </Link>
  );
}
