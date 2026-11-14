"""Explicit local QA only: accept labelled fixture rows on stdin."""

import asyncio
import json
import sys

from api.settings import Settings
from api.storage import Store


async def main():
    settings = Settings.load()
    if settings.production or not settings.show_fixtures:
        raise SystemExit("Fixture seeding requires an explicitly enabled local QA environment.")
    rows = json.load(sys.stdin)
    if not rows or not all(r.get("fixture") is True for r in rows):
        raise SystemExit("Only labelled test fixtures are accepted.")
    await Store(settings).save(rows)
    print("Labelled local test fixtures persisted by Python.")


if __name__ == "__main__":
    asyncio.run(main())
