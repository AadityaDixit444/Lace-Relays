# Live provider validation — 14 November 2026

## Verified

- API.SH key authenticates successfully. It was moved from tracked `.env.example`
  to ignored `.env.local`. It was not found in reachable Git history.
- All five user-requested queries were run against Myntra and Nykaa Fashion.
- Four detail calls returned actual size/stock/price fields for Alleyoop and ASICS
  candidates. Raw public responses are local under ignored `.data/`, not fixtures.
- Full local path: browser-facing Next endpoint → FastAPI → both retailer APIs
  returned HTTP 200 with 24 unconfirmed Alleyoop candidates.

## Exact matching is not yet verified

- “Nike Air Jordan” covers multiple models, editions, adult/kids and colourways.
- Nykaa Precision 8 query included Precision 7 products. Do not merge generations.
- McLaren Speedcat query returned unrelated jewellery on Nykaa. Do not treat these
  as shoes or as matches to generic PUMA Speedcat listings.
- The checked ASICS details were White on Myntra and Green on Nykaa. Prices cannot
  be compared as the same pair.
- The checked Alleyoop listings both say White but did not expose sufficient brand
  article evidence. No mapping has been marked verified from those names alone.
- Nykaa detail data omits currency in the checked response; that evidence is kept
  unknown until the mapping/source basis is verified, rather than silently ranking it.

User target: UK 7. Preferences mentioned: red/black and gold/black, not yet assigned
to individual models. Exact product links or per-shoe colourways are still needed.

## Hosted storage

Supabase project URL is configured locally. Its service-role credential was absent
at the latest on-disk check, despite user save confirmations. An empty entry was
added to the correct ignored file to make setup unambiguous. No migration was applied,
no hosted database access was claimed, and local storage remains SQLite.

The original SQL migration remains available. Apply it via the Supabase SQL editor
if the table is absent. Do not expose a general-purpose execute-SQL RPC to work
around missing management/database credentials.
