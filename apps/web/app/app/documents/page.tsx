"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DOCUMENT_CATEGORIES, type VaultDocument, type DocumentCategory } from "@vaultmind/vault-core";
import { listDocs, ingest, deleteDoc } from "../../../lib/vault";
import { searchDocs } from "../../../lib/search";

export default function Documents() {
  const [docs, setDocs] = useState<VaultDocument[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("Identity");
  const [expiry, setExpiry] = useState("");
  const [err, setErr] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function refresh() { setDocs(await listDocs()); setLoading(false); }
  useEffect(() => { refresh(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setErr(["Choose a file."]); return; }
    setBusy(true); setErr([]);
    const res = await ingest({
      file, category,
      ...(title ? { title } : {}),
      ...(expiry ? { expiryDate: expiry } : {}),
    });
    setBusy(false);
    if (res.ok) { setShowAdd(false); setFile(null); setTitle(""); setExpiry(""); refresh(); }
    else if ("errors" in res) setErr(res.errors);
    else setErr(["This document is already in your vault."]);
  }

  async function remove(id: string) {
    if (!confirm("Delete this document? This permanently destroys the encrypted copy on this device.")) return;
    await deleteDoc(id); refresh();
  }

  const shown = q ? searchDocs(docs, q) : docs;

  return (
    <div>
      <div className="topbar">
        <h2 style={{ margin: 0 }}>Documents</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd((v) => !v)}>{showAdd ? "Close" : "Add document"}</button>
      </div>

      {showAdd && (
        <form className="card stack" style={{ marginBottom: 18 }} onSubmit={add}>
          <div className="field">
            <label>File (PDF, JPG, PNG, DOCX — up to 25 MB)</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: 1, minWidth: 180 }}>
              <label>Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. International Passport" />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 160 }}>
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
                {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 1, minWidth: 150 }}>
              <label>Expiry date (optional)</label>
              <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </div>
          </div>
          <div className="notice">On web, documents are encrypted in your browser before storage. Metadata is entered manually — on-device text recognition is a mobile feature.</div>
          {err.length > 0 && <div className="error">{err.map((e, i) => <div key={i}>{e}</div>)}</div>}
          <button className="btn btn-primary" disabled={busy} type="submit">{busy ? <span className="spinner" /> : "Encrypt & save"}</button>
        </form>
      )}

      <div className="field">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search — e.g. ‘my 2023 rent agreement’" />
      </div>

      {loading ? <span className="spinner" /> : shown.length === 0 ? (
        <div className="empty">{q ? "No matches." : "No documents yet — add your first one above."}</div>
      ) : (
        shown.map((d) => (
          <div key={d.id} className="doc-row">
            <div className="doc-ico">{d.category.slice(0, 2).toUpperCase()}</div>
            <Link href={`/app/documents/${d.id}`} className="doc-meta" style={{ textDecoration: "none" }}>
              <div className="t">{d.title}</div>
              <div className="s">{d.category}{d.metadata.expiryDate ? ` · expires ${d.metadata.expiryDate}` : ""}</div>
            </Link>
            <button className="btn btn-danger btn-sm" onClick={() => remove(d.id)}>Delete</button>
          </div>
        ))
      )}
    </div>
  );
}
