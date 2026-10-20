# Tasks

## 1. Application foundation

- [x] 1.1 Scaffold the Node.js LTS and TypeScript project with Express, express-session, required type packages, a lockfile, and build/typecheck/lint/test scripts; verify a clean install and successful build and typecheck.
- [x] 1.2 Separate application construction from startup and validate environment configuration, including the readable photo directory and password hash; verify unit tests reject missing or malformed settings and integration tests start with a temporary directory.
- [x] 1.3 Add a secret-free environment example, password-hash generation command, and local setup instructions to README; verify the documented commands start the app with generated test credentials.

## 2. Shared authentication

- [x] 2.1 Implement shared credential verification, escaped login form, generic failure messages, and session regeneration; verify HTTP integration tests cover successful and unsuccessful login and session identifier replacement.
- [x] 2.2 Implement bounded expiring session storage, eight-hour absolute expiry, production cookie attributes, protected route middleware, no-store responses, and POST logout; verify tests cover expired sessions, capacity, restart invalidation, logout, and unauthenticated page/image requests.
- [x] 2.3 Implement same-origin/CSRF checks and a bounded login limiter allowing ten attempts per client address per fifteen minutes; verify deterministic tests cover rejected foreign-origin submissions, the eleventh attempt, expiration, and untrusted forwarding headers.
- [x] 2.4 Document shared-account limitations, session lifetime, and credential rotation; verify README matches tested behavior and no credentials or session secrets appear in tracked examples or application output.

## 3. Photo search and delivery

- [x] 3.1 Implement normalization of trimmed one-to-four-digit strings; verify unit tests cover equivalent leading-zero inputs, 0 and 9999, whitespace, blank input, excess digits, signs, decimals, exponent notation, and traversal strings.
- [x] 3.2 Implement confined photo opening and streaming from a regular-file descriptor; verify integration tests with real temporary files cover exact PNG bytes and content type, missing files, read failures, non-regular files, and escaping symbolic links.
- [x] 3.3 Add the protected search form, result image, and validation/not-found/availability messages; verify HTTP tests cover each result and repeated searches, plus a browser check that the image appears below the form.
- [x] 3.4 Document filename conventions, directory configuration, and trusted atomic photo publication; verify examples match normalization tests and photos remain outside public static directories.

## 4. Deployment guidance and final integration

- [x] 4.1 Provide example service-manager and HTTPS reverse-proxy configuration and GCP VM operating instructions without provisioning infrastructure; verify configuration syntax where tooling is available and document loopback binding, trusted proxy scope, persistent photo storage, and rollback.
- [x] 4.2 Run all quality scripts, unit tests, and filesystem/HTTP integration tests from a clean build; verify the full login-search-display-logout flow and direct-image rejection with a browser or automated end-to-end check, recording any unavailable deployment checks.
