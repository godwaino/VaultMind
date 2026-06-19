"use client";

import { useState, type FormEvent } from "react";

type ApiResult = { status: number; body: unknown };

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, phone }),
      });
      const body = await res.json().catch(() => ({ error: "non-JSON response" }));
      setResult({ status: res.status, body });
    } catch (err) {
      setResult({ status: 0, body: { error: (err as Error).message } });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "64px 24px",
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>VaultMind</h1>
      <p style={{ color: "#9b9ba3", marginTop: 0, marginBottom: 32 }}>
        Register endpoint smoke test. POSTs to <code>/api/auth/register</code>.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, color: "#9b9ba3" }}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, color: "#9b9ba3" }}>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, color: "#9b9ba3" }}>Phone</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            placeholder="0803 123 4567"
            style={inputStyle}
          />
        </label>
        <button type="submit" disabled={submitting} style={buttonStyle}>
          {submitting ? "Submitting…" : "Register"}
        </button>
      </form>

      {result && (
        <section style={{ marginTop: 32 }}>
          <div style={{ fontSize: 13, color: "#9b9ba3", marginBottom: 6 }}>
            HTTP {result.status}
          </div>
          <pre
            style={{
              background: "#15151c",
              border: "1px solid #25252e",
              borderRadius: 8,
              padding: 16,
              overflow: "auto",
              fontSize: 13,
            }}
          >
            {JSON.stringify(result.body, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}

const inputStyle = {
  background: "#15151c",
  border: "1px solid #25252e",
  borderRadius: 6,
  color: "#e6e6ea",
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
} as const;

const buttonStyle = {
  background: "#4f46e5",
  color: "white",
  border: "none",
  borderRadius: 6,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  marginTop: 8,
} as const;
