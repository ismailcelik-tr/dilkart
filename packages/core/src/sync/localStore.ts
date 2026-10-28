// Per-user device database: synced rows, outbox and sync state.
import type { SqlReader } from "../dictionary/lookup";
import { decode, encode, receive, tick, zero, type Hlc } from "./hlc";
import { uuidv7 } from "./id";
import { merge, type Clock, type Clocked, type Values } from "./merge";

export interface SqlExecutor extends SqlReader {
  run(sql: string, params: unknown[]): Promise<void>;
  exec(sql: string): Promise<void>;
}

export interface SqlDriver extends SqlExecutor {
  /** Runs `fn` exclusively in one transaction; statements inside must use `tx`. */
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}

export enum Table {
  Decks = "decks",
  Cards = "cards",
  ReviewLogs = "review_logs",
  Settings = "user_settings",
}

/** Wire format of sync_push; see supabase/migrations sync_rpc. */
export interface Op {
  op_id: string;
  table: Table;
  row_id: string;
  values: Values;
  base: Record<string, string | null>;
  hlc: string;
}

export type LwwTable = Exclude<Table, Table.ReviewLogs>;

export interface Edit {
  table: LwwTable;
  id: string;
  changes: Values;
}

export interface Pending {
  seq: number;
  op: Op;
}

export interface Failed extends Pending {
  error: string;
  failedAt: string;
}

export interface RemoteRow {
  seq: number;
  tbl: Table;
  data: Values;
}

/** The server keys settings by user; locally there is one row. */
export const SETTINGS_ID = "settings";

enum Kind {
  Text = "text",
  Int = "int",
  Real = "real",
  Bool = "bool",
  Json = "json",
}

const COLUMNS: Record<Table, Record<string, Kind>> = {
  [Table.Decks]: { name: Kind.Text, deleted_at: Kind.Text },
  [Table.Cards]: {
    deck_id: Kind.Text,
    front: Kind.Text,
    usage_label: Kind.Text,
    meanings: Kind.Json,
    example_en: Kind.Text,
    example_tr: Kind.Text,
    dict_entry_id: Kind.Text,
    dict_sense_id: Kind.Text,
    is_weak: Kind.Bool,
    weak_since: Kind.Text,
    weak_dismissed_until: Kind.Text,
    fsrs_state: Kind.Json,
    deleted_at: Kind.Text,
  },
  [Table.ReviewLogs]: {
    card_id: Kind.Text,
    reviewed_at: Kind.Text,
    rating: Kind.Int,
    mode: Kind.Int,
    tz_offset_min: Kind.Int,
    elapsed_ms: Kind.Int,
    scheduled: Kind.Bool,
  },
  [Table.Settings]: {
    daily_new_limit: Kind.Int,
    daily_review_limit: Kind.Int,
    day_start_hour: Kind.Int,
    desired_retention: Kind.Real,
    tts_accent: Kind.Text,
    daily_goal: Kind.Int,
  },
};

const CLOCK = "field_clock TEXT NOT NULL DEFAULT '{}'";

