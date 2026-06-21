import Link from "next/link";

const SHIELD = (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden>
    <path d="M12 2l8 3v6c0 5-3.4 8.6-8 11-4.6-2.4-8-6-8-11V5l8-3z" fill="#5b3df5" />
    <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function Home() {
  return (
    <main className="wrap" style={{ paddingTop: 48, paddingBottom: 48 }}>
      <div className="row between" style={{ marginBottom: 40 }}>
        <div className="row" style={{ fontWeight: 800, fontSize: "1.2rem" }}>{SHIELD} VaultMind</div>
        <div className="row">
          <Link className="btn btn-ghost btn-sm" href="/signin">Sign in</Link>
          <Link className="btn btn-primary btn-sm" href="/signup">Get started</Link>
        </div>
      </div>

      <section style={{ maxWidth: 640 }}>
        <span className="pill brand">Local-first · your documents never leave your device</span>
        <h1 style={{ fontSize: "2.6rem", lineHeight: 1.1, margin: "1rem 0" }}>
          Your documents, working for you. Privately.
        </h1>
        <p className="muted" style={{ fontSize: "1.15rem" }}>
          The VaultMind companion — manage your encrypted vault, track renewal deadlines, and
          understand contracts, in your browser. Your documents are encrypted on this device;
          the server can&apos;t read them.
        </p>
        <div className="row" style={{ marginTop: 24 }}>
          <Link className="btn btn-primary" href="/signup">Create your vault</Link>
          <Link className="btn btn-ghost" href="/app">Go to app</Link>
        </div>
        <p className="muted" style={{ marginTop: 28, fontSize: ".9rem" }}>
          For the strongest privacy (hardware-backed keys, on-device AI), use the VaultMind mobile app.
          The web companion is the convenient second screen.
        </p>
      </section>
    </main>
  );
}
