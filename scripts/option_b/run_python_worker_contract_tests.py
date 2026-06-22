#!/usr/bin/env python3
"""Run Python worker contract tests with the correct local environment.

This avoids platform-specific shell syntax for PYTHONPATH and provides a clear
message when dev/test dependencies such as httpx are missing.
"""
from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
from pathlib import Path

REQUIRED_IMPORTS = ("fastapi", "httpx", "pytest")


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def main() -> int:
    root = repo_root()
    missing = [name for name in REQUIRED_IMPORTS if importlib.util.find_spec(name) is None]
    if missing:
        print("Cannot run Python worker contract tests. Missing modules: " + ", ".join(missing), file=sys.stderr)
        print("Run this first:", file=sys.stderr)
        print("  python scripts/option_b/install_python_worker_deps.py", file=sys.stderr)
        return 1

    python_worker = root / "services" / "python-worker"
    env = os.environ.copy()
    existing_pythonpath = env.get("PYTHONPATH")
    env["PYTHONPATH"] = str(python_worker) if not existing_pythonpath else str(python_worker) + os.pathsep + existing_pythonpath
    env.setdefault("PYTEST_DISABLE_PLUGIN_AUTOLOAD", "1")

    cmd = [
        sys.executable,
        "-m",
        "pytest",
        "-q",
        "services/python-worker/tests/test_worker_contracts.py",
        "--disable-warnings",
    ]
    return subprocess.run(cmd, cwd=root, env=env).returncode


if __name__ == "__main__":
    raise SystemExit(main())
