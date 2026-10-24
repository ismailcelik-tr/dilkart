"""Stream a wiktextract JSONL dump and keep only what the dictionary needs."""

import argparse
import gzip
import json
from pathlib import Path

__all__ = ["slim", "extract"]

_MAX_EXAMPLE_CHARS = 200
_TABLE_TAGS = {"table-tags", "inflection-template"}


def _words(items: list[dict] | None) -> list[str]:
    return [i["word"] for i in items or [] if i.get("word")]


def _examples(sense: dict) -> list[dict]:
    kept = []
    for ex in sense.get("examples", []):
        text = ex.get("text", "")
        if ex.get("type") == "quotation" or ex.get("ref") or len(text) > _MAX_EXAMPLE_CHARS:
            continue

        kept.append({"text": text, "translation": ex.get("translation")})
    return kept


def _forms(entry: dict) -> list[str]:
    forms = []
    for f in entry.get("forms", []):
        form = f.get("form")
        if not form or form == entry["word"] or _TABLE_TAGS & set(f.get("tags", [])):
            continue

        if form not in forms:
            forms.append(form)
    return forms


def _dedupe(words: list[str]) -> list[str]:
    return list(dict.fromkeys(words))


def slim(entry: dict) -> dict:
    senses = entry.get("senses", [])
    return {
        "word": entry["word"],
        "lang": entry["lang_code"],
        "pos": entry.get("pos"),
        "senses": [
            {
                "glosses": s.get("glosses", []),
                "tags": s.get("tags", []),
                "form_of": _words(s.get("form_of")) + _words(s.get("alt_of")),
                "examples": _examples(s),
            }
            for s in senses
        ],
        "translations_tr": [
            {"word": t["word"], "sense": t.get("sense")}
            for t in entry.get("translations", [])
            if t.get("lang_code") == "tr" and t.get("word")
        ],
        "forms": _forms(entry),
        "synonyms": _dedupe(_words(entry.get("synonyms")) + [w for s in senses for w in _words(s.get("synonyms"))]),
        "antonyms": _dedupe(_words(entry.get("antonyms")) + [w for s in senses for w in _words(s.get("antonyms"))]),
    }


def extract(dump: Path, out_dir: Path, prefix: str, langs: set[str]) -> dict[str, int]:
    """Write <prefix>-<lang>.jsonl per language; returns entry counts."""
    out_dir.mkdir(parents=True, exist_ok=True)
    outputs = {lang: (out_dir / f"{prefix}-{lang}.jsonl").open("w", encoding="utf-8") for lang in langs}
    markers = tuple(f'"lang_code": "{lang}"' for lang in langs)
    counts = dict.fromkeys(langs, 0)
    try:
        with gzip.open(dump, "rt", encoding="utf-8") as lines:
            for line in lines:
                # Cheap substring test before json.loads; the dump is ~25 GB.
                if not any(m in line for m in markers):
                    continue

                entry = json.loads(line)
                lang = entry.get("lang_code")
                if lang not in outputs or not entry.get("word"):
                    continue

                outputs[lang].write(json.dumps(slim(entry), ensure_ascii=False) + "\n")
                counts[lang] += 1
    finally:
        for f in outputs.values():
            f.close()
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dump", type=Path)
    parser.add_argument("out_dir", type=Path)
    parser.add_argument("--prefix", required=True)
    parser.add_argument("--langs", nargs="+", required=True)
    args = parser.parse_args()
    print(extract(args.dump, args.out_dir, args.prefix, set(args.langs)))


if __name__ == "__main__":
    main()
