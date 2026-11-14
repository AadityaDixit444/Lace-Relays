"""Explicit, bounded real-data probe. Raw public product data stays in ignored .data."""

import asyncio
import json
from datetime import UTC, datetime

import httpx

from api.providers import RetailerClient
from api.settings import ROOT, Settings


async def main():
    settings = Settings.load()
    if not settings.apish_key:
        raise SystemExit("Configure APISH_KEY in .env.local first.")
    provider = RetailerClient(settings.apish_key)
    requests = json.loads((ROOT / "data/pilot-requests.json").read_text())
    output = ROOT / ".data" / "provider-probe.json"
    output.parent.mkdir(exist_ok=True)
    results = []
    for shoe in requests:
        for retailer in ("Myntra", "Nykaa Fashion"):
            result = dict(
                query=shoe["query"],
                sizeUk=7,
                retailer=retailer,
                retrievedAt=datetime.now(UTC).isoformat(),
            )
            try:
                raw = await provider.request(retailer, "search", q=shoe["query"])
                result.update(status="ok", data=raw)
                products = raw.get("products", []) if isinstance(raw, dict) else []
                print(
                    json.dumps(
                        dict(
                            query=shoe["query"],
                            retailer=retailer,
                            status="ok",
                            count=len(products),
                            candidates=[
                                dict(
                                    id=p.get("id"),
                                    name=p.get("name"),
                                    brand=p.get("brand"),
                                    url=p.get("url"),
                                    price=p.get("price"),
                                    sizes=p.get("sizes"),
                                )
                                for p in products[:3]
                                if isinstance(p, dict)
                            ],
                        )
                    )
                )
            except httpx.HTTPStatusError as error:
                result.update(status="failed", httpStatus=error.response.status_code)
                print(
                    json.dumps(
                        dict(
                            query=shoe["query"],
                            retailer=retailer,
                            status="failed",
                            httpStatus=error.response.status_code,
                        )
                    )
                )
                if error.response.status_code in (401, 403, 402, 429):
                    results.append(result)
                    output.write_text(json.dumps(results, indent=2), encoding="utf-8")
                    return
            except Exception:
                result.update(status="unavailable")
                print(
                    json.dumps(dict(query=shoe["query"], retailer=retailer, status="unavailable"))
                )
            results.append(result)
            output.write_text(json.dumps(results, indent=2), encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
