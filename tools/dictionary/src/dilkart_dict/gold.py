"""Gold-set accuracy: is a correct answer among the top results?"""

import sqlite3
from collections.abc import Iterable
from dataclasses import dataclass, field
from enum import Enum, auto
from pathlib import Path

from dilkart_dict.lookup import Direction, lookup
from dilkart_dict.normalize import search_key

__all__ = ["Match", "GoldResult", "evaluate", "read_gold"]

_TOP_RESULTS = 3
_SHOWN_GLOSSES = 4


class Match(Enum):
    EQUIVALENT = auto()  # an accepted translation appears inside a gloss
    KEYWORD = auto()  # a definition contains a word starting with the keyword


@dataclass
class GoldResult:
    total: int = 0
    hits: int = 0
    failures: list[tuple[str, list[str]]] = field(default_factory=list)

    @property
    def pct(self) -> float:
        return 100 * self.hits / self.total


def _contains(gloss_key: str, answer_key: str) -> bool:
    return f" {answer_key} " in f" {gloss_key} "


def _has_keyword(gloss_key: str, keyword_key: str) -> bool:
    return any(t.startswith(keyword_key) for t in gloss_key.split())


def evaluate(
    conn: sqlite3.Connection, rows: Iterable[tuple[str, list[str]]], direction: Direction, match: Match
) -> GoldResult:
    test = _contains if match == Match.EQUIVALENT else _has_keyword
    result = GoldResult()
    for query, answers in rows:
        result.total += 1
        glosses = [s.gloss for r in lookup(conn, query, direction, limit=_TOP_RESULTS) for s in r.senses]
        keys = [search_key(g) for g in glosses]
        if any(test(k, search_key(a)) for k in keys for a in answers):
            result.hits += 1
        else:
            result.failures.append((query, glosses[:_SHOWN_GLOSSES]))
    return result


def read_gold(path: Path) -> list[tuple[str, list[str]]]:
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        query, answers = line.split("\t")
        rows.append((query, answers.split("|")))
    return rows
