"""SQLite layout shared by the builder, lookup and the app."""

from enum import StrEnum

__all__ = ["Lang", "Source", "SCHEMA_VERSION", "PACK_VERSION", "ATTRIBUTION", "DDL", "INDEXES"]

SCHEMA_VERSION = "2"
# Bump with every published pack; matches the GitHub release tag dictionary-v<N>.
PACK_VERSION = "1"

# Shown on the app's licence screen; the pack itself is CC BY-SA 4.0.
ATTRIBUTION = [
    {"name": "Vikisözlük", "url": "https://tr.wiktionary.org", "license": "CC BY-SA 4.0",
     "via": "kaikki.org (wiktextract)"},
    {"name": "English Wiktionary", "url": "https://en.wiktionary.org", "license": "CC BY-SA 4.0",
     "via": "kaikki.org (wiktextract)"},
    {"name": "Open English WordNet", "url": "https://en-word.net", "license": "CC BY 4.0", "via": None},
    {"name": "Tatoeba", "url": "https://tatoeba.org", "license": "CC BY 2.0 FR", "via": None},
]


class Lang(StrEnum):
    EN = "en"
    TR = "tr"


class Source(StrEnum):
    VIKISOZLUK = "vikisozluk"
    WIKTIONARY = "wiktionary"
    OEWN = "oewn"
    TATOEBA = "tatoeba"


# senses.target: language of the gloss. en entry + tr gloss = EN→TR, en + en = EN→EN.
DDL = """
CREATE TABLE entries (
  id INTEGER PRIMARY KEY, -- stable hash of lang:headword:pos
  lang TEXT NOT NULL,
  headword TEXT NOT NULL,
  key TEXT NOT NULL,
  pos TEXT,
  rank INTEGER NOT NULL -- order among same-headword entries, English Wiktionary page order first
);
CREATE TABLE senses (
  id INTEGER PRIMARY KEY, -- stable hash of entry + target + gloss key
  entry_id INTEGER NOT NULL REFERENCES entries(id),
  ord INTEGER NOT NULL,
  target TEXT NOT NULL,
  gloss TEXT NOT NULL,
  context TEXT,
  source TEXT NOT NULL
);
CREATE TABLE examples (
  entry_id INTEGER NOT NULL REFERENCES entries(id),
  ord INTEGER NOT NULL,
  en TEXT NOT NULL,
  tr TEXT,
  source TEXT NOT NULL
);
CREATE TABLE forms (
  key TEXT NOT NULL,
  entry_id INTEGER NOT NULL REFERENCES entries(id),
  PRIMARY KEY (key, entry_id)
) WITHOUT ROWID;
CREATE TABLE relations (
  entry_id INTEGER NOT NULL REFERENCES entries(id),
  kind TEXT NOT NULL,
  word TEXT NOT NULL
);
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
"""

INDEXES = """
CREATE INDEX entries_lang_key ON entries(lang, key);
CREATE INDEX senses_entry ON senses(entry_id, target);
CREATE INDEX examples_entry ON examples(entry_id);
CREATE INDEX relations_entry ON relations(entry_id);
"""
