"use client";

import { useState } from "react";
import {
  VERDICT_LABEL,
  SEVERITY_LABEL,
  CONTRACTSCAN_DISCLAIMER,
  type ContractAnalysis,
} from "@vaultmind/contractscan-core";
import { apiAnalyzeContract } from "../../../lib/api";

const SEV_CLASS: Record<string, string> = { note: "grey", caution: "amber", serious: "red" };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result); resolve(s.slice(s.indexOf(",") + 1)); };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function ContractScan() {
  const [file, setFile] = useState<File | null>(null);
  const [party, setParty] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ContractAnalysis | null>(null);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setResult(null);
    if (!file) { setError("Choose a contract file."); return; }
    if (!consent) { setError("You must consent to cloud analysis."); return; }
    setBusy(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await apiAnalyzeContract({ tier2ConsentGranted: consent, mimeType: file.type, base64, signingParty: party || "the user" });
      setResult(res.analysis);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="topbar"><h2 style={{ margin: 0 }}>ContractScan</h2></div>

      <form className="card stack" style={{ marginBottom: 18 }} onSubmit={analyze}>
        <p className="muted" style={{ marginTop: 0 }}>
          Get a plain-English breakdown of a contract. On the web this uses secure cloud analysis (Gemini) —
          your document is sent only when you tick the box below.
        </p>
        <div className="field">
          <label>Contract file (PDF or image)</label>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="field">
          <label>Which party are you? (optional)</label>
          <input value={party} onChange={(e) => setParty(e.target.value)} placeholder="e.g. the Tenant" />
        </div>
        <label className="row" style={{ gap: 8, fontWeight: 500 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          I understand this document will be sent to our cloud AI provider for analysis.
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary" disabled={busy} type="submit">{busy ? <span className="spinner" /> : "Analyse contract"}</button>
      </form>

      {result && (
        <div className="stack">
          <div className="card">
            <div className="row between">
              <h3 style={{ margin: 0 }}>{result.document_summary.contract_type}</h3>
              <span className="pill brand">{VERDICT_LABEL[result.verdict]}</span>
            </div>
            <p>{result.document_summary.plain_english_summary}</p>
            <p className="muted" style={{ fontSize: ".9rem" }}>Parties: {result.document_summary.parties.join(", ")}</p>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Your obligations</h3>
            <ul>{result.your_obligations.map((o, i) => <li key={i}>{o}</li>)}</ul>
            <h3>The other party&apos;s obligations</h3>
            <ul>{result.other_party_obligations.map((o, i) => <li key={i}>{o}</li>)}</ul>
          </div>

          {result.important_dates.length > 0 && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Important dates</h3>
              {result.important_dates.map((d, i) => (
                <div key={i} style={{ marginBottom: 8 }}><b>{d.label}</b> — {d.date_or_rule}<div className="muted" style={{ fontSize: ".9rem" }}>{d.explanation}</div></div>
              ))}
            </div>
          )}

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Red flags</h3>
            {result.red_flags.length === 0 ? <p className="muted">None flagged.</p> : result.red_flags.map((f, i) => (
              <div key={i} className="notice" style={{ marginBottom: 8 }}>
                <span className={`pill ${SEV_CLASS[f.severity]}`}>{SEVERITY_LABEL[f.severity]}</span>
                <p style={{ margin: "8px 0 4px" }}><i>“{f.original_clause_text}”</i></p>
                <p style={{ margin: 0 }}>{f.plain_english_explanation}</p>
              </div>
            ))}
          </div>

          <div className="notice warn" style={{ fontSize: ".85rem" }}>{CONTRACTSCAN_DISCLAIMER}</div>
        </div>
      )}
    </div>
  );
}
