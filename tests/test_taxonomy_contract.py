from __future__ import annotations

from pathlib import Path

from scripts._repo_preflight import validate_taxonomy_contract


def test_taxonomy_ordering_contract() -> None:
    root = Path(__file__).resolve().parents[1]
    assert validate_taxonomy_contract(root) == []
