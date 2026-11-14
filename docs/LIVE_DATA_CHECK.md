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

## Selected product references and image zoom

The five user-selected links and UK 7 preference are recorded in `data/pilot-requests.json`. Nike Precision 8 Low IH1104-003, Air Jordan 1 Mid SE IB7110-002, and ASICS Classic CT S 1201B069.300 have reference-page identity evidence. PUMA 309452 has Black-Bright Papaya on the reference page but needs the colour-specific suffix. The Amazon Alleyoop page could not be read. Neither Nike product ID resolved successfully through the Nykaa provider during this check; a shared numeric ID is not proof of a matching provider listing.

These are reference selections, not verified retailer bindings. `data/retailer-bindings.json` remains empty. No prices or size availability were copied from crawled pages into live observations, and no production observations were inserted. Cross-store article, colourway, edition and UK 7 evidence must be verified before enabling comparison.

Product detail pages now include a keyboard-accessible native image dialog, a movable 3x lens and a separate magnified pane. Desktop users move the pointer; touch users tap to open and drag the source; arrow keys move the lens. Escape and the close button dismiss the modal. Images reuse existing assets; resolution limits apply. Multi-angle thumbnails require real additional photographs and are not fabricated.

Verification: Supabase migration is now applied. FastAPI `/health` and `/shoes/samba-og` returned HTTP 200 in Supabase mode, and the Next.js `/api/shoes/samba-og` proxy returned HTTP 200 after correcting the local `LACERELAY_API_URL`. No credentials were changed or committed. The mobile-width browser check confirmed that the magnifier dialog opens, shows source and enlarged panes, accepts keyboard focus, and closes with Escape. Frontend tests (11), backend tests (8), lint, production build and source security scan passed; the Python test client has an upstream deprecation warning. Touch hardware dragging and desktop pointer tracking were not manually exercised.

## First verified live pair (14 November 2026)

The Nykaa connector used Myntra's `id` parameter incorrectly. Nykaa product detail requires `url` (a product URL or numeric ID), per https://api.sh/docs/nykaafashion-product. Fixed the adapter and added a transport regression test for both retailers.

ASICS Classic CT S, article **1201B069.300**, Verdigris / Cream, is now in the shared catalog as `asics-classic-ct-s-verdigris`. Verified Nykaa listing `27846642` calls the colour Aqua. Its product image includes the exact article `1201B069.300`; the official reference confirms the colour name. The Nykaa listing page explicitly shows INR currency and UK size labels. The previous green result `28371731` uses article `1201B069301` in its images and is excluded. Source evidence is stored alongside the binding in `data/retailer-bindings.json`.

Every refresh checks the mapped article image token, source model name, brand and colour. Changed or missing evidence rejects the mapping. Missing upstream currency can use the reviewed listing's INR evidence only when the source URL matches the currency evidence URL; an explicit upstream currency is never overridden. No catalog sample price was added for this live pair.

The full Next.js proxy → FastAPI → API.SH → Supabase path returned HTTP 200 and persisted seven real size observations, preserving the source timestamp. UK 7 was INR 3,500 and in stock at that observation. An immediate second refresh returned `cached`; an independent read returned the same seven records. These are real observations, not test fixtures. There is currently **one verified store**, so this does not establish a cross-store lowest price. The UI labels it as a tracked offer and explains limited coverage.

Remaining pair status:
- Alleyoop: black Nykaa and Myntra candidates found, but the user's Amazon reference article is still unverified. Do not assume article CJ0882-001 from the candidate photo alone.
- Precision 8 Low IH1104-003: Myntra candidates exist; full article/colour matching is pending. Nykaa's reference ID returns 404 even with the corrected parameter.
- Jordan 1 Mid SE IB7110-002: no verified listing. The reference ID returns 404 via Nykaa.
- PUMA 309452 Black-Bright Papaya: black and white Myntra candidates exist; exact colour article suffix is still unverified. The white candidate must not be linked to the black reference.

Product photos are original retailer assets saved locally for the catalog; no generated substitute photo is used. Secrets and raw provider payloads remain ignored and were not copied into catalog data.

Validation for this milestone: 10 Python tests and 11 TypeScript tests passed, including the Nykaa parameter regression and rejection of changed model/colour/article evidence. Ruff, ESLint, production build and source secret scan passed. Python still reports the upstream Starlette/httpx test-client deprecation warning. Browser QA at mobile width confirmed the exact article, loaded UK 7 offer, single-store coverage notice and the first actual history point. No backend deployment or GitHub push was performed.


## Two-store comparison and hosted refresh

Added the official ASICS India public product query as a second source for article
1201B069.300. Its configurable variant response explicitly labels US8/UK7, SKU
1201B069.300.8, INR 3,499 and IN_STOCK. The existing Nykaa record for the same UK 7
pair is INR 3,500. No US-to-UK subtraction or parent-price fallback is used. All
seven official size variants were saved alongside the seven Nykaa observations.
The first official request exposed a pre-existing timestamp bug: retrieval time
was captured before awaiting the retailer. It now records receive time, while
still rejecting genuine future timestamps; a regression test covers this.

