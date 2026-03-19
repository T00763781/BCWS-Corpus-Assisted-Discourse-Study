from __future__ import annotations

from pathlib import Path

from scripts._repo_preflight import validate_seed_manifest


def test_seed_manifest_paths_exist() -> None:
    root = Path(__file__).resolve().parents[1]
    assert validate_seed_manifest(root) == []
