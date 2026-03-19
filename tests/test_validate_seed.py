from __future__ import annotations

from scripts._repo_preflight import validate_branch_name


def test_validate_branch_rejects_main() -> None:
    errors = validate_branch_name("main")
    assert any("main/master" in error for error in errors)


def test_validate_branch_accepts_codex_branch() -> None:
    assert validate_branch_name("codex/001-deploy-readiness-hardening") == []
