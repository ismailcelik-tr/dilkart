import re
import unicodedata

__all__ = ["search_key"]

# Turkish casing: str.lower() maps "I" to "i" and "İ" to "i" + combining dot.
_TR_UPPER = str.maketrans({"I": "ı", "İ": "i"})
_TR_FOLD = str.maketrans("çğıöşü", "cgiosu")
_APOSTROPHES = re.compile(r"['’]")
_SEPARATORS = re.compile(r"[-‐_/]")
_PUNCTUATION = re.compile(r"[^\w\s]")


def search_key(text: str) -> str:
    """Language-independent lookup key; must match packages/core searchKey."""
    s = unicodedata.normalize("NFC", text).translate(_TR_UPPER).lower().translate(_TR_FOLD)
    s = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    s = _APOSTROPHES.sub("", s)
    s = _SEPARATORS.sub(" ", s)
    s = _PUNCTUATION.sub("", s)
    return " ".join(s.split())
