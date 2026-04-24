/**
 * Returns today's date in EST (America/New_York) as YYYY-MM-DD.
 * Using browser's local time fails for users not in EST, and using
 * new Date().toISOString() uses UTC which rolls over at 8pm EST
 * (causing dates to appear as "tomorrow").
 */
export function todayEST(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date()); // en-CA gives YYYY-MM-DD
}

/**
 * Format an ISO date string (YYYY-MM-DD) as a localized date, interpreted in EST.
 */
export function formatESTDate(isoDate: string, options?: Intl.DateTimeFormatOptions): string {
  // Append T12:00:00 so the date doesn't shift due to timezone interpretation
  const date = new Date(isoDate + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    ...options,
  });
}
