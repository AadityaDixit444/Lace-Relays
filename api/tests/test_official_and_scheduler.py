import asyncio
import copy
from dataclasses import replace

import httpx
import pytest
from fastapi.testclient import TestClient

from api.asics import fetch_product, product_payload
from api.main import create_app
from api.providers import RetailerClient, normalize_detail
from api.service import Service
from api.settings import Settings
from api.storage import Store

SHOE = dict(
    id="asics-test",
    brand="ASICS",
    article="1201B069.300",
    color="Verdigris / Cream",
    edition="Classic CT S",
    range="adult",
)
BINDING = dict(
    shoeId=SHOE["id"],
    **{k: SHOE[k] for k in SHOE if k != "id"},
    retailer="ASICS India",
    listingId="1201B069.300",
    sourceName="CLASSIC CT S",
    sourceUrl="https://www.asics.co.in/1201b069-300-classic-ct-s.html",
    sizeSystem="UK",
    verified=True,
)
OBSERVED = "2026-11-14T12:00:00+00:00"


def payload():
    return {
        "data": {
            "products": {
                "items": [
                    {
                        "sku": "1201B069.300",
                        "name": "CLASSIC CT S",
                        "__typename": "ConfigurableProduct",
                        "variants": [
                            {
                                "attributes": [{"code": "size", "label": label}],
                                "product": {
                                    "sku": sku,
                                    "stock_status": stock,
                                    "price_range": {
                                        "minimum_price": {
                                            "final_price": {"value": "3499", "currency": "INR"}
                                        }
                                    },
                                },
                            }
                            for label, sku, stock in [
                                ("US8/UK7", "1201B069.300.8", "IN_STOCK"),
                                ("US13/UK12", "1201B069.300.13", "OUT_OF_STOCK"),
                            ]
                        ],
                    }
                ]
            }
        }
    }


def test_official_variants_preserve_explicit_uk_sizes_and_price():
    raw = product_payload(payload(), BINDING, OBSERVED)
    rows, limitation = normalize_detail(raw, BINDING, SHOE, OBSERVED)
    assert limitation is None
    assert [(r["size"], r["pricePaise"], r["stock"]) for r in rows] == [
        (7, 349900, "in_stock"),
        (12, 349900, "out_of_stock"),
    ]
    data = payload()
    variants = data["data"]["products"]["items"][0]["variants"]
    variants[0]["attributes"][0]["label"] = "US8"
    assert len(product_payload(data, BINDING, OBSERVED)["sizes"]) == 1
    variants[1]["attributes"][0]["label"] = "EU46"
    with pytest.raises(ValueError):
        product_payload(data, BINDING, OBSERVED)


def test_official_article_currency_duplicate_size_and_graphql_errors_fail_closed():
    for case in ("article", "currency", "duplicate", "error"):
        data = payload()
        item = data["data"]["products"]["items"][0]
        if case == "article":
            item["sku"] = "1201B069.301"
        if case == "currency":
            item["variants"][0]["product"]["price_range"]["minimum_price"]["final_price"][
                "currency"
            ] = "USD"
        if case == "duplicate":
            item["variants"].append(copy.deepcopy(item["variants"][0]))
        if case == "error":
            data["errors"] = [{"message": "private upstream error"}]
        with pytest.raises(ValueError):
            product_payload(data, BINDING, OBSERVED)


@pytest.mark.asyncio
async def test_official_connector_uses_fixed_host_and_never_sends_apish_key():
    def handler(request):
        assert request.url.host == "www.asics.co.in"
        assert "x-api-key" not in request.headers and "authorization" not in request.headers
        return httpx.Response(200, json=payload(), headers={"age": "180000"})

    provider = RetailerClient("fixture", httpx.MockTransport(handler))
    with pytest.raises(ValueError):
        await provider.detail(BINDING)
    with pytest.raises(ValueError):
        await fetch_product(dict(BINDING, sourceUrl="https://evil.test/product.html"))


