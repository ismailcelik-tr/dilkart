"""Query-time Turkish lemma guessing; replaces shipping full inflection tables."""

import re
from collections.abc import Iterator

__all__ = ["turkish_stems"]

_MIN_STEM = 2
# Final consonant softening before a vowel suffix: kitap → kitabı, git → gidiyor, ağaç → ağacı.
# "g" covers "ğ" in input typed without Turkish letters.
_HARDENED = {"b": "p", "c": "ç", "d": "t", "ğ": "k", "g": "k"}
_INFINITIVES = ("mek", "mak")
_PRESENT_CONTINUOUS = "yor"
# Vowels the present continuous inserts or narrows: tut-u-yor, söyle → söylü-yor.
_NARROW_VOWELS = "ıiuü"
_WIDE_VOWELS = ("e", "a")
# Past tense with optional person/plural ending: ye-dim, gör-dük, bak-tılar.
_PAST_TENSE = re.compile(r"[dt][ıiuü](m|n|k|nız|niz|nuz|nüz|lar|ler)?$")


def _verb_roots(word: str) -> list[str]:
    past = _PAST_TENSE.search(word)
    if past and past.start() >= _MIN_STEM:
        word = word[: past.start()]

    i = word.find(_PRESENT_CONTINUOUS)
    if i < _MIN_STEM:
        return [word] if past else []

    base = word[:i]
    if base[-1] not in _NARROW_VOWELS:
        return [base]

    root = base[:-1]
    hard = [root[:-1] + _HARDENED[root[-1]]] if root[-1] in _HARDENED else []
    return [base, root, *hard, *(root + v for v in _WIDE_VOWELS)]


def turkish_stems(word: str) -> Iterator[list[str]]:
    """Lemma candidates for a lowercase Turkish word, one group per stem length, longest first."""
    if " " in word or len(word) <= _MIN_STEM:
        return

    if roots := _verb_roots(word):
        yield [r + i for r in roots for i in _INFINITIVES]

    for n in range(len(word) - 1, _MIN_STEM - 1, -1):
        stem = word[:n]
        bases = [stem] + ([stem[:-1] + _HARDENED[stem[-1]]] if stem[-1] in _HARDENED else [])
        yield bases + [b + i for b in bases for i in _INFINITIVES]
