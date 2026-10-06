/**
 * ParaBank stores transaction dates as midnight UTC and its search endpoints and UI take
 * MM-DD-YYYY. Formatting in UTC keeps the result the same whatever timezone the runner uses
 * (a CI runner is UTC, a laptop in India is UTC+5:30).
 */
export function toParaBankDate(date: Date): string {
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${mm}-${dd}-${date.getUTCFullYear()}`;
}
