import sqlite3

from dilkart_dict.build import build
from dilkart_dict.gold import Match, evaluate
from dilkart_dict.lookup import Direction
from dilkart_dict.fixture import SOURCES


def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    build(conn, SOURCES)
    return conn


def test_equivalent_match_accepts_gloss_containing_answer() -> None:
    rows = [("prevent", ["önlemek"]), ("went", ["gitmek"]), ("kitap", ["yok"])]
    result = evaluate(_db(), rows, Direction.EN_TR, Match.EQUIVALENT)
    assert result.hits == 2
    assert result.failures == [("kitap", [])]


def test_definition_match_uses_keyword_prefix() -> None:
    result = evaluate(_db(), [("run", ["fast"]), ("run", ["swim"])], Direction.EN_EN, Match.KEYWORD)
    assert result.hits == 1
