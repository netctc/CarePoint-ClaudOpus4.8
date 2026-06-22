#!/usr/bin/env python3
"""Install Python worker dependencies using the active Python interpreter.

This script is intentionally cross-platform for Windows cmd/PowerShell, macOS,
and Linux. It fixes local test failures such as:

    RuntimeError: starlette.testclient requires the httpx package

Usage:
    python scripts/option_b/install_python_worker_deps.py
    python scripts/option_b/install_python_worker_deps.py --check
"""
from __future__ import annotations

import argparse
import importlib.util
import subprocess
import sys
from pathlib import Path

REQUIRED_IMPORTS = ("fastapi", "httpx", "pytest")


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def missing_imports() -> list[str]:
    missing: list[str] = []
    for module_name in REQUIRED_IMPORTS:
        if importlib.util.find_spec(module_name) is None:
            missing.append(module_name)
    return missing


def main() -> int:
    parser = argparse.ArgumentParser(description="Install/check Python worker dependencies")
    parser.add_argument("--check", action="store_true", help="Only check whether required modules are importable")
    args = parser.parse_args()

    root = repo_root()
    requirements = root / "services" / "python-worker" / "requirements.txt"
    if not requirements.exists():
        print(f"requirements.txt not found: {requirements}", file=sys.stderr)
        return 2

    if args.check:
        missing = missing_imports()
        if missing:
            print("Missing Python modules: " + ", ".join(missing))
            print("Run: python scripts/option_b/install_python_worker_deps.py")
            return 1
        print("Python worker dependencies are available.")
        return 0

    cmd = [sys.executable, "-m", "pip", "install", "-r", str(requirements)]
    print("Installing Python worker dependencies with:")
    print(" ".join(cmd))
    result = subprocess.run(cmd, cwd=root)
    if result.returncode != 0:
        return result.returncode

    missing = missing_imports()
    if missing:
        print("Install completed, but these modules are still missing: " + ", ".join(missing), file=sys.stderr)
        return 1
    print("Python worker dependencies installed and verified.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
