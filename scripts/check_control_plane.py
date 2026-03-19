#!/usr/bin/env python3
from __future__ import annotations

import argparse
import pathlib
import sys

from _repo_preflight import (
    PreflightError,
    get_current_branch,
    repo_root_from,
    validate_branch_name,
    validate_custom_agents,
    validate_seed_manifest,
    validate_sqlite_schema,
    validate_structured_files,
    validate_taxonomy_contract,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run control-plane compatibility checks for this repository.")
    parser.add_argument("root", nargs="?", default=".", help="Repository root to validate.")
    parser.add_argument("--branch", help="Override branch name instead of reading git state.")
    args = parser.parse_args()

    try:
        root = repo_root_from(args.root)
        branch_name = args.branch or get_current_branch(root)
    except PreflightError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    errors = []
    errors.extend(validate_branch_name(branch_name))
    errors.extend(f"Missing seed manifest path: {rel}" for rel in validate_seed_manifest(root))
    errors.extend(validate_custom_agents(root))
    errors.extend(validate_taxonomy_contract(root))
    errors.extend(validate_sqlite_schema(root))
    errors.extend(validate_structured_files(root))

    if errors:
        print("Control-plane checks failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"Control-plane checks passed on branch: {branch_name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