Backend production: https://lace-relays-api.vercel.app
Backend inspected deployment: https://vercel.com/lace-relays/lace-relays-api/B79pcgsFk4Xja2R4AAnzRVv7jYC4
Frontend production: https://lace-relays.vercel.app
Frontend inspected deployment: https://vercel.com/lace-relays/lace-relays/2vMUFawBaycDC7Fkan1cJKx1gJsj

The backend uses an allowlisted deployment package and an explicit Python builder.
The frontend upload excludes root Python modules and all local environment,
virtualenv, database and provider dump files. Secrets were configured in hosting,
not in Git. A server-only backend automation credential lets the Next proxy call
the protected backend; both projects retain Vercel deployment protection.

Hosted checks passed: /health and /ready returned HTTP 200; backend observations
returned 14 persisted rows; the deployed frontend's /api/shoes/asics-classic-ct-s-verdigris
returned the same 14 rows and both UK 7 offers. The hosted /internal/refresh route
returned HTTP 200 with both sources cached, proving it reused fresh observations.
Its daily production cron is configured for 01:00 UTC (06:30 IST). The first future
automatic trigger has not been observed. Job locking and quotas are per process,
not distributed; stronger controls remain necessary before scaling the pilot.

Vercel's attempted backend GitHub connection failed because the account needs a
GitHub Login Connection. Direct CLI deployment succeeded. Git pushes remain
subject to explicit user approval and none was performed for this work.

Checks passed: 17 Python tests, 12 TypeScript tests, Ruff, ESLint, Next production
build, source secret scan, Python production dependency audit and Node production
audit. Neither audit found known vulnerabilities. The upstream Starlette/httpx
test-client deprecation warning remains. The final browser visual check was
blocked by the browser permission gate; no alternate browser access was attempted.
Hosted API verification completed before that denial. Four other selected pairs
still lack verified exact retailer mappings and are not claimed as connected.


## Nike reference tracking and clearer catalog search

The official Nike India pages expose inert `__PRELOADED_STATE__` JSON with product
and size-variant data. The new read-only adapter parses that JSON without executing
scripts. Parent ID/SKU, model, adult subtitle, Style and Colour Shown must match;
each child must repeat the article and colour, belong to that parent, and provide
its own explicit UK label and numeric price. JSON-LD must identify the same parent
SKU, canonical reference URL and INR currency. Parent sold-out status overrides
child availability; duplicate IDs/sizes, identity drift, missing currency, US-only
labels, redirects, overlarge pages and expired CDN ages fail closed. Source fetches
never receive provider credentials. No new dependencies were added.

New local catalog pairs:
- Nike Precision 8 Low IH1104-003, Black / White / Dusty Cactus: Nike India product
  27763049. Ten real size observations saved; UK 7 observed at INR 5,396, in stock.
- Air Jordan 1 Mid SE IB7110-002, Black / Light Wild Mango / Olive Grey: Nike India
  product 24889618. Seven real size observations saved; UK 7 observed sold out.
  Its listed INR 12,295 price is retained as evidence, never ranked as buyable.

Repeated refreshes used cached observations, and independent database reads
returned the same records. The local scheduler included all three verified pairs.
The additional observations are real Supabase records; they are not catalog sample
prices. The existing deployed API still needs the updated catalog/connector before
it can serve the new Nike detail routes.

Search now groups reviewed tracked pairs, design previews, unverified retailer
results and references awaiting matching. Verified pairs remain visible when live
search returns candidates. Word order, article punctuation and UK-size suffixes are
supported. Changing a query or closing the search dialog aborts stale discovery
requests. Detail pages show explicit sold-out evidence instead of claiming no data.
The local browser check confirmed the Precision UK 7 offer, the Jordan sold-out
state and search classification. The default homepage remains a labelled preview.

Remaining evidence gaps:
- Alleyoop: Amazon returned a verification challenge. User-provided identifier
  1624832 has not been verified as a manufacturer article; its field label was
  requested. It is searchable only as a pending reference, not a verified pair.
- PUMA: official page state confirms colour-specific article 309452_01, Black-Bright
  Papaya. Its separate public size query returned UNAUTHENTICATED; no authentication
  bypass was attempted and no UK 7 price or stock was inferred from the parent price.
- Myntra Precision candidates were checked, but none provided the exact article
  evidence needed for a second-store mapping. Similar names/colours were not promoted.

Validation: 30 Python tests and 14 TypeScript tests passed, along with Ruff, ESLint,
Next production build and secret scans. ESLint now excludes ignored provider dump
and virtualenv directories, rather than linting downloaded third-party scripts.
The upstream Starlette/httpx test-client deprecation warning remains. These changes
have not been pushed to GitHub or redeployed.
