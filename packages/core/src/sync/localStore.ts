// Per-user device database: synced rows, outbox and sync state.
import type { SqlReader } from "../dictionary/lookup";
import { decode, encode, receive, tick, zero, type Hlc } from "./hlc";
import { uuidv7 } from "./id";
import { merge, type Clock, type Clocked, type Values } from "./merge";

export interface SqlDriver extends SqlReader {
  run(sql: string, params: unknown[]): Promise<void>;
  exec(sql: string): Promise<void>;
  /** Runs `fn` exclusively in one transaction. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
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

export interface Pending {
  seq: number;
  op: Op;
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
  },
};

const SQL_TYPE: Record<Kind, string> = {
  [Kind.Text]: "TEXT",
  [Kind.Int]: "INTEGER",
  [Kind.Real]: "REAL",
  [Kind.Bool]: "INTEGER",
  [Kind.Json]: "TEXT",
};

const HLC_KEY = "hlc";
const CURSOR_KEY = "cursor";

const isLww = (table: Table) => table !== Table.ReviewLogs;

function ddl(table: Table): string {
  const cols = Object.entries(COLUMNS[table]).map(([name, kind]) => `${name} ${SQL_TYPE[kind]}`);
  const clock = isLww(table) ? ", field_clock TEXT NOT NULL DEFAULT '{}'" : "";
  return `CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, ${cols.join(", ")}${clock});`;
}

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

/** Keeps only known columns of `table`; throws on unknown ones when `strict`. */
function columns(table: Table, values: Values, strict: boolean): Values {
  const known = COLUMNS[table];
  const out: Values = {};
  for (const [k, v] of Object.entries(values)) {
    if (k in known) {
      out[k] = v;
    } else if (strict) {
      throw new Error(`unknown column ${table}.${k}`);
    }
  }
  return out;
}

export class LocalStore {
  private hlc: Hlc;

  constructor(
    private readonly db: SqlDriver,
    node: string,
    private readonly now: () => number = Date.now,
  ) {
    this.hlc = zero(node);
  }

