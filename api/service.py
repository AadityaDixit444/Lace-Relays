"""Retailer orchestration, bounded pilot lookups and immutable observation ingestion."""

import asyncio
import time
from datetime import UTC, datetime

from api.providers import IDENTITY, RETAILERS, freshness, normalize_detail, timestamp


class PilotLimit(Exception):
    pass


class SourcesUnavailable(Exception):
    pass


class Service:
    def __init__(self, provider, store, bindings, catalog, clock=time.time, call_limit=100):
        self.provider, self.store, self.bindings, self.catalog = provider, store, bindings, catalog
        self.clock, self.call_limit = clock, call_limit
        self.calls, self.cache, self.pending, self.refresh_pending = 0, {}, {}, {}
        self.scheduled_lock = asyncio.Lock()

    def reserve(self, count):
        if self.calls + count > self.call_limit:
            raise PilotLimit()
        self.calls += count

    async def search(self, query):
        name, now = query.lower(), self.clock()
        saved = self.cache.get(name)
        if saved and now - saved["at"] / 1000 < 86400:
            return dict(saved, cached=True)
        task = self.pending.get(name)
        if task is None:
            self.reserve(2)
            task = asyncio.create_task(self._search(query, now, saved))
            self.pending[name] = task
            task.add_done_callback(
                lambda done: (
                    self.pending.pop(name, None) if self.pending.get(name) is done else None
                )
            )
        return await asyncio.shield(task)

    async def _search(self, query, now, saved):
        names = list(RETAILERS)
        results = await asyncio.gather(
            *(self.provider.search(r, query) for r in names), return_exceptions=True
        )
        sources = [
            dict(
                retailer=r,
                status="failed"
                if isinstance(value, Exception)
                else "checked"
                if value
                else "no_matches",
            )
            for r, value in zip(names, results)
        ]
        if all(isinstance(value, Exception) for value in results):
            if saved and now - saved["at"] / 1000 < 172800:
                return dict(saved, stale=True, sources=sources)
            raise SourcesUnavailable()
        result = dict(
            at=int(now * 1000),
            listings=[p for value in results if not isinstance(value, Exception) for p in value],
            sources=sources,
            mode="live",
        )
        if len(self.cache) >= 50 and query.lower() not in self.cache:
            del self.cache[next(iter(self.cache))]
        self.cache[query.lower()] = result
        return result

    async def refresh(self, shoe):
        name = shoe["id"]
        task = self.refresh_pending.get(name)
        if task is None:
            task = asyncio.create_task(self._refresh(shoe))
            self.refresh_pending[name] = task
            task.add_done_callback(
                lambda done: (
                    self.refresh_pending.pop(name, None)
                    if self.refresh_pending.get(name) is done
                    else None
                )
            )
        return await asyncio.shield(task)

    async def _refresh(self, shoe):
        prior, now = await self.store.read(shoe["id"]), self.clock()
        selected = [b for b in self.bindings if b["shoeId"] == shoe["id"]]

        async def lookup(binding):
            identity = {key: shoe["id"] if key == "shoeId" else shoe[key] for key in IDENTITY}
            if not binding.get("verified") or any(binding.get(k) != identity[k] for k in IDENTITY):
                return dict(
                    retailer=binding["retailer"],
                    status="unverified",
                    limitation="Canonical identity is not verified.",
                )
            times = [
                timestamp(r["observedAt"])
                for r in prior
                if r["retailer"] == binding["retailer"]
                and r.get("listingId") == binding["listingId"]
                and all(r.get(k) == identity[k] for k in IDENTITY)
            ]
            latest = max(times, default=0)
            if latest and 0 <= now - latest < 86400:
                return dict(retailer=binding["retailer"], status="cached", limitation=None)
            self.reserve(1)
            try:
                raw = await self.provider.detail(binding)
                rows, limitation = normalize_detail(
                    raw, binding, shoe, datetime.fromtimestamp(self.clock(), UTC).isoformat()
                )
                await self.store.save(rows)
                return dict(
                    retailer=binding["retailer"],
                    status="checked" if rows else "no_evidence",
                    limitation=limitation,
                )
            except Exception:
                state = (
                    "stale"
                    if latest
                    and freshness(datetime.fromtimestamp(latest, UTC).isoformat(), now) != "expired"
                    else "failed"
                )
                return dict(
                    retailer=binding["retailer"],
                    status=state,
                    limitation="Refresh failed. Original source timestamps are preserved.",
                )

        return await asyncio.gather(*(lookup(b) for b in selected))

    async def refresh_verified(self):
        if self.scheduled_lock.locked():
            return {"ok": True, "status": "already_running", "results": []}
        async with self.scheduled_lock:
            verified = {b["shoeId"] for b in self.bindings if b.get("verified")}
            selected = [shoe for shoe in self.catalog if shoe["id"] in verified]
            # This serverless pilot has a bounded execution budget. Do not silently
            # skip additional pairs when a larger worker is needed.
            if len(selected) > 5:
                raise ValueError("Scheduled catalog exceeds pilot batch limit")
            results = []
            for shoe in selected:
                try:
                    sources = await self.refresh(shoe)
                    results.append({"shoeId": shoe["id"], "sources": sources})
                except PilotLimit:
                    raise
                except Exception:
                    results.append(
                        {
                            "shoeId": shoe["id"],
                            "sources": [
                                {"status": "failed", "limitation": "Scheduled refresh unavailable."}
                            ],
                        }
                    )
            ok = all(
                source["status"] in ("checked", "cached")
                for item in results
                for source in item["sources"]
            )
            return {"ok": ok, "status": "complete", "results": results}
