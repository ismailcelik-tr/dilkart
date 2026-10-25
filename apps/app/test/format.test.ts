import { intervalLabel } from "@/ui/format";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

it.each([
  [30_000, "1 dk"],
  [MIN, "1 dk"],
  [10 * MIN, "10 dk"],
  [3 * HOUR, "3 sa"],
  [2 * DAY, "2 g"],
  [45 * DAY, "1,5 ay"],
  [60 * DAY, "2 ay"],
  [400 * DAY, "1,1 yıl"],
])("%d ms → %s", (ms, label) => {
  expect(intervalLabel(ms)).toBe(label);
});
