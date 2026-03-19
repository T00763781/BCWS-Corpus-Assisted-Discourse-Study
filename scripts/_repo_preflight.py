#!/usr/bin/env python3
from __future__ import annotations

import pathlib
import sqlite3
import subprocess
import sys
from typing import Iterable

import yaml

ALLOWED_BRANCH_PREFIXES = ("codex/", "feature/", "fix/", "hotfix/", "release/")


def repo_root_from(raw_root: str) -> pathlib.Path:
    root = pathlib.Path(raw_root).resolve()
    if not root.exists():
        raise PreflightError(f"Repository root does not exist: {root}")
    return root


class PreflightError(RuntimeError):
    pass


def read_yaml(path: pathlib.Path) -> object:
    try:
        return yaml.safe_load(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise PreflightError(f"Required file is missing: {path}") from exc
    except Exception as exc:  # pragma: no cover - exercised via callers
        raise PreflightError(f"Failed to parse YAML at {path}: {exc}") from exc


def ensure_paths_exist(root: pathlib.Path, relative_paths: Iterable[str]) -> list[str]:
    return [rel for rel in relative_paths if not (root / rel).exists()]


def load_seed_manifest(root: pathlib.Path) -> dict:
    manifest_path = root / "seed_manifest.yaml"
    data = read_yaml(manifest_path)
    if not isinstance(data, dict):
        raise PreflightError("seed_manifest.yaml must contain a mapping.")
    required_paths = data.get("required_paths")
    if not isinstance(required_paths, list) or not all(isinstance(item, str) for item in required_paths):
        raise PreflightError("seed_manifest.yaml must define required_paths as a list of strings.")
    return data


def validate_seed_manifest(root: pathlib.Path) -> list[str]:
    manifest = load_seed_manifest(root)
    return ensure_paths_exist(root, manifest["required_paths"])


def validate_branch_name(branch_name: str) -> list[str]:
    errors: list[str] = []
    normalized = branch_name.strip()
    if not normalized:
        errors.append("Branch name is empty.")
        return errors
    if normalized in {"main", "master"}:
        errors.append("Refusing to validate control-plane changes from main/master.")
    if not normalized.startswith(ALLOWED_BRANCH_PREFIXES):
        prefixes = ", ".join(ALLOWED_BRANCH_PREFIXES)
        errors.append(f"Branch '{normalized}' must start with one of: {prefixes}.")
    return errors


def get_current_branch(root: pathlib.Path) -> str:
    result = subprocess.run(
        ["git", "branch", "--show-current"],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise PreflightError(
            "Failed to determine the current git branch: "
            + (result.stderr.strip() or result.stdout.strip() or "unknown git error")
        )
    return result.stdout.strip()


def validate_taxonomy_contract(root: pathlib.Path) -> list[str]:
    path = root / "configs/taxonomy/actor_groups.yaml"
    data = read_yaml(path)
    if not isinstance(data, dict):
        raise PreflightError("configs/taxonomy/actor_groups.yaml must contain a mapping.")

    errors: list[str] = []
    actor_groups = data.get("actor_groups")
    geography_levels = data.get("geography_levels")
    slotting_rules = data.get("slotting_rules")

    expected_actor_groups = [
        "municipality",
        "provincial_agency",
        "first_nation",
        "media",
        "industry_union",
        "emergency_service",
        "community_group",
    ]
    expected_geography_levels = ["province", "region", "municipality", "community"]

    if actor_groups != expected_actor_groups:
        errors.append("Actor-group taxonomy ordering does not match the documented release contract.")
    if geography_levels != expected_geography_levels:
        errors.append("Geography-level ordering does not match the documented release contract.")
    if not isinstance(slotting_rules, list) or not slotting_rules:
        errors.append("slotting_rules must contain at least one machine-readable rule.")
    return errors


def validate_sqlite_schema(root: pathlib.Path, schema_relative_path: str = "sql/control_plane_state.sql") -> list[str]:
    schema_path = root / schema_relative_path
    if not schema_path.exists():
        return [f"Missing SQL schema: {schema_relative_path}"]

    sql_text = schema_path.read_text(encoding="utf-8")
    connection = sqlite3.connect(":memory:")
    try:
        connection.executescript(sql_text)
    except sqlite3.DatabaseError as exc:
        return [f"SQLite schema failed to apply for {schema_relative_path}: {exc}"]
    finally:
        connection.close()
    return []


def validate_validation_targets(root: pathlib.Path) -> list[str]:
    path = root / "validation/validation_targets.yaml"
    data = read_yaml(path)
    if not isinstance(data, dict):
        raise PreflightError("validation/validation_targets.yaml must contain a mapping.")

    errors: list[str] = []
    for key in ["required_files", "required_playbooks", "required_docs", "required_examples", "required_contracts"]:
        values = data.get(key, [])
        if not isinstance(values, list):
            errors.append(f"{key} must be a list.")
            continue
        errors.extend(f"Missing required path: {rel}" for rel in ensure_paths_exist(root, values))
    return errors


def iter_files(root: pathlib.Path) -> Iterable[pathlib.Path]:
    for path in root.rglob("*"):
        if path.is_file():
            yield path


def validate_structured_files(root: pathlib.Path) -> list[str]:
    errors: list[str] = []
    for path in iter_files(root):
        suffix = path.suffix.lower()
        if suffix in {".yaml", ".yml"}:
            try:
                yaml.safe_load(path.read_text(encoding="utf-8"))
            except Exception as exc:
                errors.append(f"YAML parse failed for {path.relative_to(root)}: {exc}")
        elif suffix == ".toml":
            try:
                import tomllib

                tomllib.loads(path.read_text(encoding="utf-8"))
            except Exception as exc:
                errors.append(f"TOML parse failed for {path.relative_to(root)}: {exc}")
    return errors


def validate_custom_agents(root: pathlib.Path) -> list[str]:
    agents_dir = root / ".codex/agents"
    if not agents_dir.exists():
        return ["Missing .codex/agents directory."]

    errors: list[str] = []
    import tomllib

    for path in sorted(agents_dir.glob("*.toml")):
        data = tomllib.loads(path.read_text(encoding="utf-8"))
        for field_name in ("name", "description", "developer_instructions"):
            if not isinstance(data.get(field_name), str) or not data[field_name].strip():
                errors.append(f"{path.relative_to(root)} must define non-empty '{field_name}'.")
        if "instructions" in data or "prompt" in data:
            errors.append(f"{path.relative_to(root)} uses undocumented agent fields; use developer_instructions.")
    return errors