@pytest.mark.asyncio
async def test_scheduler_ignores_unverified_pairs_and_reuses_fresh_observations(tmp_path):
    config = Settings(db_path=str(tmp_path / "observations.sqlite"))
    count = 0

    class Provider:
        async def detail(self, binding):
            nonlocal count
            count += 1
            await asyncio.sleep(0.01)
            return product_payload(payload(), binding, OBSERVED)

    import datetime

    def clock():
        return datetime.datetime.fromisoformat(OBSERVED).timestamp()

    service = Service(
        Provider(),
        Store(config),
        [BINDING, dict(BINDING, shoeId="unverified", verified=False)],
        [SHOE],
        clock=clock,
    )
    a, b = await asyncio.gather(service.refresh_verified(), service.refresh_verified())
    assert a["ok"] and b["status"] == "already_running" and count == 1
    assert (await service.refresh_verified())["results"][0]["sources"][0]["status"] == "cached"
    assert count == 1


def test_cron_requires_its_own_secret_and_readiness_checks_storage(tmp_path):
    config = Settings(
        pilot_token="pilot", cron_secret="scheduler", db_path=str(tmp_path / "obs.sqlite")
    )
    service = Service(None, Store(config), [], [])
    with TestClient(create_app(config, service)) as client:
        assert client.get("/internal/refresh").status_code == 401
        assert (
            client.get("/internal/refresh", headers={"Authorization": "Bearer pilot"}).status_code
            == 401
        )
        assert client.get(
            "/internal/refresh", headers={"Authorization": "Bearer scheduler"}
        ).json()["ok"]
        assert client.get("/ready").status_code == 200
    with TestClient(create_app(replace(config, cron_secret=""), service)) as client:
        assert client.get("/internal/refresh").status_code == 503
    assert "scheduler" not in repr(config)


@pytest.mark.asyncio
async def test_live_response_timestamp_is_compared_to_receive_time(tmp_path):
    from datetime import datetime

    started = datetime.fromisoformat(OBSERVED).timestamp()
    now = [started]

    class Provider:
        async def detail(self, binding):
            now[0] += 2
            return product_payload(
                payload(), binding, datetime.fromtimestamp(now[0] - 1).astimezone().isoformat()
            )

    config = Settings(db_path=str(tmp_path / "obs.sqlite"))
    service = Service(Provider(), Store(config), [BINDING], [SHOE], clock=lambda: now[0])
    result = await service.refresh(SHOE)
    assert result[0]["status"] == "checked"
    observations = await service.store.read(SHOE["id"])
    assert len(observations) == 2
    assert datetime.fromisoformat(observations[0]["retrievedAt"]).timestamp() == started + 2


def test_backend_package_excludes_env_databases_and_probe_files(tmp_path, monkeypatch):
    from scripts import prepare_backend

    monkeypatch.setattr(prepare_backend, "ROOT", tmp_path)
    (tmp_path / "api").mkdir()
    (tmp_path / "data").mkdir()
    for name in prepare_backend.MODULES:
        (tmp_path / "api" / (name + ".py")).write_text("# runtime module\n")
    (tmp_path / "api/requirements.txt").write_text("httpx\n")
    for name in ("catalog", "retailer-bindings"):
        (tmp_path / "data" / (name + ".json")).write_text("[]")
    (tmp_path / ".env.local").write_text("PRIVATE_SETTING=fixture\n")
    (tmp_path / "api/probe.py").write_text("# not a runtime dependency\n")
    stage = prepare_backend.prepare(tmp_path / ".data" / "stage")
    files = {str(p.relative_to(stage)).replace("\\", "/") for p in stage.rglob("*") if p.is_file()}
    assert ".env.local" not in files and "api/probe.py" not in files
    assert "api/main.py" in files and "data/retailer-bindings.json" in files
    assert ".env*" in (stage / ".vercelignore").read_text()
    with pytest.raises(ValueError):
        prepare_backend.prepare(stage)
    with pytest.raises(ValueError):
        prepare_backend.prepare(tmp_path / "outside")
