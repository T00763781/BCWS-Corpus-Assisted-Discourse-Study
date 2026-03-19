#!/usr/bin/env python3
from __future__ import annotations

import argparse
import pathlib
import sys

from _repo_preflight import (
    PreflightError,
    get_current_branch,
    iter_files,
    repo_root_from,
    validate_branch_name,
    validate_custom_agents,
    validate_seed_manifest,
    validate_sqlite_schema,
    validate_structured_files,
    validate_taxonomy_contract,
    validate_validation_targets,
)

REQUIRED_DOC_COUNT = 26  # 000 plus 001-025


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate the FiresideListeners control-plane package.")
    parser.add_argument("root", help="Repository root to validate.")
    parser.add_argument("--branch", help="Override git branch detection.")
    parser.add_argument(
        "--allow-main",
        action="store_true",
        help="Disable main/master rejection for read-only validation scenarios.",
    )
    args = parser.parse_args()

    try:
        root = repo_root_from(args.root)
        branch_name = args.branch or get_current_branch(root)
    except PreflightError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    errors = []
    if not args.allow_main:
        errors.extend(validate_branch_name(branch_name))

    errors.extend(validate_validation_targets(root))
    errors.extend(f"Missing seed manifest path: {rel}" for rel in validate_seed_manifest(root))
    errors.extend(validate_custom_agents(root))
    errors.extend(validate_taxonomy_contract(root))
    errors.extend(validate_sqlite_schema(root))
    docs = list((root / "Auto Run Docs/FiresideListeners").glob("*.md"))
    if len(docs) != REQUIRED_DOC_COUNT:
        errors.append(
            f"Expected {REQUIRED_DOC_COUNT} top-level docs in Auto Run Docs/FiresideListeners, found {len(docs)}"
        )
    errors.extend(validate_structured_files(root))

    print(f"Scanned files: {sum(1 for _ in iter_files(root))}")
    print(f"Branch checked: {branch_name}")
    if errors:
        print("Validation errors:")
        for err in errors:
            print(f"- {err}")
        return 1
    print("Validation checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
