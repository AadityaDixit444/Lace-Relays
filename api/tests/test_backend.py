import asyncio
import json
from dataclasses import replace
from datetime import UTC, datetime

import httpx
import pytest
from fastapi.testclient import TestClient

from api.main import create_app
from api.providers import RetailerClient, freshness, normalize_detail, normalize_search, uk_size
from api.service import Service, SourcesUnavailable
from api.settings import ROOT, Settings
from api.storage import Store, observation_id

NOW = datetime(2026, 11, 14, 10, tzinfo=UTC).timestamp()
SHOE = json.loads((ROOT / "data/catalog.json").read_text())[0]
BINDING = dict(
    shoeId=SHOE["id"],
    brand=SHOE["brand"],
    article=SHOE["article"],
    color=SHOE["color"],
    edition=SHOE["edition"],
    range=SHOE["range"],
    retailer="Myntra",
    listingId="1",
    sizeSystem="UK",
    verified=True,
)
PAYLOAD = dict(
    id=1,
    url="https://www.myntra.com/1/buy",
    currency="INR",
    fetched_at="2026-11-14T09:00:00Z",
    cached=True,
    sizes=[
        dict(label="UK 7", sku="7", price=7999, available=True),
        dict(label="8", sku="8", price=6999, available=True),
        dict(label="7.5", sku="7.5", price=7499, available=True),
        dict(label="EU 42", sku="legacy", price=6000, available=True),
        dict(label="3", sku="3", price=4999, available=False),
    ],
)


@pytest.fixture
def settings(tmp_path):
    return Settings(
        apish_key="fixture", pilot_token="fixture", db_path=str(tmp_path / "observations.sqlite")
    )


def rows():
    return normalize_detail(PAYLOAD, BINDING, SHOE, datetime.fromtimestamp(NOW, UTC).isoformat())[0]


def test_api_configuration_auth_validation_and_size_limit(settings):
    with TestClient(create_app(replace(settings, apish_key=""))) as client:
        assert client.post("/search", json={"q": "Samba"}).status_code == 503
        assert client.get("/health").json()["backend"] == "fastapi"
    with TestClient(create_app(settings)) as client:
        assert client.post("/search", json={"q": "Samba"}).status_code == 401
        headers = {"Authorization": "Bearer fixture"}
        for body in [
            "null",
            "{",
            "{}",
            '{"q":"ab"}',
            '{"q":"<script>"}',
            json.dumps({"q": "a" * 101}),
        ]:
            assert client.post("/search", content=body, headers=headers).status_code == 400
        assert client.post("/search", content="a" * 3000, headers=headers).status_code == 413
        assert client.get("/shoes/unknown").status_code == 404
        assert client.post("/shoes/samba-og/refresh", headers=headers).status_code == 503
        assert client.get("/catalog").json()["observations"] == []


@pytest.mark.asyncio
async def test_partial_failure_coalescing_cache_and_error_redaction(settings):
    calls = []

    async def handler(request):
        calls.append(request)
        assert request.headers["x-api-key"] == "fixture"
        await asyncio.sleep(0.01)
        if "/nykaafashion/" in request.url.path:
            return httpx.Response(503, json={"error": "private upstream details"})
        return httpx.Response(
            200,
            json={
                "products": [
                    dict(
                        id=1,
                        name="Samba",
                        brand="adidas",
                        price=7999,
                        url="https://www.myntra.com/1/buy",
                        sizes=["7"],
                        in_stock=True,
                    )
                ]
            },
        )

    provider = RetailerClient("fixture", httpx.MockTransport(handler))
    service = Service(provider, Store(settings), [], [SHOE], clock=lambda: NOW)
    first, second = await asyncio.gather(service.search("Samba"), service.search("Samba"))
    assert first == second and len(calls) == 2
    assert [s["status"] for s in first["sources"]] == ["checked", "failed"]
    assert first["listings"][0]["sizeStatus"] == "unconfirmed"
    assert first["listings"][0]["observedAt"] is None
    assert (await service.search("samba"))["cached"] is True and len(calls) == 2
    provider.transport = httpx.MockTransport(
        lambda request: httpx.Response(503, json={"error": "private"})
    )
    with pytest.raises(SourcesUnavailable):
        await service.search("Another pair")


def test_search_normalization_rejects_unsafe_urls_and_currency():
    values = [
        None,
        dict(name="Samba", price=1, url="https://evil.test"),
        dict(name="Samba", price=1, url="https://www.myntra.com/a", currency="USD"),
        dict(name="Samba", price=1, url="https://www.myntra.com/a", in_stock=False),
    ]
    assert normalize_search({"products": values}, "Myntra") == []
    assert "hidden" not in repr(
        Settings(apish_key="hidden", pilot_token="hidden", supabase_key="hidden")
    )


