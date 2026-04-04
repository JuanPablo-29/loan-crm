"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Simple site chrome for authenticated / internal routes.
 * Hidden on `/` so the landing page can use its own sticky marketing header.
 */
export function ConditionalHeader() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <header
      style={{
        borderBottom: "1px solid #e2ebe5",
        background: "#ffffff",
        padding: "1rem 1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: "1rem",
      }}
    >
      <Link
        href="/"
        style={{
          textDecoration: "none",
          color: "#2d5c47",
          fontWeight: 700,
          fontFamily: '"Inter", system-ui, sans-serif',
          letterSpacing: "-0.02em",
        }}
      >
        Kari Pastrana
      </Link>
    </header>
  );
}
