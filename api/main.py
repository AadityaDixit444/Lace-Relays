"""Run: python -m uvicorn api.main:app --host 127.0.0.1 --port 8000."""

import hmac
import json
import re

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from api.providers import RetailerClient
from api.service import PilotLimit, Service, SourcesUnavailable
from api.settings import ROOT, Settings
from api.storage import Store


def create_app(settings=None, service=None):
    settings = settings or Settings.load()
    catalog = json.loads((ROOT / "data/catalog.json").read_text(encoding="utf-8"))
    bindings = json.loads((ROOT / "data/retailer-bindings.json").read_text(encoding="utf-8"))
    service = service or Service(
        RetailerClient(settings.apish_key), Store(settings), bindings, catalog
    )
    app = FastAPI(
        title="LaceRelay API",
        version="0.2.0",
        docs_url=None if settings.production else "/docs",
        redoc_url=None,
    )
    app.state.service, app.state.settings = service, settings

    @app.middleware("http")
    async def headers(request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.exception_handler(HTTPException)
    async def http_error(request, error):
        return JSONResponse({"error": error.detail}, status_code=error.status_code)

    @app.exception_handler(PilotLimit)
    async def quota_error(request, error):
        return JSONResponse(
            {"error": "Pilot lookup allowance reached. Try later."}, status_code=429
        )

    @app.exception_handler(SourcesUnavailable)
    async def source_error(request, error):
        return JSONResponse(
            {"error": "Both stores are unavailable. Please try again."}, status_code=502
        )

    def authorize(request):
        if not settings.apish_key or not settings.pilot_token:
            raise HTTPException(
                503, "Live search is not connected yet. Explore the labelled preview collection."
            )
        supplied = request.headers.get("authorization", "").removeprefix("Bearer ")
        if not hmac.compare_digest(supplied.encode(), settings.pilot_token.encode()):
            raise HTTPException(401, "A valid pilot access token is required.")

    def shoe_for(shoe_id):
        shoe = next((s for s in catalog if s["id"] == shoe_id), None)
        if shoe is None:
            raise HTTPException(404, "Unknown shoe")
        return shoe

    async def observations(shoe_id=None):
        try:
            return {
                "observations": await service.store.read(shoe_id),
                "storage": service.store.mode,
            }
        except Exception:
            raise HTTPException(503, "Observation storage could not be loaded.") from None

    @app.get("/health")
    async def health():
        return {"status": "ok", "backend": "fastapi", "storage": service.store.mode}

    @app.get("/ready")
    async def ready():
        if service.store.mode == "unconfigured":
            raise HTTPException(503, "Persistent storage is not configured.")
        try:
            await service.store.read("__readiness__")
        except Exception:
            raise HTTPException(503, "Observation storage could not be loaded.") from None
        return {"status": "ready", "backend": "fastapi", "storage": service.store.mode}

    @app.get("/internal/refresh")
    async def scheduled_refresh(request: Request):
        if not settings.cron_secret:
            raise HTTPException(503, "Scheduled refresh is not configured.")
        supplied = request.headers.get("authorization", "").removeprefix("Bearer ")
        if not hmac.compare_digest(supplied.encode(), settings.cron_secret.encode()):
            raise HTTPException(401, "Scheduled refresh authorization is required.")
        if service.store.mode == "unconfigured":
            raise HTTPException(503, "Persistent storage is not configured.")
        try:
            result = await service.refresh_verified()
            return JSONResponse(result, status_code=200 if result["ok"] else 503)
        except PilotLimit:
            raise
        except Exception:
            raise HTTPException(503, "Scheduled refresh could not complete.") from None

    @app.get("/catalog")
    async def get_catalog():
        return await observations()

    @app.get("/shoes/{shoe_id}")
    async def get_shoe(shoe_id: str):
        shoe_for(shoe_id)
        return await observations(shoe_id)

    @app.post("/search")
    async def search(request: Request):
        authorize(request)
        chunks, length = [], 0
        async for chunk in request.stream():
            length += len(chunk)
            if length > 2048:
                raise HTTPException(413, "Request too large.")
            chunks.append(chunk)
        try:
            body = json.loads(b"".join(chunks))
        except (ValueError, UnicodeDecodeError):
            raise HTTPException(400, "Invalid request.") from None
        query = body.get("q") if isinstance(body, dict) else None
        if not isinstance(query, str):
            raise HTTPException(400, "Enter a shoe name between 3 and 100 characters.")
        query = re.sub(r"\s+", " ", query).strip()
        if not 3 <= len(query) <= 100 or re.search(r"[<>\x00-\x1f]", query):
            raise HTTPException(400, "Enter a shoe name between 3 and 100 characters.")
        return await service.search(query)

    @app.post("/shoes/{shoe_id}/refresh")
    async def refresh(shoe_id: str, request: Request):
        shoe = shoe_for(shoe_id)
        authorize(request)
        if service.store.mode == "unconfigured":
            raise HTTPException(503, "Persistent storage is not configured.")
        if not any(b.get("shoeId") == shoe_id and b.get("verified") for b in service.bindings):
            raise HTTPException(
                503, "No verified retailer listing is connected for this exact colourway yet."
            )
        try:
            sources = await service.refresh(shoe)
            return {"sources": sources, **await observations(shoe_id)}
        except PilotLimit:
            raise
        except Exception:
            raise HTTPException(503, "Refresh or storage unavailable.") from None

    return app


app = create_app()
