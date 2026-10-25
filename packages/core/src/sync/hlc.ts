// Hybrid logical clock. Encoded form sorts as text, so Postgres compares it
// with plain `text COLLATE "C"`; must match supabase/migrations hlc format.

export interface Hlc {
  wall: number;
  counter: number;
  node: string;
}

const WALL_DIGITS = 15;
const COUNTER_DIGITS = 4;
const MAX_COUNTER = 10 ** COUNTER_DIGITS - 1;
const SEP = "-";

export const zero = (node: string): Hlc => ({ wall: 0, counter: 0, node });

export function encode({ wall, counter, node }: Hlc): string {
  const w = String(wall).padStart(WALL_DIGITS, "0");
  const c = String(counter).padStart(COUNTER_DIGITS, "0");
  return [w, c, node].join(SEP);
}

export function decode(text: string): Hlc {
  const wall = text.slice(0, WALL_DIGITS);
  const counter = text.slice(WALL_DIGITS + 1, WALL_DIGITS + 1 + COUNTER_DIGITS);
  const node = text.slice(WALL_DIGITS + COUNTER_DIGITS + 2);
  return { wall: Number(wall), counter: Number(counter), node };
}

/** Clock for a local event at wall time `now` (ms). */
export function tick(last: Hlc, now: number): Hlc {
  if (now > last.wall) {
    return { wall: now, counter: 0, node: last.node };
  }
  return { wall: last.wall, counter: next(last.counter), node: last.node };
}

/** Clock after observing `remote` at wall time `now` (ms). */
export function receive(last: Hlc, remote: Hlc, now: number): Hlc {
  const wall = Math.max(last.wall, remote.wall, now);
  if (wall === now && now > last.wall && now > remote.wall) {
    return { wall, counter: 0, node: last.node };
  }

  let counter = -1;
  if (wall === last.wall) {
    counter = last.counter;
  }
  if (wall === remote.wall) {
    counter = Math.max(counter, remote.counter);
  }
  return { wall, counter: next(counter), node: last.node };
}

function next(counter: number): number {
  if (counter >= MAX_COUNTER) {
    throw new RangeError("hlc counter overflow");
  }
  return counter + 1;
}
