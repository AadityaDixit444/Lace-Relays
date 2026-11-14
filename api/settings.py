"""Server-only configuration. Never log credential values."""

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parent.parent


@dataclass
class Settings:
    apish_key: str = field(default="", repr=False)
    pilot_token: str = field(default="", repr=False)
    supabase_url: str = ""
    supabase_key: str = field(default="", repr=False)
    cron_secret: str = field(default="", repr=False)
    db_path: str = str(ROOT / ".data" / "observations.sqlite")
    production: bool = False
    show_fixtures: bool = False

    @classmethod
    def load(cls):
        values = {**dotenv_values(ROOT / ".env.local"), **os.environ}
        production = values.get("LACERELAY_ENV") == "production" or bool(values.get("VERCEL"))
        return cls(
            apish_key=values.get("APISH_KEY") or "",
            pilot_token=values.get("PILOT_ACCESS_TOKEN") or "",
            supabase_url=values.get("SUPABASE_URL") or "",
            supabase_key=values.get("SUPABASE_SERVICE_ROLE_KEY") or "",
            cron_secret=values.get("CRON_SECRET") or "",
            db_path=values.get("LACERELAY_DB_PATH") or str(ROOT / ".data" / "observations.sqlite"),
            production=production,
            show_fixtures=not production and values.get("SHOW_TEST_FIXTURES") == "1",
        )
