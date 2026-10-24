import sqlite3
from pathlib import Path

from dilkart_dict.fixture import write_fixture

COMMITTED = Path(__file__).parents[3] / "spec" / "fixtures" / "dictionary.sqlite"


def _dump(path: Path) -> list[str]:
    # Planner statistics differ by SQLite version; only data and schema matter.
    with sqlite3.connect(path) as conn:
        return sorted(line for line in conn.iterdump() if "sqlite_stat" not in line)


def test_committed_fixture_matches_builder(tmp_path: Path) -> None:
    fresh = tmp_path / "dictionary.sqlite"
    write_fixture(fresh)
    assert _dump(fresh) == _dump(COMMITTED), "run: uv run python -m dilkart_dict.fixture ../../spec/fixtures/dictionary.sqlite"
