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

## Administrator upload validation — 2026-10-23

Change: `add-admin-photo-upload`.

- Built Sharp 0.35.5 from source against libvips 8.18.7 with libheif 1.21.2, libde265 1.0.16, PNG, JPEG, EXIF and palette quantization. Native libraries were built/extracted under `/tmp/maxial-native` because system installation required interactive sudo; the target VM still needs the documented native installation.
- A clean `npm ci --offline --ignore-scripts` followed by `npm explore sharp -- npm run build` succeeded. npm reported zero known vulnerabilities. TypeScript build/typecheck and ESLint passed.
- All 34 tests passed, including actual HEIC/HEVC decoding, primary-image selection with an auxiliary alpha image, HEIC/JPEG orientation, metadata stripping, PNG alpha, high-entropy optimization, strict byte limits, decoder absence, malformed/chunked/disconnected uploads, role enforcement, session revocation, private previews, confirmation conflicts, and storage failures.
- The complete Chromium journey passed after the clean install: consultation lookup, administrator camera/file controls, HEIC file selection, rendered optimized image, cancellation, replacement, renewed consent after another administrator's commit, and 375-pixel mobile layout. Camera hardware selection remains a physical-device rollout check.
- Caddy 2.6.2 validated the request-body limit configuration. systemd validation passed using a temporary copy with the Node executable path present on this development machine. No live VM service, DNS, TLS certificate or firewall changes were performed.
- OpenSpec strict validation and `git diff --check` passed. No `.env` credentials were read or changed. Existing user edits to `AGENTS.md` were preserved.

For local verification with this session's temporary native environment, source `/tmp/maxial-native/run.sh` before running npm commands. This temporary directory is not part of a release; use `docs/image-processing.md` for a durable installation. Configure distinct `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` values in your environment before starting the application.

### Single-picker simplification — 2026-10-23

The administrator page now uses one multipart form with one number field, one native file input labeled **Choose a file**, and one submit action. No capture mode is forced; source choices belong to the device's native picker. README and the iPhone rollout checklist were aligned.

A clean lockfile installation, HEIC-enabled Sharp rebuild, TypeScript build/typecheck, ESLint, all 34 tests, and the updated Chromium journey passed. Browser assertions verify the single form/input/submit control, absence of a capture attribute, 375-pixel layout, real HEIC uploads, cancellation, replacement, and conflict renewal. Physical iPhone source choices remain a device-specific rollout check.
