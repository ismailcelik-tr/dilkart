"""PoC-A measurements: coverage of frequent words and lookup latency."""

import argparse
import sqlite3
import statistics
import time
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

from dilkart_dict.gold import Match, evaluate, read_gold
from dilkart_dict.lookup import Direction, lookup

__all__ = ["Coverage", "coverage", "latency_ms"]

_SAMPLE_MISSES = 40
_PERCENTILES = 100
_P95 = 94  # index into statistics.quantiles(n=100)
_GOLD = Path(__file__).parents[2] / "gold"
_GOLD_RUNS = [
    (Direction.EN_TR, Match.EQUIVALENT),
    (Direction.TR_EN, Match.EQUIVALENT),
    (Direction.EN_EN, Match.KEYWORD),
]


@dataclass
class Coverage:
    total: int
    found: int
    with_examples: int
    misses: list[str]

    @property
    def found_pct(self) -> float:
        return 100 * self.found / self.total

    @property
    def examples_pct(self) -> float:
        return 100 * self.with_examples / self.found


def coverage(conn: sqlite3.Connection, words: Iterable[str], direction: Direction) -> Coverage:
    result = Coverage(0, 0, 0, [])
    for w in words:
        if not w.isalpha():
            continue

        result.total += 1
        hits = lookup(conn, w, direction, limit=3)
        if not hits:
            result.misses.append(w)
            continue

        result.found += 1
        result.with_examples += any(h.examples for h in hits)
    return result


def latency_ms(conn: sqlite3.Connection, words: list[str], direction: Direction, prefix: bool) -> tuple[float, float]:
    """(p50, p95) of one full lookup including result hydration."""
    samples = []
    for w in words:
        started = time.perf_counter()
        lookup(conn, w[:3] if prefix else w, direction, prefix=prefix)
        samples.append((time.perf_counter() - started) * 1000)
    q = statistics.quantiles(samples, n=_PERCENTILES)
    return statistics.median(samples), q[_P95]


def main() -> None:
    from wordfreq import top_n_list

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pack", type=Path)
    parser.add_argument("--en", type=int, default=10_000)
    parser.add_argument("--tr", type=int, default=5_000)
    args = parser.parse_args()

    conn = sqlite3.connect(f"file:{args.pack}?mode=ro", uri=True)
    lists = {"en": top_n_list("en", args.en), "tr": top_n_list("tr", args.tr)}
    runs = [(Direction.EN_TR, "en"), (Direction.EN_EN, "en"), (Direction.TR_EN, "tr")]

    print(f"Pack: {args.pack.stat().st_size / 1e6:.1f} MB\n")
    print("| Direction | Words | Found | With example | p50 / p95 exact (ms) | p50 / p95 prefix (ms) |")
    print("|---|---|---|---|---|---|")
    misses = {}
    for direction, lang in runs:
        c = coverage(conn, lists[lang], direction)
        exact = latency_ms(conn, lists[lang][:2000], direction, prefix=False)
        pre = latency_ms(conn, lists[lang][:2000], direction, prefix=True)
        print(
            f"| {direction} | {c.total} | {c.found_pct:.1f}% | {c.examples_pct:.1f}% "
            f"| {exact[0]:.2f} / {exact[1]:.2f} | {pre[0]:.2f} / {pre[1]:.2f} |"
        )
        misses[direction] = c.misses

    print("\n| Gold set | Correct in top 3 |\n|---|---|")
    failures = {}
    for direction, match in _GOLD_RUNS:
        g = evaluate(conn, read_gold(_GOLD / f"{direction}.tsv"), direction, match)
        print(f"| {direction} | {g.hits}/{g.total} ({g.pct:.0f}%) |")
        failures[direction] = g.failures
    for direction, items in failures.items():
        for query, glosses in items:
            print(f"\n{direction} gold miss: {query} → {glosses}")

    for direction, words in misses.items():
        print(f"\n{direction} misses (first {_SAMPLE_MISSES} of {len(words)}): {', '.join(words[:_SAMPLE_MISSES])}")


if __name__ == "__main__":
    main()
