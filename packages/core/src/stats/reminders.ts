// Daily study reminders; docs/superpowers/specs/2026-10-28-reminders-design.md.
import { dayKey, dayStart } from "../fsrs/day";

export const REMINDER_DAYS = 7;
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1_440;

export interface Reminder {
  at: Date;
  title: string;
  body: string;
}

export interface ReminderInput {
  now: number;
  /** Minutes after local midnight. */
  minute: number;
  dayStartHour: number;
  tzOffsetMin: number;
  /** Today has an answer. */
  studied: boolean;
  streak: number;
  /** Due cards per day from today. */
  due: number[];
}

/** One reminder per study day from today; each assumes no study until it fires. */
export function reminderPlan(input: ReminderInput): Reminder[] {
  const { now, minute, dayStartHour, tzOffsetMin, studied, streak, due } = input;
  const today = dayKey(new Date(now), dayStartHour, tzOffsetMin);
  // A time before the day start belongs to the night after that study day's midnight.
  const sinceDayStart = (minute - dayStartHour * MINUTES_PER_HOUR + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const reminders: Reminder[] = [];
  let waiting = 0;

  for (let d = 0; d < REMINDER_DAYS; d++) {
    waiting += due[d] ?? 0;
    const at = new Date(dayStart(today + d, dayStartHour, tzOffsetMin).getTime() + sinceDayStart * MS_PER_MINUTE);
    if (d === 0 && (studied || at.getTime() <= now)) {
      continue;
    }

    const alive = streak > 0 && (d === 0 || (d === 1 && studied));
    reminders.push({ at, ...text(alive, streak, waiting) });
  }
  return reminders;
}

function text(alive: boolean, streak: number, waiting: number): { title: string; body: string } {
  const title = alive ? `🔥 ${streak} günlük serin bitmesin` : "Çalışma zamanı";
  if (waiting > 0) {
    return { title, body: `Bugün ${waiting} kart seni bekliyor` };
  }
  return { title, body: alive ? "Birkaç kart çalış, seri sürsün" : "Yeni bir seri başlat" };
}
