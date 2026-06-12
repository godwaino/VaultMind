/**
 * @vaultmind/consent — consent registry + in-code egress gate (ARCHITECTURE §1.3, §5, §8).
 *
 * Principle: data egress is gated in CODE, not just UI. Any function that sends
 * document content off-device must demand a `ConsentToken`, which can only be
 * minted while the matching consent is granted. A developer cannot call an egress
 * path without first passing through `mintConsentToken`, so "forgot to check
 * consent" becomes a compile-time/runtime impossibility rather than a review note.
 *
 * Every grant/revoke appends a `ConsentEvent` — the NDPA 2023 audit trail
 * (consent_events table, NFR-SEC-011). The server stores these; this package is
 * the device-side source of truth.
 */

/** Granular consent toggles shown in the Consent Centre (REQ-ONB-002/003). */
export type ConsentKey =
  | "core_processing" // on-device storage/OCR/categorisation — required to use the app
  | "analytics" // opt-in, event-names only, no content
  | "cloud_ocr_fallback" // send a low-confidence page to Google Vision
  | "cloud_backup" // upload client-side-encrypted blobs
  | "tier2_ai"; // send a contract to the cloud LLM (Claude)

/** Consent keys that gate document-content egress (trust boundary A -> B). */
export const EGRESS_CONSENT_KEYS = [
  "cloud_ocr_fallback",
  "cloud_backup",
  "tier2_ai",
] as const satisfies readonly ConsentKey[];

export type EgressConsentKey = (typeof EGRESS_CONSENT_KEYS)[number];

export interface ConsentEvent {
  readonly consentKey: ConsentKey;
  readonly granted: boolean;
  readonly at: string; // ISO-8601
  readonly appVersion: string;
}

export interface ConsentRegistryOptions {
  appVersion: string;
  /** injectable clock for tests */
  now?: () => Date;
  /** seed prior state (e.g. rehydrated from server) without emitting events */
  initial?: Partial<Record<ConsentKey, boolean>>;
}

/**
 * Opaque proof that a specific consent was granted. The `brand` symbol is module-
 * private, so a token can't be forged outside this file.
 */
const BRAND: unique symbol = Symbol("ConsentToken");
export interface ConsentToken {
  readonly key: ConsentKey;
  readonly [BRAND]: true;
}

export class ConsentDeniedError extends Error {
  constructor(public readonly key: ConsentKey) {
    super(`Consent "${key}" is not granted; this operation is blocked.`);
    this.name = "ConsentDeniedError";
  }
}

export class ConsentRegistry {
  private readonly state = new Map<ConsentKey, boolean>();
  private readonly events: ConsentEvent[] = [];
  private readonly now: () => Date;
  private readonly appVersion: string;

  constructor(opts: ConsentRegistryOptions) {
    this.appVersion = opts.appVersion;
    this.now = opts.now ?? (() => new Date());
    if (opts.initial) {
      for (const [k, v] of Object.entries(opts.initial)) {
        if (v !== undefined) this.state.set(k as ConsentKey, v);
      }
    }
  }

  isGranted(key: ConsentKey): boolean {
    return this.state.get(key) === true;
  }

  /** Set consent and append an audit event if it actually changed. */
  set(key: ConsentKey, granted: boolean): ConsentEvent | null {
    if (this.state.get(key) === granted) return null;
    this.state.set(key, granted);
    const event: ConsentEvent = {
      consentKey: key,
      granted,
      at: this.now().toISOString(),
      appVersion: this.appVersion,
    };
    this.events.push(event);
    return event;
  }

  grant(key: ConsentKey): ConsentEvent | null {
    return this.set(key, true);
  }

  revoke(key: ConsentKey): ConsentEvent | null {
    return this.set(key, false);
  }

  /** Full audit trail, append-only, for syncing to consent_events. */
  getEvents(): readonly ConsentEvent[] {
    return this.events.slice();
  }

  /**
   * Mint a token for an egress operation. Throws unless the consent is granted.
   * This is the only way to obtain a ConsentToken.
   */
  mintToken(key: ConsentKey): ConsentToken {
    if (!this.isGranted(key)) throw new ConsentDeniedError(key);
    return { key, [BRAND]: true };
  }
}

/**
 * Egress call sites call this first. It re-asserts the token matches the operation
 * — defence in depth in case a token for a different key is passed by mistake.
 */
export function assertConsent(token: ConsentToken, expected: ConsentKey): void {
  if (token.key !== expected) {
    throw new ConsentDeniedError(expected);
  }
}
