from dilkart_dict.extract import slim

RUN = {
    "word": "run",
    "lang_code": "en",
    "pos": "verb",
    "sounds": [{"ipa": "/ɹʌn/"}],
    "categories": ["English verbs"],
    "senses": [
        {
            "glosses": ["To move swiftly.", "To go at a fast pace."],
            "tags": ["intransitive"],
            "examples": [
                {"text": "Run, and you might still catch the train!", "type": "example"},
                {"text": "A long quotation " * 30, "type": "quotation", "ref": "1967"},
            ],
            "synonyms": [{"word": "sprint"}],
        }
    ],
    "translations": [
        {"lang_code": "tr", "word": "koşmak", "sense": "to move quickly"},
        {"lang_code": "de", "word": "laufen", "sense": "to move quickly"},
    ],
    "forms": [{"form": "runs", "tags": ["present", "singular", "third-person"]}],
    "antonyms": [{"word": "walk"}],
}

WENT = {
    "word": "went",
    "lang_code": "en",
    "pos": "verb",
    "senses": [{"glosses": ["simple past of go"], "tags": ["form-of", "past"], "form_of": [{"word": "go"}]}],
}

KITAP = {
    "word": "kitap",
    "lang_code": "tr",
    "pos": "noun",
    "senses": [
        {
            "glosses": ["book"],
            "examples": [
                {
                    "text": "Boş zamanlarında kitap okur musun?",
                    "translation": "Do you read books in your free time?",
                    "type": "example",
                }
            ],
        }
    ],
    "forms": [
        {"form": "kitaplar", "tags": ["plural"]},
        {"form": "no-table-tags", "source": "declension", "tags": ["table-tags"]},
        {"form": "tr-infl-noun-c", "source": "declension", "tags": ["inflection-template"]},
    ],
}


def test_slim_keeps_only_needed_fields() -> None:
    s = slim(RUN)
    assert set(s) == {"word", "lang", "pos", "senses", "translations_tr", "forms", "synonyms", "antonyms"}
    assert s["lang"] == "en"


def test_slim_keeps_turkish_translations_only() -> None:
    assert slim(RUN)["translations_tr"] == [{"word": "koşmak", "sense": "to move quickly"}]


def test_slim_drops_long_quotations_keeps_examples() -> None:
    examples = slim(RUN)["senses"][0]["examples"]
    assert examples == [{"text": "Run, and you might still catch the train!", "translation": None}]


def test_slim_keeps_example_translation() -> None:
    examples = slim(KITAP)["senses"][0]["examples"]
    assert examples[0]["translation"] == "Do you read books in your free time?"


def test_slim_keeps_form_of() -> None:
    assert slim(WENT)["senses"][0]["form_of"] == ["go"]


def test_slim_drops_table_metadata_forms() -> None:
    assert slim(KITAP)["forms"] == ["kitaplar"]


def test_slim_collects_relations() -> None:
    s = slim(RUN)
    assert s["synonyms"] == ["sprint"]
    assert s["antonyms"] == ["walk"]


def test_slim_treats_alt_of_as_form_of() -> None:
    entry = {
        "word": "ilân",
        "lang_code": "tr",
        "pos": "noun",
        "senses": [{"glosses": ["alternative spelling of ilan"], "tags": ["alt-of"], "alt_of": [{"word": "ilan"}]}],
    }
    assert slim(entry)["senses"][0]["form_of"] == ["ilan"]
