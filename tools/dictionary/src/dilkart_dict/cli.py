"""dilkart-dict build: interim + raw sources → data/out/dictionary.sqlite."""

import argparse
import sqlite3
import time
from pathlib import Path

from dilkart_dict import loaders
from dilkart_dict.build import Sources, build

_DATA = Path(__file__).parents[2] / "data"


def _build(data: Path, out: Path) -> None:
    raw, interim = data / "raw", data / "interim"
    oewn_entries, oewn_synsets = loaders.oewn(raw / "oewn")
    sources = Sources(
        trwikt_en=loaders.jsonl(interim / "trwikt-en.jsonl"),
        enwikt_en=loaders.jsonl(interim / "enwikt-en.jsonl"),
        enwikt_tr=loaders.jsonl(interim / "enwikt-tr.jsonl"),
        oewn_entries=oewn_entries,
        oewn_synsets=oewn_synsets,
        tatoeba_pairs=loaders.tatoeba_pairs(
            raw / "tur_sentences.tsv.bz2", raw / "eng_sentences.tsv.bz2", raw / "tur-eng_links.tsv.bz2"
        ),
    )

    out.parent.mkdir(parents=True, exist_ok=True)
    out.unlink(missing_ok=True)
    started = time.monotonic()
    with sqlite3.connect(out) as conn:
        build(conn, sources)
        conn.execute("VACUUM")
    print(f"{out}: {out.stat().st_size / 1e6:.1f} MB in {time.monotonic() - started:.0f}s")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=_DATA)
    parser.add_argument("--out", type=Path, default=_DATA / "out" / "dictionary.sqlite")
    args = parser.parse_args()
    _build(args.data, args.out)


if __name__ == "__main__":
    main()
