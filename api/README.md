# LaceRelay FastAPI backend

Frontend: Next.js / React / TypeScript / Tailwind. Backend: Python 3.12+ / FastAPI /
HTTPX. Next API files are same-origin proxies only; they never call retailers or
store observations. Shared catalogue identities live in `data/catalog.json`.

## Local setup (repository root)

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r api/requirements-dev.txt
.venv/Scripts/python.exe -m uvicorn api.main:app --host 127.0.0.1 --port 8000
```

In another terminal run `pnpm dev`. `.env.local` needs
`LACERELAY_API_URL=http://127.0.0.1:8000`. FastAPI reads the same ignored local file.
Never put credentials in `.env.example`. Fill real values only in `.env.local`
or in hosting secrets. Restart FastAPI after changing credentials.

## Endpoints

- GET `/health`: service status and storage mode; no credentials.
- GET `/catalog`, GET `/shoes/{id}`: recorded observations, fixture-filtered.
- POST `/search`: authenticated, validated retailer discovery, concurrent lookups,
  partial results, shared in-flight requests and 24-hour query caching.
- POST `/shoes/{id}/refresh`: authenticated verified-listing refresh. All supplied
  size-level observations are stored. Source observations under 24 hours are reused;
  failed refreshes preserve timestamps. Rankings exclude 48h-old prices.

Live calls require `APISH_KEY` and the separate `PILOT_ACCESS_TOKEN`. They are never
returned by the API or included in settings repr/logging. HTTPX does not follow
upstream redirects. Search results are unconfirmed candidates, not exact matches.

## Storage and preservation

Python SQLite retains `shoe_observations(id, shoe_id, payload)`. No table is dropped
and no unknown size is reassigned. Snapshot hashing matches TypeScript, including
integral versus half-size UK values, so old records are not duplicated on migration.
Supabase uses the existing SQL migration and REST payload. Supply `SUPABASE_URL`
and `SUPABASE_SERVICE_ROLE_KEY`; the URL alone cannot authenticate database access.
Apply `migrations/001_observations.sql` in the Supabase SQL editor if the table is
absent. A service-role key is not a database password or Management API token and
cannot apply arbitrary SQL through the ordinary REST API.

Hosted production must set `LACERELAY_ENV=production` and use Supabase. It never
falls back to local SQLite or serves fixtures. Canonical mappings remain in
`data/retailer-bindings.json`; broad search hits cannot establish exact identity.

## Checks

```powershell
.venv/Scripts/python.exe -m pytest -q
.venv/Scripts/python.exe -m ruff check api
.venv/Scripts/python.exe -m pip_audit -r api/requirements.txt --no-deps --disable-pip
pnpm test
pnpm lint
pnpm test:security
pnpm build
```

Production and development dependency sets are pinned. Pilot call accounting is
per Python process (100 upstream requests), not a distributed monthly quota.
Add durable quota enforcement before public live access.

## Hosting

Run Python separately with the repository root as working directory, including
the shared `data/` files. Install `api/requirements.txt` and start
`uvicorn api.main:app --host 0.0.0.0 --port $PORT`. Configure production variables
on that service. Set Vercel's `LACERELAY_API_URL` to its HTTPS origin. This migration
has not deployed a Python backend; the existing website is unchanged.
