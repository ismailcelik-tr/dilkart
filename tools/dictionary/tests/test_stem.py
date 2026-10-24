import pytest

from dilkart_dict.stem import turkish_stems


def _level(groups: list[list[str]], candidate: str) -> int:
    return next(i for i, g in enumerate(groups) if candidate in g)


@pytest.mark.parametrize(
    ("word", "longer", "shorter"),
    [
        ("kitaplar", "kitapla", "kitap"),
        ("kitabı", "kitab", "kitab"),
        ("evler", "evle", "ev"),
    ],
)
def test_groups_are_longest_first(word: str, longer: str, shorter: str) -> None:
    groups = list(turkish_stems(word))
    assert _level(groups, longer) <= _level(groups, shorter)


@pytest.mark.parametrize(
    ("word", "same_group"),
    [
        ("kitabı", ["kitab", "kitap"]),
        ("gidecek", ["gid", "git", "gitmek"]),
        ("ağacı", ["ağac", "ağaç"]),
        ("kurulması", ["kurul", "kurulmak"]),
        ("ettiğim", ["et", "etmek"]),
    ],
)
def test_softened_stem_and_infinitive_share_a_group(word: str, same_group: list[str]) -> None:
    groups = list(turkish_stems(word))
    assert len({_level(groups, c) for c in same_group}) == 1


def test_no_stems_for_phrases_or_short_words() -> None:
    assert list(turkish_stems("kitap kurdu")) == []
    assert list(turkish_stems("ev")) == []


def test_stems_never_shorter_than_two_letters() -> None:
    assert all(len(c) >= 2 for g in turkish_stems("evler") for c in g if not c.endswith(("mek", "mak")))


@pytest.mark.parametrize(
    ("word", "infinitive"),
    [("tutuyor", "tutmak"), ("okuyor", "okumak"), ("gidiyorum", "gitmek"), ("söylüyor", "söylemek")],
)
def test_present_continuous_tries_verb_first(word: str, infinitive: str) -> None:
    assert infinitive in next(turkish_stems(word))


@pytest.mark.parametrize(("word", "infinitive"), [("yedim", "yemek"), ("gördük", "görmek"), ("baktılar", "bakmak"), ("gidiyordum", "gitmek")])
def test_past_tense_tries_verb_first(word: str, infinitive: str) -> None:
    assert infinitive in next(turkish_stems(word))
