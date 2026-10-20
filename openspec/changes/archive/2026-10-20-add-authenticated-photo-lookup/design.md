# Design

## Context

See proposal.md for motivation. The repository contains only project instructions, a minimal README, and OpenSpec configuration: no existing application, ADRs, tests, or framework constrain the implementation. The agreed runtime is Node.js with TypeScript on a single GCP VM, with photos uploaded beforehand.

## Goals / Non-Goals

**Goals:** Keep a single deployable application, make filesystem and authentication behavior independently testable, and prevent image access outside authenticated routes.

**Non-Goals:** Distributed sessions, an SPA, a database, image transformations, and provisioning GCP infrastructure.

## Decisions

### Server-rendered application

Use Express with TypeScript and simple escaped HTML views for login and search. Express is a proposed runtime dependency for routing and middleware; express-session with its types is proposed for session lifecycle rather than implementing session cookies from scratch. Use Node's built-in crypto for password hashing, filesystem APIs for photos, and test runner for automated tests. A frontend framework adds no benefit to these forms; raw HTTP would require more manual routing and cookie handling. Pin a supported Node LTS version and commit a dependency lockfile during implementation.

Separate configuration, authentication/session middleware, number normalization, filesystem lookup, HTTP views/routes, and process startup. Construct the application without binding a port so integration tests can use temporary directories and ephemeral listeners.

### Routes and search flow

- GET /login renders the form; POST /login verifies credentials and redirects to /.
- GET / renders the protected search page; a number query parameter displays a result or a validation/not-found/availability message.
- GET /photos/:number independently authenticates and validates before streaming a PNG. All equivalent valid identifiers normalize to the same filename.
- POST /logout invalidates the current session and redirects to login.

Do not mount the photo directory as static content. Use Cache-Control: no-store for protected pages and images. Use a descriptive image alternative text containing its number.

### Shared credentials and sessions

Configure a username, salted scrypt password hash, session secret, photo directory, port, and production mode through environment configuration. Provide an offline password-hash generation command; never commit a real password or secret. Reject missing or malformed required configuration on startup. Compare password hashes using timing-safe comparison and regenerate the session on login.

Use an explicit bounded in-process session store with eight-hour absolute expiry and periodic cleanup, rather than the library's default MemoryStore. Reject new sessions gracefully if the store reaches its configured capacity. Each browser has an independent session; restart clears all sessions, which is acceptable for the first single-process deployment. Production cookies use Secure, HttpOnly, and SameSite=Lax. Require same-origin checks/CSRF protection for login and logout POSTs. Rate-limit login to ten attempts per client address per fifteen minutes with bounded, expiring state; return 429 afterward. Only trust forwarding headers from the local reverse proxy.

### Number and file handling

Planning assumption: accept trimmed strings of one to four ASCII digits, including 0; reject longer strings even if leading zeros would reduce the value. Normalize with left padding, without accepting signs, decimals, exponent syntax, or separators.

Resolve the configured photo directory at startup and ensure it is readable. Only construct filenames from validated normalized numbers. Reject symbolic-link photo entries using no-follow file opening on the target Linux VM, and verify the opened descriptor refers to a regular file. Stream from that descriptor rather than reopening the path. Keep the photo directory writable only by trusted operators. Treat missing files as not found; treat permission or storage failures as internal errors and log diagnostic details without secrets.

### VM deployment

Run one application process under a service manager with an unprivileged OS account. Bind Node to loopback behind an HTTPS reverse proxy on the same VM; proxy configuration must not expose the photo directory. Mount or place photos on persistent VM storage outside the application release directory. Document configuration, credential rotation by restart, startup, and HTTPS verification in README. A separate database or object store is unnecessary for the agreed filesystem model.

## Risks / Trade-offs

- Shared credentials cannot identify or revoke one user -> accept for version one and rotate credentials when access changes.
- Restart clears sessions and the limiter -> document re-login and avoid multiple workers until a shared store is introduced.
- Large images consume bandwidth -> stream files; image resizing is outside this change.
- Files may change during reads -> use one opened descriptor; trusted upload operators should publish complete files with atomic rename.
- Initial numeric limits were proposed rather than explicitly confirmed -> record 0 through 9999 and one-to-four-digit input as reviewable planning defaults.

## Migration Plan

There is no existing application or data migration. Build and test the locked TypeScript project, configure the shared credentials and directory, install the service and HTTPS proxy on the VM, and verify login, a known photo, a missing photo, and unauthenticated direct-image rejection. Roll back by stopping the service or restoring the previous release; keep photo storage independent of releases.
