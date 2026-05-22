from __future__ import annotations

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
STATIC_DIR = BASE_DIR / "static"
DOCS_DIR = BASE_DIR / "docs"
COMMAND_CONFIG_PATH = BASE_DIR / "command_targets.json"
