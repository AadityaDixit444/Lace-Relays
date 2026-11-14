import copy

import httpx
import pytest

from api.amazon import product_payload
from api.providers import RetailerClient, normalize_detail

BINDING = dict(
    shoeId="alleyoop-test",
    brand="Nike",
    article="CJ0882-001",
    color="Black / White / Black",
    edition="SB Alleyoop",
    range="adult",
    retailer="Amazon.in",
    listingId="B07Q5G672R",
    verified=True,
    sizeSystem="UK",
    parentAsin="B0GF9LHWZC",
    sizeDescriptor="7 UK",
    colorDescriptor="BLACK/WHITE-BLACK",
    sourceTitle="Nike Men's SB Alleyoop Sneakers",
)
SHOE = {k: BINDING[k] for k in ["brand", "article", "color", "edition", "range"]}
SHOE["id"] = "alleyoop-test"
NOW = "2026-11-14T18:00:00Z"


def payload():
    return dict(
        asin="B07Q5G672R",
        parent_asin="B0GF9LHWZC",
        domain="amazon.in",
        url="https://www.amazon.in/dp/B07Q5G672R",
        title="Nike Men's SB Alleyoop Sneakers",
        brand=None,
        price="₹6,495.00",
        price_value=6495,
        availability="In stock",
        cached=False,
        fetched_at=NOW,
        variants={
            "dimensions": ["size_name", "color_name"],
            "asins": [
                {
                    "asin": "B07Q5G672R",
                    "values": ["7 UK", "BLACK/WHITE-BLACK"],
                    "url": "https://www.amazon.com/dp/B07Q5G672R",
                },
                {
                    "asin": "B07Q4DLNJ3",
                    "values": ["5 UK", "BLACK/WHITE-BLACK"],
                    "url": "https://www.amazon.com/dp/B07Q4DLNJ3",
                },
            ],
        },
    )


def test_selected_asin_records_only_its_uk_size_and_preserves_marketplace():
    raw = product_payload(payload(), BINDING)
    rows, _ = normalize_detail(raw, BINDING, SHOE, NOW)
    assert len(rows) == 1 and rows[0]["size"] == 7 and rows[0]["pricePaise"] == 649500
    assert rows[0]["url"] == "https://www.amazon.in/dp/B07Q5G672R"
    assert rows[0]["stock"] == "in_stock"
    source = payload()
    source["availability"] = "Currently unavailable."
    raw = product_payload(source, BINDING)
    assert raw["sizes"][0]["available"] is False
    source["availability"] = "Check availability at checkout"
    assert product_payload(source, BINDING)["sizes"][0]["available"] is None
    # Dimension order is supplied by the provider; neither size nor colour is guessed.
    source = payload()
    source["variants"]["dimensions"].reverse()
    for row in source["variants"]["asins"]:
        row["values"].reverse()
    assert product_payload(source, BINDING)["sizes"][0]["label"] == "UK 7"


@pytest.mark.parametrize(
    "change",
    [
        "asin",
        "family",
        "marketplace",
        "size",
        "colour",
        "currency",
        "numeric",
        "time",
        "cache",
        "duplicate",
        "title",
        "brand",
        "format",
    ],
)
def test_amazon_refuses_cross_variant_or_uncertain_price_evidence(change):
    data = payload()
    if change == "asin":
        data["asin"] = "B07Q4DLNJ3"
    if change == "family":
        data["parent_asin"] = "OTHER"
    if change == "marketplace":
        data.update(domain="amazon.com", url="https://www.amazon.com/dp/B07Q5G672R")
    if change == "size":
        data["variants"]["asins"][0]["values"][0] = "5 UK"
    if change == "colour":
        data["variants"]["asins"][0]["values"][1] = "WHITE/BLACK-WHITE"
    if change == "currency":
        data["currency"] = "USD"
    if change == "numeric":
        data["price_value"] = 1
    if change == "time":
        data["fetched_at"] = None
    if change == "cache":
        data.pop("cached")
    if change == "duplicate":
        data["variants"]["asins"].append(copy.deepcopy(data["variants"]["asins"][0]))
    if change == "title":
        data["title"] = "Nike Dunk Sneakers"
    if change == "brand":
        data["brand"] = "Other"
    if change == "format":
        data["price"] = "₹6,49,5"
    with pytest.raises(ValueError):
        product_payload(data, BINDING)


@pytest.mark.asyncio
async def test_amazon_connector_keeps_key_on_provider_and_explicit_india_url():
    def handler(request):
        assert request.url.host == "api.api.sh"
        assert request.url.path == "/amazon/v1/product"
        assert request.headers["x-api-key"] == "fixture"
        assert request.url.params["domain"] == "in"
        assert request.url.params["url"] == "https://www.amazon.in/dp/B07Q5G672R"
        return httpx.Response(200, json=payload())

    raw = await RetailerClient("fixture", httpx.MockTransport(handler)).detail(BINDING)
    assert raw["id"] == "B07Q5G672R" and raw["currency"] == "INR"
