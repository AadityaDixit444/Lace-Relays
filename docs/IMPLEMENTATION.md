# LaceRelay private pilot

Template A is implemented in Next.js/React/TypeScript and Tailwind CSS. The existing
homepage collection and chart remain illustrative. New `/browse` and `/shoes/[id]`
views read stored observations only. Bookmarks and deal drafts stay in localStorage.
Drafts are not submitted and earn no points.

## Live discovery

The server-only POST `/api/search` supports API.SH Myntra and Nykaa Fashion search.
Set `APISH_KEY` and a separate `PILOT_ACCESS_TOKEN` in the server environment.
Enter only the pilot access token in the search dialog, never the provider key.
Authenticated provider searches and four detail responses have been tested. Search listings remain
unconfirmed for exact model, colour and size. Retailer links use allowed HTTPS hosts.

Python/FastAPI owns retailer connectors and storage. Next route handlers are thin
same-origin proxies to `LACERELAY_API_URL`. A separate Python service is now required.
Python SQLite preserves existing tables and snapshot hashes. Supabase REST uses the
existing additive SQL migration. Hosted Supabase is not authenticated-tested.
Manual retailer bindings explicitly fix article, colourway, edition and range.
Size-detail normalization records every supplied priced variant and preserves
unknown sizes. Bare labels are accepted only for mappings with a verified UK
size system. Missing size prices are not copied from a model-level price.
Before public live launch, configure real bindings, verify source responses and
add distributed rate limits and provider-credit accounting.
The current cache, request coalescing and 50-query cap are per server instance,
not global quota protection. Live access is token-gated for private pilot use.
Real history requires recorded observations. Detail history aggregates India-day
lows, shows gaps and sold-out states separately, and exposes retailer/timestamp
evidence. No interpolated values or fabricated days are stored. New comparisons,
budget filtering and Size Tax share the same exact-identity eligibility functions.
Latest stock evidence per retailer variant supersedes older stock evidence.

## Develop and verify

Node.js 24+, pnpm and Python 3.12+ required. Start FastAPI as documented in api/README.md,
then run `pnpm dev`. Python tests and lint are required alongside frontend checks.
Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:security`,
`pnpm audit --prod`, and `pnpm build` before release.

## Vercel

Import the repository or run `pnpm dlx vercel --prod` after authentication.
Use the repository root and Next.js preset. No variables are required for the
design preview. Keep the deployment protected for the private pilot. Enable live
discovery only after configuring server variables, applying the database migration,
verifying canonical retailer bindings and testing authenticated responses. Production
never serves fixture rows or uses local SQLite as persistent hosting storage.

## Image provenance

Product photos are local downloads from StockX CDN for the displayed models.
They are reference product photos, not original assets or an endorsement.
Obtain retailer-authorized assets or confirm licensing before commercial use.
