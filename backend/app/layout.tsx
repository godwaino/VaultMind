import type { ReactNode } from "react";

export const metadata = {
  title: "VaultMind",
  description: "Privacy-first personal document intelligence",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#0b0b0f",
          color: "#e6e6ea",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
