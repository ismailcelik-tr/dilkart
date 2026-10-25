"""Merge Wiktionary, Vikisözlük, Open English WordNet and Tatoeba into one SQLite pack."""

import hashlib
import re
import sqlite3
from collections import defaultdict
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field

from dilkart_dict.normalize import search_key
from dilkart_dict.schema import DDL, INDEXES, SCHEMA_VERSION, Lang, Source

__all__ = ["Sources", "build"]

_MAX_GLOSS_CHARS = 200
_MAX_REVERSE_WORDS = 3
_MAX_TAIL_WORDS = 2
_PARENTHETICAL = re.compile(r"\([^)]*\)")
_GLOSS_SPLIT = re.compile(r"[;,]")
_EN_LEADING = ("to ", "a ", "an ", "the ")
# Vikisözlük writes inflections as glosses: "çoğul çekimi: fail", "go fiilinin geçmiş zaman kipi".
_INFLECTION_GLOSSES = (re.compile(r"çekimi:\s*(.+)$"), re.compile(r"^(\S+) fiilinin "))
_MAX_EXAMPLES = 3
_MAX_TATOEBA_PER_TOKEN = 50
_MAX_SYNONYMS = 5
# English definitions from Wiktionary only fill entries WordNet does not cover.
_MAX_DEFINITIONS = 3
_SKIPPED_SENSE_TAGS = {"obsolete", "archaic"}
_OEWN_POS = {"n": "noun", "v": "verb", "a": "adj", "s": "adj", "r": "adv"}
# Ids are stored by the app and synced as card references; must stay below 2^53 for JS.
_ID_BITS = 52


@dataclass
class Sources:
    trwikt_en: Iterable[dict]
    enwikt_en: Iterable[dict]
    enwikt_tr: Iterable[dict]
    oewn_entries: Mapping[str, dict]
    oewn_synsets: Mapping[str, dict]
    tatoeba_pairs: Iterable[tuple[str, str]]


@dataclass
class _Sense:
    target: Lang
    gloss: str
    context: str | None
    source: Source
    reversed: bool = False


@dataclass
class _Entry:
    lang: Lang
    headword: str
    pos: str | None
    senses: dict[tuple[Lang, str], _Sense] = field(default_factory=dict)
    examples: list[tuple[str, str | None, Source]] = field(default_factory=list)
    forms: set[str] = field(default_factory=set)
    synonyms: list[str] = field(default_factory=list)
    antonyms: list[str] = field(default_factory=list)
    definitions: list[str] = field(default_factory=list)

    @property
    def eid(self) -> str:
        return f"{self.lang}:{self.headword}:{self.pos or ''}"

    def add_sense(
        self, target: Lang, gloss: str, source: Source, context: str | None = None, reversed: bool = False
    ) -> None:
        gloss = " ".join(gloss.split()).rstrip(".")
        if not gloss or len(gloss) > _MAX_GLOSS_CHARS:
            return

        # Commas inside parentheses belong to a note: "board (of directors, judges)".
        parts = [] if "(" in gloss else [p.strip() for p in _GLOSS_SPLIT.split(gloss)]
        if len(parts) > 1 and all(0 < len(p.split()) <= _MAX_REVERSE_WORDS for p in parts):
            for p in parts:
                self.add_sense(target, p, source, context, reversed)
            return

        # Vikisözlük often ends a definition with the equivalent: "…sonra gerçekleşen, geç".
        if len(parts) > 1 and len(parts[-1].split()) <= _MAX_TAIL_WORDS:
            self.add_sense(target, parts[-1], source, context, reversed)

        self.senses.setdefault((target, search_key(gloss)), _Sense(target, gloss, context, source, reversed))

    def add_related(self, kind: list[str], words: Iterable[str]) -> None:
        for w in words:
            if w != self.headword and w not in kind:
                kind.append(w)


