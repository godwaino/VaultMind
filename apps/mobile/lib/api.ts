import { ENV } from "./env";
import { supabase } from "./supabase";
import type { ContractAnalysis } from "@vaultmind/contractscan-core";

async function authHeaders(): Promise<Record<string, string>> {
  const sb = supabase();
  if (!sb) return {};
  const { data } = await sb.auth.getSession();
  return data.session ? { authorization: `Bearer ${data.session.access_token}` } : {};
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${ENV.apiBase}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  if (res.status === 501) throw new Error("This feature isn't configured on the server yet.");
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

export interface RegisterBody { email: string; password: string; phone: string; consents?: Record<string, boolean>; }
export const apiRegister = (b: RegisterBody) =>
  post<{ userId: string; emailVerificationRequired: true }>("/api/auth/register", b);

export interface AnalyzeBody { tier2ConsentGranted: boolean; mimeType: string; base64: string; signingParty: string; }
export const apiAnalyzeContract = (b: AnalyzeBody) =>
  post<{ analysis: ContractAnalysis; tier: 2; usage: { used: number; limit: number | null; remaining: number | null } }>(
    "/api/contractscan/analyze", b
  );

export const apiExportAccount = (userId: string) => post<Record<string, unknown>>("/api/account/export", { userId });
export const apiDeleteAccount = (userId: string) =>
  post<{ deletedAt: string; deadlines: { rowsBy: string; blobsBy: string } }>("/api/account/delete", { userId });
