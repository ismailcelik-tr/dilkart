// PoC-A: on-device dictionary latency and accuracy. Dev-only screen; removed after the decision gate.
import { Direction, lookup, searchKey, type SqlReader } from "@dilkart/core";
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";

import { sqlReader } from "@/drivers/sqlReader";

type GoldRow = [string, string[]];

// Both files are copied from tools/dictionary/data/out and are not in git.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PACK: number = require("@/assets/dictionary/dictionary.sqlite");
const GOLD: Record<Direction, GoldRow[]> = require("@/assets/dictionary/bench.json");
const TOP_RESULTS = 3;
const PREFIX_CHARS = 3;
const P95 = 0.95;

interface Row {
  direction: Direction;
  correct: number;
  total: number;
  exactP50: number;
  exactP95: number;
  prefixP50: number;
  prefixP95: number;
}

function percentile(samples: number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
}

function isCorrect(direction: Direction, glosses: string[], answers: string[]): boolean {
  const keys = glosses.map(searchKey);
  return answers.some((a) => {
    const answer = searchKey(a);
    return keys.some((k) =>
      direction === Direction.EnEn
        ? k.split(" ").some((t) => t.startsWith(answer))
        : ` ${k} `.includes(` ${answer} `),
    );
  });
}

async function measure(db: SqlReader, direction: Direction): Promise<Row> {
  const exact: number[] = [];
  const prefix: number[] = [];
  let correct = 0;
  for (const [query, answers] of GOLD[direction]) {
    let t = performance.now();
    const results = await lookup(db, query, direction, { limit: TOP_RESULTS });
    exact.push(performance.now() - t);
    correct += Number(isCorrect(direction, results.flatMap((r) => r.senses.map((s) => s.gloss)), answers));

    t = performance.now();
    await lookup(db, query.slice(0, PREFIX_CHARS), direction, { prefix: true });
    prefix.push(performance.now() - t);
  }
  return {
    direction,
    correct,
    total: GOLD[direction].length,
    exactP50: percentile(exact, 0.5),
    exactP95: percentile(exact, P95),
    prefixP50: percentile(prefix, 0.5),
    prefixP95: percentile(prefix, P95),
  };
}

function Bench({ openedAt }: { openedAt: number }) {
  const db = useSQLiteContext();
  const [rows, setRows] = useState<Row[]>([]);
  const [openMs] = useState(() => performance.now() - openedAt);

  useEffect(() => {
    (async () => {
      const reader = sqlReader(db);
      const measured: Row[] = [];
      for (const d of [Direction.EnTr, Direction.TrEn, Direction.EnEn]) {
        measured.push(await measure(reader, d));
      }
      setRows(measured);
      console.log("BENCH", JSON.stringify({ openMs, rows: measured }));
    })();
  }, [db, openMs]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text>Paket açılışı: {openMs.toFixed(0)} ms</Text>
      {rows.length === 0 && <Text>Ölçülüyor…</Text>}
      {rows.map((r) => (
        <Text key={r.direction}>
          {r.direction}: {r.correct}/{r.total} doğru · tam p50 {r.exactP50.toFixed(1)} / p95 {r.exactP95.toFixed(1)} ms ·
          önek p50 {r.prefixP50.toFixed(1)} / p95 {r.prefixP95.toFixed(1)} ms
        </Text>
      ))}
    </ScrollView>
  );
}

export default function DictionaryBench() {
  const [openedAt] = useState(() => performance.now());
  return (
    <SQLiteProvider databaseName="dictionary.sqlite" assetSource={{ assetId: PACK }}>
      <Bench openedAt={openedAt} />
    </SQLiteProvider>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16 },
});
