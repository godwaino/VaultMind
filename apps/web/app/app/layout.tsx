"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "../../lib/session";

const NAV = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/documents", label: "Documents" },
  { href: "/app/expiry", label: "ExpiryGuard" },
  { href: "/app/contractscan", label: "ContractScan" },
  { href: "/app/settings", label: "Settings" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { loading, session, configured, signOut } = useSession();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (!loading && configured && !session) router.replace("/signin");
  }, [loading, session, configured, router]);

  if (!configured) {
    return (
      <main className="center">
        <div className="card" style={{ maxWidth: 480 }}>
          <h3>Not configured</h3>
          <p className="muted">
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
            (and <code>NEXT_PUBLIC_API_BASE_URL</code>) to use the companion app.
          </p>
        </div>
      </main>
    );
  }
  if (loading || !session) return <main className="center"><span className="spinner" /></main>;

  const isActive = (href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M12 2l8 3v6c0 5-3.4 8.6-8 11-4.6-2.4-8-6-8-11V5l8-3z" fill="#5b3df5" /><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          VaultMind
        </div>
        <nav>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={isActive(n.href) ? "active" : ""}>{n.label}</Link>
          ))}
        </nav>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 20 }} onClick={() => signOut().then(() => router.push("/"))}>
          Sign out
        </button>
      </aside>
      <div className="main">{children}</div>
    </div>
  );
}