def _reversible(gloss: str, lang: Lang) -> list[str]:
    """Short headword candidates from a gloss: "to prevent; to hinder" → ["prevent", "hinder"]."""
    parts = []
    for part in _GLOSS_SPLIT.split(_PARENTHETICAL.sub("", gloss)):
        part = part.strip()
        if lang == Lang.EN:
            part = part.removeprefix(next((p for p in _EN_LEADING if part.startswith(p)), ""))
        if part and len(part.split()) <= _MAX_REVERSE_WORDS and not any(c.isdigit() for c in part):
            parts.append(part)
    return parts


def _definitions(raw: dict) -> list[str]:
    """Main gloss of each lemma sense; nested senses repeat it, so it is deduplicated."""
    glosses = [
        s["glosses"][0]
        for s in raw["senses"]
        if s["glosses"] and not s["form_of"] and not _SKIPPED_SENSE_TAGS & set(s["tags"])
    ]
    return list(dict.fromkeys(glosses))[:_MAX_DEFINITIONS]


def _valid_headword(word: str) -> bool:
    """Drops affixes ("-ye") and scraping noise ("friend.")."""
    return word[:1].isalnum() and word[-1:].isalnum()


def _display_order(senses: dict[tuple[Lang, str], _Sense]) -> list[tuple[tuple[Lang, str], _Sense]]:
    """Short equivalents before longer definitions; otherwise source order (first = primary sense)."""
    return sorted(senses.items(), key=lambda kv: len(kv[1].gloss.split()) > _MAX_REVERSE_WORDS)


def _stable_id(*parts: str) -> int:
    digest = hashlib.sha1("\x1f".join(parts).encode()).digest()
    return int.from_bytes(digest[:8]) >> (64 - _ID_BITS)


