# Lace Relays

A shoe price comparison and discovery platform.

Deployment: https://lace-relays.vercel.app (Vercel sign-in required).

## Project Status

Approved Template A is implemented as a private web pilot. Visual style discovery,
exact-size budget filtering, Size Tax and persistent all-size price history are
implemented. Python/FastAPI now runs the backend. Authenticated API.SH discovery
works locally; exact cross-store identity and hosted Supabase access remain to
verify. The deployed URL above still serves the previously approved pilot; backend
migration changes are local until reviewed and published.

## Development

Requires Node.js 24+ and pnpm. Run `pnpm install`, then `pnpm dev`.
Open http://localhost:3000.

Also requires Python 3.12+ and a running FastAPI service. See [backend setup](api/README.md).
Next API routes proxy to `LACERELAY_API_URL`; retailer credentials and storage stay
in Python. The frontend remains React/Next.js/TypeScript/Tailwind.

The responsive Lavender Paper design uses Next.js, React, TypeScript and Tailwind.
The homepage's existing collection and illustration remain labelled sample data.
`/browse` offers seven manually tagged looks, OR style selection, AND height/size/
budget filters, removable chips and URL-persisted filters. `/shoes/[id]` shows
eligible retailer offers, Size Tax and daily history for up to three UK sizes,
with evidence inspection and a mobile-scrollable all-size table. These new views
never use homepage sample prices. Saved pairs and deal drafts stay on the device.

See [implementation notes](docs/IMPLEMENTATION.md) for live discovery setup,
current limitations, security checks and Vercel deployment.

See the [project brain](docs/PROJECT_BRAIN.md) and [roadmap](docs/ROADMAP.md).

## Price storage and live refresh

The Python service uses `.data/observations.sqlite` locally (ignored by Git). For hosting,
apply `migrations/001_observations.sql` to Supabase and configure `SUPABASE_URL`
and `SUPABASE_SERVICE_ROLE_KEY` server-side. Vercel never falls back to ephemeral
SQLite. Configure `APISH_KEY`, `PILOT_ACCESS_TOKEN` and manually verified canonical
retailer mappings in `data/retailer-bindings.json`. No keys belong in the browser.

`POST /api/shoes/{id}/refresh` proxies to FastAPI, which reuses source observations under 24 hours and
attempts refresh at 24 hours or later. Cached source times remain unchanged;
48-hour-old prices cannot rank, while history remains. Only a verified mapping
may provide exact identity. Bare size labels require a documented UK size system.
Unknown size, price or currency evidence never becomes a confirmed size price.

## Isolated UI test fixtures

Fixture generators live under `tests/`, separate from application data. For local
QA only, set `SHOW_TEST_FIXTURES=1` and `LACERELAY_DB_PATH=.data/qa-history.sqlite`,
run `pnpm exec tsx tests/seed-fixtures.ts`, then `pnpm dev` in that environment.
The UI labels those prices TEST FIXTURES. Stop that server after testing.
Normal browsing hides fixture rows, and production ignores the fixture flag.

## Verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:security`,
`pnpm audit --prod` and `pnpm build`.
