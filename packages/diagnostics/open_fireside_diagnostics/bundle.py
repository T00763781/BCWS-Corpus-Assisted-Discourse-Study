from __future__ import annotations

import json
import os
import platform
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def build_diagnostics_bundle(target_dir: str) -> Path:
    root = Path(target_dir)
    root.mkdir(parents=True, exist_ok=True)
    summary = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "platform": platform.platform(),
        "python": platform.python_version(),
        "cwd": os.getcwd(),
    }
    (root / "env-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    try:
        pip_freeze = subprocess.run(["python", "-m", "pip", "freeze"], capture_output=True, text=True, check=False)
        (root / "pip-freeze.txt").write_text(pip_freeze.stdout or pip_freeze.stderr, encoding="utf-8")
    except Exception as exc:
        (root / "pip-freeze.txt").write_text(f"Unable to capture pip freeze: {exc}", encoding="utf-8")
    return root
