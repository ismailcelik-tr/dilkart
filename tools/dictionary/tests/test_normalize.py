import json
from pathlib import Path

import pytest

from dilkart_dict.normalize import search_key

VECTORS = json.loads((Path(__file__).parents[3] / "spec" / "search-key.json").read_text())


@pytest.mark.parametrize(("text", "expected"), VECTORS)
def test_search_key(text: str, expected: str) -> None:
    assert search_key(text) == expected
