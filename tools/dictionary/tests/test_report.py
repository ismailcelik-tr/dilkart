import sqlite3

from dilkart_dict.build import build
from dilkart_dict.lookup import Direction
from dilkart_dict.report import coverage
from dilkart_dict.fixture import SOURCES


def test_coverage_counts_hits_examples_and_misses() -> None:
    conn = sqlite3.connect(":memory:")
    build(conn, SOURCES)

    result = coverage(conn, ["run", "went", "xyzzy", "42"], Direction.EN_TR)

    assert (result.total, result.found, result.with_examples) == (3, 2, 1)
    assert result.misses == ["xyzzy"]
