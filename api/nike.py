"""Read-only Nike India page adapter; parse inert JSON, never execute page scripts."""

import json
import math
import re
from datetime import UTC, datetime, timedelta
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx


class ProductScripts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.current = None
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        if tag == "script":
            self.current = [dict(attrs), ""]

    def handle_data(self, data):
        if self.current is not None:
            self.current[1] += data

    def handle_endtag(self, tag):
        if tag == "script" and self.current is not None:
            self.scripts.append(self.current)
            self.current = None


def source_url(binding):
    url = binding.get("sourceUrl", "")
    parsed = urlparse(url)
    if (
        parsed.scheme != "https"
        or parsed.netloc != "www.nike.in"
        or parsed.query
        or parsed.fragment
        or not re.fullmatch(r"/[a-z0-9-]+/p/\d+", parsed.path)
        or parsed.path.rsplit("/", 1)[-1] != binding["listingId"]
    ):
        raise ValueError("Invalid Nike product reference")
    return url


def attributes(product):
    return {
        a["label"]: a["value"] for a in product.get("product_summary", {}).get("attributes", [])
    }


def identity(value):
    return re.sub(r"[^a-z0-9]", "", value.lower())


def product_payload(html, binding, observed_at):
    url = source_url(binding)
    parser = ProductScripts()
    parser.feed(html)
    states = [
        body
        for attrs, body in parser.scripts
        if attrs.get("id") == "__PRELOADED_STATE__" and attrs.get("type") == "application/json"
    ]
    if len(states) != 1:
        raise ValueError("Nike page has no unambiguous product state")
    product = json.loads(states[0])["details"]["skuData"]["product"]
    attrs = attributes(product)
    if (
        str(product.get("id")) != binding["listingId"]
        or product.get("title") != binding["sourceName"]
        or product.get("subTitle") != binding["sourceSubtitle"]
        or product.get("categoryName") != "Nike"
        or product.get("type") != "configurable"
        or not isinstance(product.get("sku"), str)
        or not product.get("sku")
        or attrs.get("Style") != binding["article"]
        or identity(attrs.get("Colour Shown", "")) != identity(binding["color"])
    ):
        raise ValueError("Nike product identity changed")
    schemas = [
        json.loads(body)
        for script_attrs, body in parser.scripts
        if script_attrs.get("type") == "application/ld+json"
    ]
    schemas = [s for s in schemas if isinstance(s, dict) and s.get("@type") == "Product"]
    if len(schemas) != 1 or schemas[0].get("sku") != product.get("sku"):
        raise ValueError("Nike price currency identity is ambiguous")
    offers = schemas[0].get("offers", {})
    if offers.get("priceCurrency") != "INR" or offers.get("url") != url:
        raise ValueError("Nike price currency is unconfirmed")
    if offers.get("availability") not in (
        "https://schema.org/InStock",
        "https://schema.org/OutOfStock",
    ):
        raise ValueError("Nike ordinary stock status is unconfirmed")
    sizes, seen, variant_ids = [], set(), set()
    for variant in product.get("sizeOptions", {}).get("options", []):
        label = variant.get("sizeName", "")
        size = re.fullmatch(r"UK (\d+(?:\.5)?)(?: \(EU \d+(?:\.\d+)?\))?", label)
        if not size:
            continue
        vattrs = attributes(variant)
        if (
            str(variant.get("parentId")) != binding["listingId"]
            or variant.get("parentSku") != product.get("sku")
            or variant.get("title") != binding["sourceName"]
            or vattrs.get("Style") != binding["article"]
            or identity(vattrs.get("Colour Shown", "")) != identity(binding["color"])
        ):
            raise ValueError("Nike variant identity changed")
        sku = variant.get("sku")
        if not isinstance(sku, str) or not sku or not variant.get("id"):
            raise ValueError("Nike variant identifier is missing")
        if size[1] in seen or str(variant["id"]) in variant_ids:
            raise ValueError("Nike UK size mapping is ambiguous")
        seen.add(size[1])
        variant_ids.add(str(variant["id"]))
        price = variant.get("discountedPrice")
        if type(price) not in (int, float) or not math.isfinite(price) or price <= 0:
            continue  # Never borrow a parent price for an unpriced variant.
        stock = variant.get("isOutOfStock")
        available = (
            False
            if product.get("isOutOfStock") == 1
            or stock == 1
            or offers.get("availability") == "https://schema.org/OutOfStock"
            else True
            if stock == 0
            else None
        )
        sizes.append(
            dict(label="UK " + size[1], sku=str(variant["id"]), price=price, available=available)
        )
    if not sizes:
        raise ValueError("Nike page has no explicit UK variant price evidence")
    return dict(
        id=binding["listingId"],
        brand="Nike",
        article_code=attrs["Style"],
        name=product["title"],
        url=url,
        currency="INR",
        sizes=sizes,
        fetched_at=observed_at,
        cached=False,
    )


async def fetch_product(binding, transport=None):
    url = source_url(binding)
    async with httpx.AsyncClient(timeout=15, transport=transport, follow_redirects=False) as client:
        async with client.stream("GET", url) as response:
            response.raise_for_status()
            age = float(response.headers.get("age", "0"))
            if not math.isfinite(age) or not 0 <= age < 172800:
                raise ValueError("Nike response age is invalid or expired")
            chunks, total = [], 0
            async for chunk in response.aiter_bytes():
                total += len(chunk)
                if total > 2_000_000:
                    raise ValueError("Nike response exceeded product-page limit")
                chunks.append(chunk)
            observed = (datetime.now(UTC) - timedelta(seconds=age)).isoformat()
            return product_payload(b"".join(chunks).decode("utf-8"), binding, observed)
