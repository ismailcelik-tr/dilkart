import bz2
from pathlib import Path

from dilkart_dict.loaders import tatoeba_pairs

_MAX_CHARS = 80


def _bz2(path: Path, rows: list[str]) -> Path:
    path.write_bytes(bz2.compress("\n".join(rows).encode()))
    return path


def test_tatoeba_pairs_joins_links_and_filters_length(tmp_path: Path) -> None:
    tur = _bz2(tmp_path / "tur.tsv.bz2", ["1\ttur\tKoş!", "2\ttur\tUzun " + "x" * _MAX_CHARS])
    eng = _bz2(tmp_path / "eng.tsv.bz2", ["10\teng\tRun!", "20\teng\tLong " + "y" * _MAX_CHARS])
    links = _bz2(tmp_path / "links.tsv.bz2", ["1\t10", "2\t20", "1\t99"])

    assert list(tatoeba_pairs(tur, eng, links)) == [("Run!", "Koş!")]
