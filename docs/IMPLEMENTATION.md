# LaceRelay private pilot

Template A is implemented in Next.js/React/TypeScript and Tailwind CSS. Collection
prices, availability, rankings and charts are explicitly illustrative. Bookmarks
and deal drafts stay in localStorage. Drafts are not submitted and earn no points.

## Live discovery

The server-only POST `/api/search` supports API.SH Myntra and Nykaa Fashion search.
Set `APISH_KEY` and a separate `PILOT_ACCESS_TOKEN` in the server environment.
Enter only the pilot access token in the search dialog, never the provider key.
Authenticated provider responses have not been tested. Search listings remain
unconfirmed for exact model, colour and size. Retailer links use allowed HTTPS hosts.

Next.js route handlers provide initial connectors without a second deployment.
The proposed FastAPI/SQLAlchemy/Supabase service is not implemented yet. Before a
public live launch, add durable observations, curated article/colourway matching,
size-detail verification, distributed rate limits and provider-credit accounting.
The current cache, request coalescing and 50-query cap are per server instance,
not global quota protection. Live access is token-gated for private pilot use.
Real price history requires persistent observations; the chart is a sample only.

## Develop and verify

Node.js 20.9+ and pnpm required. Run `pnpm install` and `pnpm dev`.
Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:security`,
`pnpm audit --prod`, and `pnpm build` before release.

## Vercel

Import the repository or run `pnpm dlx vercel --prod` after authentication.
Use the repository root and Next.js preset. No variables are required for the
design preview. Keep the deployment protected for the private pilot. Enable live
discovery only after setting both server variables and verifying actual responses.

## Image provenance

Product photos are local downloads from StockX CDN for the displayed models.
They are reference product photos, not original assets or an endorsement.
Obtain retailer-authorized assets or confirm licensing before commercial use.
