"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { VaultDocument } from "@vaultmind/vault-core";
import { getDoc, getDocBlobUrl, deleteDoc } from "../../../../lib/vault";

export default function DocumentView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [doc, setDoc] = useState<VaultDocument | null>(null);
  const [url, setUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => { setDoc(await getDoc(id)); setLoading(false); })();
  }, [id]);

  async function openFile() {
    const u = await getDocBlobUrl(id); // decrypts in-browser
    setUrl(u);
  }
  async function remove() {
    if (!confirm("Delete this document permanently?")) return;
    await deleteDoc(id);
    router.push("/app/documents");
  }

  if (loading) return <span className="spinner" />;
  if (!doc) return <div className="empty">Document not found. <Link href="/app/documents">Back</Link></div>;

  const isImage = doc.mimeType.startsWith("image/");
  return (
    <div>
      <div className="topbar">
        <h2 style={{ margin: 0 }}>{doc.title}</h2>
        <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={openFile}>Open file</button>
          <button className="btn btn-danger btn-sm" onClick={remove}>Delete</button>
        </div>
      </div>

      <div className="card stack" style={{ marginBottom: 16 }}>
        <div className="row between"><span className="muted">Category</span><span>{doc.category}</span></div>
        <div className="row between"><span className="muted">Type</span><span>{doc.mimeType}</span></div>
        <div className="row between"><span className="muted">Size</span><span>{(doc.sizeBytes / 1024).toFixed(0)} KB</span></div>
        {doc.metadata.expiryDate && <div className="row between"><span className="muted">Expiry</span><span>{doc.metadata.expiryDate}</span></div>}
        <div className="row between"><span className="muted">Added</span><span>{doc.createdAt.slice(0, 10)}</span></div>
        {doc.notes && <div><span className="muted">Notes</span><p>{doc.notes}</p></div>}
      </div>

      {url && (
        <div className="card">
          {isImage
            ? <img src={url} alt={doc.title} style={{ maxWidth: "100%", borderRadius: 8 }} />
            : <iframe src={url} title={doc.title} style={{ width: "100%", height: 600, border: 0 }} />}
        </div>
      )}
      <p className="muted" style={{ marginTop: 14 }}><Link href="/app/documents">← Back to documents</Link></p>
    </div>
  );
}
