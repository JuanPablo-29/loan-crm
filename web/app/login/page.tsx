"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error("bad_login");
      router.replace(next);
      router.refresh();
    } catch {
      setErr("Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 520 }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Loan Officer Login</h1>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Sign in to access leads, follow-ups, and export tools.
        </p>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.9rem" }}>
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>
          <label>
            Password
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          </label>
          {err && <p style={{ color: "var(--danger)", margin: 0 }}>{err}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
