"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabase();
    if (!sb) { setError("Sign-in isn't configured (missing Supabase keys)."); return; }
    setBusy(true);
    setError("");
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    router.push("/app");
  }

  return (
    <main className="center">
      <form className="card stack" style={{ maxWidth: 400, width: "100%" }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>Welcome back</h2>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? <span className="spinner" /> : "Sign in"}
        </button>
        <p className="muted" style={{ fontSize: ".9rem" }}>New here? <Link href="/signup">Create your vault</Link></p>
      </form>
    </main>
  );
}
