"""Amazon India selected-ASIN adapter. Sibling prices are never copied across sizes."""

import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from urllib.parse import urlparse


def source_url(binding):
    asin = binding.get("listingId", "")
    if not re.fullmatch(r"[A-Z0-9]{10}", asin):
        raise ValueError("Invalid Amazon ASIN")
    return "https://www.amazon.in/dp/" + asin


def product_payload(data, binding):
    url = source_url(binding)
    if not isinstance(data, dict):
        raise ValueError("Amazon product response unavailable")
    parsed = urlparse(data.get("url", ""))
    if (
        data.get("asin") != binding["listingId"]
        or data.get("parent_asin") != binding["parentAsin"]
        or data.get("domain") != "amazon.in"
        or parsed.scheme != "https"
        or parsed.netloc != "www.amazon.in"
        or parsed.path != urlparse(url).path
        or parsed.query
        or parsed.fragment
        or data.get("title") != binding["sourceTitle"]
    ):
        raise ValueError("Amazon marketplace or product identity changed")
    if not data.get("title", "").startswith("Nike ") or data.get("brand") not in (None, "Nike"):
        raise ValueError("Amazon brand contradicts the reviewed mapping")
    if data.get("currency") not in (None, "INR"):
        raise ValueError("Amazon source currency contradicts INR price")
    observed = data.get("fetched_at")
    if (
        not isinstance(observed, str)
        or datetime.fromisoformat(observed.replace("Z", "+00:00")).tzinfo is None
    ):
        raise ValueError("Amazon source observation time is missing")
    if type(data.get("cached")) is not bool:
        raise ValueError("Amazon cache provenance is missing")
    variants = data.get("variants", {})
    dimensions = variants.get("dimensions", [])
    if len(dimensions) != 2 or set(dimensions) != {"size_name", "color_name"}:
        raise ValueError("Amazon size and colour dimensions are unconfirmed")
    selected = [v for v in variants.get("asins", []) if v.get("asin") == binding["listingId"]]
    if len(selected) != 1 or len(selected[0].get("values", [])) != 2:
        raise ValueError("Amazon selected variant is ambiguous")
    attrs = dict(zip(dimensions, selected[0]["values"]))
    # The reviewed descriptor explicitly uses UK; never infer from a US size or sibling.
    if (
        attrs.get("size_name") != binding["sizeDescriptor"]
        or attrs.get("color_name") != binding["colorDescriptor"]
    ):
        raise ValueError("Amazon selected size or colour changed")
    size = re.fullmatch(r"(\d+(?:\.5)?) UK", attrs["size_name"])
    if not size:
        raise ValueError("Amazon size is not explicitly UK")
    text = data.get("price", "")
    if not isinstance(text, str) or not re.fullmatch(
        r"₹(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{2})*,[0-9]{3})(?:\.[0-9]{1,2})?", text.strip()
    ):
        raise ValueError("Amazon INR listed price is unconfirmed")
    try:
        price = Decimal(text.strip()[1:].replace(",", ""))
    except InvalidOperation as error:
        raise ValueError("Invalid Amazon price") from error
    if not price.is_finite() or price <= 0 or price * 100 > 2**53 - 1:
        raise ValueError("Invalid Amazon price")
    # Optional provider numeric value must agree with its currency-marked price.
    if data.get("price_value") is not None and Decimal(str(data["price_value"])) != price:
        raise ValueError("Amazon price fields disagree")
    availability = str(data.get("availability", "")).strip().lower().rstrip(".")
    available = (
        True
        if availability == "in stock"
        or re.fullmatch(r"only \d+ left in stock(?:[.!].*)?", availability)
        else False
        if availability in ("currently unavailable", "out of stock")
        else None
    )
    return dict(
        id=binding["listingId"],
        name=data["title"],
        brand="Nike",
        url=url,
        currency="INR",
        fetched_at=data.get("fetched_at"),
        cached=data.get("cached"),
        sizes=[
            dict(
                label="UK " + size[1],
                sku=binding["listingId"],
                price=float(price),
                available=available,
            )
        ],
    )
