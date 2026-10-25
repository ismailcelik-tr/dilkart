const TIME_BYTES = 6;
const VERSION = 0x70;
const VARIANT = 0x80;

/** RFC 9562 UUIDv7: 48-bit ms timestamp, then random bits. */
export function uuidv7(now = Date.now()): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  for (let i = 0; i < TIME_BYTES; i++) {
    b[i] = Math.floor(now / 2 ** (8 * (TIME_BYTES - 1 - i))) % 256;
  }
  b[6] = ((b[6] ?? 0) & 0x0f) | VERSION;
  b[8] = ((b[8] ?? 0) & 0x3f) | VARIANT;

  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}
