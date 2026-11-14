"""Durable storage compatible with the existing SQLite payload table and Supabase migration."""

import hashlib
import json
import math
import sqlite3
from pathlib import Path
from urllib.parse import urlparse

import httpx

from api.providers import timestamp


def observation_id(row):
    fields = [
        "shoeId",
        "brand",
        "article",
        "color",
        "edition",
        "range",
        "retailer",
        "variantId",
        "size",
        "observedAt",
        "fixture",
    ]
    values = [row.get(k) for k in fields]
    # JS JSON.stringify serializes integral UK sizes without a decimal suffix.
    values = [int(v) if type(v) is float and v.is_integer() else v for v in values]
    return hashlib.sha256(
        json.dumps(values, separators=(",", ":"), ensure_ascii=False).encode()
    ).hexdigest()


class Store:
    def __init__(self, settings, transport=None):
        self.settings, self.transport = settings, transport

    @property
    def mode(self):
        return (
            "supabase"
            if self.settings.supabase_url and self.settings.supabase_key
            else "unconfigured"
            if self.settings.production
            else "sqlite"
        )

    def remote(self):
        parsed = urlparse(self.settings.supabase_url)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or not parsed.hostname.endswith(".supabase.co")
            or parsed.username
            or parsed.password
        ):
            raise ValueError("Invalid storage configuration")
        return f"{parsed.scheme}://{parsed.netloc}/rest/v1/shoe_observations", {
            "apikey": self.settings.supabase_key,
            "Authorization": "Bearer " + self.settings.supabase_key,
        }

    def connection(self):
        path = Path(self.settings.db_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(path, timeout=5)
        db.execute("PRAGMA journal_mode=WAL")
        db.execute(
            "CREATE TABLE IF NOT EXISTS shoe_observations (id TEXT PRIMARY KEY, shoe_id TEXT NOT NULL, payload TEXT NOT NULL)"
        )
        db.execute("CREATE INDEX IF NOT EXISTS observations_shoe ON shoe_observations(shoe_id)")
        return db

    async def save(self, rows):
        if not rows:
            return
        if any(
            not math.isfinite(timestamp(r["observedAt"]))
            or type(r["pricePaise"]) is not int
            or r["pricePaise"] < 0
            for r in rows
        ):
            raise ValueError("Invalid observation")
        if self.mode == "unconfigured":
            raise RuntimeError("Persistent storage is not configured")
        if self.mode == "supabase":
            url, headers = self.remote()
            records = [
                dict(
                    id=observation_id(r),
                    shoe_id=r["shoeId"],
                    brand=r["brand"],
                    article=r["article"],
                    color=r["color"],
                    edition=r["edition"],
                    range=r["range"],
                    retailer=r["retailer"],
                    variant_id=r["variantId"],
                    size_uk=r["size"],
                    price_paise=r["pricePaise"],
                    currency=r["currency"],
                    stock=r["stock"],
                    observed_at=r["observedAt"],
                    retrieved_at=r["retrievedAt"],
                    price_type=r["priceType"],
                    match_status=r["match"],
                    url=r["url"],
                    fixture=r["fixture"],
                    payload=r,
                )
                for r in rows
            ]
            async with httpx.AsyncClient(timeout=10, transport=self.transport) as client:
                response = await client.post(
                    url,
                    params={"on_conflict": "id"},
                    headers={**headers, "Prefer": "resolution=ignore-duplicates"},
                    json=records,
                )
                response.raise_for_status()
            return
        db = self.connection()
        try:
            with db:
                db.executemany(
                    "INSERT OR IGNORE INTO shoe_observations(id,shoe_id,payload) VALUES(?,?,?)",
                    [(observation_id(r), r["shoeId"], json.dumps(r)) for r in rows],
                )
        finally:
            db.close()

    async def read(self, shoe_id=None):
        rows = []
        if self.mode == "supabase":
            url, headers = self.remote()
            offset = 0
            async with httpx.AsyncClient(timeout=10, transport=self.transport) as client:
                while True:
                    params = dict(
                        select="payload", order="observed_at.asc,id.asc", offset=offset, limit=1000
                    )
                    if shoe_id:
                        params["shoe_id"] = "eq." + shoe_id
                    if not self.settings.show_fixtures or self.settings.production:
                        params["fixture"] = "eq.false"
                    response = await client.get(url, params=params, headers=headers)
                    response.raise_for_status()
                    page = response.json()
                    rows.extend(p["payload"] for p in page)
                    if len(page) < 1000:
                        break
                    offset += 1000
        elif self.mode == "sqlite":
            db = self.connection()
            try:
                records = (
                    db.execute(
                        "SELECT payload FROM shoe_observations WHERE shoe_id=?", (shoe_id,)
                    ).fetchall()
                    if shoe_id
                    else db.execute("SELECT payload FROM shoe_observations").fetchall()
                )
                rows = [json.loads(r[0]) for r in records]
            finally:
                db.close()
        return [
            r
            for r in rows
            if not r.get("fixture") or self.settings.show_fixtures and not self.settings.production
        ]
