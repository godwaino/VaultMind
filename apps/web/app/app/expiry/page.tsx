"use client";

import { useEffect, useState } from "react";
import { EXPIRY_DOC_TYPES, DOC_TYPE_LABEL, type ExpiryDocType, type TrackedDocument } from "@vaultmind/expiry-core";
import type { VaultDocument } from "@vaultmind/vault-core";
import { listDocs } from "../../../lib/vault";
import { listTracked, trackOnWeb, untrackOnWeb, urgencyFor, travelReadiness, todayIso } from "../../../lib/expiry";

const COLOUR_CLASS: Record<string, string> = { green: "green", amber: "amber", red: "red", grey: "grey" };

export default function ExpiryGuard() {
  const [docs, setDocs] = useState<VaultDocument[]>([]);
  const [tracked, setTracked] = useState<TrackedDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const [docId, setDocId] = useState("");
  const [docType, setDocType] = useState<ExpiryDocType>("international_passport");
  const [printed, setPrinted] = useState("");
  const [err, setErr] = useState("");

  const [tripDate, setTripDate] = useState("");
  const [trip, setTrip] = useState<ReturnType<typeof travelReadiness> | null>(null);

  async function refresh() {
    setDocs(await listDocs());
    setTracked(await listTracked());
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const doc = docs.find((d) => d.id === docId);
    if (!doc) { setErr("Pick a document."); return; }
    if (!printed) { setErr("Enter the printed expiry date."); return; }
    const res = await trackOnWeb({ docId, title: doc.title, docType, printedExpiry: printed });
    if (!res.ok) { setErr(res.reason.replace(/_/g, " ")); return; }
    setDocId(""); setPrinted(""); refresh();
  }

  async function stop(id: string) { await untrackOnWeb(id); refresh(); }

  const today = todayIso(() => new Date());
  const untracked = docs.filter((d) => !tracked.some((t) => t.docId === d.id));

  return (
    <div>
      <div className="topbar"><h2 style={{ margin: 0 }}>ExpiryGuard</h2></div>

      <div className="card stack" style={{ marginBottom: 18 }}>
        <h3 style={{ margin: 0 }}>Travel-readiness check</h3>
        <p className="muted" style={{ marginTop: -6 }}>Check your travel documents against a trip date — passports use the 6-month validity rule.</p>
        <div className="row">
          <input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} style={{ maxWidth: 200 }} />
          <button className="btn btn-primary btn-sm" disabled={!tripDate} onClick={() => setTrip(travelReadiness(tracked, tripDate))}>Check</button>
        </div>
        {trip && (
          <div className={`notice ${trip.ready ? "" : "warn"}`}>
            {trip.issues.length === 0
              ? "All travel documents look good for this trip."
              : trip.issues.map((i, n) => <div key={n}><b>{i.severity === "blocker" ? "Blocker" : "Warning"}:</b> {i.message}</div>)}
          </div>
        )}
      </div>

      <form className="card stack" style={{ marginBottom: 18 }} onSubmit={add}>
        <h3 style={{ margin: 0 }}>Track a document</h3>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, minWidth: 180 }}>
            <label>Document</label>
            <select value={docId} onChange={(e) => setDocId(e.target.value)}>
              <option value="">Select…</option>
              {untracked.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 180 }}>
            <label>Type</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value as ExpiryDocType)}>
              {EXPIRY_DOC_TYPES.map((t) => <option key={t} value={t}>{DOC_TYPE_LABEL[t]}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 150 }}>
            <label>Printed expiry</label>
            <input type="date" value={printed} onChange={(e) => setPrinted(e.target.value)} />
          </div>
        </div>
        {err && <div className="error">{err}</div>}
        <button className="btn btn-primary" type="submit">Track</button>
      </form>

      <h3>Tracked documents</h3>
      {loading ? <span className="spinner" /> : tracked.length === 0 ? (
        <div className="empty">Nothing tracked yet.</div>
      ) : (
        tracked.map((t) => {
          const u = urgencyFor(t.effectiveExpiry, today);
          return (
            <div key={t.docId} className="doc-row">
              <div className="doc-meta">
                <div className="t">{t.title}</div>
                <div className="s">{DOC_TYPE_LABEL[t.docType]} · effective {t.effectiveExpiry} · {u.daysLeft < 0 ? "expired" : `${u.daysLeft} days left`}</div>
              </div>
              <span className={`pill ${COLOUR_CLASS[u.colour]}`}>{t.replaced ? "Replaced" : u.band}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => stop(t.docId)}>Untrack</button>
            </div>
          );
        })
      )}
    </div>
  );
}
