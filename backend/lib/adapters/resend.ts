/**
 * Minimal Resend email sender (no SDK — one fetch). Used for email verification and
 * (optionally) expiry reminders. Keys live only in Vercel env (ARCHITECTURE §5).
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "no-reply@vaultmind.app";
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: msg.to, subject: msg.subject, html: msg.html }),
  });
  if (!res.ok) {
    throw new Error(`Resend send failed (${res.status}): ${await res.text()}`);
  }
}
