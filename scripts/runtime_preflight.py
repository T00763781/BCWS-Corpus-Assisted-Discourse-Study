#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import sys

from _repo_preflight import (
    PreflightError,
    repo_root_from,
    validate_seed_manifest,
    validate_sqlite_schema,
    validate_taxonomy_contract,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate the minimal runtime handoff surface without claiming live ingest support."
    )
    parser.add_argument("root", nargs="?", default=".", help="Repository root to validate.")
    parser.add_argument(
        "--schema",
        default="sql/control_plane_state.sql",
        help="Relative path to the SQLite schema used for release-state bookkeeping.",
    )
    parser.add_argument(
        "--require-env",
        action="append",
        default=[],
        help="Environment variable that must be present for the current handoff workflow.",
    )
    args = parser.parse_args()

    try:
        root = repo_root_from(args.root)
    except PreflightError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    errors = []
    errors.extend(f"Missing seed manifest path: {rel}" for rel in validate_seed_manifest(root))
    errors.extend(validate_taxonomy_contract(root))
    errors.extend(validate_sqlite_schema(root, schema_relative_path=args.schema))

    for variable in args.require_env:
        if not os.environ.get(variable):
            errors.append(f"Missing required environment variable: {variable}")

    if errors:
        print("Runtime preflight failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        print(
            "This repository only supports validation and handoff preflight. "
            "Do not treat this failure as a live-ingest runtime issue.",
            file=sys.stderr,
        )
        return 1

    print("Runtime preflight passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
