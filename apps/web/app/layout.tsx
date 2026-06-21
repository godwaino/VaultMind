import "./globals.css";
import type { ReactNode } from "react";
import { SessionProvider } from "../lib/session";

export const metadata = {
  title: "VaultMind",
  description: "Privacy-first document intelligence — companion web app",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
