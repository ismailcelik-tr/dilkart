const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

const oneDecimal = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

/** Short Turkish label for a review interval: "10 dk", "3 g", "1,5 ay". */
export function intervalLabel(ms: number): string {
  const minutes = ms / MS_PER_MINUTE;
  if (minutes < MINUTES_PER_HOUR) {
    return `${Math.max(1, Math.round(minutes))} dk`;
  }
  const hours = minutes / MINUTES_PER_HOUR;
  if (hours < HOURS_PER_DAY) {
    return `${Math.round(hours)} sa`;
  }
  const days = hours / HOURS_PER_DAY;
  if (days < DAYS_PER_MONTH) {
    return `${Math.round(days)} g`;
  }
  if (days < DAYS_PER_YEAR) {
    return `${oneDecimal(days / DAYS_PER_MONTH)} ay`;
  }
  return `${oneDecimal(days / DAYS_PER_YEAR)} yıl`;
}
