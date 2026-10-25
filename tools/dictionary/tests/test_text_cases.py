import json
import sqlite3
from pathlib import Path

import pytest

from dilkart_dict.build import build
from dilkart_dict.fixture import SOURCES
from dilkart_dict.lookup import Direction, lookup
from dilkart_dict.normalize import search_key, turkish_lower
from dilkart_dict.stem import turkish_stems

# Shared with packages/core src/text/cases.test.ts.
CASES = json.loads((Path(__file__).parents[3] / "spec" / "text-cases.json").read_text())


@pytest.fixture(scope="module")
def db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    build(conn, SOURCES)
    return conn


@pytest.mark.parametrize(("text", "expected"), CASES["lower"])
def test_lower(text: str, expected: str) -> None:
    assert turkish_lower(text) == expected


@pytest.mark.parametrize(("a", "b"), CASES["key"])
def test_key(a: str, b: str) -> None:
    assert search_key(a) == search_key(b)


@pytest.mark.parametrize(("word", "stem"), CASES["stem"])
def test_stem(word: str, stem: str) -> None:
    assert stem in [s for group in turkish_stems(word) for s in group]


@pytest.mark.parametrize(("query", "direction", "headword"), CASES["lemma"])
def test_lemma(db, query: str, direction: str, headword: str) -> None:
    assert lookup(db, query, Direction(direction))[0].headword == headword
