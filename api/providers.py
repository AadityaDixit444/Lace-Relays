"""API.SH retailer connectors and conservative size-level normalization."""

import hashlib
import json
import math
import re
from datetime import UTC, datetime
from urllib.parse import unquote, urlparse

import httpx

RETAILERS = {"Myntra": "myntra", "Nykaa Fashion": "nykaafashion"}
IDENTITY = ("shoeId", "brand", "article", "color", "edition", "range")


def timestamp(value):
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed.timestamp() if parsed.tzinfo else float("nan")
    except (ValueError, TypeError):
        return float("nan")


def freshness(value, now):
    age = now - timestamp(value)
    return (
        "expired"
        if not math.isfinite(age) or age < 0 or age >= 172800
        else "fresh"
        if age < 86400
        else "stale"
    )


def safe_url(value, retailer):
    if not isinstance(value, str):
        return None
    host = {
        "Myntra": "myntra.com",
        "Nykaa Fashion": "nykaafashion.com",
        "ASICS India": "asics.co.in",
    }.get(retailer)
    if host is None:
        return None
    try:
        u = urlparse(value)
        return (
            value
            if u.scheme == "https"
            and u.hostname in (host, "www." + host)
            and not u.username
            and not u.password
            else None
        )
    except ValueError:
        return None


def uk_size(value, system):
    text = str(value).strip()
    match = re.fullmatch(r"UK\s*(\d+(?:\.[05])?)", text, re.IGNORECASE)
    if match is None and system == "UK":
        match = re.fullmatch(r"(\d+(?:\.[05])?)", text)
    number = float(match[1]) if match else -1
    return number if 3 <= number <= 12 and number * 2 % 1 == 0 else None


def normalize_search(data, retailer):
    if not isinstance(data, dict) or not isinstance(data.get("products"), list):
        return []
    now = datetime.now(UTC).timestamp()
    observed = data.get("fetched_at") if math.isfinite(timestamp(data.get("fetched_at"))) else None
    if observed and freshness(observed, now) == "expired":
        return []
    listings = []
    for p in data["products"][:12]:
        if not isinstance(p, dict):
            continue
        url, price = safe_url(p.get("url"), retailer), p.get("price")
        if (
            not url
            or not isinstance(p.get("name"), str)
            or type(price) not in (int, float)
            or not math.isfinite(price)
            or price <= 0
            or p.get("currency", "INR") != "INR"
            or p.get("in_stock") is False
        ):
            continue
        listings.append(
            dict(
                id=f"{retailer}-{p.get('id')}",
                name=p["name"][:200],
                brand=p.get("brand", ""),
                price=price,
                retailer=retailer,
                url=url,
                sizeStatus="unconfirmed",
                observedAt=observed,
            )
        )
    return listings


