# Release verification — 14 November 2026

- TypeScript strict checking and production compilation pass.
- Lint passes with no warnings.
- Comparison tests cover exact UK sizes including half sizes, tied winners,
  unknown stock, conditional prices, invalid prices and 24/48-hour boundaries.
- API tests cover disabled live access, authentication, invalid input, partial
  provider failures, request coalescing, cached queries and error redaction.
- Provider fixtures do not constitute authenticated live API verification.
- Source heuristic secret scan passes. Production dependency audit reports no
  known vulnerabilities. These checks are not a penetration test or guarantee.
- Local production HTTP response: 200. Verified CSP, frame denial, MIME sniffing
  protection, referrer policy and camera/microphone/geolocation restrictions.
- Browser preview: desktop and mobile viewed; product images load; name search,
  pair selection and browser-local bookmarks verified.
- Final browser navigation to the separate production port was denied by the
  browser permission gate. Production HTTP and build checks passed, but a full
  production browser pass remains unverified.

Live data, durable history, accounts, community review and funded rewards are not
enabled. The site explicitly labels sample offers and charts. See IMPLEMENTATION.md.

## Vercel deployment

This deployment section describes the original pilot. Later backend changes are
local until explicitly reviewed and published.

- Production: https://lace-relays.vercel.app
- Deployment `dpl_YE1XnKwxsueHtGtDmdGsXkRvw1LU` reached READY.
- Authenticated deployment HTTP check returned 200 with the expected headers.
- Project Vercel authentication is configured for all deployments (`all`).
- The automation bypass created by `vercel curl` was revoked and verified absent.
- GitHub auto-linking is not configured: the Vercel account needs a GitHub login
  connection. Deployment used the CLI; no GitHub push was performed.

## Visual discovery / Size Tax / all-size history iteration

The initial release above is historical context. These additions are local on
`develop`, not deployed or pushed as part of this iteration.

- Browser fixture journey: Terrace + Skate → Low → UK 7 → ₹6,000 returned two
  unique matches. A lower price in another size did not qualify the Samba.
- Opened Palermo, compared stores, changed UK 7 to UK 8 and saw Size Tax change
  from ₹1,500 to ₹2,500 in the labelled fixture dataset.
- Compared UK 7 and UK 8 history, inspected Myntra/variant/timestamp evidence,
  and opened the all-size table. It scrolls inside its container on mobile.
- Returning to browsing preserved look, height, size and budget filters. Setting
  a ₹100 budget showed zero results; removing that chip restored results.
- Typed Dunk search on mobile and Samba search on desktop returned expected pairs.
  Desktop 1440px, mobile 390px and 320px geometry checks found no page overflow.
- Automated cases cover OR/AND filters, duplicate tags, half sizes, ties,
  unavailable and one-size states, expired/conditional/ambiguous offers, India-day
  aggregation, missing days, single points, later sold-out updates, all-size
  ingestion, durable reopen/deduplication, null legacy sizes and retailer timeout.
- SQLite persistence is exercised with isolated temporary databases. Supabase
  REST is tested with mocked responses; the hosted SQL migration is not applied.
- Real retailer-data flows verified: **none**. No provider credentials, verified
  retailer bindings or hosted database credentials were available. No fixture
  observations are imported by app code, and production hides fixture rows.

## Python/FastAPI migration

- Frontend APIs are thin proxies; retailer orchestration and SQLite/Supabase
  persistence have moved to Python. No competing TS backend fallback remains.
- Python checks cover auth, validation, bounded bodies, partial source failures,
  coalescing/cache, size-level normalization, legacy null sizes, timestamp expiry,
  storage persistence/deduplication, Supabase payload filtering and old Node hash
  compatibility. Frontend checks retain comparison/discovery/history coverage.
- Real searches and detail field inspection succeeded; see LIVE_DATA_CHECK.md.
  Exact cross-store matching and hosted Supabase access remain unverified.
- Python tests currently emit one upstream Starlette TestClient/httpx deprecation
  warning. The HTTPX backend requests and tests pass; it is not a failed check.