class _Builder:
    def __init__(self) -> None:
        self.entries: dict[tuple[Lang, str, str | None], _Entry] = {}
        # Part-of-speech order on English Wiktionary pages: editors list the main use first.
        self.page_order: dict[tuple[Lang, str], list[str | None]] = defaultdict(list)
        self.headwords: set[tuple[Lang, str]] = set()
        # First-listed definitions per English word, for entries whose POS name differs by source.
        self.word_definitions: dict[str, list[str]] = {}
        # (form key, lemma lang, lemma headword) resolved once all entries exist.
        self.form_links: set[tuple[str, Lang, str]] = set()

    def entry(self, lang: Lang, headword: str, pos: str | None) -> _Entry:
        k = (lang, headword, pos)
        if k not in self.entries:
            self.entries[k] = _Entry(lang, headword, pos)
            self.headwords.add((lang, headword))
        return self.entries[k]

    def note_order(self, lang: Lang, word: str, pos: str | None) -> None:
        order = self.page_order[(lang, word)]
        if pos not in order:
            order.append(pos)

    def add_wiktionary(self, raw: dict, target: Lang, source: Source) -> None:
        """Glosses in `target` language; form-of senses become lemma links."""
        lang = Lang(raw["lang"])
        if source == Source.WIKTIONARY:
            self.note_order(lang, raw["word"], raw["pos"])
        lemma_senses = []
        for s in raw["senses"]:
            lemmas = s["form_of"] + [
                m.group(1).strip() for g in s["glosses"] for p in _INFLECTION_GLOSSES if (m := p.search(g))
            ]
            for lemma in lemmas:
                self.form_links.add((search_key(raw["word"]), lang, lemma))
            if not lemmas:
                lemma_senses.append(s)

        if not lemma_senses:
            return

        e = self.entry(lang, raw["word"], raw["pos"])
        for s in lemma_senses:
            for g in s["glosses"]:  # parent sense first, then the nested one
                e.add_sense(target, g, source)
            # Vikisözlük examples are not reliably paired with their translations.
            for ex in s["examples"] if source == Source.WIKTIONARY else []:
                if ex["translation"] and len(e.examples) < _MAX_EXAMPLES:
                    pair = (ex["translation"], ex["text"]) if lang == Lang.TR else (ex["text"], ex["translation"])
                    e.examples.append((*pair, source))

        e.forms.update(raw["forms"])
        e.add_related(e.synonyms, raw["synonyms"])
        e.add_related(e.antonyms, raw["antonyms"])

    def add_translations(self, raw: dict) -> None:
        self.note_order(Lang.EN, raw["word"], raw["pos"])
        key = (Lang.EN, raw["word"], raw["pos"])
        definitions = _definitions(raw)
        if (Lang.EN, raw["word"]) in self.headwords:
            self.word_definitions.setdefault(raw["word"], definitions)
        if raw["translations_tr"] or key in self.entries:
            e = self.entry(*key)
            for t in raw["translations_tr"]:
                e.add_sense(Lang.TR, t["word"], Source.WIKTIONARY, t["sense"])
            e.forms.update(raw["forms"])
            e.definitions = definitions

        for s in raw["senses"]:
            for lemma in s["form_of"]:
                self.form_links.add((search_key(raw["word"]), Lang.EN, lemma))

    def add_wordnet(self, entries: Mapping[str, dict], synsets: Mapping[str, dict]) -> None:
        for lemma, by_pos in entries.items():
            for pos_code, data in by_pos.items():
                e = self.entry(Lang.EN, lemma, _OEWN_POS.get(pos_code, pos_code))
                for sense in data.get("sense", []):
                    synset = synsets.get(sense["synset"], {})
                    for d in synset.get("definition", []):
                        e.add_sense(Lang.EN, d, Source.OEWN)
                    for ex in synset.get("example", [])[:1]:
                        if isinstance(ex, str):
                            e.examples.append((ex, None, Source.OEWN))
                    e.add_related(e.synonyms, synset.get("members", []))
                    e.add_related(e.antonyms, (a.split("%")[0].replace("_", " ") for a in sense.get("antonym", [])))

    def reverse(self) -> None:
        """Short glosses become entries of the other direction: run→koşmak gives koşmak→run."""
        added = []
        for e in self.entries.values():
            if not e.headword[:1].islower():  # proper names
                continue

            other = Lang.TR if e.lang == Lang.EN else Lang.EN
            for s in e.senses.values():
                if s.target == other and not s.reversed:
                    added += [(other, g, e.pos, e.lang, e.headword, s.source, s.context) for g in _reversible(s.gloss, other)]

        for lang, headword, pos, target, gloss, source, context in added:
            self.entry(lang, headword, pos).add_sense(target, gloss, source, context, reversed=True)

    def add_definitions(self) -> None:
        """Wiktionary definitions for English entries without WordNet ones (function words)."""
        for e in self.entries.values():
            if e.lang == Lang.EN and not any(target == Lang.EN for target, _ in e.senses):
                for d in e.definitions or self.word_definitions.get(e.headword, []):
                    e.add_sense(Lang.EN, d, Source.WIKTIONARY)

    def add_tatoeba(self, pairs: Iterable[tuple[str, str]]) -> None:
        ordered = sorted(pairs, key=lambda p: len(p[0]))
        index: dict[tuple[Lang, str], list[int]] = defaultdict(list)
        for i, (en, tr) in enumerate(ordered):
            for lang, text in ((Lang.EN, en), (Lang.TR, tr)):
                for token in set(search_key(text).split()):
                    bucket = index[(lang, token)]
                    if len(bucket) < _MAX_TATOEBA_PER_TOKEN:
                        bucket.append(i)

        for e in self.entries.values():
            other = Lang.TR if e.lang == Lang.EN else Lang.EN
            if not any(s.target == other for s in e.senses.values()):
                continue

            keys = {search_key(e.headword)} | {search_key(f) for f in e.forms}
            first_tokens = {k.split()[0] for k in keys if k}
            candidates = sorted({i for t in first_tokens for i in index.get((e.lang, t), [])})
            picked = []
            for i in candidates:
                text = ordered[i][0] if e.lang == Lang.EN else ordered[i][1]
                padded = f" {search_key(text)} "
                if any(f" {k} " in padded for k in keys):
                    picked.append(ordered[i])
                if len(picked) == _MAX_EXAMPLES:
                    break
            e.examples[:0] = [(en, tr, Source.TATOEBA) for en, tr in picked]
            del e.examples[_MAX_EXAMPLES:]

    def write(self, conn: sqlite3.Connection) -> None:
        conn.executescript(DDL)
        ids: dict[tuple[Lang, str, str | None], int] = {}
        by_headword: dict[tuple[Lang, str], list[int]] = defaultdict(list)
        unranked: dict[tuple[Lang, str], int] = defaultdict(int)
        for k, e in self.entries.items():
            if not e.senses or not _valid_headword(e.headword):
                continue

            entry_id = _stable_id(e.eid)
            ids[k] = entry_id
            by_headword[(e.lang, e.headword)].append(entry_id)
            order = self.page_order.get((e.lang, e.headword), [])
            if e.pos in order:
                rank = order.index(e.pos)
            else:
                rank = len(order) + unranked[(e.lang, e.headword)]
                unranked[(e.lang, e.headword)] += 1
            conn.execute(
                "INSERT INTO entries (id, lang, headword, key, pos, rank) VALUES (?, ?, ?, ?, ?, ?)",
                (entry_id, e.lang, e.headword, search_key(e.headword), e.pos, rank),
            )
            conn.executemany(
                "INSERT INTO senses (id, entry_id, ord, target, gloss, context, source) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [
                    (_stable_id(e.eid, s.target, gk), entry_id, n, s.target, s.gloss, s.context, s.source)
                    for n, ((_, gk), s) in enumerate(_display_order(e.senses))
                ],
            )
            conn.executemany(
                "INSERT INTO examples (entry_id, ord, en, tr, source) VALUES (?, ?, ?, ?, ?)",
                [(entry_id, n, en, tr, src) for n, (en, tr, src) in enumerate(e.examples)],
            )
            conn.executemany(
                "INSERT INTO relations (entry_id, kind, word) VALUES (?, ?, ?)",
                [(entry_id, "syn", w) for w in e.synonyms[:_MAX_SYNONYMS]]
                + [(entry_id, "ant", w) for w in e.antonyms[:_MAX_SYNONYMS]],
            )

        # Turkish inflection tables are huge; Turkish lookups stem at query time instead.
        forms = {(search_key(f), ids[k]) for k, e in self.entries.items() if k in ids and e.lang == Lang.EN for f in e.forms}
        forms |= {(fk, i) for fk, lang, lemma in self.form_links for i in by_headword.get((lang, lemma), [])}
        conn.executemany("INSERT OR IGNORE INTO forms (key, entry_id) VALUES (?, ?)", sorted(f for f in forms if f[0]))
        conn.executescript(INDEXES)
        conn.execute("ANALYZE")
        conn.executemany("INSERT INTO meta (key, value) VALUES (?, ?)", [("schema_version", SCHEMA_VERSION)])
        conn.commit()


def build(conn: sqlite3.Connection, sources: Sources) -> None:
    b = _Builder()
    for raw in sources.trwikt_en:
        b.add_wiktionary(raw, Lang.TR, Source.VIKISOZLUK)
    for raw in sources.enwikt_en:
        b.add_translations(raw)
    for raw in sources.enwikt_tr:
        b.add_wiktionary(raw, Lang.EN, Source.WIKTIONARY)
    b.add_wordnet(sources.oewn_entries, sources.oewn_synsets)
    b.reverse()
    b.add_definitions()
    b.add_tatoeba(sources.tatoeba_pairs)
    b.write(conn)
