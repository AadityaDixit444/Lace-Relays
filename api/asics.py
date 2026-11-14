"""Read-only ASICS India variant data. Only reviewed product references are queried."""

import json
import math
import re
from datetime import UTC, datetime, timedelta
from decimal import Decimal, InvalidOperation
from urllib.parse import urlparse

import httpx


def product_request(binding):
    url = binding.get("sourceUrl", "")
    parsed = urlparse(url)
    if (
        parsed.scheme != "https"
        or parsed.hostname != "www.asics.co.in"
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or not re.fullmatch(r"/[a-z0-9-]+\.html", parsed.path)
    ):
        raise ValueError("Invalid ASICS product reference")
    # Query variables are data, never GraphQL syntax or caller-provided endpoints.
    return url, parsed.path[1:-5]


QUERY = """query Pair($key: String!) {
  products(filter: {url_key: {eq: $key}}) {
    items {
      __typename sku name
      ... on ConfigurableProduct {
        variants {
          attributes {code label}
          product {
            sku stock_status
            price_range {minimum_price {final_price {value currency}}}
          }
        }
      }
    }
  }
}"""


def product_payload(data, binding, observed_at):
    url, _ = product_request(binding)
    if not isinstance(data, dict) or data.get("errors"):
        raise ValueError("ASICS product response unavailable")
    items = data.get("data", {}).get("products", {}).get("items", [])
    if len(items) != 1:
        raise ValueError("ASICS product identity is ambiguous")
    item = items[0]
    if (
        item.get("sku") != binding["article"]
        or item.get("name") != binding["sourceName"]
        or item.get("__typename") != "ConfigurableProduct"
    ):
        raise ValueError("ASICS article or model changed")
    sizes, seen = [], set()
    for variant in item.get("variants", []):
        labels = [
            a.get("label", "") for a in variant.get("attributes", []) if a.get("code") == "size"
        ]
        # ASICS explicitly labels both systems, e.g. US8/UK7. Never subtract 1 from a US size.
        if len(labels) != 1:
            continue
        match = re.fullmatch(r"US\d+(?:\.5)?/UK(\d+(?:\.5)?)", labels[0])
        if match is None:
            continue
        product = variant.get("product", {})
        sku = product.get("sku", "")
        if not isinstance(sku, str) or not sku.startswith(binding["article"] + "."):
            raise ValueError("ASICS variant article changed")
        price = product.get("price_range", {}).get("minimum_price", {}).get("final_price", {})
        if price.get("currency") != "INR":
            raise ValueError("ASICS variant currency is unconfirmed")
        try:
            value = Decimal(str(price.get("value")))
        except InvalidOperation:
            continue
        if not value.is_finite() or value <= 0 or value * 100 != (value * 100).to_integral_value():
            continue
        size = float(match[1])
        if size in seen:
            raise ValueError("ASICS size mapping is ambiguous")
        seen.add(size)
        stock = product.get("stock_status")
        sizes.append(
            dict(
                label="UK " + match[1],
                sku=sku,
                price=float(value),
                available=True
                if stock == "IN_STOCK"
                else False
                if stock == "OUT_OF_STOCK"
                else None,
            )
        )
    if not sizes:
        raise ValueError("No explicit ASICS UK variant evidence")
    return dict(
        id=binding["listingId"],
        brand="ASICS",
        name=item["name"],
        article_code=item["sku"],
        url=url,
        currency="INR",
        sizes=sizes,
        fetched_at=observed_at,
        cached=False,
    )


async def fetch_product(binding, transport=None):
    _, key = product_request(binding)
    async with httpx.AsyncClient(timeout=15, transport=transport, follow_redirects=False) as client:
        response = await client.get(
            "https://www.asics.co.in/graphql",
            params={
                "query": QUERY,
                "variables": json.dumps({"key": key}),
            },
        )
        response.raise_for_status()
        # If a CDN reports response age, do not label the cached body as newly observed.
        age = float(response.headers.get("age", "0"))
        if not math.isfinite(age) or age < 0 or age >= 172800:
            raise ValueError("ASICS response age is invalid or expired")
        observed = (datetime.now(UTC) - timedelta(seconds=age)).isoformat()
        return product_payload(response.json(), binding, observed)
