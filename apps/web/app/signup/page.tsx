"use client";

import { useState } from "react";
import Link from "next/link";
import { validateEmail, validatePassword, normalizeNigerianPhone } from "@vaultmind/validation";
import { apiRegister } from "../../lib/api";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [cloudBackup, setCloudBackup] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: string[] = [];
    const em = validateEmail(email); if (!em.ok) errs.push(...em.errors);
    const pw = validatePassword(password); if (!pw.ok) errs.push(...pw.errors);
    const ph = normalizeNigerianPhone(phone); if (!ph.ok) errs.push(...ph.errors);
    setErrors(errs);
    if (errs.length) return;

    setBusy(true);
    try {
      await apiRegister({
        email, password, phone,
        consents: { core_processing: true, cloud_backup: cloudBackup },
      });
      setDone(true);
    } catch (err) {
      setErrors([(err as Error).message]);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="center">
        <div className="card" style={{ maxWidth: 440 }}>
          <h2>Check your email</h2>
          <p className="muted">We sent a verification link to <b>{email}</b>. Verify it, then sign in.</p>
          <Link className="btn btn-primary" href="/signin">Go to sign in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="center">
      <form className="card stack" style={{ maxWidth: 440, width: "100%" }} onSubmit={submit} noValidate>
        <h2 style={{ margin: 0 }}>Create your vault</h2>
        <p className="muted" style={{ marginTop: -6 }}>Free to start. Your documents stay encrypted on your device.</p>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone (Nigerian)</label>
          <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 123 4567" />
        </div>
        <div className="field">
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 10 characters" />
        </div>
        <label className="row" style={{ fontWeight: 500, gap: 8 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={cloudBackup} onChange={(e) => setCloudBackup(e.target.checked)} />
          Enable encrypted cloud backup (optional, free up to 5 GB)
        </label>

        {errors.length > 0 && <div className="error">{errors.map((er, i) => <div key={i}>{er}</div>)}</div>}

        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? <span className="spinner" /> : "Create account"}
        </button>
        <p className="muted" style={{ fontSize: ".9rem" }}>Already have an account? <Link href="/signin">Sign in</Link></p>
      </form>
    </main>
  );
}
