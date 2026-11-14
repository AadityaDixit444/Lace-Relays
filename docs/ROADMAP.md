# LaceRelay roadmap

## Verified and implemented

- Responsive approved Template A frontend, style discovery and independent ankle-height, UK-size and budget filters.
- Product magnifier, all-size observations, Size Tax and India-day price history with missing-day gaps.
- Python/FastAPI backend, Supabase persistence, source freshness and immutable observation deduplication.
- Private Myntra/Nykaa search; exact-pair refresh uses reviewed mappings rather than broad search matches.
- ASICS Classic CT S 1201B069.300 Verdigris/Cream: two verified sources, Nykaa Fashion and ASICS India. Fourteen real size observations are stored. UK 7 was observed at INR 3,500 and INR 3,499 respectively.
- Authenticated daily refresh route, production package preparation and hosted backend readiness checks.
- Separate Vercel backend and Next.js frontend with server-only authenticated communication; deployment protection stays enabled.

## Next priorities

1. Verify article/colour/edition evidence for the remaining Alleyoop, Precision 8 Low, Jordan 1 Mid SE and McLaren Speedcat references. Keep ambiguous candidates out of exact comparisons.
2. Observe the first automatic Vercel cron run and verify history grows from actual later observations. Add monitoring, durable quotas, distributed job leases and retries before broader public live access.
3. Repair the backend project's Vercel GitHub Login Connection before relying on automatic backend Git deployments. Direct deployments currently work; GitHub pushes still require per-push approval.
4. Expand retailer coverage one verified connector at a time, preserving explicit UK size, currency, stock and source-time evidence.

## Later backlog

Real trending, accounts, watchlists/alerts, community moderation, contribution rewards and funded vouchers remain future work. The original Python/FastAPI backend plan is in use. SQLAlchemy is optional; current persistence uses Supabase REST and local SQLite for development.
