/**
 * Date math for expiry reminders. Everything is done in UTC on yyyy-mm-dd strings
 * to avoid timezone/DST drift — a passport expiring on a calendar date has no time
 * of day. Month subtraction is calendar-correct and clamps end-of-month overflow
 * (e.g. 6 months before 31 Aug is 28/29 Feb, not 2/3 Mar).
 */

export interface DateOffset {
  months?: number;
  days?: number;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s: string): boolean {
  if (!ISO_DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && toIsoDate(d) === s;
}

export function parseIsoDate(s: string): Date {
  if (!isIsoDate(s)) throw new Error(`Invalid ISO date: ${s}`);
  return new Date(`${s}T00:00:00.000Z`);
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function lastDayOfMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

/** Subtract a calendar offset (months then days) from an ISO date. */
export function subtractOffset(dateIso: string, offset: DateOffset): string {
  const d = parseIsoDate(dateIso);
  let y = d.getUTCFullYear();
  let m = d.getUTCMonth();
  let day = d.getUTCDate();

  if (offset.months) {
    m -= offset.months;
    y += Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    const maxDay = lastDayOfMonth(y, m);
    if (day > maxDay) day = maxDay; // clamp end-of-month overflow
  }

  let result = new Date(Date.UTC(y, m, day));
  if (offset.days) result = new Date(result.getTime() - offset.days * 86400000);
  return toIsoDate(result);
}

/** Whole days from `fromIso` to `toIso` (positive if `toIso` is later). */
export function daysBetween(fromIso: string, toIso: string): number {
  const ms = parseIsoDate(toIso).getTime() - parseIsoDate(fromIso).getTime();
  return Math.round(ms / 86400000);
}

/** Today's date (UTC) as yyyy-mm-dd, from an injected clock. */
export function todayIso(now: () => Date): string {
  return toIsoDate(now());
}
