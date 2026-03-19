from __future__ import annotations

from pathlib import Path

from scripts._repo_preflight import validate_sqlite_schema


def test_control_plane_schema_applies_to_sqlite() -> None:
    root = Path(__file__).resolve().parents[1]
    assert validate_sqlite_schema(root) == []
