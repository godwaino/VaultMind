/**
 * Renewal-guidance content (REQ-EXPIRY-014). Plain-English steps + the relevant
 * authority + a link, per tracked document type. Ships as versioned static JSON
 * bundled with the app and remotely updatable via CDN (non-sensitive content,
 * ARCHITECTURE §4.3). Targets Nigerian authorities.
 */

import type { ExpiryDocType } from "./docTypes.js";

export const GUIDANCE_VERSION = 1;

export interface RenewalGuidance {
  authority: string;
  url: string;
  steps: string[];
}

export const RENEWAL_GUIDANCE: Record<ExpiryDocType, RenewalGuidance> = {
  international_passport: {
    authority: "Nigeria Immigration Service (NIS)",
    url: "https://immigration.gov.ng",
    steps: [
      "Start at least 3–6 months before the printed expiry — the 6-month validity rule means your usable date is earlier.",
      "Complete the passport application on the NIS portal and pay online.",
      "Book and attend a biometrics appointment at your chosen passport office.",
      "Track the application and collect when ready.",
    ],
  },
  visa_work_permit: {
    authority: "Nigeria Immigration Service (NIS) / destination embassy",
    url: "https://immigration.gov.ng",
    steps: [
      "Check the renewal window for your visa class — some must be renewed before a cut-off.",
      "Gather supporting documents (passport, letters, fees).",
      "Submit the renewal/extension application and keep the receipt.",
    ],
  },
  drivers_vehicle_licence: {
    authority: "Federal Road Safety Corps (FRSC) / state VIO",
    url: "https://www.frsc.gov.ng",
    steps: [
      "Apply for renewal on the NDL portal and pay the fee.",
      "Complete any required capture at a licensing centre.",
      "Use the temporary slip until the card is ready.",
    ],
  },
  insurance_policy: {
    authority: "Your insurer (regulated by NAICOM)",
    url: "https://naicom.gov.ng",
    steps: [
      "Contact your insurer before the expiry to avoid a lapse in cover.",
      "Confirm the premium and pay to renew.",
      "Save the new policy document to your vault.",
    ],
  },
  professional_certificate: {
    authority: "Your professional body",
    url: "",
    steps: [
      "Check CPD/credit requirements early — these can take months to complete.",
      "Complete outstanding CPD and pay membership/renewal dues.",
      "Download the renewed certificate.",
    ],
  },
  tenancy_agreement: {
    authority: "Your landlord / managing agent",
    url: "",
    steps: [
      "Review your notice period (often 1–3 months) before the term ends.",
      "Confirm renewal terms and any rent change in writing.",
      "Sign and store the new agreement in your vault.",
    ],
  },
  waec_neco: {
    authority: "WAEC / NECO",
    url: "https://www.waecdirect.org",
    steps: [
      "Request an attestation/confirmation if an institution needs verification.",
      "Pay the applicable fee on the official portal.",
    ],
  },
  other: {
    authority: "The issuing authority",
    url: "",
    steps: [
      "Find the issuer's renewal process and start before the expiry.",
      "Save the renewed document to your vault to reset reminders.",
    ],
  },
};

export function guidanceFor(docType: ExpiryDocType): RenewalGuidance {
  return RENEWAL_GUIDANCE[docType];
}
