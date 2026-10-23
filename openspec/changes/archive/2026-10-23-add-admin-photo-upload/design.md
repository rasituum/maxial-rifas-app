# Design

## Context

See proposal.md for motivation. Existing Express routes in `src/app.ts` use a shared credential pair from `src/config.ts`; sessions in `src/state.ts` only carry an authentication timestamp. `src/photos.ts` validates four-digit filenames and opens regular files without following symbolic links. The global URL-encoded parser has a 4 kB limit and does not parse file uploads. Existing HTTP/filesystem tests and `scripts/browser-check.mjs` provide reusable integration coverage. No ADRs or upload/image-processing dependencies exist.

The VM service currently makes `/srv/maxial/photos` read-only through systemd. This must change for application-managed uploads. Existing lookup specs remain valid: newly uploaded images are simply additional private PNG files.

## Goals / Non-Goals

**Goals:** Reuse login and session management, enforce roles before reading upload bodies, support real iPhone HEIC content, bound processing cost, and publish only complete optimized images.

**Non-Goals:** Database-backed accounts, external conversion APIs, original-photo retention, batch processing, image editing, or distributed writers. Do not modify existing photos until a replacement is confirmed and ready to commit.

## Decisions

### Credentials and authorization

Retain `APP_USERNAME` and `APP_PASSWORD_HASH` for the consultation account. Add required `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH`, using existing scrypt hashing and validating distinct usernames. Both accounts use `/login`; derive the session role from matched server credentials, never from a form field. Regenerate sessions on login and keep existing eight-hour expiry, cookie policy, limiter, and logout behavior. A session missing a recognized role requires reauthentication. Restart on deployment clears old sessions.

Add reusable administrator middleware before multipart parsing. Consultation requests receive 403; anonymous requests redirect to login. Use existing same-origin protection for upload and confirmation POSTs. No account-management UI or separate administrator login is needed.

### Upload interface and endpoints

Add `GET /admin/upload` and `POST /admin/upload`. Show its link only to administrators. Provide one multipart form containing one number field, one file input labeled "Choose a file", and one upload button. Use an image selection hint such as `accept="image/*,.heic,.heif"` without a `capture` attribute or a separate camera control. The browser and operating system choose which native sources to offer, including camera and library where supported. Submit one selected photo through the same workflow regardless of its source; server-side format validation remains authoritative.

The form includes the existing numeric identifier, limits explanation, and validation feedback. A successful first upload redirects to the search result. When a target exists, show a separate page identifying its number, the current photo, the processed preview, and explicit confirm/cancel buttons. Confirmation and cancellation use POST routes under `/admin/upload/:token/`; previews require the owning administrator session. No staged file is exposed through the public filesystem.

### Multipart parsing and resource limits

Propose Busboy with its TypeScript declarations for streaming multipart parsing: Express does not supply this, and writing a parser manually would add unnecessary security-sensitive code. Configure one file, bounded field counts/lengths, 30,000,000 file bytes inclusive, and a total request ceiling of 30,065,536 bytes to allow multipart overhead. Count actual streamed bytes independently of Content-Length. Reject truncated, duplicate, extra-file, and malformed submissions; stop and remove temporary data on disconnect.

Use a private `.uploads` directory inside the resolved photo directory on the same filesystem, mode 0700, and random exclusive temporary filenames with mode 0600. Never reuse source names as paths. Validate staging directories against symlink substitution and treat the directory as application-controlled.

Planning defaults: one active upload/processing operation, no unbounded queue, a 120-second incoming-body timeout, 100,000,000 decoded pixels maximum, and a 60-second processing deadline. Run image decoding and transformation in a killable child process with one native processing thread. Kill and clean up on deadline. Return 503 with retry guidance when the processing slot or pending capacity is full. These limits bound work beyond the compressed 30 MB ceiling; high-resolution phone photos remain within the pixel default.

### Real HEIC decoding and proposed dependencies

Use Sharp for orientation, resizing, palette quantization, and PNG encoding. The standard prebuilt Sharp/libvips package does not provide HEIC/HEVC decoding. Install a pinned compatible system libvips with libheif and an HEVC decoder, then build Sharp against it, verifying the selected version's source-build instructions and minimum libvips version. Include a small redistributable real HEIC/HEVC fixture and decode it in a startup self-check; format metadata alone is not proof of HEVC support. Reject startup with an actionable operator message if the mandatory decoder is absent. The same environment must run HEIC integration tests; do not silently skip HEIC acceptance or substitute an AVIF fixture.

This adds native deployment prerequisites but keeps one image-processing API. A separate HEIC conversion service would add infrastructure; relying on the browser to convert would not meet direct HEIC upload support. Pin npm dependencies/lockfile and document OS package/build versions when implementing.

