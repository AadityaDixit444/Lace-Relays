import copy
import json

import httpx
import pytest

from api.nike import fetch_product, product_payload
from api.providers import normalize_detail

OBSERVED = "2026-11-14T18:00:00Z"
BINDING = dict(
    shoeId="precision",
    brand="Nike",
    article="IH1104-003",
    color="Black / White / Dusty Cactus",
    edition="Precision 8 Low",
    range="adult",
    retailer="Nike India",
    listingId="42",
    sourceUrl="https://www.nike.in/nike-precision-8-low-men-s-basketball-shoes/p/42",
    sourceName="Nike Precision 8 Low",
    sourceSubtitle="Men's Basketball Shoes",
    verified=True,
    sizeSystem="UK",
)
SHOE = {k: v for k, v in BINDING.items() if k in ["brand", "article", "color", "edition", "range"]}
SHOE["id"] = "precision"


def source():
    summary = {
        "attributes": [
            {"label": "Style", "value": "IH1104-003"},
            {"label": "Colour Shown", "value": "Black|White|Dusty Cactus"},
        ]
    }
    product = dict(
        id="42",
        sku="parent",
        title=BINDING["sourceName"],
        subTitle=BINDING["sourceSubtitle"],
        categoryName="Nike",
        type="configurable",
        product_summary=summary,
        isOutOfStock=0,
    )
    variants = [
        dict(
            id=str(i),
            sku="sku" + str(i),
            parentId="42",
            parentSku="parent",
            title=product["title"],
            sizeName=size,
            product_summary=copy.deepcopy(summary),
            discountedPrice=5396,
            isOutOfStock=stock,
        )
        for i, size, stock in [(1, "UK 6 (EU 40)", 0), (2, "UK 7", 0), (3, "UK 7.5", 1)]
    ]
    product["sizeOptions"] = {"options": variants}
    schema = {
        "@type": "Product",
        "sku": "parent",
        "offers": {
            "url": BINDING["sourceUrl"],
            "priceCurrency": "INR",
            "availability": "https://schema.org/InStock",
        },
    }
    return product, schema


def page(product, schema):
    state = {"details": {"skuData": {"product": product}}}
    return (
        '<script id="__PRELOADED_STATE__" type="application/json">'
        + json.dumps(state)
        + '</script><script type="application/ld+json">'
        + json.dumps(schema)
        + "</script>"
    )


def test_nike_keeps_explicit_half_sizes_and_sold_out_evidence():
    product, schema = source()
    raw = product_payload(page(product, schema), BINDING, OBSERVED)
    rows, _ = normalize_detail(raw, BINDING, SHOE, OBSERVED)
    assert [(r["size"], r["pricePaise"], r["stock"]) for r in rows] == [
        (6, 539600, "in_stock"),
        (7, 539600, "in_stock"),
        (7.5, 539600, "out_of_stock"),
    ]
    product["isOutOfStock"] = 1
    assert all(
        not v["available"]
        for v in product_payload(page(product, schema), BINDING, OBSERVED)["sizes"]
    )
    product["isOutOfStock"] = 0
    schema["offers"]["availability"] = "https://schema.org/OutOfStock"
    assert all(
        not v["available"]
        for v in product_payload(page(product, schema), BINDING, OBSERVED)["sizes"]
    )


@pytest.mark.parametrize(
    "change",
    [
        "article",
        "colour",
        "child",
        "currency",
        "duplicate",
        "schema",
        "brand",
        "model",
        "subtitle",
        "preorder",
    ],
)
def test_nike_rejects_identity_and_currency_contradictions(change):
    product, schema = source()
    if change == "article":
        product["product_summary"]["attributes"][0]["value"] = "IH1104-004"
    if change == "colour":
        product["product_summary"]["attributes"][1]["value"] = "White|Black"
    if change == "child":
        product["sizeOptions"]["options"][0]["parentId"] = "wrong"
    if change == "currency":
        schema["offers"]["priceCurrency"] = "USD"
    if change == "duplicate":
        product["sizeOptions"]["options"].append(
            copy.deepcopy(product["sizeOptions"]["options"][0])
        )
    if change == "schema":
        schema["sku"] = "different"
    if change == "brand":
        product["categoryName"] = "Other"
    if change == "model":
        product["title"] = "Precision 7"
    if change == "subtitle":
        product["subTitle"] = "Older Kids' Shoes"
    if change == "preorder":
        schema["offers"]["availability"] = "https://schema.org/PreOrder"
    with pytest.raises(ValueError):
        product_payload(page(product, schema), BINDING, OBSERVED)


def test_nike_never_borrows_parent_price_or_infers_us_size():
    product, schema = source()
    product["discountedPrice"] = 1000
    variants = product["sizeOptions"]["options"]
    variants[0].pop("discountedPrice")
    variants[1]["sizeName"] = "US 8"
    variants[2]["isOutOfStock"] = None
    raw = product_payload(page(product, schema), BINDING, OBSERVED)
    assert len(raw["sizes"]) == 1 and raw["sizes"][0]["available"] is None
    with pytest.raises(ValueError):
        product_payload("<script>throw new Error()</script>", BINDING, OBSERVED)


@pytest.mark.asyncio
async def test_nike_page_fetch_is_bounded_host_checked_and_never_sends_keys():
    product, schema = source()

    def handler(request):
        assert request.url.host == "www.nike.in"
        assert "x-api-key" not in request.headers and "authorization" not in request.headers
        return httpx.Response(200, text=page(product, schema))

    raw = await fetch_product(BINDING, httpx.MockTransport(handler))
    assert raw["article_code"] == "IH1104-003"
    with pytest.raises(ValueError):
        await fetch_product(dict(BINDING, sourceUrl="https://evil.test/p/42"))
    with pytest.raises(ValueError):
        await fetch_product(
            BINDING, httpx.MockTransport(lambda _: httpx.Response(200, content=b"x" * 2_000_001))
        )
    with pytest.raises(ValueError):
        await fetch_product(
            BINDING,
            httpx.MockTransport(
                lambda _: httpx.Response(200, text=page(product, schema), headers={"age": "172800"})
            ),
        )
