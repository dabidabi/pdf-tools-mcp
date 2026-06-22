#!/usr/bin/env python3
from __future__ import annotations

import os
import subprocess
import sys
import venv
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VENV_DIR = ROOT / ".venv"
BIN_DIR = "Scripts" if os.name == "nt" else "bin"
PYTHON = "python.exe" if os.name == "nt" else "python"
VENV_PYTHON = VENV_DIR / BIN_DIR / PYTHON
SERVER = ROOT / "mcp_server.py"
REQUIREMENTS = ROOT / "requirements.txt"


def has_pypdf(python: Path | str) -> bool:
    try:
        result = subprocess.run(
            [str(python), "-c", "import pypdf"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
    except OSError:
        return False
    return result.returncode == 0


def ensure_venv() -> Path:
    if not VENV_PYTHON.exists():
        print("codex-pdf-tools: creating local Python environment", file=sys.stderr)
        venv.EnvBuilder(with_pip=True).create(str(VENV_DIR))
    if not has_pypdf(VENV_PYTHON):
        print("codex-pdf-tools: installing pypdf", file=sys.stderr)
        subprocess.check_call(
            [
                str(VENV_PYTHON),
                "-m",
                "pip",
                "install",
                "--disable-pip-version-check",
                "-r",
                str(REQUIREMENTS),
            ]
        )
    return VENV_PYTHON


def main() -> None:
    if has_pypdf(sys.executable):
        os.execv(sys.executable, [sys.executable, str(SERVER)])
    python = ensure_venv()
    os.execv(str(python), [str(python), str(SERVER)])


if __name__ == "__main__":
    main()
