import json
from pathlib import Path

import pytest

from dilkart_dict.normalize import search_key, turkish_lower

VECTORS = json.loads((Path(__file__).parents[3] / "spec" / "search-key.json").read_text())


@pytest.mark.parametrize(("text", "expected"), VECTORS)
def test_search_key(text: str, expected: str) -> None:
    assert search_key(text) == expected


LOWER_VECTORS = json.loads((Path(__file__).parents[3] / "spec" / "turkish-lower.json").read_text())


@pytest.mark.parametrize(("text", "expected"), LOWER_VECTORS)
def test_turkish_lower(text: str, expected: str) -> None:
    assert turkish_lower(text) == expected
