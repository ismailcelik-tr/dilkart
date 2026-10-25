// Field-wise last-writer-wins; mirrors lww_merge in supabase/migrations.

export type Values = Record<string, unknown>;
export type Clock = Record<string, string>;

export interface Clocked {
  values: Values;
  clock: Clock;
}

export const TOMBSTONE = "deleted_at";

/** Newer clock wins per field; a tombstone wins over edits and the earliest one is kept. */
export function merge(local: Clocked, remote: Clocked): Clocked {
  const values: Values = {};
  const clock: Clock = {};
  const fields = new Set([...Object.keys(local.values), ...Object.keys(remote.values)]);

  for (const field of fields) {
    const winner = pick(field, local, remote);
    values[field] = winner.values[field];
    if (winner.clock[field] !== undefined) {
      clock[field] = winner.clock[field];
    }
  }
  return { values, clock };
}

function pick(field: string, a: Clocked, b: Clocked): Clocked {
  if (!(field in b.values)) {
    return a;
  }
  if (!(field in a.values)) {
    return b;
  }

  const ca = a.clock[field] ?? "";
  const cb = b.clock[field] ?? "";
  if (field !== TOMBSTONE) {
    return cb > ca ? b : a;
  }

  const deadA = a.values[field] != null;
  const deadB = b.values[field] != null;
  if (deadA !== deadB) {
    return deadA ? a : b;
  }
  return cb < ca ? b : a;
}
