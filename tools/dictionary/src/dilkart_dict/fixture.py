"""Small source set shared by Python tests and the TypeScript contract tests."""

import sqlite3
import sys
from pathlib import Path

from dilkart_dict.build import Sources, build

__all__ = ["SOURCES", "write_fixture"]


def _entry(word, lang, pos, glosses=(), form_of=(), translations_tr=(), forms=(), examples=(), synonyms=()):
    return {
        "word": word,
        "lang": lang,
        "pos": pos,
        "senses": [{"glosses": [g], "tags": [], "form_of": [], "examples": list(examples)} for g in glosses]
        + [{"glosses": [f"form of {w}"], "tags": ["form-of"], "form_of": [w], "examples": []} for w in form_of],
        "translations_tr": [{"word": w, "sense": s} for w, s in translations_tr],
        "forms": list(forms),
        "synonyms": list(synonyms),
        "antonyms": [],
    }


SOURCES = Sources(
    trwikt_en=[
        _entry("book", "en", "noun", glosses=["kitap"]),
        _entry("guest", "en", "noun", glosses=["konuk, misafir"]),
        _entry("late", "en", "adj", glosses=["olması gerekenden sonra gerçekleşen, geç", "ölmüş"]),
        _entry("fails", "en", "verb", glosses=["çoğul çekimi: fail"]),
        _entry("friend.", "en", "noun", glosses=["refik"]),
        _entry("Friend", "en", "name", glosses=["Bir soyadı."]),
        _entry("friend", "en", "noun", glosses=["arkadaş"]),
        _entry("-ye", "en", "suffix", glosses=["-e"]),
        _entry("saw", "en", "verb", glosses=["see fiilinin basit geçmiş zaman kipi"]),
        _entry("see", "en", "verb", glosses=["görmek"]),
        _entry("run", "en", "verb", glosses=["koşmak", "bir işi yönetmek ve sürdürmek için çalışmak"]),
    ],
    enwikt_en=[
        _entry("run", "en", "verb", translations_tr=[("koşmak", "to move quickly"), ("işletmek", "to manage")],
               forms=["runs", "ran"]),
        _entry("went", "en", "verb", form_of=["go"]),
        _entry("go", "en", "verb", translations_tr=[("gitmek", "to move")]),
        _entry("guest", "en", "noun", translations_tr=[("konuk", "visitor"), ("misafir", "visitor")]),
        _entry("fail", "en", "verb", translations_tr=[("başarısız olmak", None)]),
        _entry("count", "en", "verb", translations_tr=[("saymak.", None)]),

    ],
    enwikt_tr=[
        _entry("kitap", "tr", "noun", glosses=["book"], forms=["kitaplar", "kitabı"],
               examples=[{"text": "Kitap okur musun?", "translation": "Do you read books?"}]),
        _entry("kitaplarım", "tr", "noun", form_of=["kitap"]),
        _entry("ölü", "tr", "adj", glosses=["dead"]),
        _entry("olmak", "tr", "verb", glosses=["to become"]),
        _entry("Aka", "tr", "name", glosses=["a male given name"]),
        _entry("akmak", "tr", "verb", glosses=["to flow"]),
        _entry("kurul", "tr", "noun", glosses=["board (of directors, judges, etc.)"]),
        _entry("kurulmak", "tr", "verb", glosses=["to be established"]),
        _entry("önlemek", "tr", "verb", glosses=["to prevent; to hinder"]),
        _entry("tutu", "tr", "noun", glosses=["mortgage"]),
        {
            "word": "tutmak", "lang": "tr", "pos": "verb", "forms": [], "synonyms": [], "antonyms": [],
            "translations_tr": [],
            "senses": [
                {"glosses": ["to hold"], "tags": [], "form_of": [], "examples": []},
                {"glosses": ["to hold", "to catch"], "tags": [], "form_of": [], "examples": []},
            ],
        },
    ],
    oewn_entries={"run": {"v": {"sense": [{"id": "run%2:38:00::", "synset": "01926311-v"}]}}},
    oewn_synsets={
        "01926311-v": {
            "definition": ["move fast by using one's feet"],
            "example": ["Don't run--you'll be out of breath"],
            "members": ["run", "scarper"],
            "partOfSpeech": "v",
        }
    },
    tatoeba_pairs=[
        ("I like to run in the morning.", "Sabahları koşmayı severim."),
        ("Run!", "Koş!"),
        ("This book is mine.", "Bu kitap benim."),
    ],
)


def write_fixture(path: Path) -> None:
    path.unlink(missing_ok=True)
    with sqlite3.connect(path) as conn:
        build(conn, SOURCES)
        conn.execute("VACUUM")


if __name__ == "__main__":
    write_fixture(Path(sys.argv[1]))
