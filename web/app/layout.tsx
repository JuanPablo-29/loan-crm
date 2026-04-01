import type { Metadata } from "next";
import "./globals.css";

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
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
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
          <a
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
          </a>
        </header>
        {children}
      </body>
    </html>
  );
}
