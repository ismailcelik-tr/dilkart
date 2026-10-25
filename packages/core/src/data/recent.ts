import type { Direction } from "../dictionary/lookup";
import type { SqlExecutor } from "../sync/localStore";
import { searchKey } from "../text/searchKey";

const LIMIT = 20;

export interface Recent {
  query: string;
  direction: Direction;
}

/** Last dictionary searches on this device; one row per normalized query and direction. */
export class RecentSearches {
  constructor(
    private readonly db: SqlExecutor,
    private readonly now: () => number = Date.now,
  ) {}

  async add(query: string, direction: Direction): Promise<void> {
    const typed = query.trim();
    const key = searchKey(typed);
    if (key === "") {
      return;
    }

    await this.db.run(
      `INSERT INTO recent_searches (direction, key, query, searched_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (direction, key) DO UPDATE SET query = excluded.query, searched_at = excluded.searched_at`,
      [direction, key, typed, new Date(this.now()).toISOString()],
    );
    await this.db.run(
      `DELETE FROM recent_searches WHERE rowid NOT IN
       (SELECT rowid FROM recent_searches ORDER BY searched_at DESC LIMIT ?)`,
      [LIMIT],
    );
  }

  list(): Promise<Recent[]> {
    return this.db.all<Recent>("SELECT query, direction FROM recent_searches ORDER BY searched_at DESC", []);
  }

  async clear(): Promise<void> {
    await this.db.run("DELETE FROM recent_searches", []);
  }
}
