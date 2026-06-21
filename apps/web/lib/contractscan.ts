/**
 * Web ContractScan — companion app always uses the cloud (Gemini) Tier 2; there is
 * no on-device SLM in the browser (decision: companion web app, cloud AI). We reuse
 * the SAME @vaultmind/contractscan-core routing and schema as mobile — just forcing
 * `deviceCanRunSlm: false` so it always resolves to the consent-gated cloud tier.
 */

import { routeAnalysis, validateAnalysis, type ContractAnalysis } from "@vaultmind/contractscan-core";

export interface WebAnalyzeInput {
  pageCount: number;
  mimeType: string;
  base64: string;
  signingParty: string;
  /** set true once the user passes the non-dismissable Tier-2 consent gate */
  tier2ConsentGranted: boolean;
}

/** Always cloud on web. Returns the routing decision for UI messaging. */
export function webRoute(pageCount: number) {
  return routeAnalysis({ pageCount, deviceCanRunSlm: false, userChoice: "cloud" }); // -> tier 2
}

/** Calls the backend Tier-2 proxy and validates the result with the shared schema. */
export async function analyzeOnWeb(
  apiBaseUrl: string,
  accessToken: string,
  input: WebAnalyzeInput
): Promise<ContractAnalysis> {
  const res = await fetch(`${apiBaseUrl}/api/contractscan/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Analysis failed (${res.status})`);
  const body = (await res.json()) as { analysis: unknown };
  const valid = validateAnalysis(body.analysis);
  if (!valid.ok) throw new Error(`Malformed analysis: ${valid.errors.join(", ")}`);
  return valid.value;
}
