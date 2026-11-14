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
- GET `/ready`: verifies that observation storage can be read.
- GET `/catalog`, GET `/shoes/{id}`: recorded observations, fixture-filtered.
- GET `/internal/refresh`: scheduler-only route, authenticated with a separate `CRON_SECRET`.
  Refreshes only verified catalog pairs; public search queries cannot add scheduled work.
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

## ASICS India source

`api/asics.py` reads public ASICS India configurable product data from a fixed
HTTPS endpoint. A reviewed product URL supplies a GraphQL variable, never an
arbitrary host or query. Exact parent and child SKU prefixes, model name, explicit
UK variant labels, INR currency and per-variant final prices are required. No US
size conversion, parent-price fallback or implied stock is used. CDN Age, when
present, is subtracted from the observation time. The source uses no API.SH key.

## Nike India source

`api/nike.py` parses the public product page's inert JSON state and Product
JSON-LD; it never executes retailer JavaScript or forwards any credentials. It
requires matching parent/child IDs and SKUs, article, colour, model and adult
subtitle, explicit UK variant labels, variant-level prices and INR evidence. Sold
out is a recorded state; it cannot set a lowest price. Missing or contradictory
identity, price, size or currency fields fail closed. Responses are bounded to
2 MB, redirects are rejected and CDN Age is preserved. The backend packager
includes this runtime module; deploying only the frontend does not update bindings.

## Hosting and scheduled refresh

The frontend and Python backend are separate Vercel projects. Prepare a clean
backend upload with `python scripts/prepare_backend.py`; it prints a new ignored
staging directory. Only runtime modules, pinned requirements and the two shared
catalog/mapping files are copied. Environment files, provider dumps, SQLite
files, tests and frontend assets are excluded. Link that directory to the backend
project, configure production secrets, and run `vercel --prod --yes` there.
The package uses an explicit Python builder and route to `api/main.py`, so it
does not inherit Next.js build settings. Do not deploy the repository root to the
backend project. Keep the existing root `.vercel` link for the Next.js project.

Backend environment: `APISH_KEY`, `PILOT_ACCESS_TOKEN`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `LACERELAY_ENV=production`.
Frontend environment: `LACERELAY_API_URL` (backend HTTPS origin), plus server-only
`LACERELAY_BACKEND_BYPASS_SECRET` for the protected Vercel backend. Never expose
these through NEXT_PUBLIC variables. The bypass header is attached only to Vercel
backend origins, never to the browser or retailer requests. Revoke/rotate the
backend automation credential in Vercel and update the frontend environment if
its trust changes. Deployment protection remains enabled on both projects.

Vercel invokes `/internal/refresh` at `0 1 * * *` (01:00 UTC / 06:30 IST), using its
CRON_SECRET bearer header. A manual hosted invocation has passed. Fresh source
observations are reused for 24 hours; a trigger does not manufacture a new history
point. The runner supports at most five verified pairs and returns 503 on batch
failure; it never deletes prior observations. Overlapping runs are coalesced within
one Python process. Cross-instance locking, durable monthly provider quotas,
monitoring and retries are still needed before scaling beyond the private pilot.
Vercel's schedule should be checked after its first automatic run; registration
and a successful manual invocation do not prove that a future trigger ran.
