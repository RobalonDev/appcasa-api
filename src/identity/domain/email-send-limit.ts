const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** RF-12: at most 1 authentication email per address in the last minute… */
const PER_MINUTE = 1;
/** …and at most 5 in the last hour. */
const PER_HOUR = 5;

/** How far back the caller must load sends for `mayEmail` to decide. */
export const EMAIL_LIMIT_LOOKBACK_MS = HOUR;

/**
 * Whether one more authentication email may go to an address that already had emails
 * at `sentAt` (RF-12). The caller passes every send that counts: done and in flight,
 * including uncertain ones (spec D19); failed ones are not passed (RF-38).
 * Windows are sliding and exclude their far edge: a send exactly one minute old no
 * longer counts for the per-minute limit.
 */
export function mayEmail(sentAt: readonly Date[], now: Date): boolean {
  const since = (ms: number) =>
    sentAt.filter((date) => now.getTime() - date.getTime() < ms).length;
  return since(MINUTE) < PER_MINUTE && since(HOUR) < PER_HOUR;
}
