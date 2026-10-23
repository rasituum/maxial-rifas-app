# Tasks

## 1. Shared administrator authentication

- [x] 1.1 Add administrator username/password-hash configuration and validated session roles while retaining consultation credentials; verify configuration tests reject missing administrator settings and duplicate usernames and login tests cover both roles, bad credentials, regeneration, and missing-role sessions.
- [x] 1.2 Add administrator-only middleware before upload body parsing, keep consultation access to existing lookup, and reuse same-origin POST protection; verify HTTP tests cover anonymous redirects, consultation 403 responses, role-field tampering, administrator access, cross-origin rejection, expiry, and logout.
- [x] 1.3 Update environment examples and README for both shared accounts, credential rotation, and unchanged session lifetime; verify all documented variables match configuration tests and no real secrets are included.

## 2. Native image-processing foundation

- [x] 2.1 Add pinned Sharp and a compatible HEIC-enabled system libvips build with documented native prerequisites and a clean lockfile installation; verify PNG, JPEG, and a redistributable real HEIC/HEVC fixture decode in the documented Linux environment and record fixture provenance/license.
- [x] 2.2 Add a real HEIC startup decoding self-check and operator-facing failure message; verify startup tests fail with missing codec support and succeed with the required decoder, without silently skipping HEIC tests.
- [x] 2.3 Implement orientation, primary HEIF-image selection, sRGB conversion, source metadata removal, and bounded dimension-then-palette PNG optimization; verify real-image tests cover oriented JPEG/HEIC, auxiliary HEIF images, transparency, no crop/enlargement, integer-rounded aspect ratio, and output strictly below 100,000 bytes.
- [x] 2.4 Run processing in a killable child process with the specified pixel, concurrency, attempt, and time bounds; verify corrupt/deceptive images, unsupported formats, decoded-pixel excess, failed optimization, timeout termination, and slot release leave no published output.
- [x] 2.5 Document quality defaults, decimal byte limits, accepted formats, HEIC source-build commands, and runtime self-checks; verify documented processing examples produce decodable compliant PNGs using the real fixtures.

## 3. Bounded upload ingestion and publication

- [x] 3.1 Add Busboy and required types with authenticated streaming multipart ingestion into private exclusive staging files; verify HTTP/filesystem tests cover 30,000,000-byte acceptance, 30,000,001-byte rejection, missing/extra files, duplicate fields, malformed bodies, omitted or misleading Content-Length, request overhead, disconnects, and body timeout cleanup.
- [x] 3.2 Implement validated-number targeting and atomic no-overwrite first publication on the photo filesystem; verify existing lookup returns complete processed PNG bytes and tests reject traversal names, staging symlinks, unsafe targets, and concurrent target creation without overwriting.
- [x] 3.3 Implement private prepared-image state and previews bound to the administrator session with ten pending entries overall, one per session, and ten-minute expiry; verify capacity errors, preview authorization, new-pending replacement, expiry/logout/restart cleanup, and no consultation access to staged or original bytes.
- [x] 3.4 Implement explicit confirm/cancel publication with single-use tokens, target version checks, per-number serialization, and atomic replacement; verify confirm, cancel, replay, wrong-session access, stale target renewal, simultaneous confirmations, and storage/processing failure preserve the appropriate complete target.
- [x] 3.5 Document staging lifecycle, bounded errors, atomic publication, and the single-writer maintenance rule; verify failure tests match the documented preservation guarantees and upload logs omit tokens, passwords, and source metadata.

## 4. Administrator interface and deployment

- [x] 4.1 Replace the two upload forms with one administrator form containing one number field, one native file selector without a capture attribute, and one submit button; retain limits, success feedback, and accessible errors, and verify browser tests cover the single form, administrator visibility, consultation exclusion, file selection, mobile layout, and successful numeric lookup after upload.
- [x] 4.2 Add replacement preview, target number, and explicit confirm/cancel controls; verify a browser journey covers unchanged old-photo display before confirmation, successful replacement, cancellation, and conflict feedback without losing the prepared image prematurely.
- [x] 4.3 Update browser-test selectors, README, image-processing documentation, and the physical iPhone Safari checklist for the single native picker; verify automated journeys use real format fixtures and assert that capture is not forced, while documenting device-dependent camera/library choices separately.
- [x] 4.4 Update systemd write access only for the photo/staging directory and align proxy request limits with multipart overhead; verify configuration syntax where tools are available and document native codec installation, directory ownership, startup cleanup, migration, rollback, and any target-VM checks not executable locally.

## 5. Final integration verification

- [x] 5.1 Run clean dependency installation, build, typecheck, lint, the existing test suite, new native/HTTP/filesystem tests, and browser journeys; verify consultation behavior has no regressions, all supported formats publish private PNGs below the size ceiling, and record environment-specific validation limits.

## Workflow follow-up

- Before production rollout, execute the documented native-picker checklist on a physical iPhone Safari device and verify the target VM's HEIC decoder, disk permissions, HTTPS, and reverse-proxy limits.
- Review and archive the change after implementation checks are complete.
