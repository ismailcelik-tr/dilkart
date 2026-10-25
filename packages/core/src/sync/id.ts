const TIME_BYTES = 6;
const VERSION = 0x70;
const VARIANT = 0x80;
const MAX_COUNTER = 0xfff;
// A fresh millisecond starts the counter in its lower half, leaving room to count up.
const COUNTER_SEED_RANGE = 0x800;

let lastMs = -1;
let counter = 0;

/**
 * RFC 9562 UUIDv7 with a 12-bit counter in rand_a (method 1): ids made in the
 * same millisecond, or while the clock steps back, still sort in creation order.
 */
export function uuidv7(now = Date.now()): string {
  let ms = now;
  if (ms <= lastMs) {
    ms = lastMs;
    counter++;
    if (counter > MAX_COUNTER) {
      ms++;
      counter = 0;
    }
  } else {
    counter = Math.floor(Math.random() * COUNTER_SEED_RANGE);
  }
  lastMs = ms;

  const b = crypto.getRandomValues(new Uint8Array(16));
  for (let i = 0; i < TIME_BYTES; i++) {
    b[i] = Math.floor(ms / 2 ** (8 * (TIME_BYTES - 1 - i))) % 256;
  }
  b[6] = VERSION | (counter >> 8);
  b[7] = counter & 0xff;
  b[8] = ((b[8] ?? 0) & 0x3f) | VARIANT;

  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}
