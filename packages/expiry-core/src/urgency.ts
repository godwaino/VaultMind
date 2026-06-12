/**
 * Urgency bands for the dashboard (REQ-EXPIRY-011). Measured against the EFFECTIVE
 * expiry, so a passport inside its 6-month window already reads as urgent.
 *
 *   healthy (green) : more than 30 days of effective life left
 *   soon    (amber) : 8–30 days
 *   urgent  (red)   : 0–7 days
 *   expired (grey)  : past the effective expiry — shows a persistent renew prompt
 *                     until the user replaces the document (REQ-EXPIRY-013)
 */

import { daysBetween } from "./dates.js";

export type UrgencyBand = "healthy" | "soon" | "urgent" | "expired";
export type UrgencyColour = "green" | "amber" | "red" | "grey";

export interface Urgency {
  band: UrgencyBand;
  colour: UrgencyColour;
  /** days from today to the effective expiry (negative once past) */
  daysLeft: number;
}

const COLOUR: Record<UrgencyBand, UrgencyColour> = {
  healthy: "green",
  soon: "amber",
  urgent: "red",
  expired: "grey",
};

export function urgencyFor(effectiveExpiry: string, todayIso: string): Urgency {
  const daysLeft = daysBetween(todayIso, effectiveExpiry);
  let band: UrgencyBand;
  if (daysLeft < 0) band = "expired";
  else if (daysLeft <= 7) band = "urgent";
  else if (daysLeft <= 30) band = "soon";
  else band = "healthy";
  return { band, colour: COLOUR[band], daysLeft };
}
