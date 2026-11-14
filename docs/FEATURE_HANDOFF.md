# Feature handoff

## Subsequent Python/FastAPI migration

The three-feature slice below was already pushed to develop and main. A subsequent
explicit architecture decision moves backend work into Python/FastAPI while
preserving the frontend and API response shapes.

- Backend: `api/main.py`, `api/service.py`, `api/providers.py`, `api/storage.py`,
  `api/settings.py`; local probes, fixture seeding, pinned dependencies and tests.
- Frontend bridge: `lib/backend-proxy.ts` and the existing four Next API routes.
- Shared metadata: `data/catalog.json`; user pilot requests in `data/pilot-requests.json`.
- Retired duplicate TS backend code and ported its tests to Python. Client-side
  price comparison/discovery/history functions remain TS for immediate UI updates.
- Checks: 8 Python tests, 11 TS tests, Ruff/ESLint, Next production build, source
  secret scan and Python dependency audit passed. Browser bundles contain no known
  configured credentials. One upstream TestClient/httpx deprecation warning remains.
- Real searches for all five names, four product details and the full local
  Next → FastAPI → retailer discovery path succeeded. Exact cross-store matching
  and hosted Supabase access are still unverified. See LIVE_DATA_CHECK.md.
- Supabase URL is saved locally, but the service-role entry is still empty on disk.
  The key must be saved locally and the SQL migration applied if the table is absent.

## Original three-feature slice

Implemented visual sneaker discovery, Size Tax and all-size price history on develop.

Verification: 18 automated tests, TypeScript/build, lint, source secret scan and production dependency audit pass. Browser fixture journey and typed search verified on desktop/mobile.

Real retailer-data flows verified: none. Provider credentials, verified bindings and hosted Supabase configuration remain required. Hosted SQL migration is supplied but not applied. Fixture data is isolated locally and hidden in production.

See VERIFICATION.md for flow evidence, IMPLEMENTATION.md for setup, PROJECT_BRAIN.md for decisions and ROADMAP.md for next steps.

## Files changed

- .env.example
- .gitignore
- README.md
- app/api/catalog/route.ts
- app/api/shoes/[id]/refresh/route.ts
- app/api/shoes/[id]/route.ts
- app/browse/page.tsx
- app/globals.css
- app/shoes/[id]/page.tsx
- components/browse.tsx
- components/price-history.tsx
- components/product-card.tsx
- components/shoe-detail.tsx
- components/site-header.tsx
- components/storefront.tsx
- components/use-observations.ts
- data/retailer-bindings.json
- docs/IMPLEMENTATION.md
- docs/PROJECT_BRAIN.md
- docs/ROADMAP.md
- docs/VERIFICATION.md
- lib/browse-state.ts
- lib/catalog.ts
- lib/ingestion.ts
- lib/observations.ts
- lib/storage.ts
- lib/styles.ts
- migrations/001_observations.sql
- package.json
- public/shoes/SOURCES.md
- public/shoes/basketball.jpg
- public/shoes/minimal.jpg
- public/shoes/skate.jpg
- public/shoes/trail.jpg
- scripts/security-check.mjs
- tests/features.test.ts
- tests/fixtures.ts
- tests/seed-fixtures.ts
- tests/storage-ingestion.test.ts
- tests/supabase-storage.test.ts
- app/layout.tsx
- docs/FEATURE_HANDOFF.md
