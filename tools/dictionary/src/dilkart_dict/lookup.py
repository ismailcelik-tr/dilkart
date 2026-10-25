"""Reference lookup over the dictionary pack; the app mirrors these queries."""

import sqlite3
from collections.abc import Iterable
from dataclasses import dataclass
from enum import StrEnum

from dilkart_dict.normalize import search_key, turkish_lower
from dilkart_dict.schema import Lang
from dilkart_dict.stem import english_adverb_bases, turkish_stems

__all__ = ["Direction", "Sense", "Result", "lookup"]

_DEFAULT_LIMIT = 20
# Upper bound for a key prefix range scan.
_MAX_CHAR = "\U0010ffff"


class Direction(StrEnum):
    EN_TR = "en-tr"
    TR_EN = "tr-en"
    EN_EN = "en-en"


_LANGS = {
    Direction.EN_TR: (Lang.EN, Lang.TR),
    Direction.TR_EN: (Lang.TR, Lang.EN),
    Direction.EN_EN: (Lang.EN, Lang.EN),
}

_HAS_TARGET = "EXISTS (SELECT 1 FROM senses s WHERE s.entry_id = e.id AND s.target = :target)"
_RANKED = "e.id, e.headword, (SELECT count(*) FROM senses s WHERE s.entry_id = e.id AND s.target = :target), e.rank"


@dataclass(frozen=True)
class Sense:
    id: int
    gloss: str
    context: str | None


@dataclass(frozen=True)
class Result:
    id: int
    headword: str
    pos: str | None
    senses: list[Sense]
    examples: list[tuple[str, str | None]]
    synonyms: list[str]


def _entry_ids(
    conn: sqlite3.Connection, query: str, key: str, lang: Lang, target: Lang, prefix: bool, limit: int
) -> list[int]:
    params = {"key": key, "lang": lang, "target": target, "limit": limit, "end": key + _MAX_CHAR}
    if prefix:
        rows = conn.execute(
            f"SELECT e.id FROM entries e WHERE e.lang = :lang AND e.key >= :key AND e.key < :end AND {_HAS_TARGET}"
            " ORDER BY length(e.key), e.key, e.id LIMIT :limit",
            params,
        )
        return [r[0] for r in rows]

    exact = conn.execute(f"SELECT {_RANKED} FROM entries e WHERE e.lang = :lang AND e.key = :key", params)
    lemmas = conn.execute(
        f"SELECT {_RANKED} FROM entries e WHERE e.id IN (SELECT entry_id FROM forms WHERE key = :key) AND e.lang = :lang",
        params,
    )
    ids = [r[0] for r in sorted(_live(exact), key=_rank(query))] + [r[0] for r in sorted(_live(lemmas), key=_rank(query))]
    return list(dict.fromkeys(ids))[:limit]


def _live(rows: Iterable[tuple[int, str, int, int]]) -> list[tuple[int, str, int, int]]:
    return [r for r in rows if r[2] > 0]


def _rank(query: str):
    """Exact spelling first, then lowercase headwords (proper names last), then page order, then richer entries."""
    typed = query.strip()
    return lambda row: (row[1] != typed, not row[1][:1].islower(), row[3], -row[2], row[0])


def _adverb_ids(conn: sqlite3.Connection, query: str, target: Lang, limit: int) -> list[int]:
    """Falls back from an unknown -ly adverb to its adjective."""
    for base in english_adverb_bases(search_key(query)):
        rows = conn.execute(
            f"SELECT {_RANKED} FROM entries e WHERE e.lang = :lang AND e.key = :key",
            {"lang": Lang.EN, "key": base, "target": target},
        )
        if ids := [r[0] for r in sorted(_live(rows), key=_rank(base))]:
            return ids[:limit]
    return []


def _stemmed_ids(conn: sqlite3.Connection, query: str, target: Lang, limit: int) -> list[int]:
    """All lemmas of the longest matching stem; exact Turkish letters first, then folded."""
    word = turkish_lower(query)
    for strict in (True, False):
        for group in turkish_stems(word):
            ids = [
                entry_id
                for c in group
                for entry_id, headword in conn.execute(
                    f"SELECT e.id, e.headword FROM entries e WHERE e.lang = :lang AND e.key = :key AND {_HAS_TARGET}"
                    " ORDER BY e.id",
                    {"lang": Lang.TR, "key": search_key(c), "target": target},
                )
                # Capitalized headwords are proper names; a stem rarely means a name.
                if headword[:1].islower() and (not strict or turkish_lower(headword) == c)
            ]
            if ids:
                return list(dict.fromkeys(ids))[:limit]
    return []


def _result(conn: sqlite3.Connection, entry_id: int, target: Lang) -> Result:
    headword, pos = conn.execute("SELECT headword, pos FROM entries WHERE id = ?", (entry_id,)).fetchone()
    senses = [
        Sense(*row)
        for row in conn.execute(
            "SELECT id, gloss, context FROM senses WHERE entry_id = ? AND target = ? ORDER BY ord", (entry_id, target)
        )
    ]
    examples = conn.execute("SELECT en, tr FROM examples WHERE entry_id = ? ORDER BY ord", (entry_id,)).fetchall()
    synonyms = [r[0] for r in conn.execute("SELECT word FROM relations WHERE entry_id = ? AND kind = 'syn'", (entry_id,))]
    return Result(entry_id, headword, pos, senses, examples, synonyms)


def lookup(
    conn: sqlite3.Connection, query: str, direction: Direction, prefix: bool = False, limit: int = _DEFAULT_LIMIT
) -> list[Result]:
    key = search_key(query)
    if not key:
        return []

    lang, target = _LANGS[direction]
    ids = _entry_ids(conn, query, key, lang, target, prefix, limit)
    if not ids and lang == Lang.TR and not prefix:
        ids = _stemmed_ids(conn, query, target, limit)
    if not ids and lang == Lang.EN and not prefix:
        ids = _adverb_ids(conn, query, target, limit)
    return [_result(conn, i, target) for i in ids]
