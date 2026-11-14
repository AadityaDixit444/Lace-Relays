"""Prepare an allowlisted backend upload without environment files or local databases."""

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODULES = ("__init__", "main", "settings", "storage", "providers", "service", "asics")


def prepare(destination):
    destination = Path(destination).resolve()
    if destination == ROOT or not destination.is_relative_to(ROOT / ".data"):
        raise ValueError("Backend staging must stay inside the ignored .data directory")
    if destination.exists():
        raise ValueError("Use a new staging directory to avoid stale uploaded files")
    (destination / "api").mkdir(parents=True)
    (destination / "data").mkdir()
    for module in MODULES:
        shutil.copyfile(ROOT / "api" / (module + ".py"), destination / "api" / (module + ".py"))
    for name in ("catalog", "retailer-bindings"):
        shutil.copyfile(ROOT / "data" / (name + ".json"), destination / "data" / (name + ".json"))
    shutil.copyfile(ROOT / "api/requirements.txt", destination / "requirements.txt")
    (destination / "index.py").write_text("from api.main import app\n", encoding="utf-8")
    (destination / ".python-version").write_text("3.12\n", encoding="utf-8")
    (destination / ".vercelignore").write_text(
        ".env*\n.git\n__pycache__\n*.pyc\n", encoding="utf-8"
    )
    config = {
        "framework": None,
        "builds": [
            {"src": "api/main.py", "use": "@vercel/python", "config": {"includeFiles": ["data/**"]}}
        ],
        "routes": [{"src": "/(.*)", "dest": "/api/main.py"}],
        "crons": [{"path": "/internal/refresh", "schedule": "0 1 * * *"}],
    }
    (destination / "vercel.json").write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    return destination


if __name__ == "__main__":
    import uuid

    print(prepare(ROOT / ".data" / ("backend-vercel-" + uuid.uuid4().hex[:8])))
