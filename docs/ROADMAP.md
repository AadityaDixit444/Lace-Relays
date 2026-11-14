# LaceRelay roadmap

## Implemented locally in this iteration

- Visual discovery: seven look tiles, manual multi-tags, independent ankle heights,
  OR looks + AND height/exact UK size/budget, unique counts, removable chips and
  return-state preservation.
- Size Tax: shared current eligibility, all-size benchmarks, explicit zero/tie,
  unavailable and only-one-priced-size states.
- All-size observations: variant-level normalization, durable local storage,
  Supabase migration/adapter, immutable snapshot deduplication and null legacy sizes.
- Shoe detail history: selected size default, up to three series, India-day lows,
  retailer/timestamp inspection, gaps/sold-out distinction and mobile all-size table.
- Labelled fixture journey and edge-case tests. No authenticated real-data journey.

## Next validation milestone

1. Configure provider credentials and verified mappings for two exact shoe listings.
2. Inspect actual source size systems, per-size price/stock and source fetch times.
3. Configure Supabase, apply the migration, test service-role privileges/RLS and
   verify observations persist across hosted executions.
4. Run the same discovery → size comparison → Size Tax → history journey with real
   observations. Monitor credit use and add durable quota controls before public access.
5. Review, approve GitHub push, and explicitly publish a new protected Vercel version.

## Remaining original roadmap / backlog

Source proof and authenticated two-store pilot are incomplete. Existing UI and
comparison foundations are implemented; broader matching and source overlap remain
to prove. Add retailers individually after verification. Real trending, accounts,
watchlists/alerts, community review, contribution rewards and funded vouchers remain
unchanged backlog ideas. FastAPI/SQLAlchemy is not required for this feature slice.
