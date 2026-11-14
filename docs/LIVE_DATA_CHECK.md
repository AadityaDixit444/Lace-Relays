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
