#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, pathlib, sys
from typing import Iterable
try:
    import yaml
except Exception as exc:
    print(f"YAML dependency missing: {exc}", file=sys.stderr)
    sys.exit(2)

REQUIRED_DOC_COUNT = 26  # 000 plus 001-025

def iter_files(root: pathlib.Path) -> Iterable[pathlib.Path]:
    for path in root.rglob('*'):
        if path.is_file():
            yield path

def validate_yaml(path: pathlib.Path) -> list[str]:
    errors = []
    try:
        yaml.safe_load(path.read_text(encoding='utf-8'))
    except Exception as exc:
        errors.append(f'YAML parse failed for {path}: {exc}')
    return errors

def validate_json(path: pathlib.Path) -> list[str]:
    errors = []
    try:
        json.loads(path.read_text(encoding='utf-8'))
    except Exception as exc:
        errors.append(f'JSON parse failed for {path}: {exc}')
    return errors

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('root')
    args = parser.parse_args()
    root = pathlib.Path(args.root).resolve()
    vt_path = root / 'validation/validation_targets.yaml'
    if not vt_path.exists():
        print('Missing validation_targets.yaml', file=sys.stderr)
        return 2
    data = yaml.safe_load(vt_path.read_text(encoding='utf-8'))
    errors = []
    for key in ['required_files','required_playbooks','required_docs','required_examples','required_contracts']:
        for rel in data.get(key, []):
            if not (root / rel).exists():
                errors.append(f'Missing required path: {rel}')
    docs = list((root / 'Auto Run Docs/FiresideListeners').glob('*.md'))
    if len(docs) != REQUIRED_DOC_COUNT:
        errors.append(f'Expected {REQUIRED_DOC_COUNT} top-level docs in Auto Run Docs/FiresideListeners, found {len(docs)}')
    for path in iter_files(root):
        if path.suffix.lower() in {'.yaml','.yml'}:
            errors.extend(validate_yaml(path))
        elif path.suffix.lower() == '.json':
            errors.extend(validate_json(path))
    print(f'Scanned files: {sum(1 for _ in iter_files(root))}')
    if errors:
        print('Validation errors:')
        for err in errors:
            print(f'- {err}')
        return 1
    print('Validation checks passed.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