  async open(): Promise<void> {
    const tables = Object.values(Table).map(ddl).join("\n");
    await this.db.exec(`${tables}
      CREATE TABLE IF NOT EXISTS outbox (seq INTEGER PRIMARY KEY AUTOINCREMENT, op TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sync_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);

    const saved = await this.state(HLC_KEY);
    if (saved !== undefined) {
      this.hlc = { ...decode(saved), node: this.hlc.node };
    }
  }

  /** Field-wise edit of a synced row (creates it if missing). */
  async write(table: Exclude<Table, Table.ReviewLogs>, id: string, changes: Values): Promise<void> {
    const values = columns(table, changes, true);
    await this.db.transaction(async () => {
      const hlc = await this.tick();
      const clock = (await this.clocked(table, id))?.clock ?? {};
      const base = Object.fromEntries(Object.keys(values).map((f) => [f, clock[f] ?? null]));
      for (const f of Object.keys(values)) {
        clock[f] = hlc;
      }

      await this.upsert(table, id, values, clock);
      await this.enqueue({ op_id: uuidv7(this.now()), table, row_id: id, values, base, hlc });
    });
  }

  /** Review logs are insert-only. */
  async append(id: string, log: Values): Promise<void> {
    const values = columns(Table.ReviewLogs, log, true);
    await this.db.transaction(async () => {
      const hlc = await this.tick();
      await this.insertLog(id, values);
      await this.enqueue({ op_id: uuidv7(this.now()), table: Table.ReviewLogs, row_id: id, values, base: {}, hlc });
    });
  }

  async read(table: Table, id: string): Promise<Values | undefined> {
    const [row] = await this.db.all<Values>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    if (row === undefined) {
      return undefined;
    }

    const out: Values = { id: row.id };
    for (const [k, kind] of Object.entries(COLUMNS[table])) {
      out[k] = fromSql(kind, row[k]);
    }
    return out;
  }

  async pending(limit: number): Promise<Pending[]> {
    const rows = await this.db.all<{ seq: number; op: string }>(
      "SELECT seq, op FROM outbox ORDER BY seq LIMIT ?",
      [limit],
    );
    return rows.map((r) => ({ seq: r.seq, op: JSON.parse(r.op) as Op }));
  }

  /** Drops ops up to `seq` once the server has applied them. */
  async ack(seq: number): Promise<void> {
    await this.db.run("DELETE FROM outbox WHERE seq <= ?", [seq]);
  }

  async cursor(): Promise<number> {
    return Number((await this.state(CURSOR_KEY)) ?? 0);
  }

  /** Merges pulled rows and moves the cursor past them, atomically. */
  async applyRemote(rows: RemoteRow[]): Promise<void> {
    const last = rows.at(-1);
    if (last === undefined) {
      return;
    }

    await this.db.transaction(async () => {
      let newest = "";
      for (const { tbl, data } of rows) {
        const values = columns(tbl, data, false);
        if (!isLww(tbl)) {
          await this.insertLog(String(data.id), values);
          continue;
        }

        const id = tbl === Table.Settings ? SETTINGS_ID : String(data.id);
        const remote: Clocked = { values, clock: (data.field_clock ?? {}) as Clock };
        const local = await this.clocked(tbl, id);
        const merged = local ? merge(local, remote) : remote;
        await this.upsert(tbl, id, merged.values, merged.clock);

        for (const c of Object.values(remote.clock)) {
          newest = c > newest ? c : newest;
        }
      }

      if (newest !== "") {
        this.hlc = receive(this.hlc, decode(newest), this.now());
        await this.setState(HLC_KEY, encode(this.hlc));
      }
      await this.setState(CURSOR_KEY, String(last.seq));
    });
  }

  private async tick(): Promise<string> {
    this.hlc = tick(this.hlc, this.now());
    const hlc = encode(this.hlc);
    await this.setState(HLC_KEY, hlc);
    return hlc;
  }

  private async clocked(table: Table, id: string): Promise<Clocked | undefined> {
    const values = await this.read(table, id);
    if (values === undefined) {
      return undefined;
    }

    const [row] = await this.db.all<{ field_clock: string }>(`SELECT field_clock FROM ${table} WHERE id = ?`, [id]);
    delete values.id;
    return { values, clock: JSON.parse(row?.field_clock ?? "{}") as Clock };
  }

  private async upsert(table: Table, id: string, values: Values, clock: Clock): Promise<void> {
    const kinds = COLUMNS[table];
    const names = Object.keys(values);
    const cols = ["id", ...names, "field_clock"];
    const updates = [...names, "field_clock"].map((c) => `${c} = excluded.${c}`);
    await this.db.run(
      `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})
       ON CONFLICT (id) DO UPDATE SET ${updates.join(", ")}`,
      [id, ...names.map((n) => toSql(kinds[n] ?? Kind.Text, values[n])), JSON.stringify(clock)],
    );
  }

  private async insertLog(id: string, values: Values): Promise<void> {
    const kinds = COLUMNS[Table.ReviewLogs];
    const names = Object.keys(values);
    await this.db.run(
      `INSERT OR IGNORE INTO ${Table.ReviewLogs} (id, ${names.join(", ")}) VALUES (?${", ?".repeat(names.length)})`,
      [id, ...names.map((n) => toSql(kinds[n] ?? Kind.Text, values[n]))],
    );
  }

  private async enqueue(op: Op): Promise<void> {
    await this.db.run("INSERT INTO outbox (op) VALUES (?)", [JSON.stringify(op)]);
  }

  private async state(key: string): Promise<string | undefined> {
    const [row] = await this.db.all<{ value: string }>("SELECT value FROM sync_state WHERE key = ?", [key]);
    return row?.value;
  }

  private async setState(key: string, value: string): Promise<void> {
    await this.db.run(
      "INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      [key, value],
    );
  }
}
