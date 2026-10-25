const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/**
 * Study day number; a study day starts at `dayStartHour` local time.
 * `tzOffsetMin` is minutes east of UTC (Istanbul = 180), the review_logs.tz_offset_min convention.
 */
export function dayKey(at: Date | string, dayStartHour: number, tzOffsetMin: number): number {
  const local = new Date(at).getTime() + tzOffsetMin * MS_PER_MINUTE - dayStartHour * MS_PER_HOUR;
  return Math.floor(local / MS_PER_DAY);
}

/** First instant of study day `key`. */
export function dayStart(key: number, dayStartHour: number, tzOffsetMin: number): Date {
  return new Date(key * MS_PER_DAY + dayStartHour * MS_PER_HOUR - tzOffsetMin * MS_PER_MINUTE);
}