// Append-only: never edit a shipped entry. After entry i runs, user_version = i + 1.
const MIGRATIONS = [
  `CREATE TABLE decks (id TEXT PRIMARY KEY, name TEXT, deleted_at TEXT, ${CLOCK});
   CREATE TABLE cards (id TEXT PRIMARY KEY, deck_id TEXT, front TEXT, usage_label TEXT, meanings TEXT,
     example_en TEXT, example_tr TEXT, dict_entry_id TEXT, dict_sense_id TEXT, is_weak INTEGER,
     weak_dismissed_until TEXT, fsrs_state TEXT, deleted_at TEXT, ${CLOCK});
   CREATE TABLE review_logs (id TEXT PRIMARY KEY, card_id TEXT, reviewed_at TEXT, rating INTEGER, mode INTEGER,
     tz_offset_min INTEGER, elapsed_ms INTEGER, scheduled INTEGER);
   CREATE TABLE user_settings (id TEXT PRIMARY KEY, daily_new_limit INTEGER, daily_review_limit INTEGER,
     day_start_hour INTEGER, desired_retention REAL, tts_accent TEXT, ${CLOCK});
   CREATE TABLE outbox (seq INTEGER PRIMARY KEY AUTOINCREMENT, op TEXT NOT NULL);
   CREATE TABLE sync_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
  `CREATE INDEX IF NOT EXISTS cards_deck ON cards (deck_id);
   CREATE INDEX IF NOT EXISTS review_logs_card ON review_logs (card_id);`,
  // Device-only (plan section 16, item 10); never synced.
  `CREATE TABLE recent_searches (direction TEXT NOT NULL, key TEXT NOT NULL, query TEXT NOT NULL,
     searched_at TEXT NOT NULL, PRIMARY KEY (direction, key));
   CREATE INDEX cards_dict_sense ON cards (dict_sense_id);`,
  `CREATE TABLE outbox_failed (seq INTEGER PRIMARY KEY, op TEXT NOT NULL, error TEXT NOT NULL, failed_at TEXT NOT NULL);`,
  `ALTER TABLE cards ADD COLUMN weak_since TEXT;`,
  `ALTER TABLE user_settings ADD COLUMN daily_goal INTEGER;`,
];

export const LOCAL_SCHEMA_VERSION = MIGRATIONS.length;

/** Columns the store reads and writes, per table; tests check migrations create them. */
export const mappedColumns = () =>
  Object.fromEntries(Object.entries(COLUMNS).map(([t, cols]) => [t, ["id", ...Object.keys(cols)]]));

// Device-only caches derived from synced data; never written through the outbox.
const DERIVED: Partial<Record<Table, string[]>> = { [Table.Cards]: ["fsrs_state"] };
const FSRS_STATE = "fsrs_state";

const HLC_KEY = "hlc";
const NODE_KEY = "node";
const CURSOR_KEY = "cursor";

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_DAY = 86_400;

const isLww = (table: Table) => table !== Table.ReviewLogs;

function toSql(kind: Kind, v: unknown): unknown {
  if (v == null) {
    return null;
  }
  if (kind === Kind.Json) {
    return JSON.stringify(v);
  }
  if (kind === Kind.Bool) {
    return v ? 1 : 0;
  }
  return v;
}

function fromSql(kind: Kind, v: unknown): unknown {
  if (v == null) {
    return null;
  }
  if (kind === Kind.Json) {
    return JSON.parse(String(v));
  }
  if (kind === Kind.Bool) {
    return v === 1;
  }
  return v;
}

/** Keeps only synced columns of `table`; throws on unknown or derived ones when `strict`. */
function columns(table: Table, values: Values, strict: boolean): Values {
  const known = COLUMNS[table];
  const derived = DERIVED[table] ?? [];
  const out: Values = {};
  for (const [k, v] of Object.entries(values)) {
    if (k in known && !derived.includes(k)) {
      out[k] = v;
    } else if (strict) {
      throw new Error(`not a synced column: ${table}.${k}`);
    }
  }
  return out;
}

export class LocalStore {
  private hlc: Hlc;
  private readonly listeners = new Set<() => void>();

  /** Without `node`, the database keeps its own generated device id. */
  constructor(
    private readonly db: SqlDriver,
    private readonly node?: string,
    private readonly now: () => number = Date.now,
  ) {
    this.hlc = zero(node ?? "");
  }

  async open(): Promise<void> {
    await migrate(this.db);

    let node = this.node ?? (await state(this.db, NODE_KEY));
    if (node === undefined) {
      node = uuidv7(this.now());
      await setState(this.db, NODE_KEY, node);
    }

    const saved = await state(this.db, HLC_KEY);
    this.hlc = saved === undefined ? zero(node) : { ...decode(saved), node };
  }

  /** Called after each committed local write; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Field-wise edit of a synced row (creates it if missing). */
  write(table: LwwTable, id: string, changes: Values): Promise<void> {
    return this.writeAll([{ table, id, changes }]);
  }

  /** Several edits in one transaction: all apply or none. */
  async writeAll(edits: Edit[]): Promise<void> {
    const checked = edits.map((e) => ({ ...e, changes: columns(e.table, e.changes, true) }));
    await this.db.transaction(async (tx) => {
      for (const { table, id, changes } of checked) {
        const hlc = await this.tick(tx);
        const clock = (await clocked(tx, table, id))?.clock ?? {};
        const base = Object.fromEntries(Object.keys(changes).map((f) => [f, clock[f] ?? null]));
        for (const f of Object.keys(changes)) {
          clock[f] = hlc;
        }

        await upsert(tx, table, id, changes, clock);
        await enqueue(tx, { op_id: uuidv7(this.now()), table, row_id: id, values: changes, base, hlc });
      }
    });
    this.changed();
  }

  /** Review logs are insert-only. */
  append(id: string, log: Values): Promise<void> {
    return this.appendAll([{ id, log }]);
  }

  async appendAll(logs: { id: string; log: Values }[]): Promise<void> {
    const checked = logs.map(({ id, log }) => ({ id, values: columns(Table.ReviewLogs, log, true) }));
    await this.db.transaction(async (tx) => {
      for (const { id, values } of checked) {
        const hlc = await this.tick(tx);
        await insertLog(tx, id, values);
        await enqueue(tx, { op_id: uuidv7(this.now()), table: Table.ReviewLogs, row_id: id, values, base: {}, hlc });
      }
    });
    this.changed();
  }

  read(table: Table, id: string): Promise<Values | undefined> {
    return readRow(this.db, table, id);
  }

  /** Stores a card's derived FSRS state; local only. */
  async cacheFsrs(cardId: string, state: unknown): Promise<void> {
    await this.db.run(`UPDATE ${Table.Cards} SET ${FSRS_STATE} = ? WHERE id = ?`, [
      toSql(Kind.Json, state),
      cardId,
    ]);
  }

  /** Rows matching a trusted SQL condition, decoded like `read`. */
  async select(table: Table, where: string, params: unknown[]): Promise<Values[]> {
    const rows = await this.db.all<Values>(`SELECT * FROM ${table} WHERE ${where}`, params);
    return rows.map((row) => decodeRow(table, row));
  }

  /** Answers per study day, oldest first; `day` is `dayKey`'s number. */
  answersPerDay(dayStartHour: number, tzOffsetMin: number): Promise<{ day: number; count: number }[]> {
    // dayKey in SQL: whole seconds suffice, day boundaries fall on whole minutes.
    const shift = tzOffsetMin * SECONDS_PER_MINUTE - dayStartHour * SECONDS_PER_HOUR;
    return this.db.all<{ day: number; count: number }>(
      `SELECT (CAST(strftime('%s', reviewed_at) AS INTEGER) + CAST(? AS INTEGER)) / ${SECONDS_PER_DAY} AS day, COUNT(*) AS count
       FROM ${Table.ReviewLogs} GROUP BY day ORDER BY day`,
      [shift],
    );
  }

  async pending(limit: number): Promise<Pending[]> {
    const rows = await this.db.all<{ seq: number; op: string }>(
      "SELECT seq, op FROM outbox ORDER BY seq LIMIT ?",
      [limit],
    );
    return rows.map((r) => ({ seq: r.seq, op: JSON.parse(r.op) as Op }));
  }

  /** Moves an op the server will never accept out of the outbox. */
  async fail(seq: number, error: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.run(
        "INSERT INTO outbox_failed (seq, op, error, failed_at) SELECT seq, op, ?, ? FROM outbox WHERE seq = ?",
        [error, new Date(this.now()).toISOString(), seq],
      );
      await tx.run("DELETE FROM outbox WHERE seq = ?", [seq]);
    });
  }

  async counts(): Promise<{ pending: number; failed: number }> {
    const [row] = await this.db.all<{ pending: number; failed: number }>(
      "SELECT (SELECT count(*) FROM outbox) AS pending, (SELECT count(*) FROM outbox_failed) AS failed",
      [],
    );
    return { pending: row?.pending ?? 0, failed: row?.failed ?? 0 };
  }

  async failed(): Promise<Failed[]> {
    const rows = await this.db.all<{ seq: number; op: string; error: string; failed_at: string }>(
      "SELECT seq, op, error, failed_at FROM outbox_failed ORDER BY seq",
      [],
    );
    return rows.map((r) => ({ seq: r.seq, op: JSON.parse(r.op) as Op, error: r.error, failedAt: r.failed_at }));
  }

  /** Drops ops up to `seq` once the server has applied them. */
  async ack(seq: number): Promise<void> {
    await this.db.run("DELETE FROM outbox WHERE seq <= ?", [seq]);
  }

  async cursor(): Promise<number> {
    return Number((await state(this.db, CURSOR_KEY)) ?? 0);
  }

  /** Merges pulled rows and moves the cursor past them, atomically. Returns cards whose logs arrived. */
  async applyRemote(rows: RemoteRow[]): Promise<string[]> {
    const last = rows.at(-1);
    if (last === undefined) {
      return [];
    }

    const touched = new Set<string>();
    await this.db.transaction(async (tx) => {
      let newest = "";
      for (const { tbl, data } of rows) {
        const values = columns(tbl, data, false);
        if (!isLww(tbl)) {
          await insertLog(tx, String(data.id), values);
          touched.add(String(data.card_id));
          continue;
        }

        const id = tbl === Table.Settings ? SETTINGS_ID : String(data.id);
        const remote: Clocked = { values, clock: (data.field_clock ?? {}) as Clock };
        const local = await clocked(tx, tbl, id);
        const merged = local ? merge(local, remote) : remote;
        await upsert(tx, tbl, id, merged.values, merged.clock);

        for (const c of Object.values(remote.clock)) {
          newest = c > newest ? c : newest;
        }
      }

      if (newest !== "") {
        this.hlc = receive(this.hlc, decode(newest), this.now());
        await setState(tx, HLC_KEY, encode(this.hlc));
      }
      await setState(tx, CURSOR_KEY, String(last.seq));
    });
    return [...touched];
  }

  private changed(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private async tick(db: SqlExecutor): Promise<string> {
    this.hlc = tick(this.hlc, this.now());
    const hlc = encode(this.hlc);
    await setState(db, HLC_KEY, hlc);
    return hlc;
  }
}

async function migrate(db: SqlDriver): Promise<void> {
  const [row] = await db.all<{ user_version: number }>("PRAGMA user_version", []);
  for (let v = row?.user_version ?? 0; v < MIGRATIONS.length; v++) {
    await db.transaction(async (tx) => {
      await tx.exec(`${MIGRATIONS[v]}\nPRAGMA user_version = ${v + 1};`);
    });
  }
}

async function readRow(db: SqlExecutor, table: Table, id: string): Promise<Values | undefined> {
  const [row] = await db.all<Values>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  return row === undefined ? undefined : decodeRow(table, row);
}

function decodeRow(table: Table, row: Values): Values {
  const out: Values = { id: row.id };
  for (const [k, kind] of Object.entries(COLUMNS[table])) {
    out[k] = fromSql(kind, row[k]);
  }
  return out;
}

async function clocked(db: SqlExecutor, table: Table, id: string): Promise<Clocked | undefined> {
  const values = await readRow(db, table, id);
  if (values === undefined) {
    return undefined;
  }

  const [row] = await db.all<{ field_clock: string }>(`SELECT field_clock FROM ${table} WHERE id = ?`, [id]);
  delete values.id;
  return { values, clock: JSON.parse(row?.field_clock ?? "{}") as Clock };
}

async function upsert(db: SqlExecutor, table: Table, id: string, values: Values, clock: Clock): Promise<void> {
  const kinds = COLUMNS[table];
  const names = Object.keys(values);
  const cols = ["id", ...names, "field_clock"];
  const updates = [...names, "field_clock"].map((c) => `${c} = excluded.${c}`);
  await db.run(
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})
     ON CONFLICT (id) DO UPDATE SET ${updates.join(", ")}`,
    [id, ...names.map((n) => toSql(kinds[n] ?? Kind.Text, values[n])), JSON.stringify(clock)],
  );
}

async function insertLog(db: SqlExecutor, id: string, values: Values): Promise<void> {
  const kinds = COLUMNS[Table.ReviewLogs];
  const names = Object.keys(values);
  await db.run(
    `INSERT OR IGNORE INTO ${Table.ReviewLogs} (id, ${names.join(", ")}) VALUES (?${", ?".repeat(names.length)})`,
    [id, ...names.map((n) => toSql(kinds[n] ?? Kind.Text, values[n]))],
  );
}

async function enqueue(db: SqlExecutor, op: Op): Promise<void> {
  await db.run("INSERT INTO outbox (op) VALUES (?)", [JSON.stringify(op)]);
}

async function state(db: SqlExecutor, key: string): Promise<string | undefined> {
  const [row] = await db.all<{ value: string }>("SELECT value FROM sync_state WHERE key = ?", [key]);
  return row?.value;
}

async function setState(db: SqlExecutor, key: string, value: string): Promise<void> {
  await db.run(
    "INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    [key, value],
  );
}
