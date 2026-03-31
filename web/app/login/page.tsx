import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main style={{ maxWidth: 520 }}>
          <p style={{ color: "var(--muted)" }}>Loading…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
