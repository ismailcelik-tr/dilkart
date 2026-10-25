import sqlite3

import pytest

from dilkart_dict.build import build
from dilkart_dict.fixture import SOURCES
from dilkart_dict.lookup import Direction, lookup


@pytest.fixture(scope="module")
def db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    build(conn, SOURCES)
    return conn


def _glosses(results) -> list[str]:
    return [s.gloss for r in results for s in r.senses]


def test_en_tr_merges_sources_without_duplicates(db) -> None:
    glosses = _glosses(lookup(db, "run", Direction.EN_TR))
    assert glosses.count("koşmak") == 1
    assert "işletmek" in glosses


def test_en_tr_keeps_translation_context(db) -> None:
    senses = lookup(db, "run", Direction.EN_TR)[0].senses
    assert next(s for s in senses if s.gloss == "işletmek").context == "to manage"


def test_en_en_uses_wordnet(db) -> None:
    result = lookup(db, "run", Direction.EN_EN)[0]
    assert _glosses([result]) == ["move fast by using one's feet"]
    assert "scarper" in result.synonyms


def test_inflected_english_resolves_to_lemma(db) -> None:
    assert lookup(db, "Went", Direction.EN_TR)[0].headword == "go"
    assert lookup(db, "ran", Direction.EN_TR)[0].headword == "run"


def test_tr_en_from_turkish_entries(db) -> None:
    assert _glosses(lookup(db, "KİTAP", Direction.TR_EN)) == ["book"]


def test_inflected_turkish_resolves_to_lemma(db) -> None:
    assert lookup(db, "kitaplar", Direction.TR_EN)[0].headword == "kitap"
    assert lookup(db, "kitaplarim", Direction.TR_EN)[0].headword == "kitap"


def test_tr_en_reverses_short_english_translations(db) -> None:
    assert "run" in _glosses(lookup(db, "koşmak", Direction.TR_EN))


def test_long_glosses_are_not_reversed(db) -> None:
    assert lookup(db, "bir işi yönetmek ve sürdürmek için çalışmak", Direction.TR_EN) == []


def test_examples_prefer_shortest_tatoeba_pair(db) -> None:
    assert lookup(db, "run", Direction.EN_TR)[0].examples[0] == ("Run!", "Koş!")


def test_turkish_examples_from_wiktionary(db) -> None:
    assert ("Do you read books?", "Kitap okur musun?") in lookup(db, "kitap", Direction.TR_EN)[0].examples


def test_prefix_search_returns_matches(db) -> None:
    assert [r.headword for r in lookup(db, "bo", Direction.EN_TR, prefix=True)] == ["book", "board"]


def test_ids_are_stable_across_builds() -> None:
    def ids() -> list[tuple[str, str]]:
        conn = sqlite3.connect(":memory:")
        build(conn, SOURCES)
        return conn.execute("SELECT entry_id, id FROM senses ORDER BY id").fetchall()

    assert ids() == ids()


def test_ids_fit_javascript_safe_integers(db) -> None:
    max_id = db.execute("SELECT max(max(e.id), max(s.id)) FROM entries e, senses s").fetchone()[0]
    assert max_id < 2**53


def test_turkish_inflection_tables_are_not_stored(db) -> None:
    assert db.execute("SELECT count(*) FROM forms WHERE key = 'kitabi'").fetchone()[0] == 0


def test_turkish_stemming_finds_lemma(db) -> None:
    assert lookup(db, "kitabı", Direction.TR_EN)[0].headword == "kitap"
    assert lookup(db, "koşuyorum", Direction.TR_EN)[0].headword == "koşmak"


def test_synonyms_are_capped(db) -> None:
    assert len(lookup(db, "run", Direction.EN_EN)[0].synonyms) <= 5


def test_stemming_respects_turkish_letters(db) -> None:
    assert [r.headword for r in lookup(db, "oluyor", Direction.TR_EN)] == ["olmak"]


def test_stemming_skips_proper_names(db) -> None:
    assert [r.headword for r in lookup(db, "akan", Direction.TR_EN)] == ["akmak"]


def test_stemming_returns_all_matches_of_a_level(db) -> None:
    assert {r.headword for r in lookup(db, "kurulması", Direction.TR_EN)} == {"kurul", "kurulmak"}


def test_en_tr_reverses_short_turkish_entry_glosses(db) -> None:
    assert "önlemek" in _glosses(lookup(db, "prevent", Direction.EN_TR))
    assert "önlemek" in _glosses(lookup(db, "hinder", Direction.EN_TR))


def test_reversal_strips_parenthetical_notes(db) -> None:
    assert "kurul" in _glosses(lookup(db, "board", Direction.EN_TR))


def test_proper_names_are_not_reversed(db) -> None:
    assert lookup(db, "a male given name", Direction.EN_TR) == []


def test_comma_separated_short_glosses_are_split_and_merged(db) -> None:
    assert sorted(_glosses(lookup(db, "guest", Direction.EN_TR))) == ["konuk", "misafir"]


def test_short_glosses_come_before_definitions(db) -> None:
    assert _glosses(lookup(db, "late", Direction.EN_TR))[0] == "geç"


def test_inflection_glosses_become_form_links(db) -> None:
    results = lookup(db, "fails", Direction.EN_TR)
    assert [r.headword for r in results] == ["fail"]


def test_exact_lowercase_headword_ranks_first(db) -> None:
    assert lookup(db, "friend", Direction.EN_TR)[0].headword == "friend"


def test_punctuated_and_affix_headwords_are_dropped(db) -> None:
    headwords = {r[0] for r in db.execute("SELECT headword FROM entries")}
    assert not {"friend.", "-ye"} & headwords


def test_present_continuous_resolves_to_verb(db) -> None:
    assert lookup(db, "tutuyor", Direction.TR_EN)[0].headword == "tutmak"


def test_trailing_periods_are_stripped(db) -> None:
    assert _glosses(lookup(db, "count", Direction.EN_TR)) == ["saymak"]


def test_short_tail_of_a_definition_keeps_its_position(db) -> None:
    assert _glosses(lookup(db, "late", Direction.EN_TR))[:2] == ["geç", "ölmüş"]


def test_parent_gloss_of_nested_senses_comes_first(db) -> None:
    assert _glosses(lookup(db, "tutmak", Direction.TR_EN))[:2] == ["to hold", "to catch"]


def test_turkish_verb_form_glosses_become_form_links(db) -> None:
    assert [r.headword for r in lookup(db, "saw", Direction.EN_TR)] == ["see"]


def test_homographs_follow_english_wiktionary_page_order(db) -> None:
    results = lookup(db, "go", Direction.EN_TR)
    assert [r.pos for r in results] == ["verb", "noun"]


def test_english_definitions_fill_words_missing_from_wordnet(db) -> None:
    [the] = lookup(db, "the", Direction.EN_EN)
    assert [s.gloss for s in the.senses] == ["Definite grammatical article", "Used before a noun", "Used before a superlative"]


def test_wordnet_words_get_no_wiktionary_definitions(db) -> None:
    run = lookup(db, "run", Direction.EN_EN)[0]
    assert {s.gloss for s in run.senses} == {"move fast by using one's feet"}
