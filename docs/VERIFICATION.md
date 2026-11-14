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