def normalize_detail(data, binding, shoe, retrieved_at):
    identity = {key: shoe["id"] if key == "shoeId" else shoe[key] for key in IDENTITY}
    if not binding.get("verified") or any(binding.get(k) != identity[k] for k in IDENTITY):
        return [], "Exact identity has not been verified."
    if not isinstance(data, dict) or str(data.get("id")) != binding["listingId"]:
        return [], "Retailer listing identity changed."

    def code(value):
        return re.sub("[^a-z0-9]", "", value.lower())

    if isinstance(data.get("brand"), str) and code(data["brand"]) != code(binding["brand"]):
        return [], "Source brand contradicts the verified mapping."
    article = data.get("article_code", data.get("articleCode"))
    if isinstance(article, str) and code(article) != code(binding["article"]):
        return [], "Source article contradicts the verified mapping."
    url = safe_url(data.get("url"), binding["retailer"])
    if not url:
        return [], "Invalid retailer URL."
    # Reviewed mappings can require source evidence on every refresh. A similar
    # model name or a neighbouring colour code must never reuse the mapping.
    image_token = binding.get("articleImageToken")
    if image_token:
        images = data.get("images")
        if (
            code(image_token) != code(binding["article"])
            or not isinstance(images, list)
            or not any(
                isinstance(image, str)
                and re.search(
                    re.escape(image_token) + r"(?=[_\-./]|$)",
                    unquote(urlparse(image).path),
                    re.IGNORECASE,
                )
                for image in images
            )
            or code(str(data.get("brand", ""))) != code(binding["brand"])
            or code(str(data.get("color", data.get("colour", ""))))
            != code(binding.get("sourceColor", ""))
            or code(str(data.get("name", ""))) != code(binding.get("sourceName", ""))
        ):
            return [], "Source article, colour or model evidence changed; mapping needs review."
    currency = data.get("currency")
    if currency is None:
        currency = (
            binding["currency"]
            if binding.get("currency") == "INR" and binding.get("currencyEvidenceUrl") == url
            else "unknown"
        )
    source_time = (
        data.get("fetched_at") if math.isfinite(timestamp(data.get("fetched_at"))) else None
    )
    if data.get("cached") is True and not source_time:
        return [], "Cached source has no observation time; not recorded again."
    observed_at = source_time or retrieved_at
    if timestamp(observed_at) > timestamp(retrieved_at):
        return [], "Invalid future source timestamp."
    variants = data.get("sizes") or [None]
    if not isinstance(variants, list):
        return [], "Invalid size evidence."
    rows = []
    for item in variants:
        v = item if isinstance(item, dict) else {}
        label = v.get("label", v.get("size", item))
        size = uk_size(label, binding.get("sizeSystem")) if v else None
        price = v.get("price", data.get("price") if size is None else None)
        if (
            type(price) not in (int, float)
            or not math.isfinite(price)
            or price < 0
            or price * 100 > 2**53 - 1
        ):
            continue
        available = v.get("available", v.get("in_stock"))
        variant = str(v.get("sku", v.get("id", f"{binding['listingId']}:{label or 'unknown'}")))
        row = dict(
            identity,
            id="",
            listingId=binding["listingId"],
            variantId=variant,
            retailer=binding["retailer"],
            size=size,
            pricePaise=round(price * 100),
            currency=currency,
            stock="in_stock"
            if available is True
            else "out_of_stock"
            if available is False
            else "unknown",
            observedAt=observed_at,
            retrievedAt=retrieved_at,
            priceType="conditional"
            if data.get("price_type") == "conditional" or v.get("price_type") == "conditional"
            else "ordinary",
            match="exact",
            url=url,
            fixture=False,
        )
        row["id"] = hashlib.sha256(
            json.dumps(
                [row["shoeId"], row["retailer"], variant, size, observed_at], separators=(",", ":")
            ).encode()
        ).hexdigest()
        rows.append(row)
    limitation = (
        None
        if any(
            r["size"] is not None and r["stock"] != "unknown" and r["currency"] == "INR"
            for r in rows
        )
        else "No confirmed UK-size price and stock evidence."
    )
    return rows, limitation


class RetailerClient:
    def __init__(self, key, transport=None):
        self.key, self.transport = key, transport

    async def request(self, retailer, operation, **params):
        path = RETAILERS[retailer]
        async with httpx.AsyncClient(
            timeout=15, transport=self.transport, follow_redirects=False
        ) as client:
            response = await client.get(
                f"https://api.api.sh/{path}/v1/{operation}",
                params=params,
                headers={"x-api-key": self.key},
            )
            response.raise_for_status()
            return response.json()

    async def search(self, retailer, query):
        return normalize_search(await self.request(retailer, "search", q=query), retailer)

    async def detail(self, binding):
        if binding["retailer"] == "ASICS India":
            from api.asics import fetch_product

            return await fetch_product(binding, self.transport)
        parameter = "url" if binding["retailer"] == "Nykaa Fashion" else "id"
        return await self.request(
            binding["retailer"], "product", **{parameter: binding["listingId"]}
        )
