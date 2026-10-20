# Implementation validation

Change: `add-authenticated-photo-lookup`.

Verified on 2026-10-20 with Node.js 24.22.0:

- Clean `npm ci --offline --ignore-scripts` from the committed lockfile succeeded; npm reported no known vulnerabilities.
- `npm run build`, `npm run typecheck`, `npm run lint`, and `git diff --check` passed.
- `npm test` passed all 12 tests, including real HTTP listeners, unreadable files, session expiration/capacity, restart invalidation, and symbolic links.
- The password-hash CLI produced the expected format, and the application started from a temporary environment file with generated credentials.
- `scripts/browser-check.mjs` passed in headless Chromium: login, a PNG decoded by the browser below the search form, missing-photo feedback, logout, protected direct image URL, and mobile width. Playwright and browser libraries were installed outside the project; they are not runtime dependencies.
- `openspec validate add-authenticated-photo-lookup --strict` passed.
- `systemd-analyze verify` passed for a temporary copy of the service with `/usr/bin/node` replaced by the Node executable installed on this development machine. The shipped example assumes `/usr/bin/node`; adapt it on the target VM if needed.

The browser check caught a form submission failure caused by `Referrer-Policy: no-referrer` suppressing the same-origin POST Origin header. The application now uses `same-origin`; the HTTP regression assertion and full browser journey passed afterward.

Not verified here: Caddy syntax (Caddy is not installed), actual service installation, GCP firewall configuration, live DNS/TLS issuance, and production disk permissions. Follow README deployment checks on the target VM. No GCP resources were created or modified.