def test_detail_all_sizes_unknown_stock_cache_and_identity():
    normalized = rows()
    assert [r["size"] for r in normalized] == [7, 8, 7.5, None, 3]
    assert normalized[-1]["stock"] == "out_of_stock" and normalized[0]["pricePaise"] == 799900
    assert (
        normalize_detail({**PAYLOAD, "fetched_at": None}, BINDING, SHOE, "2026-11-14T10:00:00Z")[0]
        == []
    )
    assert (
        normalize_detail(PAYLOAD, {**BINDING, "range": "kids"}, SHOE, "2026-11-14T10:00:00Z")[0]
        == []
    )
    assert (
        normalize_detail({**PAYLOAD, "brand": "Nike"}, BINDING, SHOE, "2026-11-14T10:00:00Z")[0]
        == []
    )
    assert (
        normalize_detail(
            {**PAYLOAD, "sizes": [dict(label="7", available=True)], "price": 4999},
            BINDING,
            SHOE,
            "2026-11-14T10:00:00Z",
        )[0]
        == []
    )
    assert uk_size("7.5", "UK") == 7.5 and uk_size("7.5", None) is None
    assert freshness("2026-11-13T10:00:00Z", NOW) == "stale"
    assert freshness("2026-11-12T10:00:00Z", NOW) == "expired"


@pytest.mark.asyncio
async def test_durable_reopen_dedup_and_legacy_unknown(settings):
    store = Store(settings)
    original = rows()
    await store.save(original)
    await store.save([{**r, "retrievedAt": "2026-11-14T11:00:00Z"} for r in original])
    result = await Store(settings).read(SHOE["id"])
    assert len(result) == 5 and result[3]["size"] is None
    assert observation_id({**original[0], "size": 7}) == observation_id(
        {**original[0], "size": 7.0}
    )
    fixture = {**original[0], "fixture": True}
    await store.save([fixture])
    assert len(await store.read()) == 5
    assert len(await Store(replace(settings, show_fixtures=True)).read()) == 6
    assert len(await Store(replace(settings, production=True, show_fixtures=True)).read()) == 0


@pytest.mark.asyncio
async def test_refresh_boundary_all_sizes_and_timeout(settings):
    store = Store(settings)
    await store.save(rows())
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, json=PAYLOAD)

    provider = RetailerClient("fixture", httpx.MockTransport(handler))
    service = Service(provider, store, [BINDING], [SHOE], clock=lambda: NOW)
    assert (await service.refresh(SHOE))[0]["status"] == "cached" and not calls
    service.clock = lambda: NOW + 23 * 3600
    assert (await service.refresh(SHOE))[0]["status"] == "checked" and len(calls) == 1
    assert len(await store.read()) == 5

    def timeout(request):
        raise httpx.ReadTimeout("private timeout")

    provider.transport = httpx.MockTransport(timeout)
    service.clock = lambda: NOW + 25 * 3600
    assert (await service.refresh(SHOE))[0]["status"] == "stale"
    assert (await store.read())[0]["observedAt"] == PAYLOAD["fetched_at"]


@pytest.mark.asyncio
async def test_supabase_payload_and_production_fixture_filter(settings):
    config = replace(
        settings,
        production=True,
        show_fixtures=True,
        supabase_url="https://fixture.supabase.co",
        supabase_key="fixture",
    )
    normalized = rows()

    def handler(request):
        assert request.url.host == "fixture.supabase.co" and request.headers["apikey"] == "fixture"
        if request.method == "POST":
            body = json.loads(request.content)
            assert len(body) == 5 and body[3]["size_uk"] is None
            return httpx.Response(201)
        assert request.url.params["fixture"] == "eq.false"
        return httpx.Response(
            200,
            json=[{"payload": r} for r in normalized]
            + [{"payload": {**normalized[0], "fixture": True}}],
        )

    store = Store(config, httpx.MockTransport(handler))
    await store.save(normalized)
    assert len(await store.read(SHOE["id"])) == 5


def test_python_reads_existing_typescript_sqlite_snapshot_without_duplicate(settings):
    import sqlite3

    row = rows()[0]
    # Fixed Node-generated key verifies cross-language JSON/hash compatibility.
    expected = "d2bccdfa6460b2ff15274fe3983fdb95056d550629a2d41cf7fab63301e8af73"
    assert observation_id(row) == expected
    db = sqlite3.connect(settings.db_path)
    db.execute(
        "CREATE TABLE shoe_observations(id TEXT PRIMARY KEY,shoe_id TEXT NOT NULL,payload TEXT NOT NULL)"
    )
    db.execute(
        "INSERT INTO shoe_observations VALUES(?,?,?)", (expected, row["shoeId"], json.dumps(row))
    )
    db.commit()
    db.close()
    store = Store(settings)
    asyncio.run(store.save([row]))
    assert len(asyncio.run(store.read())) == 1
