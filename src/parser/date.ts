/**
 * Deterministic date extraction. Supports only:
 *  - "today" / "aaj"       -> reference date
 *  - "yesterday" / "kal"   -> reference date - 1 day
 *  - explicit DD/MM/YYYY or DD-MM-YYYY numeric dates
 *
 * `new Date()` is only ever called at the call site that owns "now" (the
 * one allowed exception in the spec); this module takes the reference date
 * as a parameter with a default, so tests stay deterministic.
 */

function toIsoDate(year: number, month1to12: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month1to12).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** True calendar-date check (rejects e.g. 31/02/2024, 30/13/2024). */
export function isValidCalendarDate(year: number, month1to12: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month1to12) || !Number.isInteger(day)) {
    return false;
  }
  if (month1to12 < 1 || month1to12 > 12) return false;
  if (day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
  return day <= daysInMonth;
}

function shiftDateByDays(reference: Date, deltaDays: number): string {
  const utc = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()),
  );
  utc.setUTCDate(utc.getUTCDate() + deltaDays);
  return toIsoDate(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
}

/**
 * Extract an explicit date from normalized text, or undefined if none of
 * the supported forms are present. Malformed numeric dates (not a real
 * calendar date) are ignored rather than guessed at.
 */
export function extractDate(
  normalized: string,
  referenceDate: Date = new Date(),
): string | undefined {
  if (/\b(today|aaj)\b/.test(normalized)) {
    return shiftDateByDays(referenceDate, 0);
  }
  if (/\b(yesterday|kal)\b/.test(normalized)) {
    return shiftDateByDays(referenceDate, -1);
  }

  const explicit = normalized.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (explicit) {
    const day = Number.parseInt(explicit[1], 10);
    const month = Number.parseInt(explicit[2], 10);
    const year = Number.parseInt(explicit[3], 10);
    if (isValidCalendarDate(year, month, day)) {
      return toIsoDate(year, month, day);
    }
    return undefined;
  }

  return undefined;
}
