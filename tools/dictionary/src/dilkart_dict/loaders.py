"""Read the downloaded source files into the shapes `build` expects."""

import bz2
import json
from collections.abc import Iterator
from pathlib import Path

__all__ = ["jsonl", "oewn", "tatoeba_pairs"]

_MAX_SENTENCE_CHARS = 80


def jsonl(path: Path) -> Iterator[dict]:
    with path.open(encoding="utf-8") as lines:
        for line in lines:
            yield json.loads(line)


def oewn(directory: Path) -> tuple[dict, dict]:
    """(lemma entries, synsets) from the Open English WordNet JSON release."""
    entries: dict = {}
    synsets: dict = {}
    for f in sorted(directory.glob("*.json")):
        if f.name.startswith("entries-"):
            entries.update(json.loads(f.read_text()))
        elif f.name != "frames.json":
            synsets.update(json.loads(f.read_text()))
    return entries, synsets


def _sentences(path: Path) -> dict[str, str]:
    with bz2.open(path, "rt", encoding="utf-8") as rows:
        return {
            sid: text
            for sid, _, text in (r.rstrip("\n").split("\t", 2) for r in rows)
            if len(text) <= _MAX_SENTENCE_CHARS
        }


def tatoeba_pairs(tur_sentences: Path, eng_sentences: Path, tur_eng_links: Path) -> Iterator[tuple[str, str]]:
    """(english, turkish) sentence pairs, short sentences only."""
    tur = _sentences(tur_sentences)
    eng = _sentences(eng_sentences)
    with bz2.open(tur_eng_links, "rt", encoding="utf-8") as rows:
        for row in rows:
            tur_id, eng_id = row.split()
            if tur_id in tur and eng_id in eng:
                yield eng[eng_id], tur[tur_id]
