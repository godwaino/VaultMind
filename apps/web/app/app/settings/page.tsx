"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBackupKeyset } from "@vaultmind/crypto";
import { useSession } from "../../../lib/session";
import { apiExportAccount, apiDeleteAccount } from "../../../lib/api";

const CONSENTS = [
  { key: "cloud_backup", label: "Encrypted cloud backup (up to 5 GB free)" },
  { key: "tier2_ai", label: "Cloud contract analysis (Gemini)" },
  { key: "cloud_ocr_fallback", label: "Cloud text-recognition fallback" },
  { key: "analytics", label: "Anonymous usage analytics" },
];

export default function Settings() {
  const { user, signOut } = useSession();
  const router = useRouter();
  const [consents, setConsents] = useState<Record<string, boolean>>({ cloud_backup: false, tier2_ai: false, cloud_ocr_fallback: false, analytics: false });

  const [pw, setPw] = useState("");
  const [phrase, setPhrase] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function generatePhrase() {
    if (pw.length < 10) { setMsg("Enter your account password (10+ chars) to derive the backup key."); return; }
    setGenBusy(true);
    const { recoveryPhrase } = await createBackupKeyset(pw);
    setPhrase(recoveryPhrase);
    setGenBusy(false);
  }

  async function exportData() {
    if (!user) return;
    try {
      const data = await apiExportAccount(user.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "vaultmind-export.json";
      a.click();
    } catch (e) { setMsg((e as Error).message); }
  }

  async function deleteAccount() {
    if (!user) return;
    if (!confirm("Delete your account? Server data is purged within 72 hours. This can't be undone.")) return;
    try {
      const res = await apiDeleteAccount(user.id);
      alert(`Account scheduled for deletion. Rows purged by ${res.deadlines.rowsBy.slice(0, 10)}, backups by ${res.deadlines.blobsBy.slice(0, 10)}.`);
      await signOut();
      router.push("/");
    } catch (e) { setMsg((e as Error).message); }
  }

  return (
    <div>
      <div className="topbar"><h2 style={{ margin: 0 }}>Settings</h2></div>

      <div className="card stack" style={{ marginBottom: 18 }}>
        <h3 style={{ margin: 0 }}>Consent centre</h3>
        <p className="muted" style={{ marginTop: -6 }}>Control what can leave your device. Each change is auditable (NDPA).</p>
        {CONSENTS.map((c) => (
          <label key={c.key} className="row between" style={{ fontWeight: 500 }}>
            {c.label}
            <input type="checkbox" style={{ width: "auto" }} checked={consents[c.key] ?? false}
              onChange={(e) => setConsents({ ...consents, [c.key]: e.target.checked })} />
          </label>
        ))}
        <div className="notice" style={{ fontSize: ".82rem" }}>Demo toggles — wire these to the backend <code>consent_events</code> table to persist and audit.</div>
      </div>

      <div className="card stack" style={{ marginBottom: 18 }}>
        <h3 style={{ margin: 0 }}>Backup recovery phrase</h3>
        <p className="muted" style={{ marginTop: -6 }}>If you forget your password, this 24-word phrase restores your encrypted backup. Write it down and keep it safe.</p>
        <div className="row">
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Your account password" style={{ maxWidth: 280 }} />
          <button className="btn btn-primary btn-sm" disabled={genBusy} onClick={generatePhrase}>{genBusy ? <span className="spinner" /> : "Generate"}</button>
        </div>
        {phrase && <div className="notice warn" style={{ fontFamily: "monospace", lineHeight: 1.8 }}>{phrase}</div>}
      </div>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Your data</h3>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-ghost btn-sm" onClick={exportData}>Export my data</button>
          <button className="btn btn-danger btn-sm" onClick={deleteAccount}>Delete my account</button>
        </div>
        {msg && <div className="error">{msg}</div>}
        <p className="muted" style={{ fontSize: ".85rem" }}>Documents on this device are exported separately from the Documents page. The most sensitive items are best kept on the mobile app (hardware-backed keys).</p>
      </div>
    </div>
  );
}
