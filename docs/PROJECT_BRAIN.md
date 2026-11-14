# LaceRelay project brain

## Confirmed direction

India online shoe comparison; INR, UK sizes and half sizes. Exact article,
colourway, edition and adult/kids range matter. Lavender Paper Template A remains
approved. Preserve the homepage/navigation and develop on `develop`; ask before
each GitHub push and before publishing to `main`.

## Current implementation

- Next.js/React/TypeScript/Tailwind; shared ProductCard, catalogue and sizing.
- Backend decision explicitly reconfirmed: Python + FastAPI. Next API routes only
  proxy; Python handles source requests, authentication, caching and persistence.
  Canonical catalogue metadata is shared JSON. Client-side presentation stays TS.
- Seven manually tagged style looks, independent ankle height, OR look matching
  and AND size/budget filtering. A shoe appears once. URL state survives returning
  from detail. No stock-confirmed offer means it cannot pass a size or budget filter.
- Size Tax is selected-size lowest minus lowest eligible size price. It is a size
  price difference, not a checkout surcharge. Ties, one-size and unavailable states
  are explicit. It uses exactly the same observations as store comparison.
- History stores all supplied UK-size observations, not only the searched size.
  India-day lows, missing gaps, observed sold-out states, evidence inspection,
  three-size comparisons and all-size mobile table are implemented.
- Source observation age controls 24-hour reuse and 48-hour ranking expiry.
  Cached responses without a source timestamp are not recorded again. Repeated
  snapshot IDs do not append history. Unknown legacy sizes remain null.
- SQLite local storage and Supabase REST server storage. Apply the additive SQL
  migration before hosted use. Raw service credentials stay server-side.

## Limits and evidence

Authenticated searches for the user's five requests and four retailer detail
responses succeeded. The local Next → FastAPI → both retailers search returned
24 unconfirmed Alleyoop candidates. Hosted Supabase and exact cross-store identity
remain unverified. Secrets belong only in ignored local/server configuration. Fixtures are in tests,
opt-in locally and hidden in production. The homepage preview is not a source of
observations. See VERIFICATION.md for tests and IMPLEMENTATION.md for setup.

## Backlog boundary

Accounts, synced watchlists, alerts, real trending metrics, community moderation,
points/redemption, extra retailers and distributed quota enforcement remain backlog.
No rewards, popularity metrics or savings claims should be invented.
