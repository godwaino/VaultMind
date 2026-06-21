"use client";

import { ENV } from "./env";
import { supabase } from "./supabaseClient";
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
  if (!res.ok) {
    let detail = `${res.status}`;
    try { detail = JSON.stringify(await res.json()); } catch { /* ignore */ }
    throw new Error(`Request failed: ${detail}`);
  }
  return (await res.json()) as T;
}

export interface RegisterBody {
  email: string; password: string; phone: string;
  consents?: Record<string, boolean>;
}
export function apiRegister(body: RegisterBody) {
  return post<{ userId: string; emailVerificationRequired: true }>("/api/auth/register", body);
}

export interface AnalyzeBody {
  tier2ConsentGranted: boolean; mimeType: string; base64: string; signingParty: string;
}
export function apiAnalyzeContract(body: AnalyzeBody) {
  return post<{ analysis: ContractAnalysis; tier: 2; usage: { used: number; limit: number | null; remaining: number | null } }>(
    "/api/contractscan/analyze",
    body
  );
}

export function apiExportAccount(userId: string) {
  return post<Record<string, unknown>>("/api/account/export", { userId });
}
export function apiDeleteAccount(userId: string) {
  return post<{ deletedAt: string; deadlines: { rowsBy: string; blobsBy: string } }>("/api/account/delete", { userId });
}
