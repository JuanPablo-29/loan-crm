import type { Metadata } from "next";
import "./globals.css";
import { LogoutButton } from "./components/LogoutButton";

export const metadata: Metadata = {
  title: "Kari Pastrana — Loan Officer Dashboard",
  description: "Loan lead engagement for Kari Pastrana",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header
          style={{
            borderBottom: "1px solid var(--border)",
            padding: "1rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <a href="/" style={{ textDecoration: "none", color: "var(--text)", fontWeight: 600 }}>
            Kari Pastrana
          </a>
          <nav style={{ display: "flex", gap: "1rem", fontSize: "0.9rem" }}>
            <a href="/dashboard">Dashboard</a>
            <a href="/dashboard/csv">CSV Export</a>
            <a href="/login">Login</a>
            <LogoutButton />
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
