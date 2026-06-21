"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { VaultDocument } from "@vaultmind/vault-core";
import { listDocs } from "../../lib/vault";
import { listTracked, urgencyFor, todayIso, type TrackedDocument } from "../../lib/expiry";

export default function Dashboard() {
  const [docs, setDocs] = useState<VaultDocument[]>([]);
  const [tracked, setTracked] = useState<TrackedDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setDocs(await listDocs());
      setTracked(await listTracked());
      setLoading(false);
    })();
  }, []);

  const today = todayIso(() => new Date());
  const urgent = tracked.filter((t) => !t.replaced && ["urgent", "expired"].includes(urgencyFor(t.effectiveExpiry, today).band)).length;
  const soon = tracked.filter((t) => urgencyFor(t.effectiveExpiry, today).band === "soon").length;

  if (loading) return <span className="spinner" />;

  return (
    <div>
      <div className="topbar"><h2 style={{ margin: 0 }}>Overview</h2></div>

      <div className="kpi" style={{ marginBottom: 24 }}>
        <div className="card"><div className="muted">Documents</div><div className="n">{docs.length}</div></div>
        <div className="card"><div className="muted">Tracked</div><div className="n">{tracked.length}</div></div>
        <div className="card"><div className="muted">Due soon</div><div className="n" style={{ color: "var(--warn)" }}>{soon}</div></div>
        <div className="card"><div className="muted">Urgent / expired</div><div className="n" style={{ color: "var(--danger)" }}>{urgent}</div></div>
      </div>

      <div className="card">
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Recent documents</h3>
          <Link className="btn btn-primary btn-sm" href="/app/documents">Add / view all</Link>
        </div>
        {docs.length === 0 ? (
          <div className="empty">No documents yet. <Link href="/app/documents">Add your first one →</Link></div>
        ) : (
          docs.slice(0, 6).map((d) => (
            <Link key={d.id} href={`/app/documents/${d.id}`} className="doc-row" style={{ textDecoration: "none" }}>
              <div className="doc-ico">{d.category.slice(0, 2).toUpperCase()}</div>
              <div className="doc-meta"><div className="t">{d.title}</div><div className="s">{d.category}</div></div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
