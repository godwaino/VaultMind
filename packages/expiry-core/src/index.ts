/**
 * @vaultmind/expiry-core — ExpiryGuard domain logic (PRD Phase 2). Per-doc-type
 * reminder policies with effective expiry (ADR-008), travel-readiness, urgency
 * bands, renewal guidance, and the free-tier 5-doc cap. Local-first and offline
 * (REQ-EXPIRY-009); native scheduling is injected via ports.
 */

export {
  isIsoDate,
  parseIsoDate,
  toIsoDate,
  subtractOffset,
  daysBetween,
  todayIso,
  type DateOffset,
} from "./dates.js";
export {
  EXPIRY_DOC_TYPES,
  NON_EXPIRING_TYPES,
  isExpiryDocType,
  isNonExpiring,
  inferExpiryDocType,
  type ExpiryDocType,
} from "./docTypes.js";
export {
  REMINDER_POLICIES,
  POLICY_TABLE_VERSION,
  policyFor,
  type ReminderPolicy,
} from "./policies.js";
export type {
  TrackedDocument,
  Reminder,
  ReminderKind,
  ExpirySource,
} from "./model.js";
export * from "./ports.js";
export {
  InMemoryTrackingRepo,
  InMemoryNotificationScheduler,
  InMemoryEmailReminderRegistry,
  sequentialIdProvider,
  fixedClock,
} from "./adapters.js";
export {
  buildReminders,
  formatHumanDate,
  DOC_TYPE_LABEL,
  type PlannedReminder,
} from "./reminders.js";
export {
  trackDocument,
  updateExpiry,
  dismissReminder,
  markReplaced,
  untrack,
  FREE_TIER_TRACKING_CAP,
  EXTRACTION_CONFIDENCE_THRESHOLD,
  type TrackDeps,
  type TrackInput,
  type TrackResult,
} from "./tracking.js";
export { urgencyFor, type Urgency, type UrgencyBand, type UrgencyColour } from "./urgency.js";
export { travelReadiness, type TravelReadiness, type TravelIssue } from "./travel.js";
export {
  RENEWAL_GUIDANCE,
  GUIDANCE_VERSION,
  guidanceFor,
  type RenewalGuidance,
} from "./guidance.js";