References: [Sharp custom libvips installation](https://sharp.pixelplumbing.com/install/#custom-libvips), [Sharp PNG and HEIF options](https://sharp.pixelplumbing.com/api-output/), and [Sharp metadata including HEIF compression](https://sharp.pixelplumbing.com/api-input/).

### Processing algorithm

Accept only successfully decoded PNG, JPEG, and HEIC/HEIF still-photo content; reject SVG, GIF, AVIF, and disguised non-image files. Inspect container codec information to distinguish HEIC/HEVC from AVIF. Select the primary image for HEIF containers; ignore auxiliary depth images and additional frames. Apply orientation once before resizing, normalize colour space to sRGB, and strip source EXIF/GPS metadata. Retain PNG transparency when present.

Interpret the agreed sizes as decimal bytes: input at most 30,000,000; output strictly below 100,000. Attempt PNG lossless compression first at maximum long edges of 2048, 1600, 1280, and 1024, always from the oriented source, with no enlargement or cropping. Stop at the first compliant result. If these dimension-only attempts fail, try palettes of 256, 128, then 64 colours at the 1024 long-edge bound. If necessary, repeat the palette attempts at 768, 512, and 320. Always cap size to the original dimensions and maintain proportions within integer-pixel rounding. Bound attempts by the processing deadline. Reject when none succeeds; never rename a noncompliant output into place. These are reviewable quality defaults rather than a promise that every possible image will be acceptable.

### Replacement and publication

For an absent target, publish the fully written, validated staged PNG with an atomic no-overwrite operation (same-filesystem hard link, then remove the temporary name). If another upload created the target meanwhile, require confirmation instead of overwriting.

For existing regular files, keep the processed image in private staging and create a random single-use confirmation token. Bind it to the session ID, normalized number, prepared-file identity, and SHA-256 of the current target opened without symlink following. Limit pending entries to ten overall, one per session, expiring after ten minutes. Starting another pending replacement discards that session's previous one. Clean pending state on logout, expiration, cancellation, restart, and failed preparation.

Serialize commits per number in the existing single application process. On confirm, recheck authentication, expiry, ownership, safe target type, and digest under the lock. If the target changed, do not commit: show the updated target and issue a fresh confirmation, retaining the prepared image only within its bounded lifetime. Only explicit consent for the latest target permits replacement. Flush the completed staged file before atomic rename over an unchanged target. Before the atomic commit, every failure preserves the old file; after commit, report success and invalidate the token. Readers holding an old descriptor can finish reading the previous image.

Other processes must not modify the photo directory while web uploads operate; operator imports require pausing the service. The per-number lock is intentionally scoped to the existing single-process deployment. Reject symlinks and non-regular destination entries; do not follow or overwrite them. Scan and remove only recognized application-owned staging files on startup, never arbitrary photos.

### Errors and observability

Return validation errors for unsupported/corrupt content or invalid numbers, 413 for excessive input, 403 for wrong-role access, 503 for capacity exhaustion, and a generic processing/storage error for failed conversion or commits. Confirmation conflicts return a fresh confirmation page without writing the target. Do not log passwords, original image bytes, confirmation tokens, or metadata. Log upload outcome, normalized number, and generic failure category for troubleshooting. Keep `Cache-Control: no-store` on pages, staged previews, and image responses.

## Risks / Trade-offs

- Native HEIC decoding varies with installed codecs -> require real-fixture startup and integration checks plus reproducible VM build documentation.
- 100 kB PNG output can lose substantial photo detail -> use dimension reduction before palettes, preview replacements, and reject if bounded attempts cannot satisfy the limit.
- Native picker options vary by browser and operating system -> leave capture mode unspecified, keep standard file selection available, and manually verify the picker on iPhone Safari without requiring identical source menus on every device.
- Decoding 30 MB sources can be expensive -> enforce streamed byte/pixel limits, serialize work, and kill the child process on timeout.
- Atomic replacement relies on one writer and one filesystem -> keep staging on the photo disk and require maintenance mode for external imports.
- Shared administrator credentials cannot attribute actions to a person -> accept this agreed first-version constraint; rotate credentials when access changes.

## Migration Plan

1. Build and test native decoding, including real HEIC fixtures, in the target Linux environment before rollout.
2. Back up existing photos. Configure distinct administrator credentials; retain consultation settings. Update `.env.example` and README without including real secrets.
3. Grant the service account write access only to its photo directory and staging. Replace the systemd read-only path with a narrowly scoped `ReadWritePaths=/srv/maxial/photos` while retaining the remaining hardening. Configure the proxy request ceiling to allow the bounded multipart request.
4. Restart to invalidate old sessions. Verify consultation-only access, the single administrator upload form and native picker, each input format, size boundaries, first upload, confirmation/cancel/conflict, and protected lookup.
5. Roll back the release and systemd write permissions if needed. Published PNG files remain compatible with the old application. Clear private staging with the application cleanup procedure; do not delete numbered photos. No database migration is needed.
